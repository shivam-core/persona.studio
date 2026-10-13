"""Group-weighted preprocessing and scaling pipeline for segmentation."""

import numpy as np
import pandas as pd
from sklearn.preprocessing import RobustScaler


class PreprocessingResult:
    def __init__(
        self,
        transformed_matrix: np.ndarray,
        feature_names: list[str],
        column_groups: dict[str, list[str]],
        imputation_medians: dict[str, float],
        percentile_caps: dict[str, tuple[float, float]],
        scaler: RobustScaler,
    ):
        self.transformed_matrix = transformed_matrix
        self.feature_names = feature_names
        self.column_groups = column_groups
        self.imputation_medians = imputation_medians
        self.percentile_caps = percentile_caps
        self.scaler = scaler


def preprocess_feature_matrix(
    df: pd.DataFrame,
    group_weights: dict[str, float] | None = None,
) -> PreprocessingResult:
    """
    Implements Section 6.5 transform pipeline:
    1. Drop all-missing / constant columns.
    2. Impute missing with medians.
    3. Log1p on skewed non-negative counts, money, and recency.
    4. Cap at 1st/99th percentiles if N >= 100.
    5. Robust-scale continuous values.
    6. Group-weight: scale by sqrt(group_weight / group_dimension).
    """
    df_clean = df.copy()
    n_samples = len(df_clean)

    # Filter out empty or constant columns
    usable_cols = []
    for col in df_clean.columns:
        if df_clean[col].isna().all():
            continue
        vals = df_clean[col].dropna()
        if len(vals) == 0 or vals.nunique() <= 1:
            continue
        usable_cols.append(col)

    if not usable_cols:
        raise ValueError("No usable features with variation found in dataset.")

    df_work = df_clean[usable_cols].copy()

    # Column classification into 4 semantic groups
    # Default group weights: value (0.30), timing/frequency (0.35), offer (0.20), engagement (0.15)
    default_weights = {
        "value": 0.30,
        "timing_frequency": 0.35,
        "offer_behavior": 0.20,
        "engagement": 0.15,
    }
    weights = group_weights or default_weights

    column_groups = {
        "value": [],
        "timing_frequency": [],
        "offer_behavior": [],
        "engagement": [],
    }

    skewed_cols = set()
    for col in usable_cols:
        col_lower = col.lower()
        if any(k in col_lower for k in ["net_sales", "aov", "spend", "price", "amount"]):
            column_groups["value"].append(col)
            skewed_cols.add(col)
        elif any(k in col_lower for k in ["recency", "orders", "active_days", "tenure", "frequency"]):
            column_groups["timing_frequency"].append(col)
            skewed_cols.add(col)
        elif any(k in col_lower for k in ["discount", "refund", "coupon", "share"]):
            column_groups["offer_behavior"].append(col)
        else:
            column_groups["engagement"].append(col)
            if any(k in col_lower for k in ["events", "days", "views", "clicks"]):
                skewed_cols.add(col)

    # Impute missing values with median
    imputation_medians = {}
    for col in usable_cols:
        med = float(df_work[col].median(skipna=True))
        if np.isnan(med):
            med = 0.0
        imputation_medians[col] = med
        df_work[col] = df_work[col].fillna(med)

    # Log1p on skewed non-negative columns
    for col in usable_cols:
        if col in skewed_cols:
            min_v = df_work[col].min()
            if min_v >= 0:
                df_work[col] = np.log1p(df_work[col].astype(float))

    # Cap at 1st and 99th percentiles if N >= 100
    percentile_caps = {}
    if n_samples >= 100:
        for col in usable_cols:
            p1 = float(np.percentile(df_work[col], 1))
            p99 = float(np.percentile(df_work[col], 99))
            percentile_caps[col] = (p1, p99)
            df_work[col] = np.clip(df_work[col], p1, p99)

    # Robust scaling
    scaler = RobustScaler()
    scaled_matrix = scaler.fit_transform(df_work.values)

    # Apply group weights: sqrt(group_weight / group_dimension)
    final_matrix = scaled_matrix.copy()

    # Calculate active weights sum
    active_weight_sum = 0.0
    for grp, cols in column_groups.items():
        if cols:
            active_weight_sum += weights.get(grp, 0.25)

    for grp, cols in column_groups.items():
        if not cols:
            continue
        dim = len(cols)
        norm_weight = weights.get(grp, 0.25) / (active_weight_sum if active_weight_sum > 0 else 1.0)
        multiplier = np.sqrt(norm_weight / dim)

        for col_name in cols:
            col_idx = usable_cols.index(col_name)
            final_matrix[:, col_idx] *= multiplier

    return PreprocessingResult(
        transformed_matrix=final_matrix,
        feature_names=usable_cols,
        column_groups=column_groups,
        imputation_medians=imputation_medians,
        percentile_caps=percentile_caps,
        scaler=scaler,
    )
