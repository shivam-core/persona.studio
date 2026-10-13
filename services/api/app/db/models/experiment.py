"""Experiment models: preregistration, assignments, outcomes, and impact analysis."""

from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, DateTime, JSON, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base, generate_uuid


class Experiment(Base):
    __tablename__ = "experiments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True)
    campaign_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("campaigns.id"), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    audience_snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey("audience_snapshots.id"), index=True)
    offering_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="registered")  # registered, in_progress, outcomes_imported, analyzed
    preregistration_json: Mapped[dict] = mapped_column(JSON, default=dict)
    power_analysis_json: Mapped[dict] = mapped_column(JSON, default=dict)
    seed: Mapped[int] = mapped_column(Integer, default=42)
    allocation_ratio: Mapped[float] = mapped_column(Float, default=0.5)
    observation_window_days: Mapped[int] = mapped_column(Integer, default=30)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    assignments: Mapped[list["ExperimentAssignment"]] = relationship("ExperimentAssignment", back_populates="experiment", cascade="all, delete-orphan")
    outcomes: Mapped[list["ExperimentOutcome"]] = relationship("ExperimentOutcome", back_populates="experiment", cascade="all, delete-orphan")
    analyses: Mapped[list["ExperimentAnalysis"]] = relationship("ExperimentAnalysis", back_populates="experiment", cascade="all, delete-orphan")


class ExperimentAssignment(Base):
    __tablename__ = "experiment_assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    experiment_id: Mapped[str] = mapped_column(String(36), ForeignKey("experiments.id"), index=True)
    customer_id: Mapped[str] = mapped_column(String(100), index=True)
    stratum_persona_id: Mapped[str] = mapped_column(String(100))
    arm: Mapped[str] = mapped_column(String(20))  # treatment, control
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    experiment: Mapped["Experiment"] = relationship("Experiment", back_populates="assignments")

    __table_args__ = (
        Index("ix_exp_assign_composite", "experiment_id", "customer_id", unique=True),
    )


class ExperimentOutcome(Base):
    __tablename__ = "experiment_outcomes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    experiment_id: Mapped[str] = mapped_column(String(36), ForeignKey("experiments.id"), index=True)
    customer_id: Mapped[str] = mapped_column(String(100), index=True)
    converted: Mapped[bool] = mapped_column(Boolean, default=False)
    net_revenue: Mapped[float] = mapped_column(Float, default=0.0)
    variable_cost: Mapped[float] = mapped_column(Float, default=0.0)
    order_count: Mapped[int] = mapped_column(Integer, default=0)
    observation_end_at: Mapped[datetime] = mapped_column(DateTime)
    outcome_complete: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    experiment: Mapped["Experiment"] = relationship("Experiment", back_populates="outcomes")

    __table_args__ = (
        Index("ix_exp_outcome_composite", "experiment_id", "customer_id", unique=True),
    )


class ExperimentAnalysis(Base):
    __tablename__ = "experiment_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    experiment_id: Mapped[str] = mapped_column(String(36), ForeignKey("experiments.id"), index=True)
    method: Mapped[str] = mapped_column(String(100))  # stratified_bootstrap_itt, proportions_ztest, fishers_exact
    primary_metric: Mapped[str] = mapped_column(String(100), default="conversion_rate")
    effect_estimates_json: Mapped[dict] = mapped_column(JSON, default=dict)
    confidence_intervals_json: Mapped[dict] = mapped_column(JSON, default=dict)
    exploratory_strata_json: Mapped[list] = mapped_column(JSON, default=list)
    balance_checks_json: Mapped[dict] = mapped_column(JSON, default=dict)
    diagnostics_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    experiment: Mapped["Experiment"] = relationship("Experiment", back_populates="analyses")
