#!/usr/bin/env python3
"""
Phase 4 — Synthetic MSME Credit Scoring Model Training
=======================================================

Generates ~3,000 synthetic Indian MSME financial profiles, trains a Ridge
regression model on 12 named features, and exports a model_meta.json file
that the Rust scoring service loads at startup.

Why Ridge regression + JSON (not XGBoost + ONNX):
  - Zero ML-runtime dependency in Rust — model is just a JSON weight file
  - For linear models, SHAP is exact: contribution_i = coeff_i * normalized_i
  - Coefficients are learned from data (not hand-tuned rules), so this IS a
    real trained model, not a heuristic stub
  - Swapping in a real dataset + XGBoost is a future step (Phase 4 backlog)

Output:
  services/scoring/model/model_meta.json

Usage:
  conda activate nexus-api
  python infra/scripts/train_model.py
"""

import json
import math
import os
import random
import sys
from pathlib import Path

import numpy as np

try:
    from sklearn.linear_model import Ridge
    from sklearn.metrics import mean_squared_error

    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

N_SAMPLES = 3000
REPO_ROOT = Path(__file__).parent.parent.parent
OUTPUT_DIR = REPO_ROOT / "services" / "scoring" / "model"

# ── Feature definitions ──────────────────────────────────────────────────────
# Order here MUST match Features::as_vec() in Rust extractor.rs

FEATURE_NAMES = [
    "total_transactions",
    "upi_ratio",
    "credit_debit_ratio",
    "nach_debit_count",
    "avg_monthly_revenue_lakh",
    "gst_compliance_ratio",
    "gst_turnover_lakh",
    "current_balance_lakh",
    "invoice_overdue_ratio",
    "data_window_months",
    "transaction_velocity",
    "revenue_consistency",
]

FEATURE_LABELS = {
    "total_transactions": "Transaction Volume",
    "upi_ratio": "UPI Adoption Rate",
    "credit_debit_ratio": "Cash Flow Ratio (Credits/Debits)",
    "nach_debit_count": "NACH/EMI Commitments",
    "avg_monthly_revenue_lakh": "Average Monthly Revenue",
    "gst_compliance_ratio": "GST Filing Compliance",
    "gst_turnover_lakh": "Annual GST Turnover",
    "current_balance_lakh": "Current Account Balance",
    "invoice_overdue_ratio": "Invoice Overdue Rate",
    "data_window_months": "Data Coverage (months)",
    "transaction_velocity": "Transaction Velocity (txns/month)",
    "revenue_consistency": "Revenue Consistency",
}


# ── Synthetic data generation ────────────────────────────────────────────────

def generate_msme_data(n: int):
    """
    Generate synthetic MSME financial profiles across 4 credit quality tiers.
    Tiers: 0=stressed, 1=average, 2=good, 3=excellent
    Distribution: 15% / 40% / 35% / 10%
    """
    rows, targets = [], []

    for _ in range(n):
        tier = random.choices([0, 1, 2, 3], weights=[15, 40, 35, 10])[0]

        # Total transactions
        total_transactions = float(random.randint(
            *{0: (5, 30), 1: (20, 80), 2: (50, 200), 3: (100, 500)}[tier]
        ))

        # UPI ratio (digital payment adoption)
        upi_ratio = random.uniform(
            *{0: (0.05, 0.30), 1: (0.20, 0.60), 2: (0.40, 0.80), 3: (0.60, 0.95)}[tier]
        )

        # Credit / debit ratio (capped at 3.0 to bound feature space)
        credit_debit_ratio = min(3.0, random.uniform(
            *{0: (0.50, 0.95), 1: (0.90, 1.20), 2: (1.10, 1.50), 3: (1.30, 2.50)}[tier]
        ))

        # NACH debit count (existing loan obligations)
        nach_debit_count = float(random.randint(
            *{0: (3, 15), 1: (1, 8), 2: (0, 5), 3: (0, 3)}[tier]
        ))

        # Average monthly revenue in lakhs (₹1L = ₹100,000)
        avg_monthly_revenue_lakh = random.uniform(
            *{0: (0.5, 5.0), 1: (2.0, 20.0), 2: (10.0, 50.0), 3: (30.0, 200.0)}[tier]
        )

        # GST compliance ratio (0 = no GST data)
        gst_compliance_ratio = (
            random.uniform(
                *{0: (0.30, 0.70), 1: (0.60, 0.85), 2: (0.80, 0.95), 3: (0.90, 1.00)}[tier]
            )
            if random.random() > 0.15
            else 0.0
        )

        # GST declared turnover in lakhs (annual)
        gst_turnover_lakh = (
            avg_monthly_revenue_lakh * 12 * random.uniform(0.7, 1.1)
            if gst_compliance_ratio > 0
            else 0.0
        )

        # Current account balance in lakhs
        bal_mult = {0: (0.1, 1.0), 1: (0.5, 3.0), 2: (1.0, 8.0), 3: (3.0, 20.0)}[tier]
        current_balance_lakh = avg_monthly_revenue_lakh * random.uniform(*bal_mult)

        # Invoice overdue ratio (lower = better)
        invoice_overdue_ratio = random.uniform(
            *{0: (0.30, 0.80), 1: (0.10, 0.40), 2: (0.00, 0.20), 3: (0.00, 0.10)}[tier]
        )

        # Data window in months
        data_window_months = random.uniform(6.0, 24.0)

        # Transaction velocity (txns / month)
        transaction_velocity = total_transactions / data_window_months

        # Revenue consistency (proxy via cf_ratio stability)
        cf_score = min(1.0, max(0.0, (credit_debit_ratio - 0.5) / 2.5))
        nach_pen = min(0.5, nach_debit_count / 10.0)
        revenue_consistency = max(0.0, min(1.0, cf_score - nach_pen + random.gauss(0, 0.05)))

        row = [
            total_transactions,
            upi_ratio,
            credit_debit_ratio,
            nach_debit_count,
            avg_monthly_revenue_lakh,
            gst_compliance_ratio,
            gst_turnover_lakh,
            current_balance_lakh,
            invoice_overdue_ratio,
            data_window_months,
            transaction_velocity,
            revenue_consistency,
        ]

        # Target score: tier base + feature-influenced adjustment + Gaussian noise
        base = {0: 390, 1: 545, 2: 685, 3: 785}[tier]
        adjustment = (
            + (credit_debit_ratio - 1.0) * 30
            + upi_ratio * 20
            - nach_debit_count * 5
            + gst_compliance_ratio * 25
            - invoice_overdue_ratio * 30
            + revenue_consistency * 20
        )
        noise = random.gauss(0, 20)
        score = max(300.0, min(850.0, base + adjustment + noise))

        rows.append(row)
        targets.append(score)

    return np.array(rows, dtype=float), np.array(targets, dtype=float)


# ── Training ─────────────────────────────────────────────────────────────────

def train_and_export():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Generating {N_SAMPLES} synthetic MSME records...")
    X, y = generate_msme_data(N_SAMPLES)

    # Normalize (z-score per feature)
    means = X.mean(axis=0)
    stds = X.std(axis=0)
    stds[stds == 0] = 1.0
    X_norm = (X - means) / stds

    if SKLEARN_AVAILABLE:
        model = Ridge(alpha=1.0, random_state=SEED)
        model.fit(X_norm, y)
        coefficients = model.coef_.tolist()
        intercept = float(model.intercept_)
        y_pred = model.predict(X_norm)
    else:
        # Numpy-only fallback: ordinary least squares via normal equations
        X_aug = np.column_stack([np.ones(len(X_norm)), X_norm])
        theta, _, _, _ = np.linalg.lstsq(X_aug, y, rcond=None)
        intercept = float(theta[0])
        coefficients = theta[1:].tolist()
        y_pred = X_aug @ theta

    rmse = math.sqrt(float(np.mean((y_pred - y) ** 2)))
    print(f"Training RMSE: {rmse:.2f} score points")

    # ── Export ───────────────────────────────────────────────────────────────
    model_meta = {
        "model_version": "linear-v1.0.0",
        "model_type": "ridge_regression",
        "description": (
            "Calibrated credit scoring model trained on synthetic Indian MSME proxy data. "
            "Coefficients represent feature weights learned from data (not hand-tuned rules). "
            "SHAP attribution is exact for linear models: contribution_i = coeff_i * z_score_i."
        ),
        "n_features": len(FEATURE_NAMES),
        "feature_names": FEATURE_NAMES,
        "feature_labels": FEATURE_LABELS,
        "intercept": intercept,
        "coefficients": coefficients,
        "feature_means": means.tolist(),
        "feature_stds": stds.tolist(),
        "score_clamp": {"min": 300.0, "max": 850.0},
        "training": {
            "n_samples": N_SAMPLES,
            "seed": SEED,
            "rmse": round(rmse, 2),
            "sklearn_used": SKLEARN_AVAILABLE,
        },
    }

    output_path = OUTPUT_DIR / "model_meta.json"
    with open(output_path, "w") as f:
        json.dump(model_meta, f, indent=2)

    print(f"\nModel exported -> {output_path.relative_to(REPO_ROOT)}")

    print(f"Features      : {len(FEATURE_NAMES)}")
    print(f"Intercept     : {intercept:.2f}")
    print("\nTop coefficients (absolute value):")
    coeff_pairs = sorted(
        zip(FEATURE_NAMES, coefficients), key=lambda x: abs(x[1]), reverse=True
    )
    for name, coeff in coeff_pairs[:8]:
        sign = "+" if coeff >= 0 else "-"
        print(f"  {sign}{abs(coeff):7.3f}  {FEATURE_LABELS[name]}")

    print("\nDone. Run 'docker compose up --build scoring' to pick up the new model.")
    return output_path


if __name__ == "__main__":
    train_and_export()
