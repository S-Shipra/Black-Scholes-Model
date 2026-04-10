"""
Black-Scholes calculations — wired to market.py.

Three things this module does:
  1. Theoretical price  →  using HV from market.py as sigma
  2. Implied Volatility →  back-solving BS such that bs_price == market_price
  3. Greeks             →  using IV as sigma (reflects what market is pricing in)

Data sources (all from market.py):
  - HV          ← _compute_historical_volatility(ticker)["historical_vol"]
  - spot price  ← _compute_historical_volatility(ticker)["spot_price"]
  - market price← _get_option_data(ticker, expiry, strike, option_type)["market_price"]
"""

import logging
import numpy as np
from scipy.stats import norm
from scipy.optimize import brentq
from typing import Literal

from backend.agents.market_data import _compute_historical_volatility, _get_option_data

logger = logging.getLogger(__name__)

OptionType = Literal["call", "put"]


# ─────────────────────────────────────────────────────────────
# Core: d1 and d2
# ─────────────────────────────────────────────────────────────

def _d1_d2(S: float, K: float, T: float, r: float, sigma: float):
    if T <= 0 or sigma is None or sigma <= 0:
        return None, None
    try:
        d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
        d2 = d1 - sigma * np.sqrt(T)
        return d1, d2
    except Exception:
        return None, None


# ─────────────────────────────────────────────────────────────
# 1. Theoretical Price  (sigma = HV)
# ─────────────────────────────────────────────────────────────

def bs_price(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: OptionType = "call",
) -> float | None:
    if sigma is None or sigma <= 0:
        logger.error("bs_price: invalid sigma")
        return None

    intrinsic = max(S - K, 0.0) if option_type == "call" else max(K - S, 0.0)

    if T <= 0:
        return intrinsic

    d1, d2 = _d1_d2(S, K, T, r, sigma)
    if d1 is None:
        return intrinsic

    q = 0.0
    print(f"BS DEBUG → S={S}, K={K}, T={T}, r={r}, q={q}, sigma={sigma}, d1={d1}, d2={d2}, Nd1={norm.cdf(d1):.6f}, Nd2={norm.cdf(d2):.6f}, disc_K={K * np.exp(-r*T):.6f}, disc_S={S * np.exp(-q*T):.6f}")

    if option_type == "call":
        price = S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)
    else:
        price = K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)

    return round(float(max(price, intrinsic, 0.0)), 6)


# ─────────────────────────────────────────────────────────────
# 2. Implied Volatility  (back-solve from market price)
# ─────────────────────────────────────────────────────────────

def implied_volatility(
    market_price: float,
    S: float,
    K: float,
    T: float,
    r: float,
    option_type: OptionType = "call",
    tol: float = 1e-6,
    max_iter: int = 500,
) -> float | None:
    if T <= 0 or market_price is None or market_price <= 0:
        return None

    intrinsic = max(S - K, 0.0) if option_type == "call" else max(K - S, 0.0)
    if market_price <= intrinsic + 0.001:
        return None

    def objective(sigma):
        p = bs_price(S, K, T, r, sigma, option_type)
        return (p - market_price) if p is not None else float("inf")

    for lo, hi in [(1e-4, 3.0), (1e-4, 5.0), (1e-4, 10.0)]:
        try:
            if objective(lo) * objective(hi) < 0:
                iv = brentq(objective, lo, hi, xtol=tol, maxiter=max_iter)
                return round(float(iv), 6)
        except (ValueError, RuntimeError):
            continue

    logger.warning(f"IV not found: market_price={market_price}, S={S}, K={K}, T={T}")
    return None


# ─────────────────────────────────────────────────────────────
# 3. Greeks  (sigma = IV — reflects what market is pricing in)
# ─────────────────────────────────────────────────────────────

def bs_greeks(
    S: float,
    K: float,
    T: float,
    r: float,
    sigma: float,
    option_type: OptionType = "call",
) -> dict | None:
    if sigma is None or sigma <= 0:
        logger.error("bs_greeks: invalid sigma")
        return None

    if T <= 0:
        delta = (1.0 if S > K else 0.0) if option_type == "call" else (-1.0 if K > S else 0.0)
        return {"delta": delta, "gamma": 0.0, "vega": 0.0, "theta": 0.0, "rho": 0.0}

    d1, d2 = _d1_d2(S, K, T, r, sigma)
    if d1 is None:
        return None

    sqrt_T = np.sqrt(T)
    nd1    = norm.pdf(d1)

    delta = norm.cdf(d1) if option_type == "call" else norm.cdf(d1) - 1
    gamma = nd1 / (S * sigma * sqrt_T)
    vega  = S * nd1 * sqrt_T / 100

    common = -(S * nd1 * sigma) / (2 * sqrt_T)
    if option_type == "call":
        theta = (common - r * K * np.exp(-r * T) * norm.cdf(d2))  / 365
        rho   =  K * T * np.exp(-r * T) * norm.cdf(d2)  / 100
    else:
        theta = (common + r * K * np.exp(-r * T) * norm.cdf(-d2)) / 365
        rho   = -K * T * np.exp(-r * T) * norm.cdf(-d2) / 100

    return {
        "delta": round(float(delta), 6),
        "gamma": round(float(gamma), 6),
        "vega":  round(float(vega),  6),
        "theta": round(float(theta), 6),
        "rho":   round(float(rho),   6),
    }


# ─────────────────────────────────────────────────────────────
# Master function — pulls HV + market price from market.py
# ─────────────────────────────────────────────────────────────

def analyse_option(
    ticker: str,
    expiry: str,        # "YYYY-MM-DD"
    strike: float,
    T: float,           # years to expiry  e.g. 30/365
    r: float,           # risk-free rate   e.g. 0.065
    option_type: OptionType = "call",
) -> dict:
    """
    Full BS analysis for one option.

    Pulls from market.py:
      - HV + spot   → _compute_historical_volatility(ticker)
      - market price→ _get_option_data(ticker, expiry, strike, option_type)

    Returns:
      {
        ticker, strike, option_type, expiry,
        spot, hv, market_price,
        theoretical_price,   ← bs_price using HV as sigma
        implied_vol,         ← back-solved from market_price
        vol_risk_premium,    ← IV - HV  (positive = options expensive)
        greeks,              ← computed with IV as sigma
        signal               ← OVERPRICED / UNDERPRICED / FAIR
      }
    """
    # ── Step 1: HV + spot from market.py ─────────────────────
    hv_data = _compute_historical_volatility(ticker)
    hv      = hv_data["historical_vol"]
    S       = hv_data["spot_price"]

    # ── Step 2: market price from market.py ──────────────────
    opt_data = _get_option_data(ticker, expiry, strike, option_type)
    if not opt_data.get("found"):
        raise ValueError(f"Option not found: {ticker} {expiry} {strike} {option_type}")
    market_price = opt_data["market_price"]

    # ── Step 3: theoretical price using HV ───────────────────
    theoretical = bs_price(S, strike, T, r, sigma=hv, option_type=option_type)

    # ── Step 4: IV back-solved from market price ──────────────
    iv = implied_volatility(market_price, S, strike, T, r, option_type)

    # ── Step 5: Greeks using IV ───────────────────────────────
    greeks = bs_greeks(S, strike, T, r, sigma=iv, option_type=option_type) if iv else None

    # ── Step 6: vol risk premium + signal ─────────────────────
    vrp = round(iv - hv, 6) if iv else None

    if theoretical is None or market_price is None:
        signal = "UNKNOWN"
    elif market_price > theoretical * 1.02:
        signal = "OVERPRICED"   # market paying more than HV justifies → sell
    elif market_price < theoretical * 0.98:
        signal = "UNDERPRICED"  # market paying less than HV justifies → buy
    else:
        signal = "FAIR"

    return {
        "ticker":            ticker.upper(),
        "strike":            strike,
        "option_type":       option_type,
        "expiry":            expiry,
        "spot":              round(S, 4),
        "hv":                round(hv, 6),
        "market_price":      round(market_price, 4),
        "theoretical_price": theoretical,
        "implied_vol":       iv,
        "vol_risk_premium":  vrp,
        "greeks":            greeks,
        "signal":            signal,
    }
