"""Script to generate all example fixtures into examples/ directory."""

import os
from pathlib import Path
from datetime import datetime
import pandas as pd
from app.domain.data.generator import generate_retail_demo_dataset

BASE_DIR = Path(__file__).parents[1] / "examples"


def create_all_fixtures():
    # 1. Retail Demo Fixtures
    retail_dir = BASE_DIR / "retail"
    retail_dir.mkdir(parents=True, exist_ok=True)
    dfs = generate_retail_demo_dataset(seed=42)
    for name, df in dfs.items():
        df.to_csv(retail_dir / f"{name}.csv", index=False)
    print(f"Saved retail demo CSVs to {retail_dir}")

    # 2. Services Fixture
    services_dir = BASE_DIR / "services"
    services_dir.mkdir(parents=True, exist_ok=True)
    serv_offerings = pd.DataFrame([
        {"offering_id": "SRV-01", "name": "Bespoke Styling Session", "category": "Consulting", "kind": "service", "list_price": 5000.0, "unit_variable_cost": 2000.0, "fixed_campaign_cost_default": 3000.0, "capacity_units": 50, "description": "1-on-1 private styling"},
    ])
    serv_customers = pd.DataFrame([
        {"customer_id": "SRV-C1", "signup_at": "2026-08-01 10:00:00", "purchase_history_complete": True, "email_opt_in": True, "sms_opt_in": False, "region": "Mumbai", "external_source": "vip_inquiry"},
        {"customer_id": "SRV-C2", "signup_at": "2026-08-15 11:00:00", "purchase_history_complete": True, "email_opt_in": True, "sms_opt_in": True, "region": "Delhi", "external_source": "vip_inquiry"},
    ])
    serv_orders = pd.DataFrame([
        {"order_id": "SRV-ORD-1", "line_id": "L-1", "customer_id": "SRV-C1", "offering_id": "SRV-01", "order_at": "2026-09-01 14:00:00", "quantity": 1, "unit_list_price": 5000.0, "discount_amount": 0.0, "refund_amount": 0.0, "unit_variable_cost": 2000.0, "status": "completed"},
    ])
    serv_offerings.to_csv(services_dir / "offerings.csv", index=False)
    serv_customers.to_csv(services_dir / "customers.csv", index=False)
    serv_orders.to_csv(services_dir / "order_lines.csv", index=False)
    print(f"Saved service fixture to {services_dir}")

    # 3. Subscriptions Fixture
    sub_dir = BASE_DIR / "subscriptions"
    sub_dir.mkdir(parents=True, exist_ok=True)
    sub_offerings = pd.DataFrame([
        {"offering_id": "SUB-01", "name": "Curator Box Monthly", "category": "Subscriptions", "kind": "subscription", "list_price": 1500.0, "unit_variable_cost": 500.0, "monthly_variable_cost": 500.0, "billing_period_months": 1, "fixed_campaign_cost_default": 2500.0, "capacity_units": 300, "description": "Monthly accessory curation"},
    ])
    sub_customers = pd.DataFrame([
        {"customer_id": "SUB-C1", "signup_at": "2026-07-01 10:00:00", "purchase_history_complete": True, "email_opt_in": True, "sms_opt_in": True, "region": "Bengaluru", "external_source": "app_signup"},
    ])
    sub_orders = pd.DataFrame([
        {"order_id": "SUB-ORD-1", "line_id": "L-1", "customer_id": "SUB-C1", "offering_id": "SUB-01", "order_at": "2026-08-01 12:00:00", "quantity": 1, "unit_list_price": 1500.0, "discount_amount": 300.0, "refund_amount": 0.0, "unit_variable_cost": 500.0, "status": "completed"},
    ])
    sub_offerings.to_csv(sub_dir / "offerings.csv", index=False)
    sub_customers.to_csv(sub_dir / "customers.csv", index=False)
    sub_orders.to_csv(sub_dir / "order_lines.csv", index=False)
    print(f"Saved subscriptions fixture to {sub_dir}")

    # 4. Invalid Fixtures (Testing validation quarantine and errors)
    invalid_dir = BASE_DIR / "invalid"
    invalid_dir.mkdir(parents=True, exist_ok=True)
    inv_customers = pd.DataFrame([
        {"customer_id": "INV-C1", "signup_at": "2026-08-01 10:00:00", "purchase_history_complete": True, "email_opt_in": True},
        {"customer_id": "INV-C1", "signup_at": "2026-08-05 10:00:00", "purchase_history_complete": True, "email_opt_in": True},  # Duplicate ID
        {"customer_id": "INV-C2", "signup_at": "2029-01-01 00:00:00", "purchase_history_complete": True, "email_opt_in": False}, # Future signup
        {"customer_id": "", "signup_at": "2026-08-01 10:00:00", "purchase_history_complete": False, "email_opt_in": False},      # Empty ID
    ])
    inv_orders = pd.DataFrame([
        {"order_id": "INV-ORD-1", "line_id": "L-1", "customer_id": "INV-C1", "offering_id": "NON-EXISTENT", "order_at": "2026-09-01 12:00:00", "quantity": 1, "unit_list_price": 1000.0, "discount_amount": 0.0, "refund_amount": 0.0, "status": "completed"}, # Bad offering FK
        {"order_id": "INV-ORD-2", "line_id": "L-1", "customer_id": "UNKNOWN-C", "offering_id": "OFF-101", "order_at": "2026-09-01 12:00:00", "quantity": 1, "unit_list_price": 1000.0, "discount_amount": 0.0, "refund_amount": 0.0, "status": "completed"}, # Bad customer FK
        {"order_id": "INV-ORD-3", "line_id": "L-1", "customer_id": "INV-C1", "offering_id": "OFF-101", "order_at": "2026-09-01 12:00:00", "quantity": 1, "unit_list_price": 1000.0, "discount_amount": 200.0, "refund_amount": 950.0, "status": "completed"}, # Refund (950) > gross - discount (800)
    ])
    inv_customers.to_csv(invalid_dir / "customers.csv", index=False)
    inv_orders.to_csv(invalid_dir / "order_lines.csv", index=False)
    print(f"Saved invalid fixtures to {invalid_dir}")


if __name__ == "__main__":
    create_all_fixtures()
