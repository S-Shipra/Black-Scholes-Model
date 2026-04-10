"""
Agent 5 – Strategy  (Volatility-Mispricing  ×  Market-Direction)
=================================================================

Decision logic
--------------
The final action is built in two stages:

Stage A – Volatility signal  (from Black-Scholes mispricing)
    UNDERPRICED  → lean BUY
    OVERPRICED   → lean SELL
    FAIR         → no vol edge

Stage B – Direction signal   (from direction.py: trend + momentum)
    bullish      → lean BUY
    bearish      → lean SELL
    neutral      → no directional edge

Combining Stage A + B
─────────────────────
Both agree (e.g. UNDERPRICED + bullish)
    → STRONG signal; action = BUY/SELL, confidence boosted

Vol signal only (direction neutral / low-conf)
    → MODERATE signal; follow vol edge

Direction signal only (FAIR pricing)
    → MODERATE signal; follow direction, only if medium/high confidence

They conflict (e.g. UNDERPRICED + bearish)
    → Use confidence levels to decide:
        direction high AND vol edge mild  → follow direction
        vol edge strong AND direction low → follow vol
        otherwise                         → HOLD (uncertainty)

Registered tool: suggest_strategy
"""
from __future__ import annotations

import logging
import json
import os

from utils.tool_registry import ToolRegistry
from groq import Groq

logger = logging.getLogger(__name__)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


# ─────────────────────────────────────────────────────────────────────────────
# Thresholds
# ─────────────────────────────────────────────────────────────────────────────

STRONG_MISPRICING  = 2.0   # % — strong vol signal
MILD_MISPRICING    = 1.0   # % — mild vol signal
STRONG_DELTA       = 0.6   # absolute delta — high directional confidence
MILD_DELTA         = 0.4

# Direction score thresholds (from direction.py, range [-1, +1])
DIR_STRONG         = 0.45  # |score| ≥ this → strong directional bias
DIR_MILD           = 0.20  # |score| ≥ this → mild directional bias


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _f2(val) -> str:
    return f"{float(val):.2f}" if val is not None else "N/A"

def _f3(val) -> str:
    return f"{float(val):.3f}" if val is not None else "N/A"

def _f4(val) -> str:
    return f"{float(val):.4f}" if val is not None else "N/A"

def _safe_float(val, fallback: float = 0.0) -> float:
    return float(val) if val is not None else fallback

def _conf_rank(confidence: str) -> int:
    """Map confidence label to an integer for easy comparison."""
    return {"high": 3, "medium": 2, "low": 1}.get(str(confidence).lower(), 0)


# ─────────────────────────────────────────────────────────────────────────────
# Stage A – Volatility / mispricing signal
# ─────────────────────────────────────────────────────────────────────────────

def _vol_signal(mispricing_pct: float) -> tuple[str, str]:
    """
    Returns (action_lean, strength)
        action_lean : 'BUY' | 'SELL' | 'HOLD'
        strength    : 'strong' | 'mild' | 'none'
    """
    abs_m = abs(mispricing_pct)
    if mispricing_pct < -STRONG_MISPRICING:
        return "BUY",  "strong"
    if mispricing_pct < -MILD_MISPRICING:
        return "BUY",  "mild"
    if mispricing_pct >  STRONG_MISPRICING:
        return "SELL", "strong"
    if mispricing_pct >  MILD_MISPRICING:
        return "SELL", "mild"
    return "HOLD", "none"


# ─────────────────────────────────────────────────────────────────────────────
# Stage B – Direction signal
# ─────────────────────────────────────────────────────────────────────────────

def _dir_signal(
    direction: str,
    direction_score: float,
    direction_confidence: str,
    option_type: str,
) -> tuple[str, str]:
    """
    Maps directional bias → option action lean for the given option_type.

    Returns (action_lean, strength)
        action_lean : 'BUY' | 'SELL' | 'HOLD'
        strength    : 'strong' | 'mild' | 'none'
    """
    opt    = option_type.lower()
    d      = direction.lower()
    abs_ds = abs(direction_score)

    if d == "neutral" or _conf_rank(direction_confidence) == 1:
        return "HOLD", "none"

    # Strength of directional signal
    strength = "strong" if abs_ds >= DIR_STRONG else "mild"

    # Map direction → trade action per option type
    if opt == "call":
        # bullish → buy call; bearish → sell call (or buy put)
        if d == "bullish":
            return "BUY",  strength
        else:
            return "SELL", strength
    else:  # put
        # bearish → buy put; bullish → sell put
        if d == "bearish":
            return "BUY",  strength
        else:
            return "SELL", strength


# ─────────────────────────────────────────────────────────────────────────────
# Combined decision engine
# ─────────────────────────────────────────────────────────────────────────────

_STRENGTH_RANK = {"strong": 2, "mild": 1, "none": 0}


def _combined_decision(
    vol_lean: str, vol_strength: str,
    dir_lean: str, dir_strength: str,
    direction_confidence: str,
) -> tuple[str, str, str]:
    """
    Combine vol + direction leaning into one final action.

    Returns (action, confidence_label, decision_reason)
        action           : 'BUY' | 'SELL' | 'HOLD'
        confidence_label : 'HIGH' | 'MEDIUM' | 'LOW'
        decision_reason  : short human-readable explanation
    """
    vr = _STRENGTH_RANK[vol_strength]
    dr = _STRENGTH_RANK[dir_strength]
    dc = _conf_rank(direction_confidence)

    # ── Case 1: Both agree ───────────────────────────────────────────────────
    if vol_lean == dir_lean and vol_lean != "HOLD":
        combined_strength = max(vr, dr)
        conf = "HIGH" if combined_strength == 2 else "MEDIUM"
        reason = (
            f"Volatility mispricing ({vol_strength}) and market direction "
            f"({dir_strength}) both point to {vol_lean}. Signals are aligned."
        )
        return vol_lean, conf, reason

    # ── Case 2: Vol signal only (direction neutral/none) ────────────────────
    if vol_lean != "HOLD" and dir_lean == "HOLD":
        conf = "MEDIUM" if vr == 2 else "LOW"
        reason = (
            f"Volatility mispricing ({vol_strength}) suggests {vol_lean}. "
            "No clear directional edge; relying on vol signal alone."
        )
        return vol_lean, conf, reason

    # ── Case 3: Direction signal only (vol edge none) ───────────────────────
    if dir_lean != "HOLD" and vol_lean == "HOLD":
        if dc >= 2:          # medium or high direction confidence
            conf = "MEDIUM" if dr == 2 else "LOW"
            reason = (
                f"Options are fairly priced (no vol edge). "
                f"Market direction is {dir_lean} with {direction_confidence} confidence — "
                "trading on directional bias only."
            )
            return dir_lean, conf, reason
        else:
            reason = (
                "Options are fairly priced and direction confidence is low. "
                "Insufficient edge to act."
            )
            return "HOLD", "LOW", reason

    # ── Case 4: Conflict ─────────────────────────────────────────────────────
    if vol_lean != "HOLD" and dir_lean != "HOLD" and vol_lean != dir_lean:
        # If direction is clearly stronger → follow direction
        if dc == 3 and vr <= 1:
            reason = (
                f"Conflicting signals: vol says {vol_lean} ({vol_strength}), "
                f"direction says {dir_lean} (high confidence). "
                "High-confidence direction overrides mild vol signal."
            )
            return dir_lean, "MEDIUM", reason

        # If vol is clearly stronger → follow vol
        if vr == 2 and dc <= 1:
            reason = (
                f"Conflicting signals: direction says {dir_lean} (low confidence), "
                f"vol says {vol_lean} (strong). "
                "Strong vol mispricing overrides weak directional signal."
            )
            return vol_lean, "MEDIUM", reason

        # Both moderate → too much uncertainty
        reason = (
            f"Conflicting signals: vol says {vol_lean} ({vol_strength}), "
            f"direction says {dir_lean} ({direction_confidence} confidence). "
            "Signals cancel out — no clear edge."
        )
        return "HOLD", "LOW", reason

    # ── Fallback ─────────────────────────────────────────────────────────────
    return "HOLD", "LOW", "Insufficient signal strength to act."


# ─────────────────────────────────────────────────────────────────────────────
# Trade metrics
# ─────────────────────────────────────────────────────────────────────────────

def _compute_trade_metrics(action: str, option_type: str, strike: float, premium: float) -> dict:
    opt = option_type.lower()
    act = action.upper()

    if act == "HOLD" or premium == 0 or strike == 0:
        return {"break_even": None, "max_profit": None, "max_loss": None}

    if opt == "call" and act == "BUY":
        return {
            "break_even": round(strike + premium, 2),
            "max_profit": "Unlimited",
            "max_loss":   round(premium, 2),
        }
    if opt == "put" and act == "BUY":
        return {
            "break_even": round(strike - premium, 2),
            "max_profit": round(strike - premium, 2),
            "max_loss":   round(premium, 2),
        }
    if opt == "call" and act == "SELL":
        return {
            "break_even": round(strike + premium, 2),
            "max_profit": round(premium, 2),
            "max_loss":   "Unlimited",
        }
    if opt == "put" and act == "SELL":
        return {
            "break_even": round(strike - premium, 2),
            "max_profit": round(premium, 2),
            "max_loss":   round(strike - premium, 2),
        }
    return {"break_even": None, "max_profit": None, "max_loss": None}


# ─────────────────────────────────────────────────────────────────────────────
# Role-based actions  (unchanged logic; direction-aware context only in LLM)
# ─────────────────────────────────────────────────────────────────────────────

def _role_based_actions(mispricing_pct: float, delta: float, direction: str) -> dict:
    """
    Each role applies the combined (vol + direction) logic at its own
    risk tolerance:

      Trader       — acts on mild mispricing OR strong direction
      Hedger       — only strong mispricing AND confirming direction
      Arbitrageur  — pure mispricing; ignores direction
    """
    abs_misp = abs(mispricing_pct)
    abs_d    = abs(delta)
    d        = direction.lower()

    # ── Trader ───────────────────────────────────────────────────────────────
    vol_ok  = abs_misp >= MILD_MISPRICING and abs_d >= MILD_DELTA
    dir_ok  = d != "neutral"
    if mispricing_pct < -MILD_MISPRICING and abs_d >= MILD_DELTA:
        trader = "BUY"
    elif mispricing_pct > MILD_MISPRICING and abs_d >= MILD_DELTA:
        trader = "SELL"
    elif d == "bullish" and abs_misp < MILD_MISPRICING:
        trader = "BUY"                      # directional-only trade
    elif d == "bearish" and abs_misp < MILD_MISPRICING:
        trader = "SELL"
    else:
        trader = "HOLD"

    # ── Hedger (most conservative) ───────────────────────────────────────────
    if abs_misp >= STRONG_MISPRICING:
        # Only act if direction does not directly contradict
        if mispricing_pct < 0 and d != "bearish":
            hedger = "BUY"
        elif mispricing_pct > 0 and d != "bullish":
            hedger = "SELL"
        else:
            hedger = "HOLD"   # conflicting — skip
    else:
        hedger = "HOLD"

    # ── Arbitrageur (mispricing only) ─────────────────────────────────────────
    if abs_misp >= MILD_MISPRICING:
        arbitrageur = "BUY" if mispricing_pct < 0 else "SELL"
    else:
        arbitrageur = "HOLD"

    return {
        "trader":      trader,
        "hedger":      hedger,
        "arbitrageur": arbitrageur,
    }


# ─────────────────────────────────────────────────────────────────────────────
# LLM insight generator  (now direction-aware)
# ─────────────────────────────────────────────────────────────────────────────

def _llm_insights(
    signal: str,
    option_type: str,
    mispricing_pct: float,
    implied_vol,
    historical_vol,
    role_actions: dict,
    direction: str,
    direction_score: float,
    direction_confidence: str,
    decision_reason: str,
) -> dict:
    prompt = f"""
You are a senior options trading analyst. Explain each role's trading decision in 2-3 concise sentences.

MARKET DATA:
- Option type:          {option_type}
- Mispricing:           {_f2(mispricing_pct)}%
- Implied vol:          {_f4(implied_vol)}
- Historical vol:       {_f4(historical_vol)}
- Pricing signal:       {signal}
- Market direction:     {direction}  (score: {_f3(direction_score)}, confidence: {direction_confidence})
- Decision rationale:   {decision_reason}

ROLE DECISIONS (already determined — your job is only to explain them):
- Trader:       {role_actions['trader']}
- Hedger:       {role_actions['hedger']}
- Arbitrageur:  {role_actions['arbitrageur']}

Return ONLY a JSON object with no extra text:
{{
  "trader":      "explanation here",
  "hedger":      "explanation here",
  "arbitrageur": "explanation here"
}}
"""
    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        return json.loads(response.choices[0].message.content)

    except Exception as exc:
        logger.error("LLM insight error: %s", exc)
        return {
            "trader":      "No insight available.",
            "hedger":      "No insight available.",
            "arbitrageur": "No insight available.",
        }


# ─────────────────────────────────────────────────────────────────────────────
# Volatility commentary
# ─────────────────────────────────────────────────────────────────────────────

def _vol_commentary(implied_vol: float, historical_vol: float) -> str:
    iv_pct = round(implied_vol  * 100, 2)
    hv_pct = round(historical_vol * 100, 2)

    if iv_pct > hv_pct:
        return (
            f"IV ({iv_pct}%) is above HV ({hv_pct}%) — options are relatively expensive. "
            "Sellers have an edge if realised vol stays near historical levels."
        )
    if iv_pct < hv_pct:
        return (
            f"IV ({iv_pct}%) is below HV ({hv_pct}%) — options are relatively cheap. "
            "Buyers may find value if realised vol continues near historical levels."
        )
    return (
        f"IV ({iv_pct}%) and HV ({hv_pct}%) are in line — "
        "options are fairly priced by volatility."
    )


# ─────────────────────────────────────────────────────────────────────────────
# Main function
# ─────────────────────────────────────────────────────────────────────────────

def _suggest_strategy(
    # ── existing params ──────────────────────────────────────────────────────
    signal: str,
    option_type: str,
    delta: float,
    mispricing_pct: float,
    implied_vol,
    historical_vol,
    strike: float,
    premium: float,
    # ── direction params (NEW — passed in by orchestrator) ───────────────────
    direction_score: float        = 0.0,
    direction: str                = "neutral",
    direction_confidence: str     = "low",
    direction_suggestion: str     = "no_trade",   # from direction.py bs_suggestion
) -> dict:
    """
    Build a full strategy recommendation by combining:
      • Volatility mispricing signal  (Black-Scholes theoretical vs market)
      • Market direction signal       (trend + momentum from direction.py)
    """

    # ── Sanitise inputs ───────────────────────────────────────────────────────
    mispricing_pct       = _safe_float(mispricing_pct)
    delta                = _safe_float(delta)
    implied_vol          = _safe_float(implied_vol)
    historical_vol       = _safe_float(historical_vol)
    strike               = _safe_float(strike)
    premium              = _safe_float(premium)
    direction_score      = _safe_float(direction_score)

    # ── Stage A: vol signal ───────────────────────────────────────────────────
    vol_lean, vol_strength = _vol_signal(mispricing_pct)

    # ── Stage B: direction signal ─────────────────────────────────────────────
    dir_lean, dir_strength = _dir_signal(
        direction, direction_score, direction_confidence, option_type
    )

    # ── Combined decision ─────────────────────────────────────────────────────
    action, confidence_label, decision_reason = _combined_decision(
        vol_lean, vol_strength,
        dir_lean, dir_strength,
        direction_confidence,
    )

    # ── Role-based views ──────────────────────────────────────────────────────
    role_actions = _role_based_actions(mispricing_pct, delta, direction)

    # ── LLM explains ─────────────────────────────────────────────────────────
    role_insights = _llm_insights(
        signal, option_type, mispricing_pct,
        implied_vol, historical_vol, role_actions,
        direction, direction_score, direction_confidence,
        decision_reason,
    )

    # ── Trade metrics ─────────────────────────────────────────────────────────
    metrics = _compute_trade_metrics(action, option_type, strike, premium)

    # ── Strategy label ────────────────────────────────────────────────────────
    strategy = (
        "No Trade Opportunity"
        if action == "HOLD"
        else f"{action} {option_type.upper()}"
    )

    # ── Direction summary for output ──────────────────────────────────────────
    direction_summary = (
        f"Market direction is {direction.upper()} "
        f"(score {direction_score:+.3f}, {direction_confidence} confidence). "
        f"Direction lean for this {option_type}: {dir_lean} ({dir_strength})."
    )

    # ── Rationale ─────────────────────────────────────────────────────────────
    rationale = (
        f"Vol signal: {vol_lean} ({vol_strength}) — mispricing {_f2(mispricing_pct)}%. "
        f"Direction signal: {dir_lean} ({dir_strength}) — {direction}, "
        f"score {direction_score:+.3f}. "
        f"{decision_reason}"
    )

    return {
        # ── Primary output ────────────────────────────────────────────────────
        "strategy":            strategy,
        "action":              action,
        "confidence":          confidence_label,

        # ── Signal breakdown ──────────────────────────────────────────────────
        "vol_lean":            vol_lean,
        "vol_strength":        vol_strength,
        "dir_lean":            dir_lean,
        "dir_strength":        dir_strength,
        "signals_aligned":     vol_lean == dir_lean and vol_lean != "HOLD",

        # ── Direction data ────────────────────────────────────────────────────
        "direction":           direction,
        "direction_score":     round(direction_score, 4),
        "direction_confidence":direction_confidence,
        "direction_suggestion":direction_suggestion,
        "direction_summary":   direction_summary,

        # ── Rationale + commentary ────────────────────────────────────────────
        "rationale":           rationale,
        "decision_reason":     decision_reason,
        "vol_commentary":      _vol_commentary(implied_vol, historical_vol),

        # ── Role views ────────────────────────────────────────────────────────
        "actions_by_role":     role_actions,
        "role_insights":       role_insights,

        # ── Trade metrics ─────────────────────────────────────────────────────
        "break_even":          metrics["break_even"],
        "max_profit":          metrics["max_profit"],
        "max_loss":            metrics["max_loss"],

        # ── Vol data ──────────────────────────────────────────────────────────
        "implied_vol":         implied_vol,
        "historical_vol":      historical_vol,

        # ── Risk level  (can be overridden by risk agent) ─────────────────────
        "risk_level":          "MODERATE",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────────────────────────────────────

def register(registry: ToolRegistry) -> None:
    registry.register(
        "suggest_strategy",
        _suggest_strategy,
        description=(
            "Strategy engine: combines Black-Scholes vol-mispricing signal with "
            "market direction (trend + momentum) to produce a final BUY / SELL / HOLD "
            "recommendation with confidence level and role-based views."
        ),
    )
