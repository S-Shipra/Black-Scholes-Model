"""
Agent 2 – Pricing
=================
Tools registered:
  • compute_bs_price
  • compute_greeks
"""
from __future__ import annotations

import logging
from datetime import datetime

from config import RISK_FREE_RATE
from utils.bs_math import bs_price, bs_greeks
from utils.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)

# Match bs_math.py and direction.py — 365.25 accounts for leap years
_DAYS_IN_YEAR = 365.25


def _years_to_expiry(expiry: str) -> float:
    """Convert 'YYYY-MM-DD' string to fraction of a year from today."""
    today  = datetime.today().date()
    target = datetime.strptime(expiry, "%Y-%m-%d").date()
    days   = (target - today).days
    if days < 0:
        logger.warning("Expiry %s is in the past (%d days ago). T clamped to 0.", expiry, -days)
    return max(days / _DAYS_IN_YEAR, 0.0)


# ─────────────────────────────────────────────────────────────────────────────
# Tool handlers
# ─────────────────────────────────────────────────────────────────────────────

def _compute_bs_price(
    spot_price: float,
    strike: float,
    expiry: str,
    sigma: float,
    option_type: str = "call",
    risk_free_rate: float = RISK_FREE_RATE,
) -> dict:
    T     = _years_to_expiry(expiry)
    price = bs_price(spot_price, strike, T, risk_free_rate, sigma, option_type)

    # bs_price() returns None when sigma is invalid or inputs are degenerate
    if price is None:
        logger.error(
            "bs_price returned None for spot=%.4f K=%.4f T=%.6f sigma=%.6f",
            spot_price, strike, T, sigma,
        )
        raise ValueError(
            f"BS price could not be computed — check sigma ({sigma}) and inputs."
        )

    return {
        "bs_price":       round(price, 4),
        "spot_price":     spot_price,
        "strike":         strike,
        "expiry":         expiry,
        "T_years":        round(T, 6),
        "sigma":          sigma,
        "risk_free_rate": risk_free_rate,
        "option_type":    option_type,
    }


def _compute_greeks(
    spot_price: float,
    strike: float,
    expiry: str,
    sigma: float,
    option_type: str = "call",
    risk_free_rate: float = RISK_FREE_RATE,
) -> dict:
    T      = _years_to_expiry(expiry)
    greeks = bs_greeks(spot_price, strike, T, risk_free_rate, sigma, option_type)

    # bs_greeks() returns None when sigma is invalid
    if greeks is None:
        logger.error(
            "bs_greeks returned None for spot=%.4f K=%.4f T=%.6f sigma=%.6f",
            spot_price, strike, T, sigma,
        )
        raise ValueError(
            f"Greeks could not be computed — check sigma ({sigma}) and inputs."
        )

    greeks.update({
        "spot_price":  spot_price,
        "strike":      strike,
        "expiry":      expiry,
        "T_years":     round(T, 6),
        "option_type": option_type,
    })
    return greeks


# ─────────────────────────────────────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────────────────────────────────────

def register(registry: ToolRegistry) -> None:
    registry.register(
        "compute_bs_price",
        _compute_bs_price,
        description="Compute the theoretical Black-Scholes option price.",
    )
    registry.register(
        "compute_greeks",
        _compute_greeks,
        description="Compute Black-Scholes Greeks: delta, gamma, vega, theta, rho.",
    )