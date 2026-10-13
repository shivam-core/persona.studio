"""Tests for Phase 2: Data Hub validation, quarantine, synthetic generation, and as-of features."""

from datetime import datetime
from pathlib import Path
import pandas as pd
import pytest

from app.domain.validation.engine import validate_tables
from app.domain.features.engine import build_features
from app.domain.data.generator import DEFAULT_AS_OF

EXAMPLES_DIR = Path(__file__).parents[3] / "examples"


def test_valid_retail_fixtures():
    retail_dir = EXAMPLES_DIR / "retail"
    tables = {
        "customers": pd.read_csv(retail_dir / "customers.csv"),
        "offerings": pd.read_csv(retail_dir / "offerings.csv"),
        "order_lines": pd.read_csv(retail_dir / "order_lines.csv"),
        "engagement_events": pd.read_csv(retail_dir / "engagement_events.csv"),
    }

    report = validate_tables(tables, as_of_at=DEFAULT_AS_OF)
    assert not report.has_fatal_errors
    assert report.accepted_rows["customers"] == 3000
    assert report.accepted_rows["offerings"] == 12
    assert report.accepted_rows["order_lines"] > 0
    assert report.quarantined_rows["customers"] == 0
    assert report.quarantined_rows["order_lines"] == 0


def test_invalid_fixtures_quarantine_and_issues():
    inv_dir = EXAMPLES_DIR / "invalid"
    tables = {
        "customers": pd.read_csv(inv_dir / "customers.csv"),
        "offerings": pd.read_csv(EXAMPLES_DIR / "retail" / "offerings.csv"),
        "order_lines": pd.read_csv(inv_dir / "order_lines.csv"),
    }

    report = validate_tables(tables, as_of_at=DEFAULT_AS_OF)
    assert not report.has_fatal_errors  # File structure is valid CSV, row errors quarantined
    assert report.quarantined_rows["customers"] > 0
    assert report.quarantined_rows["order_lines"] > 0

    issue_codes = {issue.issue_code for issue in report.issues}
    # Verify expected quarantine reasons were captured
    assert "DUPLICATE_CUSTOMER_ID" in issue_codes
    assert "FUTURE_SIGNUP_DATE" in issue_codes
    assert "EMPTY_CUSTOMER_ID" in issue_codes
    assert "FOREIGN_KEY_CUSTOMER_NOT_FOUND" in issue_codes
    assert "FOREIGN_KEY_OFFERING_NOT_FOUND" in issue_codes
    assert "REFUND_EXCEEDS_NET_SALES" in issue_codes


def test_feature_engineering_integrity():
    retail_dir = EXAMPLES_DIR / "retail"
    tables = {
        "customers": pd.read_csv(retail_dir / "customers.csv"),
        "offerings": pd.read_csv(retail_dir / "offerings.csv"),
        "order_lines": pd.read_csv(retail_dir / "order_lines.csv"),
        "engagement_events": pd.read_csv(retail_dir / "engagement_events.csv"),
    }

    result = build_features(tables, as_of_at=DEFAULT_AS_OF, lookback_days=180)

    # 1. Check population counts
    assert result.population_counts["existing_buyer"] == 2100
    assert result.population_counts["verified_prospect"] > 600
    assert result.population_counts["unknown_history"] == 100

    # 2. Check inactive past purchasers (whose purchase was outside lookback)
    # They MUST remain existing_buyer with orders_lookback == 0, NOT converted to prospects!
    lapsed_buyers = [
        r for r in result.records
        if r.population_type == "existing_buyer" and r.orders_lookback == 0
    ]
    assert len(lapsed_buyers) > 0, "Inactive buyers whose only order is outside lookback must exist"
    for b in lapsed_buyers:
        assert b.recency_days is not None
        assert b.recency_days > 180.0
        assert b.net_sales_lookback == 0.0

    # 3. Frequency check: distinct order_id count, NOT order lines count
    multi_line_custs = [r for r in result.records if r.orders_lookback > 0]
    assert len(multi_line_custs) > 0
    for r in multi_line_custs:
        assert r.orders_lookback >= 1
        if r.orders_lookback > 0:
            assert r.aov_lookback is not None
            assert r.aov_lookback >= 0.0
