"""FastAPI entry point for the Campus Customs chat API."""

from __future__ import annotations

import logging
import json
import os
import sqlite3
from uuid import uuid4
from pathlib import Path
from typing import TypedDict

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from pydantic_ai.messages import ModelRequest, ModelResponse, TextPart, UserPromptPart
from pydantic_ai.usage import UsageLimits

if __package__:
    from .audit import append_audit
    from .agent import AgentConfigurationError, get_agent
    from .models import (
        AgentCustomer,
        AgentDependencies,
        ChatHistoryMessage,
        ChatHistoryResponse,
        ChatPageContext,
        ChatRequest,
        ChatResponse,
        ChatTurn,
    )
    from .tools import load_products_by_ids
else:
    from audit import append_audit
    from agent import AgentConfigurationError, get_agent
    from models import (
        AgentCustomer,
        AgentDependencies,
        ChatHistoryMessage,
        ChatHistoryResponse,
        ChatPageContext,
        ChatRequest,
        ChatResponse,
        ChatTurn,
    )
    from tools import load_products_by_ids


ROOT = Path(__file__).resolve().parents[1]
DATABASE_PATH = ROOT / "data" / "campus_customs.db"
AUTH_API_URL = os.environ.get(
    "AUTH_API_URL",
    f"http://127.0.0.1:{os.environ.get('AUTH_PORT', '8001')}",
).rstrip("/")
AUTH_COOKIE_NAME = "campus_customs_session"
DISPLAY_HISTORY_LIMIT = 100
AGENT_HISTORY_LIMIT = 12
logger = logging.getLogger("campus_customs.chat")
AGENT_REQUEST_LIMIT = 8
AGENT_TOOL_CALLS_LIMIT = 6

app = FastAPI(title="Campus Customs Chat API", version="1.0.0")


class VerifiedVisitor(TypedDict):
    user_id: int
    name: str
    email: str


def _history_to_model_messages(history: list[ChatTurn]) -> list[ModelRequest | ModelResponse]:
    messages: list[ModelRequest | ModelResponse] = []
    for turn in history[-12:]:
        if turn.role == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=turn.content)]))
        else:
            messages.append(ModelResponse(parts=[TextPart(content=turn.content)]))
    return messages


def _stored_product_ids(products_json: str | None) -> list[str]:
    if not products_json:
        return []
    try:
        payload = json.loads(products_json)
    except (json.JSONDecodeError, TypeError):
        return []

    if isinstance(payload, dict):
        payload = payload.get("product_ids", payload.get("products", []))
    if not isinstance(payload, list):
        return []

    product_ids: list[str] = []
    for item in payload:
        product_id = item if isinstance(item, str) else item.get("product_id") if isinstance(item, dict) else None
        if isinstance(product_id, str) and product_id and product_id not in product_ids:
            product_ids.append(product_id)
    return product_ids[:5]


def _read_chat_rows(user_id: int, limit: int) -> list[sqlite3.Row]:
    with sqlite3.connect(DATABASE_PATH, timeout=5) as connection:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA busy_timeout = 5000")
        rows = connection.execute(
            """
            SELECT id, role, content, products_json, created_at
            FROM chat_messages
            WHERE user_id = ? AND role IN ('user', 'assistant')
            ORDER BY id DESC
            LIMIT ?
            """,
            (user_id, limit),
        ).fetchall()
    return list(reversed(rows))


def _load_saved_chat_messages(user_id: int, limit: int = DISPLAY_HISTORY_LIMIT) -> list[ChatHistoryMessage]:
    rows = _read_chat_rows(user_id, limit)
    product_ids = [
        product_id
        for row in rows
        if row["role"] == "assistant"
        for product_id in _stored_product_ids(row["products_json"])
    ]
    cards_by_id = {
        card.product_id: card
        for card in load_products_by_ids(DATABASE_PATH, product_ids)
    }

    messages: list[ChatHistoryMessage] = []
    for row in rows:
        content = str(row["content"] or "")
        if not content.strip():
            continue
        product_cards = [
            cards_by_id[product_id]
            for product_id in _stored_product_ids(row["products_json"])
            if row["role"] == "assistant" and product_id in cards_by_id
        ]
        messages.append(
            ChatHistoryMessage(
                id=int(row["id"]),
                role=row["role"],
                content=content,
                products=product_cards,
                created_at=str(row["created_at"]),
            )
        )
    return messages


def _load_agent_history(user_id: int) -> list[ChatTurn]:
    rows = _read_chat_rows(user_id, AGENT_HISTORY_LIMIT)
    return [
        ChatTurn(role=row["role"], content=str(row["content"] or "")[:1_500])
        for row in rows
        if str(row["content"] or "").strip()
    ]


def _save_chat_exchange(user_id: int, user_message: str, assistant_message: str, product_ids: list[str]) -> None:
    with sqlite3.connect(DATABASE_PATH, timeout=5) as connection:
        connection.execute("PRAGMA busy_timeout = 5000")
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'user', ?, NULL)",
            (user_id, user_message),
        )
        connection.execute(
            "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'assistant', ?, ?)",
            (user_id, assistant_message, json.dumps(product_ids, ensure_ascii=False)),
        )


def _validated_page_context(page_context: ChatPageContext) -> ChatPageContext:
    if page_context.page != "product-detail" or page_context.product_id is None:
        return ChatPageContext(page=page_context.page)
    if not load_products_by_ids(DATABASE_PATH, [page_context.product_id]):
        return ChatPageContext(page="product-detail")
    return page_context


async def _verified_visitor(request: Request) -> VerifiedVisitor | None:
    session_token = request.cookies.get(AUTH_COOKIE_NAME)
    if not session_token:
        return None

    try:
        async with httpx.AsyncClient(timeout=3) as client:
            response = await client.get(
                f"{AUTH_API_URL}/api/auth/me",
                headers={"Cookie": f"{AUTH_COOKIE_NAME}={session_token}"},
            )
    except httpx.RequestError as error:
        logger.warning("Could not contact the auth API (%s).", type(error).__name__)
        raise HTTPException(status_code=503, detail="Authentication is temporarily unavailable.") from None

    if response.status_code == 401:
        return None
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Authentication is temporarily unavailable.")

    try:
        payload = response.json()
    except ValueError:
        raise HTTPException(status_code=503, detail="Authentication is temporarily unavailable.") from None
    user = payload.get("user") if isinstance(payload, dict) else None
    if not isinstance(user, dict):
        raise HTTPException(status_code=503, detail="Authentication is temporarily unavailable.")

    user_id = user.get("id")
    name = user.get("name")
    email = user.get("email")
    if type(user_id) is not int or not isinstance(name, str) or not name.strip() or not isinstance(email, str) or not email.strip():
        raise HTTPException(status_code=503, detail="Authentication is temporarily unavailable.")
    return {"user_id": user_id, "name": name.strip(), "email": email.strip()}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/chat/history", response_model=ChatHistoryResponse)
async def chat_history(request: Request, response: Response) -> ChatHistoryResponse:
    visitor = await _verified_visitor(request)
    response.headers["Cache-Control"] = "no-store"
    if visitor is None:
        return ChatHistoryResponse(authenticated=False)

    try:
        messages = _load_saved_chat_messages(visitor["user_id"])
    except sqlite3.Error as error:
        logger.warning("Could not load saved chat history (%s).", type(error).__name__)
        raise HTTPException(status_code=503, detail="Saved chat history is temporarily unavailable.") from None
    return ChatHistoryResponse(authenticated=True, messages=messages)


@app.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest, request: Request, response: Response) -> ChatResponse:
    visitor = await _verified_visitor(request)
    authenticated = visitor is not None
    try:
        agent = get_agent()
    except AgentConfigurationError:
        raise HTTPException(
            status_code=503,
            detail="The chat assistant is not configured on the server.",
        ) from None

    try:
        page_context = _validated_page_context(payload.page_context)
        history = _load_agent_history(visitor["user_id"]) if visitor is not None else payload.history
    except sqlite3.Error as error:
        logger.warning("Could not load chat context (%s).", type(error).__name__)
        raise HTTPException(status_code=503, detail="Chat context is temporarily unavailable.") from None

    dependencies = AgentDependencies(
        database_path=str(DATABASE_PATH),
        authenticated=authenticated,
        audit_run_id=uuid4().hex,
        customer=(AgentCustomer(name=visitor["name"], email=visitor["email"]) if visitor else None),
        page_context=page_context,
    )
    append_audit(
        dependencies.audit_run_id,
        "agent.run",
        args={"phase": "start", "message_length": len(payload.message), "history_count": len(history), "authenticated": authenticated},
        result={"status": "started"},
    )
    try:
        result = await agent.run(
            payload.message,
            deps=dependencies,
            message_history=_history_to_model_messages(history),
            usage_limits=UsageLimits(request_limit=AGENT_REQUEST_LIMIT, tool_calls_limit=AGENT_TOOL_CALLS_LIMIT),
        )
    except Exception as error:
        append_audit(
            dependencies.audit_run_id,
            "agent.run",
            args={"phase": "finish"},
            result={"status": "error", "error_type": type(error).__name__},
            stop_reason=type(error).__name__,
        )
        logger.warning("Chat agent request failed (%s).", type(error).__name__)
        raise HTTPException(status_code=502, detail="The assistant could not respond right now.") from None

    model_responses = [message for message in result.new_messages() if isinstance(message, ModelResponse)]
    finish_reason = model_responses[-1].finish_reason if model_responses else None
    append_audit(
        dependencies.audit_run_id,
        "agent.run",
        args={"phase": "finish"},
        result={"status": "ok", "model_requests": result.usage.requests, "product_matches": len(result.output.product_matches)},
        stop_reason=finish_reason or "completed",
    )

    product_cards = []
    seen_product_ids: set[str] = set()
    for match in result.output.product_matches:
        if match.product_id in seen_product_ids:
            continue
        product = dependencies.catalogue_results.get(match.product_id)
        if product is None:
            continue
        seen_product_ids.add(match.product_id)
        product_cards.append(product)
    chat_response = ChatResponse(
        reply=dependencies.catalogue_error or result.output.reply,
        authenticated=authenticated,
        products=[] if dependencies.catalogue_error else product_cards,
    )
    response.headers["Cache-Control"] = "no-store"
    if visitor is not None:
        try:
            _save_chat_exchange(
                visitor["user_id"],
                payload.message,
                chat_response.reply,
                [product.product_id for product in chat_response.products],
            )
        except sqlite3.Error as error:
            logger.warning("Could not save chat history (%s).", type(error).__name__)
            raise HTTPException(status_code=503, detail="The response could not be saved to chat history.") from None
    return chat_response
