"""
Kuzo Platform — ARQ Worker Metrics Helpers

Provides:
  - job_timer()           – async context manager that records job duration and result
  - record_job_result()   – standalone helper for manual instrumentation
  - queue_depth_loop()    – background coroutine that periodically samples queue depth
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from app.core.metrics import (
    WORKER_ACTIVE_JOBS,
    WORKER_JOB_DURATION,
    WORKER_JOB_TOTAL,
    WORKER_QUEUE_DEPTH,
)

logger = logging.getLogger("kuzo.metrics.worker")


# ---------------------------------------------------------------------------
# job_timer — wrap any ARQ task body
# ---------------------------------------------------------------------------
@asynccontextmanager
async def job_timer(task_name: str) -> AsyncGenerator[None, None]:
    """Async context manager that instruments an ARQ job.

    Usage::

        async def my_task(ctx, payload):
            async with job_timer("my_task"):
                ...  # task body

    On exit it records:
      - WORKER_JOB_TOTAL  (task, status=success|failed)
      - WORKER_JOB_DURATION (task)
      - WORKER_ACTIVE_JOBS gauge
    """
    WORKER_ACTIVE_JOBS.inc()
    timer = asyncio.get_event_loop().time()
    status = "success"
    try:
        yield
    except Exception:
        status = "failed"
        raise
    finally:
        elapsed = asyncio.get_event_loop().time() - timer
        WORKER_JOB_TOTAL.labels(task=task_name, status=status).inc()
        WORKER_JOB_DURATION.labels(task=task_name).observe(elapsed)
        WORKER_ACTIVE_JOBS.dec()


# ---------------------------------------------------------------------------
# record_job_result — manual instrumentation for non-context-manager usage
# ---------------------------------------------------------------------------
def record_job_result(task_name: str, status: str, duration: float) -> None:
    """Record a job completion outside of the context manager.

    Parameters
    ----------
    task_name : str
        The ARQ task function name (e.g. ``"deploy_contract"``).
    status : str
        ``"success"`` or ``"failed"``.
    duration : float
        Wall-clock seconds the job took.
    """
    WORKER_JOB_TOTAL.labels(task=task_name, status=status).inc()
    WORKER_JOB_DURATION.labels(task=task_name).observe(duration)


# ---------------------------------------------------------------------------
# queue_depth_loop — background sampler
# ---------------------------------------------------------------------------
async def queue_depth_loop(
    redis_pool,
    queue_name: str = "arq:queue",
    interval: float = 15.0,
) -> None:
    """Periodically sample the ARQ queue depth and update the gauge.

    Parameters
    ----------
    redis_pool :
        An ``arq.connections.ArqRedis`` or ``redis.asyncio.Redis`` instance.
    queue_name : str
        The Redis key for the ARQ queue (default ``arq:queue``).
    interval : float
        Seconds between samples (default 15).
    """
    logger.info("queue_depth_loop started — sampling every %.1fs", interval)
    while True:
        try:
            depth = await redis_pool.zcard(queue_name)
            WORKER_QUEUE_DEPTH.set(depth)
        except Exception:
            logger.exception("Failed to sample queue depth")
        await asyncio.sleep(interval)
