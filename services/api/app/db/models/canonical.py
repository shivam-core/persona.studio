"""Canonical tables: Customer, Offering, OrderLine, EngagementEvent."""

from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base, generate_uuid


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True)
    dataset_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("dataset_versions.id"), index=True)
    customer_id: Mapped[str] = mapped_column(String(100), index=True)
    signup_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    purchase_history_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    email_opt_in: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    sms_opt_in: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    external_source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_cust_ver_cust_id", "dataset_version_id", "customer_id", unique=True),
    )


class Offering(Base):
    __tablename__ = "offerings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True)
    dataset_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("dataset_versions.id"), index=True)
    offering_id: Mapped[str] = mapped_column(String(100), index=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(100), index=True)
    kind: Mapped[str] = mapped_column(String(50))  # product, service, subscription
    list_price: Mapped[float] = mapped_column(Float)
    unit_variable_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    fixed_campaign_cost_default: Mapped[float] = mapped_column(Float, default=0.0)
    capacity_units: Mapped[int | None] = mapped_column(Integer, nullable=True)
    billing_period_months: Mapped[int] = mapped_column(Integer, default=1)
    monthly_variable_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_offering_ver_offering_id", "dataset_version_id", "offering_id", unique=True),
    )


class OrderLine(Base):
    __tablename__ = "order_lines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True)
    dataset_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("dataset_versions.id"), index=True)
    order_id: Mapped[str] = mapped_column(String(100), index=True)
    line_id: Mapped[str] = mapped_column(String(100))
    customer_id: Mapped[str] = mapped_column(String(100), index=True)
    offering_id: Mapped[str] = mapped_column(String(100), index=True)
    order_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_list_price: Mapped[float] = mapped_column(Float)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0)
    refund_amount: Mapped[float] = mapped_column(Float, default=0.0)
    unit_variable_cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(50))  # completed, cancelled, pending
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_order_line_composite", "dataset_version_id", "order_id", "line_id", unique=True),
    )


class EngagementEvent(Base):
    __tablename__ = "engagement_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True)
    dataset_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("dataset_versions.id"), index=True)
    event_id: Mapped[str] = mapped_column(String(100), index=True)
    customer_id: Mapped[str] = mapped_column(String(100), index=True)
    event_at: Mapped[datetime] = mapped_column(DateTime, index=True)
    channel: Mapped[str] = mapped_column(String(50))  # email, sms, search, social, direct, other
    event_type: Mapped[str] = mapped_column(String(50))  # delivered, impression, click, session, product_view, add_to_cart, purchase_event
    offering_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_event_ver_event_id", "dataset_version_id", "event_id", unique=True),
    )
