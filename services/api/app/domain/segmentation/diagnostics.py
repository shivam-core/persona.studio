"""Clustering diagnostics, stability assessment, and candidate scoring."""

import math
import numpy as np
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score, adjusted_rand_score
from sklearn.cluster import KMeans
from sklearn.mixture import GaussianMixture


class CandidateDiagnostics:
    def __init__(
        self,
        k: int,
        algorithm: str,
        silhouette: float,
        davies_bouldin: float,
        calinski_harabasz: float,
        inertia: float | None = None,
        bic: float | None = None,
        aic: float | None = None,
        cluster_sizes: list[int] = None,
        median_ari: float = 0.0,
        ari_range: tuple[float, float] = (0.0, 0.0),
        is_qualified: bool = False,
        heuristic_score: float = 0.0,
        warning_flags: list[str] = None,
    ):
        self.k = k
        self.algorithm = algorithm
        self.silhouette = silhouette
        self.davies_bouldin = davies_bouldin
        self.calinski_harabasz = calinski_harabasz
        self.inertia = inertia
        self.bic = bic
        self.aic = aic
        self.cluster_sizes = cluster_sizes or []
        self.median_ari = median_ari
        self.ari_range = ari_range
        self.is_qualified = is_qualified
        self.heuristic_score = heuristic_score
        self.warning_flags = warning_flags or []

    def to_dict(self) -> dict:
        return {
            "k": self.k,
            "algorithm": self.algorithm,
            "silhouette": round(self.silhouette, 4),
            "davies_bouldin": round(self.davies_bouldin, 4),
            "calinski_harabasz": round(self.calinski_harabasz, 2),
            "inertia": round(self.inertia, 2) if self.inertia is not None else None,
            "bic": round(self.bic, 2) if self.bic is not None else None,
            "aic": round(self.aic, 2) if self.aic is not None else None,
            "cluster_sizes": self.cluster_sizes,
            "min_cluster_size": min(self.cluster_sizes) if self.cluster_sizes else 0,
            "max_cluster_size": max(self.cluster_sizes) if self.cluster_sizes else 0,
            "median_ari": round(self.median_ari, 4),
            "ari_min": round(self.ari_range[0], 4),
            "ari_max": round(self.ari_range[1], 4),
            "is_qualified": self.is_qualified,
            "heuristic_score": round(self.heuristic_score, 4),
            "warning_flags": self.warning_flags,
        }


def compute_diagnostics(
    X: np.ndarray,
    labels: np.ndarray,
    k: int,
    algorithm: str,
    seed: int = 42,
    model_obj=None,
) -> CandidateDiagnostics:
    """Compute mathematical diagnostics and 5-subsample ARI stability."""
    n_samples = len(X)
    warning_flags = []

    # Cluster sizes
    unique_labels, counts = np.unique(labels, return_counts=True)
    cluster_sizes = [int(c) for c in counts]
    min_size = min(cluster_sizes)
    max_size = max(cluster_sizes)

    min_required_size = max(20, math.ceil(0.03 * n_samples))
    if min_size < min_required_size:
        warning_flags.append(f"Small cluster size: {min_size} < required {min_required_size}")

    # Silhouette with stratified sample if large
    if n_samples > 2000:
        rng = np.random.RandomState(seed)
        sample_indices = []
        for ul in unique_labels:
            indices_in_c = np.where(labels == ul)[0]
            sampled_in_c = rng.choice(
                indices_in_c,
                size=min(len(indices_in_c), int(2000 * len(indices_in_c) / n_samples)),
                replace=False,
            )
            sample_indices.extend(sampled_in_c)
        sample_indices = np.array(sample_indices)
        sil = float(silhouette_score(X[sample_indices], labels[sample_indices]))
    else:
        sil = float(silhouette_score(X, labels))

    db_score = float(davies_bouldin_score(X, labels))
    ch_score = float(calinski_harabasz_score(X, labels))

    inertia = float(model_obj.inertia_) if algorithm == "kmeans" and hasattr(model_obj, "inertia_") else None
    bic = float(model_obj.bic(X)) if algorithm == "gmm" and hasattr(model_obj, "bic") else None
    aic = float(model_obj.aic(X)) if algorithm == "gmm" and hasattr(model_obj, "aic") else None

    # Stability: 5 repeated 80% subsamples with fitted preprocessing
    ari_scores = []
    rng_stab = np.random.RandomState(seed)
    subsample_size = int(0.8 * n_samples)

    for i in range(5):
        sub_idx = rng_stab.choice(n_samples, size=subsample_size, replace=False)
        X_sub = X[sub_idx]

        try:
            if algorithm == "kmeans":
                sub_model = KMeans(n_clusters=k, n_init=10, max_iter=200, random_state=seed + i)
                sub_model.fit(X_sub)
                pred_eval = sub_model.predict(X)
            else:
                sub_model = GaussianMixture(n_components=k, covariance_type="diag", reg_covar=1e-4, n_init=3, random_state=seed + i)
                sub_model.fit(X_sub)
                pred_eval = sub_model.predict(X)

            ari = float(adjusted_rand_score(labels, pred_eval))
            ari_scores.append(ari)
        except Exception:
            pass

    median_ari = float(np.median(ari_scores)) if ari_scores else 0.0
    ari_range = (float(np.min(ari_scores)), float(np.max(ari_scores))) if ari_scores else (0.0, 0.0)

    if sil < 0.15:
        warning_flags.append(f"Low silhouette separation: {sil:.3f} < 0.15")
    if median_ari < 0.60:
        warning_flags.append(f"Subsample stability weak: ARI {median_ari:.3f} < 0.60")

    is_qualified = (sil >= 0.15) and (median_ari >= 0.60) and (min_size >= min_required_size)

    # Heuristic rank score: 0.45 * norm_sil + 0.35 * clipped_ari + 0.20 * (min_size / max_size)
    clipped_ari = max(0.0, min(1.0, median_ari))
    size_ratio = min_size / max(1, max_size)
    norm_sil = max(0.0, min(1.0, (sil + 0.2) / 0.8))  # normalized scale
    heuristic_score = 0.45 * norm_sil + 0.35 * clipped_ari + 0.20 * size_ratio

    return CandidateDiagnostics(
        k=k,
        algorithm=algorithm,
        silhouette=sil,
        davies_bouldin=db_score,
        calinski_harabasz=ch_score,
        inertia=inertia,
        bic=bic,
        aic=aic,
        cluster_sizes=cluster_sizes,
        median_ari=median_ari,
        ari_range=ari_range,
        is_qualified=is_qualified,
        heuristic_score=heuristic_score,
        warning_flags=warning_flags,
    )
