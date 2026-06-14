import asyncio
import logging
from collections import deque
from typing import AsyncGenerator

_log_buffer: deque[str] = deque(maxlen=50)
_subscribers: list[asyncio.Queue] = []


class SSELogHandler(logging.Handler):
    """Feeds every log record into the in-memory buffer and all live SSE queues."""

    def emit(self, record: logging.LogRecord) -> None:
        line = self.format(record)
        _log_buffer.append(line)
        dead: list[asyncio.Queue] = []
        for q in list(_subscribers):
            try:
                q.put_nowait(line)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            try:
                _subscribers.remove(q)
            except ValueError:
                pass


def get_log_buffer() -> list[str]:
    return list(_log_buffer)


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue[str] = asyncio.Queue(maxsize=200)
    _subscribers.append(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    try:
        _subscribers.remove(q)
    except ValueError:
        pass


async def log_event_stream() -> AsyncGenerator[str, None]:
    # Replay buffered history first so the client sees context immediately.
    for line in get_log_buffer():
        yield f"data: {line}\n\n"

    q = subscribe()
    try:
        while True:
            try:
                line = await asyncio.wait_for(q.get(), timeout=20.0)
                yield f"data: {line}\n\n"
            except asyncio.TimeoutError:
                # SSE comment keeps the connection alive through proxies/load balancers.
                yield ": keepalive\n\n"
    except asyncio.CancelledError:
        pass
    finally:
        unsubscribe(q)
