"""Campaign model."""

from datetime import datetime
from sqlalchemy import String, Integer, Float, DateTime, JSON, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base, generate_uuid


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    objective: Mapped[str] = mapped_column(String(50))  # acquisition, retention, reactivation
    offering_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    audience_snapshot_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("audience_snapshots.id"), nullable=True)
    channel: Mapped[str] = mapped_column(String(50), default="email")  # email, sms, search, social, direct
    proposition: Mapped[str] = mapped_column(Text, default="")
    offer_type: Mapped[str] = mapped_column(String(50), default="none")  # none, percent_discount, fixed_discount
    discount_pct: Mapped[float] = mapped_column(Float, default=0.0)
    fixed_discount: Mapped[float] = mapped_column(Float, default=0.0)
    budget: Mapped[float] = mapped_column(Float, default=10000.0)
    fixed_cost: Mapped[float] = mapped_column(Float, default=2000.0)
    duration_days: Mapped[int] = mapped_column(Integer, default=30)
    status: Mapped[str] = mapped_column(String(50), default="draft")  # draft, planned, simulated, active, completed
    brief_json: Mapped[dict] = mapped_column(JSON, default=dict)
    message_variants_json: Mapped[list] = mapped_column(JSON, default=list)
    assumption_set_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
