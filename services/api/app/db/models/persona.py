"""Persona cards and evidence metrics."""

from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, DateTime, JSON, ForeignKey, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base, generate_uuid


class PersonaCard(Base):
    __tablename__ = "persona_cards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True)
    segmentation_run_id: Mapped[str] = mapped_column(String(36), ForeignKey("segmentation_runs.id"), index=True)
    segment_ordinal: Mapped[int] = mapped_column(Integer)
    stable_segment_id: Mapped[str] = mapped_column(String(100), index=True)
    display_name: Mapped[str] = mapped_column(String(255))
    summary_text: Mapped[str] = mapped_column(Text)
    audience_count: Mapped[int] = mapped_column(Integer)
    audience_share: Mapped[float] = mapped_column(Float)
    population_type: Mapped[str] = mapped_column(String(50))
    color_hex: Mapped[str] = mapped_column(String(20), default="#5146D9")
    behavioral_glyph: Mapped[str] = mapped_column(String(50), default="chart-bar")
    evidence_coverage_badge: Mapped[str] = mapped_column(String(50), default="Strong")  # Strong, Partial, Limited
    claims_json: Mapped[list] = mapped_column(JSON, default=list)
    hypotheses_json: Mapped[list] = mapped_column(JSON, default=list)
    missing_evidence_json: Mapped[list] = mapped_column(JSON, default=list)
    fingerprint_json: Mapped[dict] = mapped_column(JSON, default=dict)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    text_provenance: Mapped[str] = mapped_column(String(50), default="template")  # template, ai
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    evidence_metrics: Mapped[list["EvidenceMetric"]] = relationship("EvidenceMetric", back_populates="persona_card", cascade="all, delete-orphan")


class EvidenceMetric(Base):
    __tablename__ = "evidence_metrics"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_uuid)
    persona_card_id: Mapped[str] = mapped_column(String(36), ForeignKey("persona_cards.id"), index=True)
    stable_segment_id: Mapped[str] = mapped_column(String(100), index=True)
    metric_key: Mapped[str] = mapped_column(String(100), index=True)
    display_label: Mapped[str] = mapped_column(String(255))
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(50))  # fraction, currency, count, days
    aggregation: Mapped[str] = mapped_column(String(100))
    valid_n: Mapped[int] = mapped_column(Integer)
    population_n: Mapped[int] = mapped_column(Integer)
    baseline_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    numerator: Mapped[float | None] = mapped_column(Float, nullable=True)
    denominator: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_columns_json: Mapped[list] = mapped_column(JSON, default=list)
    dataset_version_id: Mapped[str] = mapped_column(String(36))
    feature_snapshot_id: Mapped[str] = mapped_column(String(36))
    lookback_start_at: Mapped[datetime] = mapped_column(DateTime)
    as_of_at: Mapped[datetime] = mapped_column(DateTime)
    missing_fraction: Mapped[float] = mapped_column(Float, default=0.0)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)

    persona_card: Mapped["PersonaCard"] = relationship("PersonaCard", back_populates="evidence_metrics")

    __table_args__ = (
        Index("ix_ev_metric_card_key", "persona_card_id", "metric_key"),
    )
