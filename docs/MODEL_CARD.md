# ML Model Card — Persona Studio Behavioral Segmentation

**Model Name:** Persona Studio Behavioral Segmentation Engine  
**Version:** 1.0.0 (Unsupervised Cluster Suite)  
**Date:** 13 October 2026  
**License:** Academic / Open Evaluation  

---

## 1. Intended Use & Boundaries

- **Primary Purpose:** Discovers interpretable customer behavioral archetypes from transactional and engagement history to power grounded persona cards, offering matching, and campaign economics.
- **Population Scopes:**
  1. `existing_buyer`: Customers with $\ge 1$ completed historical order prior to the as-of cutoff date. Used for retention and reactivation segmentation.
  2. `verified_prospect`: Profiles with 0 historical purchases and an explicit complete-history flag. Used for acquisition segmentation.
  3. `unknown`: Profiles with 0 purchases but no completeness guarantee. Tracked as descriptive audience; excluded from verified acquisition CAC.
  4. `insufficient_data`: Profiles with inadequate events for unsupervised clustering. Maintained as an unmodeled cohort.
- **Out of Scope:**
  - Predicting individual conversion probabilities or intent.
  - Inferring personality traits, wealth, gender, caste, religion, or sensitive demographic attributes.
  - Automated autonomous bidding or ad delivery.

---

## 2. Feature Pipeline & Preprocessing

1. **Continuous & Monetary Features:**
   - Orders lookback, net sales lookback, AOV lookback, recency days, tenure days, discount share, refund share, engagement days, category net sales shares.
2. **Missingness Handling:**
   - Columns with $>40\%$ missingness are excluded from the model matrix.
   - Remaining numerical missing values are median-imputed only within the model matrix; raw missingness is preserved in evidence records.
3. **Transformations:**
   - Nonnegative skewed monetary amounts and counts are transformed via $x \leftarrow \log(1 + x)$.
   - Ratios and shares (bounded in $[0, 1]$) are preserved without log transformation.
   - Preprocessing values are capped at population 1st and 99th percentiles when $N \ge 100$. Uncapped raw values remain authoritative for business accounting.
   - Robust scaling via `RobustScaler` (median centering and IQR scaling).
4. **Group Weighting:**
   - Feature columns are partitioned into 4 behavioral groups:
     - Value (weight: 0.30)
     - Timing / Frequency (weight: 0.35)
     - Offer / Discount Behavior (weight: 0.20)
     - Engagement (weight: 0.15)
   - Columns are scaled by $\sqrt{\text{group\_weight} / \text{group\_dimension}}$ to prevent wide dimensional blocks from dominating Euclidean distance.

---

## 3. Algorithm Candidates & Diagnostics

1. **Candidate Models:**
   - **K-Means:** Evaluated across $K=2..8$ using `k-means++` initialization, $n_{\text{init}}=20$, $\text{max\_iter}=300$, fixed seed.
   - **Gaussian Mixture Models (GMM):** Evaluated across $K=2..8$ with diagonal covariance matrices, explicit covariance regularization, and multiple starts.
2. **Cluster Quality Diagnostics:**
   - **Silhouette Score:** Evaluated using hard cluster labels on a stratified evaluation sample (up to 2,000 profiles). Minimum threshold: $\ge 0.15$.
   - **Davies–Bouldin Index:** Ratio of within-cluster distance to between-cluster separation (lower is superior).
   - **Calinski–Harabasz Index:** Variance ratio criterion (higher indicates denser, separated clusters).
   - **BIC / AIC:** Information criteria for GMM model selection.
   - **Cluster Size Validity:** Enforces minimum cluster size $\ge \max(20, \lceil 0.03 \cdot N \rceil)$ and balanced size ratios.
3. **Subsample Refit Stability (ARI):**
   - Fits 5 independent 80% random subsamples using the fixed fitted preprocessing pipeline.
   - Predicts labels on a shared evaluation sample and measures Adjusted Rand Index (ARI) against the full-data fit.
   - Qualifying candidate threshold: Median ARI $\ge 0.60$.
4. **Selection Heuristic:**
   $$\text{Score} = 0.45 \times \text{Silhouette}_{\text{norm}} + 0.35 \times \text{ARI}_{\text{clipped}} + 0.20 \times \left( \frac{\text{Min Cluster Size}}{\text{Max Cluster Size}} \right)$$
   *Note: This is an unsupervised selection heuristic, not a measure of supervised classification accuracy or business profit.*

---

## 4. Boundary Ambiguity & Dimensionality Reduction

- **Distance Ambiguity:** Ratio of distance to closest centroid $d_1$ over second-closest centroid $d_2$:
  $$\text{Ambiguity} = \frac{d_1}{\max(d_2, 10^{-6})}$$
  Profiles with ratio close to 1.0 lie near decision boundaries and are flagged for marketing review.
- **2D PCA Visualization:**
  - Fit on the robust-scaled, group-weighted feature matrix for visual inspection only.
  - Algorithms run on the full multidimensional feature space; PCA does not compress features before clustering.
  - Explained variance ratio of PC1 and PC2 is explicitly reported on the chart.

---

## 5. Ethical Considerations & Limitations

- **No Demographic Profiling:** All features are purely behavioral (transactions, item categories, engagement activity).
- **Synthetic Retail Data Limitations:** Seeded retail examples use generative rules (seed=42) designed for educational demonstration. Real production deployments require fresh validation and feature engineering.
- **LLM Decoupling:** Large language models never perform clustering or feature calculations; LLM involvement is limited strictly to qualitative text proposals grounded in verified evidence metric IDs.
