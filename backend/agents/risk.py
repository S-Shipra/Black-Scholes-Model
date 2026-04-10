"""
Agent 6 – Model Risk
====================
Tools registered:
  • check_volatility_skew
  • assess_model_risk
"""
from __future__ import annotations

import logging

from config import SKEW_THRESHOLD, IV_HV_DIVERGENCE_THRESHOLD
from utils.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)


def _check_volatility_skew(
    options_chain: dict,
    option_type: str = "call",
) -> dict:
    """
    Analyse the volatility smile/skew from the options chain.
    Flags large dispersion in IV across strikes.
    """
    side = options_chain.get("calls" if option_type == "call" else "puts", [])
    if not side:
        return {"skew_detected": False, "skew_data": [], "skew_magnitude": None}

    strike_iv = []
    for row in side:
        iv  = row.get("impliedVolatility", 0)
        stk = row.get("strike", 0)
        vol = row.get("volume", 0) or 0
        oi  = row.get("openInterest", 0) or 0
        # Only include liquid strikes
        if iv and iv > 0 and (vol + oi) > 10:
            strike_iv.append({"strike": stk, "iv": round(iv, 4)})

    if len(strike_iv) < 3:
        return {"skew_detected": False, "skew_data": strike_iv, "skew_magnitude": None}

    ivs       = [x["iv"] for x in strike_iv]
    iv_range  = max(ivs) - min(ivs)
    skew_flag = iv_range > SKEW_THRESHOLD

    return {
        "skew_detected":  skew_flag,
        "skew_magnitude": round(iv_range, 4),
        "iv_min":         round(min(ivs), 4),
        "iv_max":         round(max(ivs), 4),
        "skew_threshold": SKEW_THRESHOLD,
        "skew_data":      strike_iv,
        "warning": (
            f"Volatility skew detected (range={iv_range:.2%}). "
            "Black-Scholes assumes flat vol; skew undermines model accuracy."
        ) if skew_flag else "Volatility surface appears relatively flat.",
    }


def _assess_model_risk(
    implied_vol: float | None,
    historical_vol: float | None,
    skew_detected: bool,
    T_years: float,
    option_type: str,
    delta: float | None = None,
) -> dict:
    """
    Holistic Black-Scholes model-risk assessment.
    Returns a risk score 0–100 and a list of flagged assumptions.

    Score budget
    ------------
      IV/HV divergence   → up to 30
      Volatility skew    → 20
      Near-expiry        → 25
      Deep ITM           → 10
      Deep OTM           → 15
      Maximum possible   → 100  (capped)
    """
    specific_flags = []
    risk_score = 0

    # 1 – IV vs HV divergence
    # Explicit None check — treats 0.0 as a valid (if unusual) vol value
    if implied_vol is not None and historical_vol is not None and historical_vol > 0:
        gap = abs(implied_vol - historical_vol)
        if gap > IV_HV_DIVERGENCE_THRESHOLD:
            specific_flags.append(
                f"IV ({implied_vol:.1%}) deviates {gap:.1%} from HV ({historical_vol:.1%}). "
                "Possible vol regime shift or event risk."
            )
            risk_score += min(int(gap * 300), 30)

    # 2 – Volatility smile / skew
    if skew_detected:
        specific_flags.append(
            "Volatility skew detected. BS assumes constant vol across strikes — "
            "model price may be unreliable away from ATM."
        )
        risk_score += 20

    # 3 – Near-expiry: gamma risk, pin risk
    if T_years < 7 / 365:
        specific_flags.append(
            "Expiry within 7 days. Gamma is very high; small spot moves create "
            "large P&L swings. BS may misprice near expiry."
        )
        risk_score += 25

    # 4 – Deep ITM / OTM
    if delta is not None:
        if abs(delta) > 0.95:
            specific_flags.append(
                "Option is very deep ITM (delta ≈ 1). "
                "Extrinsic value is near zero; BS provides little incremental information."
            )
            risk_score += 10
        elif abs(delta) < 0.05:
            specific_flags.append(
                "Option is very deep OTM (delta ≈ 0). "
                "BS may underestimate tail-risk probabilities (fat tails)."
            )
            risk_score += 15

    risk_score = min(risk_score, 100)

    if risk_score < 20:
        risk_level = "LOW"
    elif risk_score < 50:
        risk_level = "MODERATE"
    elif risk_score < 75:
        risk_level = "HIGH"
    else:
        risk_level = "VERY HIGH"

    # Generic note always appended last — kept separate from specific_flags
    # so num_flags count is not affected by it
    generic_note = (
        "BS assumptions: constant vol, no dividends explicitly modelled, "
        "continuous trading, no transaction costs."
    )

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "flags":      specific_flags + [generic_note],
        "num_flags":  len(specific_flags),   # excludes the generic note
        "summary": (
            f"Model risk is {risk_level} (score={risk_score}/100). "
            f"{len(specific_flags)} specific risk factor(s) identified."
        ),
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        "check_volatility_skew",
        _check_volatility_skew,
        description="Detect volatility skew/smile across the options chain.",
    )
    registry.register(
        "assess_model_risk",
        _assess_model_risk,
        description=(
            "Holistic BS model-risk assessment "
            "(skew, IV/HV gap, near-expiry, delta extremes)."
        ),
    )