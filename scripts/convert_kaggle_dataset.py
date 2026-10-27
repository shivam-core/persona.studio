"""
Kaggle E-Commerce Dataset Converter for Persona Studio.

Usage:
  python scripts/convert_kaggle_dataset.py --source /path/to/kaggle_online_retail.csv --output data/kaggle_imported/

Supports:
  1. UCI Online Retail / Online Retail II (Invoice, StockCode, Description, Quantity, InvoiceDate, Price, Customer ID, Country)
  2. Generic CSVs with columns: customer_id, order_id, order_date, price, quantity, product_name.
"""

import argparse
from pathlib import Path
from datetime import datetime
import pandas as pd
import numpy as np

def convert_kaggle_retail(input_file: Path, output_dir: Path):
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"Reading Kaggle dataset from {input_file}...")

    # Support CSV or Excel
    if input_file.suffix in [".xlsx", ".xls"]:
        df_raw = pd.read_excel(input_file)
    else:
        df_raw = pd.read_csv(input_file, encoding="ISO-8859-1", low_memory=False)

    print(f"Loaded {len(df_raw)} raw rows.")
    print("Columns detected:", list(df_raw.columns))

    # Standardize column names
    col_map = {c.strip().lower().replace(" ", "_"): c for c in df_raw.columns}

    # Identify key columns
    cust_col = None
    for candidate in ["customer_id", "customer id", "customerid", "client_id"]:
        if candidate.replace(" ", "_") in col_map:
            cust_col = col_map[candidate.replace(" ", "_")]
            break

    invoice_col = None
    for candidate in ["invoice", "invoiceno", "invoice_no", "order_id", "order_number"]:
        if candidate.replace(" ", "_") in col_map:
            invoice_col = col_map[candidate.replace(" ", "_")]
            break

    date_col = None
    for candidate in ["invoicedate", "invoice_date", "order_date", "order_at", "timestamp"]:
        if candidate.replace(" ", "_") in col_map:
            date_col = col_map[candidate.replace(" ", "_")]
            break

    price_col = None
    for candidate in ["price", "unitprice", "unit_price", "list_price", "amount"]:
        if candidate.replace(" ", "_") in col_map:
            price_col = col_map[candidate.replace(" ", "_")]
            break

    qty_col = None
    for candidate in ["quantity", "qty", "count"]:
        if candidate.replace(" ", "_") in col_map:
            qty_col = col_map[candidate.replace(" ", "_")]
            break

    desc_col = None
    for candidate in ["description", "product_name", "item_name", "stockcode", "stock_code"]:
        if candidate.replace(" ", "_") in col_map:
            desc_col = col_map[candidate.replace(" ", "_")]
            break

    stock_col = col_map.get("stockcode", col_map.get("stock_code", desc_col))
    country_col = col_map.get("country", col_map.get("region", None))

    if not cust_col or not invoice_col or not date_col:
        raise ValueError(f"Could not map essential columns. Found: cust={cust_col}, invoice={invoice_col}, date={date_col}")

    # Clean missing customers
    df = df_raw.dropna(subset=[cust_col, invoice_col]).copy()
    df["clean_cust_id"] = "CUST-" + df[cust_col].astype(str).str.replace(".0", "", regex=False)
    df["clean_order_id"] = "ORD-" + df[invoice_col].astype(str)
    df["order_at"] = pd.to_datetime(df[date_col], errors="coerce")
    df = df.dropna(subset=["order_at"])

    # Quantities and prices
    df["clean_qty"] = pd.to_numeric(df[qty_col], errors="coerce").fillna(1)
    df["clean_price"] = pd.to_numeric(df[price_col], errors="coerce").fillna(100.0)

    # Filter out cancellations for canonical lines, track cancellations
    df["is_cancellation"] = df["clean_order_id"].str.startswith("ORD-C") | (df["clean_qty"] < 0)
    df["clean_qty"] = df["clean_qty"].abs()
    df["clean_price"] = df["clean_price"].abs()

    # 1. offerings.csv
    unique_items = df[[stock_col, desc_col, price_col]].drop_duplicates(subset=[stock_col]).copy()
    offerings = []
    for _, row in unique_items.iterrows():
        p_id = "PROD-" + str(row[stock_col]).replace(" ", "_")[:20]
        name = str(row[desc_col]) if pd.notna(row[desc_col]) else f"Product {p_id}"
        price = float(row[price_col]) if pd.notna(row[price_col]) and float(row[price_col]) > 0 else 500.0
        offerings.append({
            "offering_id": p_id,
            "name": name[:150],
            "category": "General Merchandise",
            "kind": "product",
            "list_price": round(price, 2),
            "unit_variable_cost": round(price * 0.4, 2),
            "fixed_campaign_cost_default": 2500.0,
            "capacity_units": 1000,
            "description": name,
        })
    df_offerings = pd.DataFrame(offerings).drop_duplicates(subset=["offering_id"])
    df_offerings.to_csv(output_dir / "offerings.csv", index=False)

    # Mapping product IDs
    stock_to_id = {row[stock_col]: "PROD-" + str(row[stock_col]).replace(" ", "_")[:20] for _, row in unique_items.iterrows()}

    # 2. customers.csv
    cust_groups = df.groupby("clean_cust_id")
    customers = []
    for cid, grp in cust_groups:
        min_date = grp["order_at"].min()
        region = grp[country_col].iloc[0] if country_col and pd.notna(grp[country_col].iloc[0]) else "Global"
        customers.append({
            "customer_id": cid,
            "signup_at": (min_date - pd.Timedelta(days=14)).strftime("%Y-%m-%d %H:%M:%S"),
            "purchase_history_complete": True,
            "email_opt_in": True,
            "sms_opt_in": False,
            "region": str(region),
            "external_source": "kaggle_retail_import",
        })
    df_customers = pd.DataFrame(customers)
    df_customers.to_csv(output_dir / "customers.csv", index=False)

    # 3. order_lines.csv
    order_lines = []
    line_idx = 1
    for _, row in df.iterrows():
        stock_val = row[stock_col]
        offering_id = stock_to_id.get(stock_val, "PROD-GENERIC")
        p = float(row["clean_price"])
        q = int(row["clean_qty"]) if row["clean_qty"] > 0 else 1
        is_canc = bool(row["is_cancellation"])

        order_lines.append({
            "order_id": str(row["clean_order_id"]),
            "line_id": f"L-{line_idx}",
            "customer_id": str(row["clean_cust_id"]),
            "offering_id": offering_id,
            "order_at": row["order_at"].strftime("%Y-%m-%d %H:%M:%S"),
            "quantity": q,
            "unit_list_price": round(p, 2),
            "discount_amount": 0.0,
            "refund_amount": round(p * q, 2) if is_canc else 0.0,
            "unit_variable_cost": round(p * 0.4, 2),
            "status": "cancelled" if is_canc else "completed",
        })
        line_idx += 1

    df_order_lines = pd.DataFrame(order_lines)
    df_order_lines.to_csv(output_dir / "order_lines.csv", index=False)

    # 4. engagement_events.csv (Synthesizing session & view events from transactions)
    events = []
    ev_idx = 1
    for cid, grp in cust_groups:
        for _, row in grp.head(5).iterrows():
            events.append({
                "event_id": f"EV-{ev_idx}",
                "customer_id": cid,
                "event_at": (row["order_at"] - pd.Timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
                "channel": "direct",
                "event_type": "product_view",
                "offering_id": stock_to_id.get(row[stock_col], "PROD-GENERIC"),
                "category": "General Merchandise",
            })
            ev_idx += 1
    df_events = pd.DataFrame(events)
    df_events.to_csv(output_dir / "engagement_events.csv", index=False)

    print("Success! Created canonical CSVs in", output_dir)
    print(" - customers.csv:", len(df_customers))
    print(" - offerings.csv:", len(df_offerings))
    print(" - order_lines.csv:", len(df_order_lines))
    print(" - engagement_events.csv:", len(df_events))

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert Kaggle retail dataset to Persona Studio format.")
    parser.add_argument("--source", type=Path, required=True, help="Path to Kaggle CSV/Excel dataset")
    parser.add_argument("--output", type=Path, default=Path("data/kaggle_imported"), help="Destination directory")
    args = parser.parse_args()
    convert_kaggle_retail(args.source, args.output)
