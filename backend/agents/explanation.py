"""
Agent 7 – Explanation  (Groq backend)
======================================
Install dependency:
    pip install groq
"""
from __future__ import annotations

import json
import logging

from config import GROQ_API_KEY, GROQ_MODEL
from utils.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)


_SYSTEM_PROMPT = """You are an options analyst.
Read the provided JSON with stock/options data, pricing, IV/HV, direction, and strategy.
Write a VERY brief plain-English summary (100-150 words) for a trader.
Structure exactly as follows:
1. Market: Spot price & trend.
2. Pricing & Vol: BS fair value vs Market price; IV vs HV.
3. Recommendation: Final action with reasoning (reconciling mispricing & direction). Note conflicts explicitly.
4. Risks: 1-2 bullet points.
Be direct, no fluff."""


def _build_minimal_payload(state: dict) -> tuple[str, int]:
    """
    Construct a lean payload dict from scratch using ONLY the fields
    the system prompt references. Ignores everything else in state.

    Target: < 500 tokens (well under Groq's 12k TPM limit).
    """
    inp       = state.get("input",               {})
    bs        = state.get("bs_price_data",       {})
    spot_data = state.get("spot_price_data",     {})
    greeks    = state.get("greeks",              {})
    iv_data   = state.get("iv_data",             {})
    hv_data   = state.get("historical_vol_data", {})
    misp      = state.get("mispricing",          {})
    direction = state.get("direction_data",      {})
    strat     = state.get("strategy",            {})
    risk      = state.get("model_risk",          {})

    # Drop the last generic BS disclaimer flag
    flags = risk.get("flags", [])
    flags = flags[:-1] if len(flags) > 1 else flags

    payload = {
        "input": {
            "tick": inp.get("ticker"),
            "type": inp.get("option_type"),
            "strike": inp.get("strike"),
            "exp": inp.get("expiry"),
        },
        "spot": spot_data.get("spot_price"),
        "bs_p": bs.get("bs_price"),
        "mkt_p": state.get("market_price", misp.get("market_price")),
        "delta": greeks.get("delta"),
        "iv": iv_data.get("implied_volatility"),
        "hv": hv_data.get("historical_vol"),
        "misp_pct": misp.get("mispricing_pct"),
        "dir": direction.get("direction"),
        "strat": strat.get("strategy"),
        "act": strat.get("action"),
        "risk_lvl": risk.get("risk_level"),
        "flags": flags[:2],
    }

    serialised     = json.dumps(payload, default=str)
    estimated_tokens = len(serialised) // 4

    # ── Always log so you can monitor payload size during dev ─────────────────
    logger.info(
        "[Groq] Payload size: %d chars / ~%d tokens",
        len(serialised), estimated_tokens
    )

    return serialised, estimated_tokens


def _generate_explanation(state: dict) -> dict:
    if not GROQ_API_KEY:
        logger.warning("GROQ_API_KEY not set – using rule-based fallback.")
        return _fallback_explanation(state)

    try:
        from groq import Groq

        client = Groq(api_key=GROQ_API_KEY)
        payload, estimated_tokens = _build_minimal_payload(state)

        # System prompt ~100 tokens + response cap 250 tokens + payload
        total_estimate = estimated_tokens + 100 + 250
        if total_estimate > 5000:
            logger.warning(
                "[Groq] Estimated total tokens (%d) too close to limit. Falling back.",
                total_estimate,
            )
            return _fallback_explanation(
                state,
                error=f"Payload too large (~{total_estimate} tokens estimated)",
            )

        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user",   "content": payload},
            ],
            temperature=0.3,
            max_tokens=250,
        )

        explanation = response.choices[0].message.content.strip()

        try:
            tokens_used = response.usage.total_tokens
        except Exception:
            tokens_used = None

        logger.info("[Groq] Tokens actually used: %s", tokens_used)

        return {
            "explanation": explanation,
            "model":       GROQ_MODEL,
            "tokens_used": tokens_used,
            "source":      "groq",
        }

    except ImportError:
        logger.error("groq not installed. Run: pip install groq")
        return _fallback_explanation(state, error="groq package not installed")

    except Exception as exc:
        logger.error("Groq explanation error: %s", exc)
        return _fallback_explanation(state, error=str(exc))


def _fallback_explanation(state: dict, error: str | None = None) -> dict:
    """
    Rule-based explanation — no external API needed.
    Used when Groq is unavailable, key is missing, or payload is too large.
    """
    inp       = state.get("input",                {})
    misp      = state.get("mispricing",           {})
    strat     = state.get("strategy",             {})
    risk      = state.get("model_risk",           {})
    bs        = state.get("bs_price_data",        {})
    spot_data = state.get("spot_price_data",      {})
    greeks    = state.get("greeks",               {})
    iv_data   = state.get("iv_data",              {})
    hv_data   = state.get("historical_vol_data",  {})
    direction = state.get("direction_data",       {})

    ticker  = inp.get("ticker",      "N/A")
    otype   = inp.get("option_type", "option").upper()
    strike  = inp.get("strike",      "N/A")
    expiry  = inp.get("expiry",      "N/A")

    spot    = spot_data.get("spot_price", "N/A")
    bs_p    = bs.get("bs_price",          "N/A")
    mkt_p   = state.get("market_price", misp.get("market_price", "N/A"))

    pct     = misp.get("mispricing_pct")
    action  = strat.get("action",   "REVIEW")
    strat_n = strat.get("strategy", "N/A")
    risk_l  = risk.get("risk_level", "N/A")
    iv      = iv_data.get("implied_volatility")
    hv      = hv_data.get("historical_vol")
    delta   = greeks.get("delta")

    dir_label   = direction.get("direction",            "neutral")
    dir_score   = direction.get("direction_score",      0.0)
    dir_conf    = direction.get("direction_confidence", "low")
    dir_suggest = direction.get("direction_suggestion", "no_trade")
    aligned     = strat.get("signals_aligned", False)
    confidence  = strat.get("confidence",      "LOW")

    lines = [
        f"**{ticker} {otype} ${strike} expiring {expiry}**\n",
        f"Spot: ${spot}  |  BS fair value: ${bs_p}  |  Market price: ${mkt_p}",
        "",
    ]

    if pct is not None:
        if abs(pct) < 5:
            lines.append(f"The option appears fairly priced (deviation: {pct:+.2f}%).")
        elif pct > 0:
            lines.append(
                f"The option is OVERPRICED by {pct:.2f}% vs the BS model. "
                f"Strategy: {strat_n} → **{action}**."
            )
        else:
            lines.append(
                f"The option is UNDERPRICED by {abs(pct):.2f}% vs the BS model. "
                f"Strategy: {strat_n} → **{action}**."
            )

    if iv and hv:
        lines.append(
            f"\nImplied vol: {iv:.1%}  vs  Historical vol: {hv:.1%}. "
            + (
                "IV premium — market expects larger-than-normal moves."
                if iv > hv else
                "IV discount — volatility appears cheap relative to recent history."
            )
        )

    lines.append(
        f"\nMarket direction: **{dir_label.upper()}** "
        f"(score {dir_score:+.3f}, {dir_conf} confidence). "
        f"Direction suggestion: {dir_suggest.replace('_', ' ')}."
    )

    if aligned:
        lines.append(
            "✓ Vol-mispricing signal and directional bias are ALIGNED — "
            f"both support {action}. Overall confidence: {confidence}."
        )
    else:
        vol_lean = strat.get("vol_lean", "HOLD")
        dir_lean = strat.get("dir_lean", "HOLD")
        if vol_lean != "HOLD" and dir_lean != "HOLD" and vol_lean != dir_lean:
            lines.append(
                f"⚠ CONFLICTING signals — vol says {vol_lean}, "
                f"direction says {dir_lean}. "
                f"Final decision ({action}) reflects the stronger signal. "
                "Trade with reduced size."
            )
        else:
            lines.append(
                f"Signal source: {'vol mispricing' if vol_lean != 'HOLD' else 'direction only'}. "
                f"Overall confidence: {confidence}."
            )

    if delta is not None:
        lines.append(
            f"\nDelta: {delta:.2f} — ~{abs(delta) * 100:.0f}% "
            "probability of finishing in-the-money."
        )

    lines.append(f"\nModel risk level: **{risk_l}**.")
    specific_flags = risk.get("flags", [])[:-1]
    for f in specific_flags:
        lines.append(f"  • {f}")

    if error:
        lines.append(
            f"\n_(Groq unavailable: {error} — using rule-based explanation)_"
        )

    return {
        "explanation": "\n".join(lines),
        "model":       "rule-based fallback",
        "tokens_used": None,
        "source":      "fallback",
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        "generate_explanation",
        _generate_explanation,
        description=(
            "Send full analysis state to Groq and return a plain-English summary "
            "covering pricing, volatility, market direction, trade recommendation, "
            "and risk flags."
        ),
    )
