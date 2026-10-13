"""Feature snapshots and customer features."""

from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, JSON, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base, generate_uuid


class FeatureSnapshot(Base):
    __tablename__ = "feature_snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True)
    dataset_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("dataset_versions.id"), index=True)
    snapshot_name: Mapped[str] = mapped_column(String(255))
    as_of_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    lookback_start_at: Mapped[datetime] = mapped_column(DateTime)
    lookback_days: Mapped[int] = mapped_column(Integer, default=180)
    config_json: Mapped[dict] = mapped_column(JSON, default=dict)
    population_counts: Mapped[dict] = mapped_column(JSON, default=dict)
    summary_stats: Mapped[dict] = mapped_column(JSON, default=dict)
    artifact_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    customer_features: Mapped[list["CustomerFeature"]] = relationship("CustomerFeature", back_populates="feature_snapshot", cascade="all, delete-orphan")


class CustomerFeature(Base):
    __tablename__ = "customer_features"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    feature_snapshot_id: Mapped[str] = mapped_column(String(36), ForeignKey("feature_snapshots.id"), index=True)
    customer_id: Mapped[str] = mapped_column(String(100), index=True)
    population_type: Mapped[str] = mapped_column(String(50), index=True)  # existing_buyer, verified_prospect, unknown_history, insufficient_evidence
    recency_days: Mapped[float | None] = mapped_column(Float, nullable=True)
    orders_lookback: Mapped[int] = mapped_column(Integer, default=0)
    net_sales_lookback: Mapped[float] = mapped_column(Float, default=0.0)
    aov_lookback: Mapped[float | None] = mapped_column(Float, nullable=True)
    tenure_days: Mapped[float | None] = mapped_column(Float, nullable=True)
    purchase_active_days: Mapped[int] = mapped_column(Integer, default=0)
    discount_share: Mapped[float | None] = mapped_column(Float, nullable=True)
    refund_share: Mapped[float | None] = mapped_column(Float, nullable=True)
    category_shares_json: Mapped[dict] = mapped_column(JSON, default=dict)
    engagement_days: Mapped[int] = mapped_column(Integer, default=0)
    channel_click_shares_json: Mapped[dict] = mapped_column(JSON, default=dict)
    cart_events: Mapped[int] = mapped_column(Integer, default=0)
    feature_vector_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    feature_snapshot: Mapped["FeatureSnapshot"] = relationship("FeatureSnapshot", back_populates="customer_features")

    __table_args__ = (
        Index("ix_cust_feat_snapshot_cust", "feature_snapshot_id", "customer_id", unique=True),
    )
