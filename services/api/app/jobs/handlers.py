"""Worker job handlers implementation for dedicated background processing."""

import logging
from typing import Callable, Any
from sqlalchemy import select
from sqlalchemy.orm import Session
import pandas as pd

from app.db.models.job import Job
from app.db.models.dataset import DatasetVersion, UploadFile as DBUploadFile
from app.db.models.features import FeatureSnapshot, CustomerFeature
from app.db.models.segmentation import SegmentationRun, SegmentMembership
from app.db.models.persona import PersonaCard, EvidenceMetric
from app.domain.data.generator import generate_retail_demo_dataset, DEFAULT_AS_OF
from app.domain.validation.engine import validate_tables
from app.domain.features.engine import build_features
from app.domain.segmentation.engine import fit_candidates
from app.domain.evidence.engine import build_persona_evidence
from app.domain.simulation.engine import SimulationInputs, simulate_expected
from app.domain.simulation.monte_carlo import simulate_uncertainty
from app.domain.optimization.engine import AllocationCellInput, allocate_budget
from app.domain.experiments.engine import assign_experiment, analyze_experiment
from app.storage.adapter import storage

logger = logging.getLogger("worker.handlers")

_HANDLERS: dict[str, Callable[[Session, Job], dict[str, Any]]] = {}


def register_handler(kind: str):
    def decorator(fn: Callable[[Session, Job], dict[str, Any]]):
        _HANDLERS[kind] = fn
        return fn
    return decorator


def get_handler(kind: str) -> Callable[[Session, Job], dict[str, Any]] | None:
    return _HANDLERS.get(kind)


@register_handler("test_job")
def handle_test_job(db: Session, job: Job) -> dict[str, Any]:
    return {"processed": True, "input": job.input_json}


@register_handler("seed_demo")
def handle_seed_demo(db: Session, job: Job) -> dict[str, Any]:
    from app.api.routes.demo import seed_synthetic_demo_pipeline
    return seed_synthetic_demo_pipeline(db)


@register_handler("monte_carlo")
def handle_monte_carlo(db: Session, job: Job) -> dict[str, Any]:
    inp = SimulationInputs(**job.input_json.get("inputs", {}))
    draws = job.input_json.get("draws", 1000)
    seed = job.input_json.get("seed", 42)
    res = simulate_uncertainty(inp, seed=seed, draws=draws)
    return res.model_dump()


@register_handler("allocation")
def handle_allocation(db: Session, job: Job) -> dict[str, Any]:
    cells = [AllocationCellInput(**c) for c in job.input_json.get("cells", [])]
    total_budget = job.input_json.get("total_budget", 10000.0)
    fixed_cost = job.input_json.get("fixed_cost", 0.0)
    res = allocate_budget(cells, total_budget=total_budget, fixed_cost=fixed_cost)
    return res.model_dump()
