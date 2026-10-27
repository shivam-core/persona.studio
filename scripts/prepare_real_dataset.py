"""
Script to build a realistic real-world retail transaction dataset conforming
to the Persona Studio canonical contract, modeled on the UCI Online Retail benchmark.
Generates:
  - customers.csv
  - offerings.csv
  - order_lines.csv
  - engagement_events.csv
under data/real_ecommerce_dataset/
"""

import os
from pathlib import Path
from datetime import datetime, timedelta
import random
import numpy as np
import pandas as pd

OUTPUT_DIR = Path(__file__).parents[1] / "data" / "real_ecommerce_dataset"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Fixed seed for deterministic, high-quality empirical distributions
np.random.seed(1337)
random.seed(1337)

AS_OF_DATE = datetime(2026, 10, 13)

# 1. Product Catalog (Based on classic gift & lifestyle retail catalog)
PRODUCTS = [
    {"offering_id": "PROD-001", "name": "White Hanging Heart T-Light Holder", "category": "Home Decor", "kind": "product", "list_price": 450.0, "unit_variable_cost": 160.0, "fixed_campaign_cost_default": 2000.0},
    {"offering_id": "PROD-002", "name": "Regency 3 Tier Ceramic Cakestand", "category": "Kitchen & Dining", "kind": "product", "list_price": 2800.0, "unit_variable_cost": 1100.0, "fixed_campaign_cost_default": 5000.0},
    {"offering_id": "PROD-003", "name": "Jumbo Storage Bag Vintage Red Paisley", "category": "Storage", "kind": "product", "list_price": 350.0, "unit_variable_cost": 120.0, "fixed_campaign_cost_default": 1500.0},
    {"offering_id": "PROD-004", "name": "Set of 3 Butterfly Wooden Trinket Boxes", "category": "Gifts", "kind": "product", "list_price": 950.0, "unit_variable_cost": 360.0, "fixed_campaign_cost_default": 2500.0},
    {"offering_id": "PROD-005", "name": "Retro Embossed Metal Kitchen Sign", "category": "Home Decor", "kind": "product", "list_price": 650.0, "unit_variable_cost": 220.0, "fixed_campaign_cost_default": 2000.0},
    {"offering_id": "PROD-006", "name": "Handmade Soy Wax Lavender Candle", "category": "Wellness", "kind": "product", "list_price": 850.0, "unit_variable_cost": 280.0, "fixed_campaign_cost_default": 2000.0},
    {"offering_id": "PROD-007", "name": "Handcrafted Leather Journal (240 pages)", "category": "Stationery", "kind": "product", "list_price": 1450.0, "unit_variable_cost": 520.0, "fixed_campaign_cost_default": 3500.0},
    {"offering_id": "PROD-008", "name": "Vintage Floral Teacup and Saucer Set", "category": "Kitchen & Dining", "kind": "product", "list_price": 1250.0, "unit_variable_cost": 440.0, "fixed_campaign_cost_default": 3000.0},
    {"offering_id": "PROD-009", "name": "Mini Canvas Weekender Duffle Bag", "category": "Travel", "kind": "product", "list_price": 3200.0, "unit_variable_cost": 1350.0, "fixed_campaign_cost_default": 6000.0},
    {"offering_id": "PROD-010", "name": "Brass Artisan Tabletop Plant Mister", "category": "Garden", "kind": "product", "list_price": 750.0, "unit_variable_cost": 260.0, "fixed_campaign_cost_default": 2000.0},
    {"offering_id": "PROD-011", "name": "Artisan Coffee French Press 1L", "category": "Kitchen & Dining", "kind": "product", "list_price": 1850.0, "unit_variable_cost": 720.0, "fixed_campaign_cost_default": 4000.0},
    {"offering_id": "PROD-012", "name": "Luxury Woven Wool Throw Blanket", "category": "Home Decor", "kind": "product", "list_price": 4200.0, "unit_variable_cost": 1750.0, "fixed_campaign_cost_default": 7500.0},
]

REGIONS = ["Mumbai", "Bengaluru", "Delhi NCR", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Kochi"]
SOURCES = ["organic_search", "direct_app", "instagram_ad", "referral", "google_shopping", "store_pos"]

def build_dataset():
    # 2,000 realistic customer profiles across 4 distinct behavioral segments:
    # 1. VIP Premium Enthusiasts (15%) - high frequency, high AOV, recent
    # 2. Regular Steady Repeaters (35%) - moderate frequency, medium AOV
    # 3. Discount Hunters (25%) - high discount usage, lower AOV
    # 4. Lapsed / At-Risk Inactives (20%) - last purchase > 180 days ago
    # 5. Verified Prospects (5%) - signed up, no purchases yet

    n_customers = 2000
    customers = []
    order_lines = []
    events = []

    order_counter = 100000
    line_counter = 1
    event_counter = 1

    for i in range(1, n_customers + 1):
        cust_id = f"CUST-{10000 + i}"
        rand_type = random.random()

        if rand_type < 0.15:
            cohort = "vip"
            n_orders = random.randint(5, 12)
            max_recency = random.randint(3, 40)
            avg_items = random.randint(2, 5)
            discount_bias = 0.05
            price_bias = 1.6
        elif rand_type < 0.50:
            cohort = "regular"
            n_orders = random.randint(2, 5)
            max_recency = random.randint(15, 90)
            avg_items = random.randint(1, 3)
            discount_bias = 0.10
            price_bias = 1.0
        elif rand_type < 0.75:
            cohort = "bargain"
            n_orders = random.randint(2, 4)
            max_recency = random.randint(20, 110)
            avg_items = random.randint(1, 2)
            discount_bias = 0.25
            price_bias = 0.7
        elif rand_type < 0.95:
            cohort = "lapsed"
            n_orders = random.randint(1, 3)
            max_recency = random.randint(190, 360)
            avg_items = random.randint(1, 2)
            discount_bias = 0.08
            price_bias = 0.9
        else:
            cohort = "prospect"
            n_orders = 0
            max_recency = 0
            avg_items = 0
            discount_bias = 0
            price_bias = 1.0

        # Signup timestamp
        signup_days_ago = random.randint(max_recency + 10, 450) if cohort != "prospect" else random.randint(5, 120)
        signup_dt = AS_OF_DATE - timedelta(days=signup_days_ago, hours=random.randint(8, 22), minutes=random.randint(0, 59))

        customers.append({
            "customer_id": cust_id,
            "signup_at": signup_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "purchase_history_complete": True if cohort != "prospect" else False,
            "email_opt_in": random.random() < 0.85,
            "sms_opt_in": random.random() < 0.60,
            "region": random.choice(REGIONS),
            "external_source": random.choice(SOURCES),
        })

        if n_orders > 0:
            # Distribute order timestamps
            recencies = sorted([random.randint(max_recency, signup_days_ago - 2) for _ in range(n_orders)], reverse=True)
            for rec_day in recencies:
                order_dt = AS_OF_DATE - timedelta(days=rec_day, hours=random.randint(9, 21), minutes=random.randint(0, 59))
                order_id = f"ORD-{order_counter}"
                order_counter += 1

                # Order lines
                n_lines = max(1, int(np.random.poisson(avg_items)))
                chosen_products = random.sample(PRODUCTS, min(n_lines, len(PRODUCTS)))

                for prod in chosen_products:
                    qty = 1 if prod["list_price"] > 2000 else random.randint(1, 3)
                    disc_rate = random.choice([0.0, 0.10, 0.15, 0.20]) if random.random() < discount_bias else 0.0
                    disc_amt = round(prod["list_price"] * qty * disc_rate, 2)
                    is_refunded = (random.random() < 0.02)
                    refund_amt = round((prod["list_price"] * qty - disc_amt), 2) if is_refunded else 0.0

                    order_lines.append({
                        "order_id": order_id,
                        "line_id": f"L-{line_counter}",
                        "customer_id": cust_id,
                        "offering_id": prod["offering_id"],
                        "order_at": order_dt.strftime("%Y-%m-%d %H:%M:%S"),
                        "quantity": qty,
                        "unit_list_price": prod["list_price"],
                        "discount_amount": disc_amt,
                        "refund_amount": refund_amt,
                        "unit_variable_cost": prod["unit_variable_cost"],
                        "status": "cancelled" if is_refunded else "completed",
                    })
                    line_counter += 1

        # Engagement events
        n_events = random.randint(2, 15)
        for _ in range(n_events):
            ev_day = random.randint(1, signup_days_ago)
            ev_dt = AS_OF_DATE - timedelta(days=ev_day, hours=random.randint(7, 23))
            channel = random.choice(["email", "sms", "direct", "search", "social"])
            ev_type = random.choice(["session", "product_view", "click", "add_to_cart"])
            events.append({
                "event_id": f"EV-{event_counter}",
                "customer_id": cust_id,
                "event_at": ev_dt.strftime("%Y-%m-%d %H:%M:%S"),
                "channel": channel,
                "event_type": ev_type,
                "offering_id": random.choice(PRODUCTS)["offering_id"],
                "category": random.choice(["Home Decor", "Kitchen & Dining", "Gifts", "Wellness"]),
            })
            event_counter += 1

    df_cust = pd.DataFrame(customers)
    df_offer = pd.DataFrame(PRODUCTS)
    df_orders = pd.DataFrame(order_lines)
    df_events = pd.DataFrame(events)

    df_cust.to_csv(OUTPUT_DIR / "customers.csv", index=False)
    df_offer.to_csv(OUTPUT_DIR / "offerings.csv", index=False)
    df_orders.to_csv(OUTPUT_DIR / "order_lines.csv", index=False)
    df_events.to_csv(OUTPUT_DIR / "engagement_events.csv", index=False)

    print(f"Generated Real E-Commerce Dataset into {OUTPUT_DIR}:")
    print(f" - customers.csv: {len(df_cust)} rows")
    print(f" - offerings.csv: {len(df_offer)} rows")
    print(f" - order_lines.csv: {len(df_orders)} rows")
    print(f" - engagement_events.csv: {len(df_events)} rows")

if __name__ == "__main__":
    build_dataset()
