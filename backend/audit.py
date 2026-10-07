"""Bounded, append-only JSON audit records for chat agent runs."""

from __future__ import annotations

import fcntl
import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, TypedDict


AUDIT_PATH = Path(__file__).resolve().parents[1] / "output" / "audit_trail.json"
LOCK_PATH = Path(tempfile.gettempdir()) / "campus_customs_audit_trail.lock"


class AuditRecord(TypedDict):
    time: str
    run_id: str
    tool_name: str
    args: dict[str, int | str | bool]
    result: dict[str, int | str | bool]
    stop_reason: str | None


def append_audit(
    run_id: str,
    tool_name: Literal["agent.run", "search_catalogue", "search_catalogue_batch", "get_authentication_status"],
    *,
    args: dict[str, int | str | bool],
    result: dict[str, int | str | bool],
    stop_reason: str | None = None,
) -> None:
    """Append a record without accepting raw chat, product text, or credentials."""
    record: AuditRecord = {
        "time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run_id": run_id,
        "tool_name": tool_name,
        "args": args,
        "result": result,
        "stop_reason": stop_reason,
    }
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOCK_PATH.open("a+b") as lock_file:
        fcntl.flock(lock_file, fcntl.LOCK_EX)
        try:
            if AUDIT_PATH.exists():
                previous = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
                if not isinstance(previous, list):
                    raise ValueError("Audit trail must contain a JSON array.")
            else:
                previous = []
            previous.append(record)
            temporary_path: Path | None = None
            try:
                with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=AUDIT_PATH.parent, delete=False) as temporary:
                    temporary_path = Path(temporary.name)
                    json.dump(previous, temporary, ensure_ascii=False, indent=2)
                    temporary.write("\n")
                    temporary.flush()
                    os.fsync(temporary.fileno())
                os.replace(temporary_path, AUDIT_PATH)
            finally:
                if temporary_path is not None:
                    temporary_path.unlink(missing_ok=True)
        finally:
            fcntl.flock(lock_file, fcntl.LOCK_UN)
