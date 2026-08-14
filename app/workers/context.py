"""
Kuzo Platform — ARQ Worker Context

Initialises shared resources on worker startup:
  - Redis / ARQ connection pool
  - Database session factory
  - BUILD_INFO metric
  - queue_depth_loop background task
"""

import asyncio
import logging
import os

from app.core.metrics import BUILD_INFO
from app.core.metrics_worker import queue_depth_loop

logger = logging.getLogger("kuzo.worker.context")

# ---------------------------------------------------------------------------
# Version metadata — read from env or fallback
# ---------------------------------------------------------------------------
SERVICE_NAME = os.getenv("KUZO_SERVICE_NAME", "kuzo-worker")
SERVICE_VERSION = os.getenv("KUZO_VERSION", "0.1.0")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")


async def startup(ctx: dict) -> None:
    """ARQ ``on_startup`` hook.

    Called once when the worker process starts.  Sets up shared
    resources that every task can access through ``ctx``.
    """
    logger.info("Worker starting — %s v%s", SERVICE_NAME, SERVICE_VERSION)

    # -- Prometheus build info ------------------------------------------------
    BUILD_INFO.info({
        "version": SERVICE_VERSION,
        "service": SERVICE_NAME,
    })

    # -- Redis pool (arq already gives us one in ctx["redis"]) ----------------
    redis_pool = ctx.get("redis")

    # -- Background task: queue depth sampler ----------------------------------
    if redis_pool is not None:
        loop_task = asyncio.create_task(
            queue_depth_loop(redis_pool, queue_name="arq:queue", interval=15.0)
        )
        ctx["_queue_depth_task"] = loop_task
        logger.info("queue_depth_loop launched")
    else:
        logger.warning("No redis pool in ctx — queue_depth_loop skipped")


async def shutdown(ctx: dict) -> None:
    """ARQ ``on_shutdown`` hook.

    Cancels background tasks and closes connections cleanly.
    """
    logger.info("Worker shutting down")

    # Cancel the queue depth sampler
    loop_task = ctx.get("_queue_depth_task")
    if loop_task is not None:
        loop_task.cancel()
        try:
            await loop_task
        except asyncio.CancelledError:
            pass
