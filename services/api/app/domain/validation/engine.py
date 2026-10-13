"""Canonical table validation and quarantine engine."""

from datetime import datetime
from typing import Any
import pandas as pd
from pydantic import BaseModel, Field


class ValidationIssueItem(BaseModel):
    table_name: str
    row_index: int | None = None
    column_name: str | None = None
    severity: str  # fatal, error, warning
    issue_code: str
    message: str
    raw_value: str | None = None
    proposed_resolution: str | None = None
    is_quarantined: bool = False


class ValidationReport(BaseModel):
    is_valid: bool
    has_fatal_errors: bool
    total_issues: int
    accepted_rows: dict[str, int] = Field(default_factory=dict)
    quarantined_rows: dict[str, int] = Field(default_factory=dict)
    issues: list[ValidationIssueItem] = Field(default_factory=list)
    quarantined_indices: dict[str, list[int]] = Field(default_factory=dict)


def validate_tables(
    tables: dict[str, pd.DataFrame],
    as_of_at: datetime | None = None,
    allow_uncatalogued: bool = False,
) -> ValidationReport:
    """
    Pure validation function checking:
    1. Schema and required columns
    2. Primary & composite key uniqueness
    3. Referential integrity
    4. Numeric and monetary constraints (quantity > 0, refund <= gross - discount)
    5. Temporal consistency and future-dating
    6. Quarantine detection
    """
    issues: list[ValidationIssueItem] = []
    quarantined_indices: dict[str, set[int]] = {tbl: set() for tbl in tables}
    has_fatal = False

    as_of = as_of_at or datetime.utcnow()

    customers_df = tables.get("customers")
    offerings_df = tables.get("offerings")
    orders_df = tables.get("order_lines")
    events_df = tables.get("engagement_events")

    # 1. Customers Validation
    valid_customer_ids: set[str] = set()
    if customers_df is not None:
        if "customer_id" not in customers_df.columns:
            has_fatal = True
            issues.append(ValidationIssueItem(
                table_name="customers",
                severity="fatal",
                issue_code="MISSING_PRIMARY_KEY_COLUMN",
                message="Column 'customer_id' is required.",
            ))
        else:
            seen_cust_ids = set()
            for idx, row in customers_df.iterrows():
                cid = str(row["customer_id"]).strip() if pd.notna(row["customer_id"]) else ""
                if not cid:
                    quarantined_indices["customers"].add(idx)
                    issues.append(ValidationIssueItem(
                        table_name="customers",
                        row_index=int(idx),
                        column_name="customer_id",
                        severity="error",
                        issue_code="EMPTY_CUSTOMER_ID",
                        message="customer_id cannot be empty.",
                        is_quarantined=True,
                    ))
                    continue

                if cid in seen_cust_ids:
                    quarantined_indices["customers"].add(idx)
                    issues.append(ValidationIssueItem(
                        table_name="customers",
                        row_index=int(idx),
                        column_name="customer_id",
                        severity="error",
                        issue_code="DUPLICATE_CUSTOMER_ID",
                        message=f"Duplicate customer_id: '{cid}'.",
                        raw_value=cid,
                        is_quarantined=True,
                    ))
                    continue

                seen_cust_ids.add(cid)
                valid_customer_ids.add(cid)

                # Check signup_at <= as_of
                if "signup_at" in customers_df.columns and pd.notna(row["signup_at"]):
                    try:
                        s_dt = pd.to_datetime(row["signup_at"], utc=True).to_pydatetime().replace(tzinfo=None)
                        if s_dt > as_of:
                            quarantined_indices["customers"].add(idx)
                            issues.append(ValidationIssueItem(
                                table_name="customers",
                                row_index=int(idx),
                                column_name="signup_at",
                                severity="error",
                                issue_code="FUTURE_SIGNUP_DATE",
                                message="Signup date cannot be in the future past as-of date.",
                                raw_value=str(row["signup_at"]),
                                is_quarantined=True,
                            ))
                    except Exception:
                        issues.append(ValidationIssueItem(
                            table_name="customers",
                            row_index=int(idx),
                            column_name="signup_at",
                            severity="warning",
                            issue_code="INVALID_DATE_FORMAT",
                            message="Invalid date format for signup_at.",
                        ))

    # 2. Offerings Validation
    valid_offering_ids: set[str] = set()
    if offerings_df is not None:
        required_off_cols = ["offering_id", "name", "category", "kind", "list_price"]
        missing_off_cols = [c for c in required_off_cols if c not in offerings_df.columns]
        if missing_off_cols:
            has_fatal = True
            issues.append(ValidationIssueItem(
                table_name="offerings",
                severity="fatal",
                issue_code="MISSING_OFFERING_COLUMNS",
                message=f"Missing required columns in offerings: {missing_off_cols}",
            ))
        else:
            seen_off_ids = set()
            for idx, row in offerings_df.iterrows():
                oid = str(row["offering_id"]).strip() if pd.notna(row["offering_id"]) else ""
                if not oid or oid in seen_off_ids:
                    quarantined_indices["offerings"].add(idx)
                    issues.append(ValidationIssueItem(
                        table_name="offerings",
                        row_index=int(idx),
                        column_name="offering_id",
                        severity="error",
                        issue_code="DUPLICATE_OR_EMPTY_OFFERING_ID",
                        message=f"Invalid offering ID: '{oid}'.",
                        raw_value=oid,
                        is_quarantined=True,
                    ))
                    continue

                seen_off_ids.add(oid)
                valid_offering_ids.add(oid)

                # list_price >= 0
                try:
                    lp = float(row["list_price"])
                    if lp < 0:
                        quarantined_indices["offerings"].add(idx)
                        issues.append(ValidationIssueItem(
                            table_name="offerings",
                            row_index=int(idx),
                            column_name="list_price",
                            severity="error",
                            issue_code="NEGATIVE_LIST_PRICE",
                            message="List price cannot be negative.",
                            raw_value=str(row["list_price"]),
                            is_quarantined=True,
                        ))
                except Exception:
                    quarantined_indices["offerings"].add(idx)

                # kind check
                kind = str(row["kind"]).lower()
                if kind not in {"product", "service", "subscription"}:
                    issues.append(ValidationIssueItem(
                        table_name="offerings",
                        row_index=int(idx),
                        column_name="kind",
                        severity="warning",
                        issue_code="UNUSUAL_OFFERING_KIND",
                        message=f"Kind '{kind}' should be product, service, or subscription.",
                    ))

    # 3. Order Lines Validation
    order_customer_map: dict[str, str] = {}
    order_datetime_map: dict[str, Any] = {}
    if orders_df is not None:
        required_ord_cols = ["order_id", "line_id", "customer_id", "offering_id", "order_at", "quantity", "unit_list_price"]
        missing_ord_cols = [c for c in required_ord_cols if c not in orders_df.columns]
        if missing_ord_cols:
            has_fatal = True
            issues.append(ValidationIssueItem(
                table_name="order_lines",
                severity="fatal",
                issue_code="MISSING_ORDER_LINE_COLUMNS",
                message=f"Missing required columns in order_lines: {missing_ord_cols}",
            ))
        else:
            seen_lines = set()
            for idx, row in orders_df.iterrows():
                order_id = str(row["order_id"]).strip()
                line_id = str(row["line_id"]).strip()
                composite = (order_id, line_id)

                if composite in seen_lines:
                    quarantined_indices["order_lines"].add(idx)
                    issues.append(ValidationIssueItem(
                        table_name="order_lines",
                        row_index=int(idx),
                        severity="error",
                        issue_code="DUPLICATE_ORDER_LINE",
                        message=f"Duplicate order_id and line_id: {composite}",
                        is_quarantined=True,
                    ))
                    continue
                seen_lines.add(composite)

                # Customer FK
                cid = str(row["customer_id"]).strip()
                if customers_df is not None and cid not in valid_customer_ids:
                    quarantined_indices["order_lines"].add(idx)
                    issues.append(ValidationIssueItem(
                        table_name="order_lines",
                        row_index=int(idx),
                        column_name="customer_id",
                        severity="error",
                        issue_code="FOREIGN_KEY_CUSTOMER_NOT_FOUND",
                        message=f"Customer ID '{cid}' does not exist in customers table.",
                        raw_value=cid,
                        is_quarantined=True,
                    ))
                    continue

                # Offering FK
                oid = str(row["offering_id"]).strip()
                if offerings_df is not None and oid not in valid_offering_ids:
                    if not allow_uncatalogued:
                        quarantined_indices["order_lines"].add(idx)
                        issues.append(ValidationIssueItem(
                            table_name="order_lines",
                            row_index=int(idx),
                            column_name="offering_id",
                            severity="error",
                            issue_code="FOREIGN_KEY_OFFERING_NOT_FOUND",
                            message=f"Offering ID '{oid}' does not exist in catalog.",
                            raw_value=oid,
                            is_quarantined=True,
                        ))
                        continue

                # Consistent customer per order_id
                if order_id in order_customer_map:
                    if order_customer_map[order_id] != cid:
                        quarantined_indices["order_lines"].add(idx)
                        issues.append(ValidationIssueItem(
                            table_name="order_lines",
                            row_index=int(idx),
                            column_name="customer_id",
                            severity="error",
                            issue_code="CONFLICTING_ORDER_CUSTOMER",
                            message=f"Order {order_id} belongs to multiple customers ({order_customer_map[order_id]} and {cid}).",
                            is_quarantined=True,
                        ))
                        continue
                else:
                    order_customer_map[order_id] = cid

                # Check quantity > 0
                qty = int(row.get("quantity", 1))
                if qty <= 0:
                    quarantined_indices["order_lines"].add(idx)
                    issues.append(ValidationIssueItem(
                        table_name="order_lines",
                        row_index=int(idx),
                        column_name="quantity",
                        severity="error",
                        issue_code="NON_POSITIVE_QUANTITY",
                        message="Quantity must be a positive integer.",
                        raw_value=str(qty),
                        is_quarantined=True,
                    ))
                    continue

                # Prices and refunds
                unit_price = float(row.get("unit_list_price", 0.0))
                discount = float(row.get("discount_amount", 0.0)) if pd.notna(row.get("discount_amount")) else 0.0
                refund = float(row.get("refund_amount", 0.0)) if pd.notna(row.get("refund_amount")) else 0.0

                gross = qty * unit_price
                max_refund = max(0.0, gross - discount)

                if refund > max_refund + 0.01:
                    quarantined_indices["order_lines"].add(idx)
                    issues.append(ValidationIssueItem(
                        table_name="order_lines",
                        row_index=int(idx),
                        column_name="refund_amount",
                        severity="error",
                        issue_code="REFUND_EXCEEDS_NET_SALES",
                        message=f"Refund ({refund}) cannot exceed post-discount gross sales ({max_refund:.2f}).",
                        raw_value=str(refund),
                        is_quarantined=True,
                    ))
                    continue

    # 4. Engagement Events Validation
    if events_df is not None:
        required_evt_cols = ["event_id", "customer_id", "event_at", "channel", "event_type"]
        missing_evt_cols = [c for c in required_evt_cols if c not in events_df.columns]
        if missing_evt_cols:
            has_fatal = True
            issues.append(ValidationIssueItem(
                table_name="engagement_events",
                severity="fatal",
                issue_code="MISSING_EVENT_COLUMNS",
                message=f"Missing required columns in engagement_events: {missing_evt_cols}",
            ))
        else:
            seen_events = set()
            for idx, row in events_df.iterrows():
                eid = str(row["event_id"]).strip()
                if eid in seen_events:
                    quarantined_indices["engagement_events"].add(idx)
                    issues.append(ValidationIssueItem(
                        table_name="engagement_events",
                        row_index=int(idx),
                        column_name="event_id",
                        severity="error",
                        issue_code="DUPLICATE_EVENT_ID",
                        message=f"Duplicate event_id: '{eid}'.",
                        raw_value=eid,
                        is_quarantined=True,
                    ))
                    continue
                seen_events.add(eid)

                cid = str(row["customer_id"]).strip()
                if customers_df is not None and cid not in valid_customer_ids:
                    quarantined_indices["engagement_events"].add(idx)
                    issues.append(ValidationIssueItem(
                        table_name="engagement_events",
                        row_index=int(idx),
                        column_name="customer_id",
                        severity="error",
                        issue_code="EVENT_CUSTOMER_NOT_FOUND",
                        message=f"Customer ID '{cid}' not found for event.",
                        raw_value=cid,
                        is_quarantined=True,
                    ))
                    continue

    accepted_counts = {}
    quarantined_counts = {}
    for tbl, df in tables.items():
        q_cnt = len(quarantined_indices.get(tbl, set()))
        t_cnt = len(df) if df is not None else 0
        quarantined_counts[tbl] = q_cnt
        accepted_counts[tbl] = max(0, t_cnt - q_cnt)

    return ValidationReport(
        is_valid=(not has_fatal and sum(quarantined_counts.values()) == 0),
        has_fatal_errors=has_fatal,
        total_issues=len(issues),
        accepted_rows=accepted_counts,
        quarantined_rows=quarantined_counts,
        issues=issues,
        quarantined_indices={k: sorted(list(v)) for k, v in quarantined_indices.items()},
    )
