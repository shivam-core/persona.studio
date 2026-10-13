"""Segmentation runs and memberships."""

from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, JSON, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base, generate_uuid


class SegmentationRun(Base):
    __tablename__ = "segmentation_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True)
    feature_snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey("feature_snapshots.id"), index=True)
    population_type: Mapped[str] = mapped_column(String(50))  # existing_buyer, verified_prospect
    config_json: Mapped[dict] = mapped_column(JSON, default=dict)
    k_selected: Mapped[int | None] = mapped_column(Integer, nullable=True)
    algorithm_selected: Mapped[str | None] = mapped_column(String(50), nullable=True)  # kmeans, gmm, rules
    diagnostics_json: Mapped[dict] = mapped_column(JSON, default=dict)
    candidate_comparisons_json: Mapped[dict] = mapped_column(JSON, default=dict)
    pca_projection_json: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(50), default="candidate_ready")  # running, candidate_ready, published, failed
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    memberships: Mapped[list["SegmentMembership"]] = relationship("SegmentMembership", back_populates="segmentation_run", cascade="all, delete-orphan")


class SegmentMembership(Base):
    __tablename__ = "segment_memberships"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    segmentation_run_id: Mapped[str] = mapped_column(String(36), ForeignKey("segmentation_runs.id"), index=True)
    segment_ordinal: Mapped[int] = mapped_column(Integer, index=True)
    customer_id: Mapped[str] = mapped_column(String(100), index=True)
    distance_to_centroid: Mapped[float | None] = mapped_column(Float, nullable=True)
    boundary_ambiguity_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    gmm_probabilities_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    segmentation_run: Mapped["SegmentationRun"] = relationship("SegmentationRun", back_populates="memberships")

    __table_args__ = (
        Index("ix_seg_mem_composite", "segmentation_run_id", "customer_id", unique=True),
    )
