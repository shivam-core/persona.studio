"""Segmentation engine comparing K-Means, Gaussian Mixture, and rule-based cohorts."""

import math
from typing import Any
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.mixture import GaussianMixture
from sklearn.decomposition import PCA
from pydantic import BaseModel, Field

from app.domain.segmentation.preprocessing import preprocess_feature_matrix, PreprocessingResult
from app.domain.segmentation.diagnostics import compute_diagnostics, CandidateDiagnostics


class CandidateSummary(BaseModel):
    id: str = ""
    k: int
    n_clusters: int = 0
    algorithm: str
    diagnostics: dict[str, Any]
    is_recommended: bool = False
    silhouette_score: float | None = None
    davies_bouldin_index: float | None = None
    calinski_harabasz_score: float | None = None
    aic: float | None = None
    bic: float | None = None
    stability_median_ari: float | None = None
    min_cluster_size: int = 0
    selection_score: float = 0.0
    is_qualified: bool = False


class CandidateComparison(BaseModel):
    population_type: str
    n_samples: int
    n_features: int
    candidates: list[CandidateSummary]
    recommended_k: int
    recommended_algorithm: str
    pca_projection: dict[str, Any]
    labels: list[int]
    ambiguity_scores: list[float]
    customer_ids: list[str]
    is_fallback_rule: bool = False
    status_message: str = "Candidate models fitted successfully."


def fit_candidates(
    feature_records_df: pd.DataFrame,
    population_type: str = "existing_buyer",
    seed: int = 42,
) -> CandidateComparison:
    """
    Fits candidate segmentation models (K-Means and GMM) and evaluates diagnostics.
    Selects mathematically qualified candidate with highest stability/silhouette heuristic.
    Falls back to documented rule-based cohorts if population is small or degenerate.
    """
    customer_ids = feature_records_df["customer_id"].tolist()
    n_samples = len(customer_ids)

    # Fallback if too few samples or insufficient variation
    if n_samples < 60:
        return _build_fallback_cohorts(feature_records_df, population_type, reason="Population size < 60")

    # Extract feature matrix (excluding IDs and non-numeric columns)
    drop_cols = ["customer_id", "population_type", "feature_vector", "category_shares", "channel_click_shares"]
    cols_to_use = [c for c in feature_records_df.columns if c not in drop_cols]
    numeric_df = feature_records_df[cols_to_use].copy()

    try:
        preproc: PreprocessingResult = preprocess_feature_matrix(numeric_df)
    except Exception as exc:
        return _build_fallback_cohorts(feature_records_df, population_type, reason=f"Preprocessing failure: {exc}")

    X = preproc.transformed_matrix
    n_features = X.shape[1]

    if n_features < 2:
        return _build_fallback_cohorts(feature_records_df, population_type, reason="Fewer than 2 varying dimensions")

    # Determine K range: 2 through min(8, floor(N/20))
    max_k = min(8, max(2, math.floor(n_samples / 20)))
    k_range = list(range(2, max_k + 1))

    candidates: list[CandidateSummary] = []
    fitted_models: dict[tuple[int, str], Any] = {}
    fitted_labels: dict[tuple[int, str], np.ndarray] = {}

    for k in k_range:
        # 1. K-Means (k-means++, n_init=20, max_iter=300)
        km = KMeans(n_clusters=k, init="k-means++", n_init=20, max_iter=300, random_state=seed)
        km_labels = km.fit_predict(X)
        km_diag = compute_diagnostics(X, km_labels, k=k, algorithm="kmeans", seed=seed, model_obj=km)
        candidates.append(CandidateSummary(
            id=f"kmeans_k{k}",
            k=k,
            n_clusters=k,
            algorithm="kmeans",
            diagnostics=km_diag.to_dict(),
            silhouette_score=km_diag.silhouette,
            davies_bouldin_index=km_diag.davies_bouldin,
            calinski_harabasz_score=km_diag.calinski_harabasz,
            aic=km_diag.aic,
            bic=km_diag.bic,
            stability_median_ari=km_diag.median_ari,
            min_cluster_size=min(km_diag.cluster_sizes) if km_diag.cluster_sizes else 0,
            selection_score=km_diag.heuristic_score,
            is_qualified=km_diag.is_qualified,
        ))
        fitted_models[(k, "kmeans")] = km
        fitted_labels[(k, "kmeans")] = km_labels

        # 2. Gaussian Mixture (diagonal covariance, reg_covar=1e-4, n_init=5)
        gmm = GaussianMixture(n_components=k, covariance_type="diag", reg_covar=1e-4, n_init=5, random_state=seed)
        gmm_labels = gmm.fit_predict(X)
        gmm_diag = compute_diagnostics(X, gmm_labels, k=k, algorithm="gmm", seed=seed, model_obj=gmm)
        candidates.append(CandidateSummary(
            id=f"gmm_k{k}",
            k=k,
            n_clusters=k,
            algorithm="gmm",
            diagnostics=gmm_diag.to_dict(),
            silhouette_score=gmm_diag.silhouette,
            davies_bouldin_index=gmm_diag.davies_bouldin,
            calinski_harabasz_score=gmm_diag.calinski_harabasz,
            aic=gmm_diag.aic,
            bic=gmm_diag.bic,
            stability_median_ari=gmm_diag.median_ari,
            min_cluster_size=min(gmm_diag.cluster_sizes) if gmm_diag.cluster_sizes else 0,
            selection_score=gmm_diag.heuristic_score,
            is_qualified=gmm_diag.is_qualified,
        ))
        fitted_models[(k, "gmm")] = gmm
        fitted_labels[(k, "gmm")] = gmm_labels

    # Candidate selection:
    # 1. Filter qualified candidates (silhouette >= 0.15, median_ari >= 0.60, valid sizes)
    qualified = [c for c in candidates if c.diagnostics.get("is_qualified", False)]

    if qualified:
        # Sort by heuristic score descending, tie-break smaller K
        qualified.sort(key=lambda c: (-c.diagnostics["heuristic_score"], c.k))
        best = qualified[0]
        status_msg = f"Candidate K={best.k} ({best.algorithm.upper()}) selected based on separation and subsample stability."
    else:
        # Weak segmentation: take highest heuristic score among all
        candidates.sort(key=lambda c: (-c.diagnostics["heuristic_score"], c.k))
        best = candidates[0]
        status_msg = "Weak segmentation — review diagnostics before publishing."

    best.is_recommended = True
    rec_k = best.k
    rec_algo = best.algorithm
    rec_labels = fitted_labels[(rec_k, rec_algo)]
    rec_model = fitted_models[(rec_k, rec_algo)]

    # Compute boundary ambiguity scores
    ambiguity_scores = []
    if rec_algo == "kmeans":
        # Distance to centroid 1 vs centroid 2: d1 / max(d2, 1e-6)
        centroids = rec_model.cluster_centers_
        for idx in range(n_samples):
            pt = X[idx]
            dists = np.linalg.norm(centroids - pt, axis=1)
            sorted_dists = np.sort(dists)
            d1 = sorted_dists[0]
            d2 = sorted_dists[1] if len(sorted_dists) > 1 else d1
            amb = float(d1 / max(d2, 1e-6))
            ambiguity_scores.append(round(min(1.0, max(0.0, amb)), 4))
    else:
        # GMM: posterior probability entropy or margin
        probs = rec_model.predict_proba(X)
        for idx in range(n_samples):
            sorted_p = np.sort(probs[idx])[::-1]
            p1 = sorted_p[0]
            p2 = sorted_p[1] if len(sorted_p) > 1 else 0.0
            margin = float(p1 - p2)
            amb = 1.0 - margin  # Higher means closer boundary ambiguity
            ambiguity_scores.append(round(min(1.0, max(0.0, amb)), 4))

    # PCA 2D scatter visualization (sampled at most 2,000 points)
    pca = PCA(n_components=2, random_state=seed)
    X_pca = pca.fit_transform(X)
    evr = [float(r) for r in pca.explained_variance_ratio_]

    pca_points = []
    sample_limit = min(n_samples, 2000)
    for idx in range(sample_limit):
        pca_points.append({
            "customer_id": customer_ids[idx],
            "x": round(float(X_pca[idx, 0]), 3),
            "y": round(float(X_pca[idx, 1]), 3),
            "cluster": int(rec_labels[idx]),
            "ambiguity": ambiguity_scores[idx],
        })

    pca_projection = {
        "explained_variance_ratio": evr,
        "total_explained_variance": round(sum(evr), 4),
        "sampled_points": pca_points,
        "coordinates": pca_points,
    }

    return CandidateComparison(
        population_type=population_type,
        n_samples=n_samples,
        n_features=n_features,
        candidates=candidates,
        recommended_k=rec_k,
        recommended_algorithm=rec_algo,
        pca_projection=pca_projection,
        labels=[int(l) for l in rec_labels],
        ambiguity_scores=ambiguity_scores,
        customer_ids=customer_ids,
        is_fallback_rule=False,
        status_message=status_msg,
    )


def _build_fallback_cohorts(
    df: pd.DataFrame,
    population_type: str,
    reason: str,
) -> CandidateComparison:
    """Documented rule-based cohorts when data is insufficient for machine learning clustering."""
    n_samples = len(df)
    customer_ids = df["customer_id"].tolist()

    labels = []
    ambiguity_scores = [0.0] * n_samples

    # Mutually exclusive behavioral rule cohorts:
    # 0: Recent Repeat Buyers (orders >= 2, recency <= 90)
    # 1: Recent One-Time Buyers (orders == 1, recency <= 90)
    # 2: Lapsed / Inactive Buyers (recency > 90 or orders == 0)
    for _, row in df.iterrows():
        orders = int(row.get("orders_lookback", 0))
        rec = float(row.get("recency_days", 180.0)) if pd.notna(row.get("recency_days")) else 180.0

        if orders >= 2 and rec <= 90:
            labels.append(0)
        elif orders == 1 and rec <= 90:
            labels.append(1)
        else:
            labels.append(2)

    candidates = [
        CandidateSummary(
            k=3,
            algorithm="rule_based_cohorts",
            diagnostics={
                "k": 3,
                "algorithm": "rules",
                "silhouette": 0.0,
                "davies_bouldin": 0.0,
                "calinski_harabasz": 0.0,
                "is_qualified": True,
                "heuristic_score": 0.5,
                "reason": reason,
                "cohort_definitions": [
                    "Recent Repeat Buyers (orders >= 2, recency <= 90d)",
                    "Recent One-Time Buyers (orders == 1, recency <= 90d)",
                    "Lapsed / Inactive Buyers (recency > 90d or orders == 0)",
                ],
            },
            is_recommended=True,
        )
    ]

    pca_points = [
        {"customer_id": cid, "x": 0.0, "y": 0.0, "cluster": labels[i], "ambiguity": 0.0}
        for i, cid in enumerate(customer_ids[:2000])
    ]

    return CandidateComparison(
        population_type=population_type,
        n_samples=n_samples,
        n_features=len(df.columns),
        candidates=candidates,
        recommended_k=3,
        recommended_algorithm="rule_based_cohorts",
        pca_projection={
            "explained_variance_ratio": [0.0, 0.0],
            "total_explained_variance": 0.0,
            "sampled_points": pca_points,
        },
        labels=labels,
        ambiguity_scores=ambiguity_scores,
        customer_ids=customer_ids,
        is_fallback_rule=True,
        status_message=f"Rule-based cohorts applied: {reason}",
    )
