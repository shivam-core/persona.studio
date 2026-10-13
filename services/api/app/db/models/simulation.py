"""Simulation and allocation persistence models."""

from datetime import datetime
from sqlalchemy import String, Float, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base, generate_uuid


class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True)
    campaign_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("campaigns.id"), nullable=True, index=True)
    scenario_name: Mapped[str] = mapped_column(String(50), default="base")  # conservative, base, optimistic, custom
    delivery_model: Mapped[str] = mapped_column(String(50), default="paid_cpc")  # paid_cpc, direct_outreach
    inputs_json: Mapped[dict] = mapped_column(JSON, default=dict)
    expected_outputs_json: Mapped[dict] = mapped_column(JSON, default=dict)
    uncertainty_outputs_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AllocationRun(Base):
    __tablename__ = "allocation_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True)
    campaign_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("campaigns.id"), nullable=True, index=True)
    total_budget: Mapped[float] = mapped_column(Float)
    fixed_cost: Mapped[float] = mapped_column(Float, default=0.0)
    method: Mapped[str] = mapped_column(String(50), default="marginal_contribution")
    cells_json: Mapped[list] = mapped_column(JSON, default=list)
    results_json: Mapped[dict] = mapped_column(JSON, default=dict)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
