"""Bus sự kiện trong tiến trình cho SSE.

Sự kiện được gom vào session và chỉ phát sau khi transaction commit thành công, để màn hình
không thấy trạng thái chưa ghi sổ. Bus chạy trong một tiến trình (uvicorn 1 worker); muốn chạy
nhiều worker thì chuyển sang Postgres LISTEN/NOTIFY.
"""

import asyncio
import json
import threading
from typing import Any

from sqlalchemy import event
from sqlalchemy.orm import Session

KITCHEN = "kitchen"
SERVER = "server"
MANAGER = "manager"
STORE = "store"

_lock = threading.Lock()
_subscribers: dict[str, set[asyncio.Queue]] = {}
_loop: asyncio.AbstractEventLoop | None = None


def bind_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def subscribe(channels: list[str]) -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=200)
    with _lock:
        for ch in channels:
            _subscribers.setdefault(ch, set()).add(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    with _lock:
        for subs in _subscribers.values():
            subs.discard(q)


def _deliver(channel: str, payload: str) -> None:
    with _lock:
        targets = list(_subscribers.get(channel, ()))
    for q in targets:
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass


def publish_now(channel: str, kind: str, data: dict[str, Any] | None = None) -> None:
    payload = json.dumps({"channel": channel, "kind": kind, "data": data or {}}, default=str)
    if _loop is None or _loop.is_closed():
        return
    _loop.call_soon_threadsafe(_deliver, channel, payload)


def emit(db: Session, channel: str, kind: str, data: dict[str, Any] | None = None) -> None:
    """Đăng ký một sự kiện, phát ra sau khi commit."""
    db.info.setdefault("pending_events", []).append((channel, kind, data))


@event.listens_for(Session, "after_commit")
def _after_commit(session: Session) -> None:
    for channel, kind, data in session.info.pop("pending_events", []):
        publish_now(channel, kind, data)


@event.listens_for(Session, "after_rollback")
def _after_rollback(session: Session) -> None:
    session.info.pop("pending_events", None)
