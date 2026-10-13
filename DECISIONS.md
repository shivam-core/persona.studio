# DECISIONS — Architecture & Implementation Decisions

## 1. Monorepo and Project Layout
- Layout strictly follows `prompt.md` Section 4.4:
  - `services/api`: FastAPI backend, SQLAlchemy 2, Alembic, pure domain analytics engine.
  - `apps/web`: Next.js 16 App Router (React 19, TypeScript, Tailwind CSS v4, Lucide icons, TanStack Query, Recharts).
  - `docs`: Architecture, Metric Dictionary, Model Card, Demo Script.
  - `scripts`: Fixture generation and smoke tests.
  - `examples`: Retail, services, subscription, and invalid CSV fixtures.

## 2. PostgreSQL & Worker Architecture
- Dedicated Python worker process polls the `jobs` table using PostgreSQL `FOR UPDATE SKIP LOCKED`.
- Worker executes CPU-bound tasks (clustering diagnostics, 1,000-draw Monte Carlo simulations, stratified experiment bootstrap resamples, dataset feature extraction).
- API remains fast and responsive, returning HTTP 202 with job tracking references.
- Schema migrations are handled with Alembic (`alembic upgrade head`) for versioned reliability.

## 3. Pure Analytics Separation
- Pure numerical domain functions are decoupled from database models and HTTP requests:
  - `validate_tables`
  - `build_features`
  - `fit_candidates`
  - `build_persona_evidence`
  - `score_offering_fit`
  - `simulate_expected`
  - `simulate_uncertainty`
  - `allocate_budget`
  - `assign_experiment`
  - `analyze_experiment`
- All calculations are pure Python (NumPy, SciPy, pandas, statsmodels, scikit-learn).
- No LLM touches numeric calculations or cluster assignment.

## 4. UI/UX Design System
- Light-theme editorial palette with high contrast and readable typography.
- Hex tokens matching specification:
  - Background: `#F5F7FB`
  - Surface: `#FFFFFF`
  - Text: `#17233B`
  - Muted: `#52617A`
  - Border: `#E2E8F2`
  - Primary: `#5146D9`
  - Success: `#16724E`
  - Warning: `#956000`
  - Danger: `#B42335`
- Persona cards feature behavioral fingerprints (normalized percentile bars with raw numbers), evidence badges, and direct links to evidence drawers.

## 5. As-Of Temporal Isolation & Population Taxonomy
- Every feature snapshot enforces strict as-of temporal isolation: only orders strictly before `as_of_at` within lookback window (`as_of - 180d <= order_at < as_of`) are processed for features.
- Inactive past buyers with orders before the 180-day window remain classified as **Existing Buyers** and are never misclassified as new prospects.
- **Verified Prospects** require an explicit purchase history completeness flag to be eligible for acquisition CAC.

## 6. Exact CAC vs Repeat Purchaser Cost Distinction
- **Campaign CAC** is defined strictly for verified prospects: `(S + F) / Acquired Prospects`.
- **Cost per Repeat Purchaser** is used for existing buyers: `MktCost / Repeat Purchasers`.
- Zero-denominator ratios return `null` with explanation, never `Infinity` or `NaN`.

## 7. Holdout ITT & Bootstrap Confidence Interval Methodology
- Primary causal effect estimation uses intention-to-treat across assigned customers.
- 95% Confidence Intervals are calculated via 2,000 customer-level bootstrap resamples stratified by persona.
- If the 95% CI contains 0, the result is reported as *"Evidence is inconclusive at the 95% confidence level"*, avoiding invalid claims of "no effect".

## 8. Grounded LLM Decoupling & Deterministic Fallbacks
- Large Language Models are strictly decoupled from calculations, feature engineering, and cluster assignments.
- Qualitative wording uses deterministic text templates by default. When configured, the server-side Gemini API proposes wording strictly grounded in verified `EvidenceMetric` IDs.

## 9. Constrained Discretized Budget Allocation
- Solved across 100 budget increments using marginal contribution under concave saturation curves ($Q(B) = p_{\text{base}} \frac{N}{\lambda} (1 - e^{-\lambda q(B)/N})$).
- Recommends a **Do Not Launch** baseline if avoidable fixed costs exceed total contribution, leaving unprofitable budget unspent.
