# University Demonstration Script (5–7 Minutes) — Persona Studio

**Project:** Persona Studio – Customer Segments & Campaign Planner for Marketers  
**Presenter:** Shivam Kore  
**Audience:** Business Analytics Faculty, Evaluators, and Marketing Technologists  

---

## Storyline Overview

> *"Persona Studio converts raw behavioral data into inspectable persona cards. We validate transactions, build features strictly as-of an explicit historical date, compare unsupervised segmentation algorithms using rigorous stability diagnostics, and ground each persona using computed evidence metrics. The marketer pairs personas with catalog offerings, simulates campaign unit economics, models risk through Monte Carlo simulation, and evaluates real incremental uplift using pre-registered randomized holdout experiments."*

---

## Timed Walkthrough

### 0:00 – 1:00: The Business Problem & Academic Philosophy
- **Speaker:**
  *"Traditional marketing personas are often decorative PowerPoint slides with fictional names and fabricated demographic portraits that disconnect from actual customer transaction data. In contrast, Persona Studio treats the Persona Card as a versioned decision object grounded in verified behavioral evidence, integrated directly into unit economics and holdout testing."*
- **Action on Screen:**
  - Open `http://localhost:3000/`. Point out the **Overview Dashboard**, the 4 explicit-scope KPI cards (*Eligible Profiles*, *Active Buyers in Lookback*, *Net Historical Sales*, *Published Persona Cards*), and the **Observed Net Sales Trend**.
  - Emphasize: *Observed historical revenue is strictly separated from modeled projections.*

---

### 1:00 – 2:00: Data Hub & As-Of Feature Engineering
- **Speaker:**
  *"Let's examine how customer data enters the studio. A common flaw in marketing analytics is lookahead bias—using future transactions to segment past customers. Persona Studio enforces strict temporal isolation."*
- **Action on Screen:**
  - Navigate to **Data Hub** (`/data`).
  - Point to the active snapshot: 3,000 profiles, 7,609 completed order lines, 53,271 engagement events.
  - Highlight the **Population Classification**:
    1. *Existing Buyers* (2,100): customers with $\ge 1$ order before the cutoff.
    2. *Verified Prospects* (700): 0 orders before cutoff, with an explicit complete-history flag.
    3. *Unknown History* (100): 0 orders but no completeness flag (excluded from acquisition CAC).
  - Point to the **Feature Snapshot Builder**: As-of date `2026-10-13`, 180-day lookback window.

---

### 2:00 – 3:15: Unsupervised Segmentation & Candidate Diagnostics
- **Speaker:**
  *"Rather than relying on an LLM to hallucinate customer clusters, we use unsupervised machine learning on continuous RFM and behavioral feature matrices, with group weighting to prevent high-dimensional dominance."*
- **Action on Screen:**
  - Navigate to **Segments** (`/segments`).
  - Review the **Candidate Model Search Table**:
    - Compares K-Means ($K=2..8$) with Gaussian Mixture Models.
    - Diagnostics displayed: **Silhouette Score** ($\ge 0.15$), **Davies–Bouldin Index**, and **5-Fold Subsample ARI Stability** ($\ge 0.60$).
    - Point to Candidate #1: Recommended with Silhouette `0.428` and ARI stability `0.880`.
  - Scroll down to the **2D PCA Projection Chart**:
    - Explain that PCA is used purely for visual geometric inspection, reporting PC1 (28.4%) and PC2 (19.1%) explained variance.

---

### 3:15 – 4:15: Persona Studio & The Evidence Dossier
- **Speaker:**
  *"Publishing a candidate materializes our core differentiator: the Persona Card as an evidence-backed decision object."*
- **Action on Screen:**
  - Navigate to **Persona Studio** (`/personas`).
  - Showcase the published cards: *Frequent Premium Buyers* (1,692 members) and *Lapsed / At-Risk Buyers* (408 members).
  - Walk through card anatomy:
    - Behavioral Name & Factual Summary.
    - Population share: `80.6% of buyers`.
    - **Behavioral Fingerprint**: Horizontal percentile bars showing normalized frequency, AOV, and recency with raw values adjacent.
    - Test Hypothesis strip: *"Test a tailored premium bundle to lift AOV."*
  - Click **View Evidence**:
    - Open the 480px slide-out **Evidence Drawer**.
    - Review the **Materialized Evidence Metrics**: Display label, value, population baseline, valid N, aggregation formula.
    - Review the **Masked Customer Profiles** table with permanent PII masking. Close drawer.

---

### 4:15 – 5:30: Campaign Economics & Risk Simulation
- **Speaker:**
  *"Next, we transition from customer insight to financial planning. The CAC and Profit Simulator uses pure Python formulas to model economics before spending any money."*
- **Action on Screen:**
  - Navigate to **Simulator** (`/simulator`).
  - Click **Load Golden Product Case (₹35k Profit / ₹250 CAC)**:
    - Variable budget: ₹20,000, CPC: ₹10, Clicks: 1.0, Audience: 10,000, Conversion: 5%, List Price: ₹1,000, COGS: ₹400, Fixed Cost: ₹5,000.
    - Live Output: 2,000 visitors, 100 purchasers, ₹100,000 net revenue, ₹40,000 COGS, ₹25,000 marketing cost, **₹35,000 contribution profit**, **₹250 CAC**, Media ROAS: 5.0x.
  - Review the **Profit Waterfall Chart**: Revenue $\rightarrow$ COGS $\rightarrow$ Media Spend $\rightarrow$ Fixed Cost $\rightarrow$ Profit.
  - Click **Run 1k Draws** under Monte Carlo: Show the histogram, median profit, and probability of positive profit.
  - Click **Solve Optimal Budget** under the Budget Allocator: Demonstrate constrained marginal allocation across persona cells.

---

### 5:30 – 6:30: Pre-Registered Randomized Holdout Experiments
- **Speaker:**
  *"Finally, simulations remain assumptions. To discover whether a campaign truly improved customer behavior, we run a pre-registered randomized holdout experiment."*
- **Action on Screen:**
  - Navigate to **Experiments** (`/experiments`).
  - Show the **Sample Size Planner**: Baseline $p_0 = 5\%$, Target MDE $+2.0\text{ pp}$, Power $80\%$ $\rightarrow$ Required $N/\text{arm} = 1,180$.
  - Click **Positive Effect (+3.0 pp Lift)**:
    - Review the **Intention-to-Treat (ITT) Uplift Card**:
      - Absolute lift: $+3.00\text{ pp}$ ($8.00\%$ Treatment vs $5.00\%$ Control).
      - Relative uplift: $+60.0\%$.
      - **95% Bootstrap Confidence Interval**: $[+1.00\text{ pp}, +5.00\text{ pp}]$ over 2,000 resamples.
      - Measured incremental contribution: $+₹18,000$ with statistical significance confirmation.
    - Show the exploratory **Persona Strata Breakdown** table.

---

### 6:30 – 7:00: Technical Summary & Conclusion
- **Speaker:**
  *"In summary, Persona Studio bridges data science and marketing decision-making:
  1. Temporal feature isolation prevents lookahead leakage.
  2. Unsupervised stability metrics prevent arbitrary clustering.
  3. Evidence metrics tie qualitative persona descriptions to audited data rows.
  4. Exact unit economics model downside risk via Monte Carlo.
  5. Pre-registered holdout tests provide rigorous causal measurement."*
