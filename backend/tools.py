"""Read-only catalogue and authentication tools available to the agent."""

from __future__ import annotations

import json
import logging
import re
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path

from pydantic_ai import Agent, RunContext

if __package__:
    from .audit import append_audit
    from .models import (
        AgentDependencies,
        AgentReply,
        AuthenticationStatus,
        CatalogueBatchSearchRequest,
        CatalogueBatchSearchResult,
        CatalogueSearchRequest,
        CatalogueSearchResult,
        ProductCard,
        ProductSizeStatus,
    )
else:
    from audit import append_audit
    from models import (
        AgentDependencies,
        AgentReply,
        AuthenticationStatus,
        CatalogueBatchSearchRequest,
        CatalogueBatchSearchResult,
        CatalogueSearchRequest,
        CatalogueSearchResult,
        ProductCard,
        ProductSizeStatus,
    )

logger = logging.getLogger("campus_customs.tools")
CATALOGUE_RETRY_ATTEMPTS = 2
CATALOGUE_FAILURE_MESSAGE = "I can’t load the product catalogue right now. Please try again shortly."


@dataclass(frozen=True)
class SearchableProduct:
    card: ProductCard
    search_tags: list[str]


def _decode_string_list(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return [value]
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, str)]


def _search_term_variants(term: str) -> set[str]:
    variants = {term}
    if len(term) > 4 and term.endswith("ies"):
        variants.add(term[:-1])
        variants.add(f"{term[:-3]}y")
    elif len(term) > 3 and term.endswith("s") and not term.endswith(("ss", "us")):
        variants.add(term[:-1])
    return variants


def _load_catalogue_products(database_path: Path) -> list[SearchableProduct]:
    database_uri = f"{database_path.resolve().as_uri()}?mode=ro"
    with sqlite3.connect(database_uri, uri=True, timeout=3) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            SELECT c.product_id, c.name, c.garment_type, c.description,
                   c.colors, c.search_tags, c.price, i.size, i.quantity
            FROM catalogue AS c
            LEFT JOIN inventory AS i ON i.product_id = c.product_id
            ORDER BY c.name, i.id
            """
        ).fetchall()

    products: dict[str, dict[str, object]] = {}
    for row in rows:
        product_id = str(row["product_id"])
        product = products.get(product_id)
        if product is None:
            colors = _decode_string_list(row["colors"])
            tags = _decode_string_list(row["search_tags"])
            product = {
                "product_id": product_id,
                "name": str(row["name"]),
                "garment_type": str(row["garment_type"] or ""),
                "description": str(row["description"] or ""),
                "price": float(row["price"]),
                "colors": colors,
                "tags": tags,
                "sizes": [],
            }
            products[product_id] = product

        if row["size"] is not None and row["quantity"] is not None:
            quantity = int(row["quantity"])
            product["sizes"].append(
                ProductSizeStatus(
                    size=str(row["size"]),
                    quantity=quantity,
                    in_stock=quantity > 0,
                )
            )

    return [
        SearchableProduct(
            card=ProductCard(
                product_id=product["product_id"],
                name=product["name"],
                garment_type=product["garment_type"],
                description=product["description"],
                price=product["price"],
                colors=product["colors"],
                sizes=product["sizes"],
            ),
            search_tags=product["tags"],
        )
        for product in products.values()
    ]


def _rank_product_matches(catalogue_products: list[SearchableProduct], query: str, limit: int) -> list[ProductCard]:
    terms = [_search_term_variants(term) for term in re.findall(r"[a-z0-9]+", query.casefold())]
    if not terms:
        return []

    ranked: list[tuple[int, ProductCard]] = []
    for searchable_product in catalogue_products:
        product = searchable_product.card
        searchable = " ".join(
            [
                product.product_id,
                product.name,
                product.garment_type,
                product.description,
                " ".join(product.colors),
                " ".join(searchable_product.search_tags),
            ]
        ).casefold()
        score = sum(1 for variants in terms if any(term in searchable for term in variants))
        if not score:
            continue
        ranked.append(
            (
                score,
                product,
            )
        )

    ranked.sort(key=lambda item: (-item[0], item[1].name.casefold()))
    return [match for _, match in ranked[: max(1, min(limit, 5))]]


def _load_catalogue_with_retry(database_path: Path) -> list[SearchableProduct]:
    for attempt in range(1, CATALOGUE_RETRY_ATTEMPTS + 1):
        try:
            return _load_catalogue_products(database_path)
        except sqlite3.Error as error:
            if attempt >= CATALOGUE_RETRY_ATTEMPTS:
                logger.warning(
                    "Catalogue lookup failed after %s attempts (%s).",
                    CATALOGUE_RETRY_ATTEMPTS,
                    type(error).__name__,
                )
                raise
            time.sleep(0.05 * attempt)
    return []


def _product_matches(database_path: Path, query: str, limit: int) -> list[ProductCard]:
    return _rank_product_matches(_load_catalogue_with_retry(database_path), query, limit)


def load_products_by_ids(database_path: Path, product_ids: list[str]) -> list[ProductCard]:
    """Reload trusted product cards for saved chat history or validated page context."""
    requested_ids = list(dict.fromkeys(product_ids))[:500]
    if not requested_ids:
        return []

    placeholders = ", ".join("?" for _ in requested_ids)
    database_uri = f"{database_path.resolve().as_uri()}?mode=ro"
    with sqlite3.connect(database_uri, uri=True, timeout=3) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            f"""
            SELECT c.product_id, c.name, c.garment_type, c.description,
                   c.colors, c.price, i.size, i.quantity
            FROM catalogue AS c
            LEFT JOIN inventory AS i ON i.product_id = c.product_id
            WHERE c.product_id IN ({placeholders})
            ORDER BY c.name, i.id
            """,
            requested_ids,
        ).fetchall()

    products: dict[str, dict[str, object]] = {}
    for row in rows:
        product_id = str(row["product_id"])
        product = products.get(product_id)
        if product is None:
            product = {
                "product_id": product_id,
                "name": str(row["name"]),
                "garment_type": str(row["garment_type"]),
                "description": str(row["description"]),
                "price": float(row["price"]),
                "colors": _decode_string_list(row["colors"]),
                "sizes": [],
            }
            products[product_id] = product

        if row["size"] is not None and row["quantity"] is not None:
            quantity = int(row["quantity"])
            product["sizes"].append(
                ProductSizeStatus(size=str(row["size"]), quantity=quantity, in_stock=quantity > 0)
            )

    return [
        ProductCard(
            product_id=products[product_id]["product_id"],
            name=products[product_id]["name"],
            garment_type=products[product_id]["garment_type"],
            description=products[product_id]["description"],
            price=products[product_id]["price"],
            colors=products[product_id]["colors"],
            sizes=products[product_id]["sizes"],
        )
        for product_id in requested_ids
        if product_id in products
    ]


def register_tools(agent: Agent[AgentDependencies, AgentReply]) -> None:
    @agent.tool
    def search_catalogue(
        ctx: RunContext[AgentDependencies],
        request: CatalogueSearchRequest,
    ) -> CatalogueSearchResult:
        """Search products by name or category and return database descriptions, prices, and exact stock per size."""
        try:
            results = _rank_product_matches(_load_catalogue_with_retry(Path(ctx.deps.database_path)), request.query, limit=5)
        except Exception as error:
            if not isinstance(error, sqlite3.Error):
                logger.warning("Catalogue search tool failed (%s).", type(error).__name__)
            ctx.deps.catalogue_error = CATALOGUE_FAILURE_MESSAGE
            append_audit(ctx.deps.audit_run_id, "search_catalogue", args={"query_length": len(request.query)}, result={"status": "unavailable", "error_type": type(error).__name__}, stop_reason="tool_error")
            return CatalogueSearchResult(
                matched_query=request.query,
                status="unavailable",
                error_message=CATALOGUE_FAILURE_MESSAGE,
            )
        ctx.deps.catalogue_error = None
        ctx.deps.catalogue_results.update({product.product_id: product for product in results})
        append_audit(ctx.deps.audit_run_id, "search_catalogue", args={"query_length": len(request.query)}, result={"status": "ok", "product_count": len(results)})
        return CatalogueSearchResult(matched_query=request.query, products=results)

    @agent.tool
    def search_catalogue_batch(
        ctx: RunContext[AgentDependencies],
        request: CatalogueBatchSearchRequest,
    ) -> CatalogueBatchSearchResult:
        """Search up to five related product queries from one catalogue and inventory database read."""
        try:
            catalogue_products = _load_catalogue_with_retry(Path(ctx.deps.database_path))
        except Exception as error:
            if not isinstance(error, sqlite3.Error):
                logger.warning("Batched catalogue search tool failed (%s).", type(error).__name__)
            ctx.deps.catalogue_error = CATALOGUE_FAILURE_MESSAGE
            append_audit(ctx.deps.audit_run_id, "search_catalogue_batch", args={"query_count": len(request.queries)}, result={"status": "unavailable", "error_type": type(error).__name__}, stop_reason="tool_error")
            return CatalogueBatchSearchResult(
                searches=[
                    CatalogueSearchResult(
                        matched_query=query,
                        status="unavailable",
                        error_message=CATALOGUE_FAILURE_MESSAGE,
                    )
                    for query in request.queries
                ]
            )

        ctx.deps.catalogue_error = None
        searches = [
            CatalogueSearchResult(
                matched_query=query,
                products=_rank_product_matches(catalogue_products, query, limit=5),
            )
            for query in request.queries
        ]
        ctx.deps.catalogue_results.update({
            product.product_id: product
            for search in searches
            for product in search.products
        })
        append_audit(ctx.deps.audit_run_id, "search_catalogue_batch", args={"query_count": len(request.queries)}, result={"status": "ok", "search_count": len(searches), "product_count": sum(len(search.products) for search in searches)})
        return CatalogueBatchSearchResult(searches=searches)

    @agent.tool
    def get_authentication_status(
        ctx: RunContext[AgentDependencies],
    ) -> AuthenticationStatus:
        """Check whether the current website visitor has a valid signed-in session."""
        append_audit(ctx.deps.audit_run_id, "get_authentication_status", args={}, result={"status": "ok", "authenticated": ctx.deps.authenticated})
        return AuthenticationStatus(authenticated=ctx.deps.authenticated)
