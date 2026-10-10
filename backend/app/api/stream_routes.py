import asyncio

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app import domain as d, events
from app.auth.security import current_user
from app.models import User

router = APIRouter(tags=["Sự kiện trực tiếp"])


def channels_for(user: User) -> list[str]:
    ch = [events.KITCHEN, events.SERVER]
    if user.has(d.STOREKEEPER, d.MANAGER):
        ch.append(events.STORE)
    if user.has(d.MANAGER):
        ch.append(events.MANAGER)
    return ch


@router.get("/events")
async def stream(request: Request, user: User = Depends(current_user)):
    """Server-Sent Events: danh sách món của bếp, thông báo phục vụ, cảnh báo quản lý."""
    q = events.subscribe(channels_for(user))

    async def gen():
        try:
            yield "retry: 3000\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            events.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
