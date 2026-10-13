"""Dedicated analytics worker runner."""

import os
import signal
import sys
import time
import logging
from app.db.session import SessionLocal
from app.jobs.repository import (
    claim_next_job,
    update_job_heartbeat,
    complete_job,
    fail_job,
    cancel_job,
    check_job_cancellation,
)
from app.jobs.handlers import get_handler

# Set BLAS/OMP thread limits to avoid overloading
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] [Worker] %(message)s",
)
logger = logging.getLogger("worker")

_RUNNING = True


def _handle_shutdown(signum, frame):
    global _RUNNING
    logger.info("Worker shutdown requested via signal %s. Finishing current step...", signum)
    _RUNNING = False


signal.signal(signal.SIGINT, _handle_shutdown)
signal.signal(signal.SIGTERM, _handle_shutdown)


def run_worker_loop(poll_interval: float = 1.0):
    """Main worker loop that polls and executes background analytics jobs."""
    logger.info("Persona Studio Analytics Worker started. Polling for jobs...")

    while _RUNNING:
        try:
            with SessionLocal() as db:
                job = claim_next_job(db)
                if not job:
                    time.sleep(poll_interval)
                    continue

                logger.info("Claimed job %s (kind=%s, attempt=%d)", job.id, job.kind, job.attempt_count)
                handler = get_handler(job.kind)

                if not handler:
                    logger.error("No handler registered for job kind: %s", job.kind)
                    fail_job(db, job.id, "UNKNOWN_JOB_KIND", f"No handler registered for kind {job.kind}")
                    continue

                try:
                    result = handler(db, job)
                    if check_job_cancellation(db, job.id):
                        logger.info("Job %s was cancelled during execution", job.id)
                        cancel_job(db, job.id)
                    else:
                        complete_job(db, job.id, result_ref=result)
                        logger.info("Job %s completed successfully", job.id)
                except Exception as exc:
                    logger.exception("Job %s failed with exception: %s", job.id, exc)
                    fail_job(db, job.id, "EXECUTION_ERROR", str(exc))

        except Exception as loop_exc:
            logger.exception("Unexpected error in worker loop: %s", loop_exc)
            time.sleep(poll_interval)

    logger.info("Analytics Worker stopped gracefully.")


if __name__ == "__main__":
    run_worker_loop()
