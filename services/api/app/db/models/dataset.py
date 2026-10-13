"""Dataset version, upload files, and validation issues."""

from datetime import datetime
from sqlalchemy import String, Integer, BigInteger, Boolean, DateTime, JSON, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base, generate_uuid


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    version_number: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(50), default="uploaded")  # uploaded, mapped, validating, needs_review, validated, failed, features_ready
    source_file_hashes: Mapped[dict] = mapped_column(JSON, default=dict)
    mapping_manifest: Mapped[dict] = mapped_column(JSON, default=dict)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Kolkata")
    row_counts: Mapped[dict] = mapped_column(JSON, default=dict)
    accepted_rows: Mapped[int] = mapped_column(Integer, default=0)
    quarantined_rows: Mapped[int] = mapped_column(Integer, default=0)
    coverage_period: Mapped[dict] = mapped_column(JSON, default=dict)
    purchase_history_complete: Mapped[bool] = mapped_column(Boolean, default=False)
    is_synthetic: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    upload_files: Mapped[list["UploadFile"]] = relationship("UploadFile", back_populates="dataset_version", cascade="all, delete-orphan")
    validation_issues: Mapped[list["ValidationIssue"]] = relationship("ValidationIssue", back_populates="dataset_version", cascade="all, delete-orphan")


class UploadFile(Base):
    __tablename__ = "upload_files"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    dataset_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("dataset_versions.id"), index=True)
    table_name: Mapped[str] = mapped_column(String(50))  # customers, order_lines, offerings, engagement_events, experiment_outcomes
    original_filename: Mapped[str] = mapped_column(String(255))
    storage_path: Mapped[str] = mapped_column(String(512))
    row_count: Mapped[int] = mapped_column(Integer, default=0)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    file_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    dataset_version: Mapped["DatasetVersion"] = relationship("DatasetVersion", back_populates="upload_files")


class ValidationIssue(Base):
    __tablename__ = "validation_issues"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    dataset_version_id: Mapped[str] = mapped_column(String(36), ForeignKey("dataset_versions.id"), index=True)
    table_name: Mapped[str] = mapped_column(String(50))
    row_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    column_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    severity: Mapped[str] = mapped_column(String(20))  # fatal, error, warning
    issue_code: Mapped[str] = mapped_column(String(50))
    message: Mapped[str] = mapped_column(Text)
    raw_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    proposed_resolution: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_quarantined: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    dataset_version: Mapped["DatasetVersion"] = relationship("DatasetVersion", back_populates="validation_issues")
