import requests
import json
import sys

BASE_URL = "http://127.0.0.1:8000"

def test_endpoint(name, method, path, expected_status=[200, 201, 202], json_data=None):
    url = f"{BASE_URL}{path}"
    try:
        if method == "GET":
            res = requests.get(url, timeout=10)
        elif method == "POST":
            res = requests.post(url, json=json_data or {}, timeout=10)
        elif method == "PATCH":
            res = requests.patch(url, json=json_data or {}, timeout=10)
        
        status = res.status_code
        if status in expected_status:
            print(f"  [PASS] {method} {path} -> {status}")
            return True, res.json() if res.headers.get("content-type", "").startswith("application/json") else res.text
        else:
            print(f"  [FAIL] {method} {path} -> {status} (Expected {expected_status})")
            print(f"         Body: {res.text[:300]}")
            return False, None
    except Exception as e:
        print(f"  [ERROR] {method} {path} -> {str(e)}")
        return False, None

def run_all_api_checks():
    print("=" * 60)
    print("PHASE 1: BACKEND API ENDPOINTS SYSTEM CONTRACT AUDIT")
    print("=" * 60)
    
    results = []
    
    # 1. Health & Workspace
    ok, _ = test_endpoint("Health", "GET", "/health")
    results.append(ok)
    ok, _ = test_endpoint("Ready", "GET", "/ready")
    results.append(ok)
    ok, ws = test_endpoint("Get Workspace", "GET", "/api/v1/workspace")
    results.append(ok)
    
    # 2. Datasets
    ok, datasets = test_endpoint("List Datasets", "GET", "/api/v1/datasets")
    results.append(ok)
    
    dataset_id = datasets[0]["id"] if (ok and datasets and len(datasets) > 0) else None
    if dataset_id:
        ok, _ = test_endpoint(f"Dataset Validation {dataset_id}", "GET", f"/api/v1/datasets/{dataset_id}/validation")
        results.append(ok)
    
    # 3. Features
    ok, features = test_endpoint("List Features", "GET", "/api/v1/features")
    results.append(ok)
    
    feature_id = features[0]["id"] if (ok and features and len(features) > 0) else None
    if feature_id:
        ok, _ = test_endpoint(f"Get Feature Snapshot {feature_id}", "GET", f"/api/v1/features/{feature_id}")
        results.append(ok)
    
    # 4. Segmentations
    ok, segs = test_endpoint("List Segmentations", "GET", "/api/v1/segmentations")
    results.append(ok)
    
    seg_id = segs[0]["id"] if (ok and segs and len(segs) > 0) else None
    if seg_id:
        ok, _ = test_endpoint(f"Get Segmentation {seg_id}", "GET", f"/api/v1/segmentations/{seg_id}")
        results.append(ok)
    
    # 5. Personas
    ok, personas = test_endpoint("List Personas", "GET", "/api/v1/personas")
    results.append(ok)
    
    persona_id = personas[0]["id"] if (ok and personas and len(personas) > 0) else None
    if persona_id:
        ok, _ = test_endpoint(f"Get Persona {persona_id}", "GET", f"/api/v1/personas/{persona_id}")
        results.append(ok)
        ok, _ = test_endpoint(f"Get Persona Evidence {persona_id}", "GET", f"/api/v1/personas/{persona_id}/evidence")
        results.append(ok)
        ok, _ = test_endpoint(f"Get Persona Members {persona_id}", "GET", f"/api/v1/personas/{persona_id}/members?page=1&page_size=5")
        results.append(ok)

    # 6. Offerings
    ok, offerings = test_endpoint("List Offerings", "GET", "/api/v1/offerings")
    results.append(ok)
    
    offering_id = offerings[0]["id"] if (ok and offerings and len(offerings) > 0) else None
    if offering_id:
        ok, _ = test_endpoint(f"Get Offering Fit {offering_id}", "GET", f"/api/v1/offerings/{offering_id}/fit")
        results.append(ok)

    # 7. Audiences & Campaigns
    ok, _ = test_endpoint("List Audiences", "GET", "/api/v1/audiences")
    results.append(ok)
    ok, _ = test_endpoint("List Campaigns", "GET", "/api/v1/campaigns")
    results.append(ok)
    ok, _ = test_endpoint("List Allocations", "GET", "/api/v1/allocations")
    results.append(ok)

    # 8. Simulations
    ok, _ = test_endpoint("Preview Simulation", "POST", "/api/v1/simulations/preview", json_data={
        "channel_type": "paid_cpc",
        "variable_budget": 1000.0,
        "audience_n": 5000,
        "cost_per_click": 1.2,
        "conversion_probability": 0.05,
        "aov": 75.0,
        "gross_margin": 0.6,
        "fixed_cost": 200.0,
        "return_rate": 0.02
    })
    results.append(ok)

    ok, _ = test_endpoint("Monte Carlo Simulation", "POST", "/api/v1/simulations/monte_carlo", json_data={
        "inputs": {
            "channel_type": "paid_cpc",
            "variable_budget": 1000.0,
            "audience_n": 5000,
            "cost_per_click": 1.2,
            "conversion_probability": 0.05,
            "aov": 75.0,
            "gross_margin": 0.6,
            "fixed_cost": 200.0,
            "return_rate": 0.02
        },
        "draws": 250,
        "seed": 42
    })
    results.append(ok)

    # 9. Budget Allocation Run
    if persona_id:
        ok, _ = test_endpoint("Run Budget Allocation", "POST", "/api/v1/allocations", json_data={
            "cells": [
                {
                    "persona_id": persona_id,
                    "persona_name": personas[0]["display_name"],
                    "channel": "paid_search",
                    "audience_n": 1000,
                    "cost_per_contact": 0.8,
                    "baseline_conversion": 0.04,
                    "contribution_per_purchaser": 45.0,
                    "saturation_lambda": 0.5
                }
            ],
            "total_budget": 500.0,
            "fixed_cost": 50.0
        })
        results.append(ok)

    # 10. Experiments
    ok, exps = test_endpoint("List Experiments", "GET", "/api/v1/experiments")
    results.append(ok)

    exp_id = exps[0]["id"] if (ok and exps and len(exps) > 0) else None
    if exp_id:
        ok, _ = test_endpoint(f"Get Experiment {exp_id}", "GET", f"/api/v1/experiments/{exp_id}")
        results.append(ok)
        ok, _ = test_endpoint(f"Get Experiment Analysis {exp_id}", "GET", f"/api/v1/experiments/{exp_id}/analysis")
        results.append(ok)
        ok, _ = test_endpoint(f"Seed Positive Scenario {exp_id}", "POST", f"/api/v1/experiments/{exp_id}/outcomes", json_data={
            "effect_type": "positive"
        })
        results.append(ok)
        ok, _ = test_endpoint(f"Recalculate Analysis {exp_id}", "POST", f"/api/v1/experiments/{exp_id}/analyze")
        results.append(ok)

    # 11. Jobs
    ok, _ = test_endpoint("List Jobs", "GET", "/api/v1/jobs")
    results.append(ok)

    passed_count = sum(1 for r in results if r)
    total_count = len(results)
    print("=" * 60)
    print(f"API AUDIT RESULT: {passed_count}/{total_count} Passed ({passed_count/total_count*100:.1f}%)")
    print("=" * 60)
    return passed_count == total_count

if __name__ == "__main__":
    success = run_all_api_checks()
    sys.exit(0 if success else 1)
