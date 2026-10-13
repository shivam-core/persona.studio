"""Audience snapshots and members."""

from datetime import datetime
from sqlalchemy import String, Integer, Boolean, DateTime, JSON, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base, generate_uuid


class AudienceSnapshot(Base):
    __tablename__ = "audience_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True)
    feature_snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey("feature_snapshots.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    selected_persona_ids_json: Mapped[list] = mapped_column(JSON, default=list)
    total_members: Mapped[int] = mapped_column(Integer, default=0)
    evidence_eligible: Mapped[int] = mapped_column(Integer, default=0)
    objective_eligible: Mapped[int] = mapped_column(Integer, default=0)
    consent_eligible: Mapped[int] = mapped_column(Integer, default=0)
    excluded_count: Mapped[int] = mapped_column(Integer, default=0)
    final_planned_count: Mapped[int] = mapped_column(Integer, default=0)
    exclusions_summary_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    members: Mapped[list["AudienceMember"]] = relationship("AudienceMember", back_populates="audience_snapshot", cascade="all, delete-orphan")


class AudienceMember(Base):
    __tablename__ = "audience_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    audience_snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey("audience_snapshots.id"), index=True)
    customer_id: Mapped[str] = mapped_column(String(100), index=True)
    persona_id: Mapped[str] = mapped_column(String(36), index=True)
    population_type: Mapped[str] = mapped_column(String(50))
    channel_cell: Mapped[str] = mapped_column(String(100), default="default")
    is_eligible: Mapped[bool] = mapped_column(Boolean, default=True)
    exclusion_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)

    audience_snapshot: Mapped["AudienceSnapshot"] = relationship("AudienceSnapshot", back_populates="members")

    __table_args__ = (
        Index("ix_aud_mem_composite", "audience_snapshot_id", "customer_id", unique=True),
    )
