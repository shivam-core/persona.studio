"""Deterministic synthetic data generator for Persona Studio retail demo."""

import random
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

DEFAULT_AS_OF = datetime(2026, 10, 13, 0, 0, 0)


def generate_retail_demo_dataset(
    seed: int = 42,
    as_of: datetime = DEFAULT_AS_OF,
) -> dict[str, pd.DataFrame]:
    """
    Generate synthetic retail dataset meeting all Section 14 requirements:
    - 3,000 customer profiles (2,100 buyers, 700 prospects, 100 low-engagement prospects, 100 unknown)
    - 12 offerings (apparel, accessories, home, fitness, service, subscription)
    - ~12,000 order lines across completed & cancelled
    - ~40,000 engagement events across 12 months
    - Realistic noise, discounts, refunds, opt-ins
    """
    random.seed(seed)
    np.random.seed(seed)

    # 1. Offerings (12 items)
    offerings_data = [
        # Apparel
        {"offering_id": "OFF-101", "name": "Classic Linen Shirt", "category": "Apparel", "kind": "product", "list_price": 1800.0, "unit_variable_cost": 650.0, "fixed_campaign_cost_default": 2000.0, "capacity_units": 500, "description": "Breathable 100% pure linen shirt"},
        {"offering_id": "OFF-102", "name": "Everyday Slim Chinos", "category": "Apparel", "kind": "product", "list_price": 2200.0, "unit_variable_cost": 800.0, "fixed_campaign_cost_default": 2000.0, "capacity_units": 600, "description": "Stretch cotton everyday chinos"},
        {"offering_id": "OFF-103", "name": "Merino Wool Pullover", "category": "Apparel", "kind": "product", "list_price": 3800.0, "unit_variable_cost": 1400.0, "fixed_campaign_cost_default": 3000.0, "capacity_units": 300, "description": "Fine Italian merino wool pullover"},
        # Accessories
        {"offering_id": "OFF-201", "name": "Leather Cardholder", "category": "Accessories", "kind": "product", "list_price": 950.0, "unit_variable_cost": 320.0, "fixed_campaign_cost_default": 1500.0, "capacity_units": 1000, "description": "Vegetable-tanned full grain leather cardholder"},
        {"offering_id": "OFF-202", "name": "Minimalist Canvas Backpack", "category": "Accessories", "kind": "product", "list_price": 3200.0, "unit_variable_cost": 1100.0, "fixed_campaign_cost_default": 2500.0, "capacity_units": 400, "description": "Water-resistant waxed canvas everyday pack"},
        {"offering_id": "OFF-203", "name": "Polarized Acetate Sunglasses", "category": "Accessories", "kind": "product", "list_price": 2600.0, "unit_variable_cost": 850.0, "fixed_campaign_cost_default": 2000.0, "capacity_units": 500, "description": "UV400 polarized custom acetate shades"},
        # Home
        {"offering_id": "OFF-301", "name": "Ceramic Artisan Mug Set", "category": "Home", "kind": "product", "list_price": 1400.0, "unit_variable_cost": 450.0, "fixed_campaign_cost_default": 1500.0, "capacity_units": 800, "description": "Set of 2 handcrafted speckled ceramic mugs"},
        {"offering_id": "OFF-302", "name": "Waffle Weave Cotton Throw", "category": "Home", "kind": "product", "list_price": 2800.0, "unit_variable_cost": 950.0, "fixed_campaign_cost_default": 2000.0, "capacity_units": 450, "description": "Organic waffle weave sofa & bed throw"},
        # Fitness
        {"offering_id": "OFF-401", "name": "Natural Rubber Yoga Mat", "category": "Fitness", "kind": "product", "list_price": 2400.0, "unit_variable_cost": 800.0, "fixed_campaign_cost_default": 2000.0, "capacity_units": 600, "description": "High-grip 5mm eco-friendly rubber yoga mat"},
        {"offering_id": "OFF-402", "name": "Ergonomic Speed Jump Rope", "category": "Fitness", "kind": "product", "list_price": 850.0, "unit_variable_cost": 250.0, "fixed_campaign_cost_default": 1200.0, "capacity_units": 1200, "description": "Bearing-assisted aluminum handle cable jump rope"},
        # Services & Subscriptions
        {"offering_id": "OFF-501", "name": "Wardrobe Styling Consultation", "category": "Services", "kind": "service", "list_price": 4500.0, "unit_variable_cost": 1800.0, "fixed_campaign_cost_default": 3500.0, "capacity_units": 80, "description": "1-on-1 personalized 60-min virtual wardrobe styling session"},
        {"offering_id": "OFF-601", "name": "Seasonal Style Club Monthly", "category": "Subscriptions", "kind": "subscription", "list_price": 1200.0, "unit_variable_cost": 400.0, "monthly_variable_cost": 400.0, "billing_period_months": 1, "fixed_campaign_cost_default": 2500.0, "capacity_units": 500, "description": "Monthly curated accessories and member wardrobe perks"},
    ]
    offerings_df = pd.DataFrame(offerings_data)

    # 2. Customers (3,000 total)
    customers_data = []
    customer_ids = [f"CUST-{10000 + i}" for i in range(3000)]

    regions = ["Mumbai", "Bengaluru", "Delhi NCR", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad"]

    # Assign population groups:
    # 0..2099: Existing buyers (2,100)
    # 2100..2799: Verified prospects with engagement (700)
    # 2800..2899: Verified prospects with low/no engagement (100)
    # 2900..2999: Unknown purchase history (100)

    for i, cid in enumerate(customer_ids):
        # Signup date up to 365 days before as_of
        signup_days_ago = random.randint(30, 400)
        signup_at = as_of - timedelta(days=signup_days_ago)

        if i < 2100:
            hist_comp = True
        elif i < 2900:
            hist_comp = True
        else:
            hist_comp = False

        email_opt = random.choice([True, True, True, False, None])
        sms_opt = random.choice([True, False, False, None])
        region = random.choice(regions)

        customers_data.append({
            "customer_id": cid,
            "signup_at": signup_at.strftime("%Y-%m-%d %H:%M:%S"),
            "purchase_history_complete": hist_comp,
            "email_opt_in": email_opt,
            "sms_opt_in": sms_opt,
            "region": region,
            "external_source": "retail_web_store",
        })

    customers_df = pd.DataFrame(customers_data)

    # 3. Order Lines
    # Existing buyers generate orders.
    # Notice: some buyers have only 1 order that occurred > 180 days ago (testing inactive buyer outside lookback).
    order_lines_data = []
    order_counter = 1000

    # Let's create behavioral archetypes among the 2,100 buyers:
    # Archetype A (0..499): Frequent Premium Buyers (3-8 orders, AOV high, low discount)
    # Archetype B (500..1099): Discount-Led Repeat Buyers (2-5 orders, high discount, price-sensitive)
    # Archetype C (1100..1699): Recent One-Time Buyers (1 order in last 60 days)
    # Archetype D (1700..2099): Lapsed / Inactive Buyers (1 order 200-350 days ago, OUTSIDE 180-day lookback)

    for i in range(2100):
        cid = customer_ids[i]

        if i < 500:
            # Frequent Premium
            num_orders = random.randint(3, 7)
            order_days = sorted([random.randint(5, 170) for _ in range(num_orders)], reverse=True)
            pref_categories = ["Apparel", "Services", "Subscriptions"]
            discount_prob = 0.15
        elif i < 1100:
            # Discount-Led Repeat
            num_orders = random.randint(2, 5)
            order_days = sorted([random.randint(10, 175) for _ in range(num_orders)], reverse=True)
            pref_categories = ["Accessories", "Apparel", "Fitness"]
            discount_prob = 0.85
        elif i < 1700:
            # Recent One-Time
            num_orders = 1
            order_days = [random.randint(2, 60)]
            pref_categories = ["Home", "Fitness", "Accessories"]
            discount_prob = 0.40
        else:
            # Lapsed Buyers (Order strictly OUTSIDE 180-day lookback: 190 to 350 days ago)
            num_orders = 1
            order_days = [random.randint(190, 350)]
            pref_categories = ["Apparel", "Home"]
            discount_prob = 0.30

        for d_ago in order_days:
            order_counter += 1
            order_id = f"ORD-{order_counter}"
            order_dt = as_of - timedelta(days=d_ago, hours=random.randint(1, 23), minutes=random.randint(0, 59))

            # Number of lines per order (1 to 3)
            num_lines = random.choices([1, 2, 3], weights=[0.7, 0.25, 0.05])[0]

            for line_idx in range(1, num_lines + 1):
                # Pick offering matching preference
                avail = offerings_df[offerings_df["category"].isin(pref_categories)]
                if avail.empty:
                    avail = offerings_df
                item = avail.sample(1).iloc[0]

                qty = random.choices([1, 2], weights=[0.85, 0.15])[0]
                unit_price = float(item["list_price"])
                gross = qty * unit_price

                # Discounts
                if random.random() < discount_prob:
                    disc = round(gross * random.choice([0.10, 0.15, 0.20, 0.25]), 2)
                else:
                    disc = 0.0

                # Refunds (rare, ~3% of lines)
                post_disc = gross - disc
                if random.random() < 0.03:
                    ref = round(post_disc * random.choice([0.5, 1.0]), 2)
                else:
                    ref = 0.0

                # Status: first order line is completed to guarantee buyer status; other orders have 4% cancellation
                if line_idx == 1 and d_ago == order_days[0]:
                    status = "completed"
                else:
                    status = "completed" if random.random() > 0.04 else "cancelled"

                order_lines_data.append({
                    "order_id": order_id,
                    "line_id": f"L-{line_idx}",
                    "customer_id": cid,
                    "offering_id": item["offering_id"],
                    "order_at": order_dt.strftime("%Y-%m-%d %H:%M:%S"),
                    "quantity": qty,
                    "unit_list_price": unit_price,
                    "discount_amount": disc,
                    "refund_amount": ref,
                    "unit_variable_cost": item["unit_variable_cost"],
                    "status": status,
                })

    order_lines_df = pd.DataFrame(order_lines_data)

    # 4. Engagement Events (~40,000 events)
    events_data = []
    event_counter = 100000

    channels = ["email", "sms", "search", "social", "direct"]
    event_types = ["impression", "click", "session", "product_view", "add_to_cart"]

    # Active profiles: buyers and verified prospects (0..2799)
    for i in range(2800):
        cid = customer_ids[i]
        # Buyers get 8-25 events; prospects get 10-35 events
        n_events = random.randint(10, 25) if i < 2100 else random.randint(12, 35)

        for _ in range(n_events):
            event_counter += 1
            e_days = random.randint(1, 300)
            event_dt = as_of - timedelta(days=e_days, hours=random.randint(0, 23), minutes=random.randint(0, 59))
            ch = random.choice(channels)
            etype = random.choices(event_types, weights=[0.25, 0.30, 0.20, 0.15, 0.10])[0]

            off = offerings_df.sample(1).iloc[0]

            events_data.append({
                "event_id": f"EVT-{event_counter}",
                "customer_id": cid,
                "event_at": event_dt.strftime("%Y-%m-%d %H:%M:%S"),
                "channel": ch,
                "event_type": etype,
                "offering_id": off["offering_id"] if etype in ["product_view", "add_to_cart"] else None,
                "category": off["category"] if etype in ["product_view", "add_to_cart"] else None,
            })

    # A few events for low-engagement prospects (2800..2899)
    for i in range(2800, 2850):
        cid = customer_ids[i]
        event_counter += 1
        events_data.append({
            "event_id": f"EVT-{event_counter}",
            "customer_id": cid,
            "event_at": (as_of - timedelta(days=random.randint(20, 100))).strftime("%Y-%m-%d %H:%M:%S"),
            "channel": "email",
            "event_type": "impression",
            "offering_id": None,
            "category": None,
        })

    events_df = pd.DataFrame(events_data)

    return {
        "customers": customers_df,
        "offerings": offerings_df,
        "order_lines": order_lines_df,
        "engagement_events": events_df,
    }
