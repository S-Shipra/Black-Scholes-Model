"""
Agent 4 – Mispricing Detection
===============================
Tools registered:
  • detect_mispricing
"""
from __future__ import annotations

import logging

from config import MISPRICING_THRESHOLD_PCT
from utils.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)


def _detect_mispricing(
    bs_price: float,
    market_price: float,
    threshold_pct: float = MISPRICING_THRESHOLD_PCT,
) -> dict:
    """
    Compare theoretical BS price vs market price.

    Returns
    -------
    dict with:
      • mispricing_pct      – signed % deviation  (market − BS) / BS × 100
      • mispricing_dollar_gap – signed dollar gap  (market − BS)
      • is_mispriced        – True when |pct| > threshold
      • pricing_direction   – "overpriced" | "underpriced" | "fairly_priced"
      • signal              – "OVERPRICED" | "UNDERPRICED" | "FAIR"
                              (matches bs_math.py convention)
    """
    if bs_price <= 0:
        return {
            "mispricing_pct":        None,
            "mispricing_dollar_gap": None,
            "is_mispriced":          False,
            "pricing_direction":     "indeterminate",
            "signal":                "no_signal",
            "bs_price":              bs_price,
            "market_price":          market_price,
        }

    pct      = (market_price - bs_price) / bs_price * 100
    dollar_gap = round(market_price - bs_price, 4)
    is_mispriced = abs(pct) > threshold_pct

    if not is_mispriced:
        pricing_direction = "fairly_priced"
        signal            = "FAIR"
    elif pct > 0:
        # Market > BS  →  option expensive vs model  →  sell candidate
        pricing_direction = "overpriced"
        signal            = "OVERPRICED"
    else:
        # Market < BS  →  option cheap vs model  →  buy candidate
        pricing_direction = "underpriced"
        signal            = "UNDERPRICED"

    return {
        "mispricing_pct":        round(pct, 4),
        "mispricing_dollar_gap": dollar_gap,
        "is_mispriced":          is_mispriced,
        "pricing_direction":     pricing_direction,
        "signal":                signal,
        "bs_price":              round(bs_price, 4),
        "market_price":          round(market_price, 4),
        "threshold_pct":         threshold_pct,
    }


def register(registry: ToolRegistry) -> None:
    registry.register(
        "detect_mispricing",
        _detect_mispricing,
        description="Compare BS theoretical price vs market price and flag mis-pricing.",
    )