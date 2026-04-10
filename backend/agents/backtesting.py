"""
Agent – Backtesting
====================
Simulates what would have happened if you had followed the IV-vs-HV
buy/sell signal on every trading day over a historical lookback window.

Decision logic (mirrors the main pipeline exactly)
---------------------------------------------------
  1. Compute rolling HV from historical spot prices up to each day.
  2. Compute BS theoretical price using that day's spot + HV.
  3. Back-solve IV from the market price proxy (Newton-Raphson,
     same approach as volatility.py).
  4. Compare IV vs HV:
       IV > HV + threshold  →  SELL  (option overpriced)
       IV < HV - threshold  →  BUY   (option underpriced)
       |IV - HV| < threshold →  HOLD  (noise band, no edge)

Tools registered:
  • run_backtest
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import yfinance as yf
from scipy.stats import norm

from backend.utils.tool_registry import ToolRegistry
from backend.utils.bs_math import bs_price, bs_greeks

logger = logging.getLogger(__name__)

_HV_ROLLING_WINDOW = 30   # trading days for rolling HV estimate


# ─────────────────────────────────────────────────────────────────────────────
# Session helper
# ─────────────────────────────────────────────────────────────────────────────

def _make_ticker(symbol: str) -> yf.Ticker:
    try:
        from curl_cffi import requests as curl_requests
        session = curl_requests.Session(impersonate="chrome")
        return yf.Ticker(symbol, session=session)
    except ImportError:
        import requests
        session = requests.Session()
        session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        })
        return yf.Ticker(symbol, session=session)


# ─────────────────────────────────────────────────────────────────────────────
# IV solver — Newton-Raphson (mirrors your volatility.py)
# ─────────────────────────────────────────────────────────────────────────────

def _solve_iv(
    market_price: float,
    S: float,
    K: float,
    T: float,
    r: float,
    option_type: str,
    max_iter: int = 100,
    tol: float = 1e-6,
) -> float | None:
    """
    Back-solve implied volatility from a market price using Newton-Raphson.
    Returns None if it fails to converge — caller falls back to HV → HOLD.
    """
    if market_price <= 0 or T <= 0:
        return None

    sigma = 0.3  # initial guess

    for _ in range(max_iter):
        try:
            price = bs_price(S=S, K=K, T=T, r=r, sigma=sigma, option_type=option_type)
        except Exception:
            return None

        diff = price - market_price
        if abs(diff) < tol:
            return round(sigma, 6)

        d1   = (np.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * np.sqrt(T))
        vega = S * norm.pdf(d1) * np.sqrt(T)

        if abs(vega) < 1e-10:
            return None

        sigma -= diff / vega
        sigma  = max(sigma, 1e-6)   # keep positive

    return None   # did not converge


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_historical_spot(ticker: str, lookback_days: int) -> pd.DataFrame:
    """
    Fetch daily Close prices. Fetches extra rows before the window
    so the rolling HV has enough warm-up data.
    """
    t     = _make_ticker(ticker)
    extra = _HV_ROLLING_WINDOW + 15
    start = (datetime.now() - timedelta(days=lookback_days + extra)).strftime("%Y-%m-%d")
    end   = datetime.now().strftime("%Y-%m-%d")
    hist  = t.history(start=start, end=end)

    if hist.empty:
        raise ValueError(f"No historical price data for '{ticker}'")

    hist.index = hist.index.tz_localize(None)
    return hist[["Close"]].copy()


def _rolling_hv(close_series: pd.Series, window: int = _HV_ROLLING_WINDOW) -> pd.Series:
    """Annualised rolling HV: std(log-returns) × √252."""
    log_ret = np.log(close_series / close_series.shift(1))
    return log_ret.rolling(window).std() * np.sqrt(252)


def _intrinsic_value(spot: float, strike: float, option_type: str) -> float:
    if option_type.lower() == "call":
        return max(spot - strike, 0.0)
    return max(strike - spot, 0.0)


# ─────────────────────────────────────────────────────────────────────────────
# Core backtest engine
# ─────────────────────────────────────────────────────────────────────────────

def _run_backtest(
    ticker: str,
    strike: float,
    expiry: str,
    option_type: str,
    risk_free_rate: float,
    lookback_days: int = 60,
    iv_hv_threshold: float = 0.02,    # minimum |IV - HV| to act (filters noise)
) -> dict:
    """
    Backtest the IV-vs-HV signal over a historical lookback window.

    Decision logic (mirrors main pipeline):
      Step 1 — Rolling HV from historical spot prices up to each day.
      Step 2 — BS theoretical price = bs_price(spot, HV).
      Step 3 — IV back-solved from market price proxy (Newton-Raphson).
      Step 4 — Signal:
                  IV > HV + threshold  →  SELL
                  IV < HV - threshold  →  BUY
                  else                 →  HOLD

    Parameters
    ----------
    ticker           : underlying ticker
    strike           : option strike
    expiry           : option expiry (YYYY-MM-DD)
    option_type      : 'call' or 'put'
    risk_free_rate   : annualised risk-free rate (e.g. 0.05)
    lookback_days    : calendar days to look back (30 / 60 / 90)
    iv_hv_threshold  : minimum absolute IV-HV gap to trigger a signal
    """

    # ── Validate expiry ───────────────────────────────────────────────────────
    try:
        expiry_dt = datetime.strptime(expiry, "%Y-%m-%d").date()
    except ValueError:
        raise ValueError(f"Invalid expiry format '{expiry}'. Use YYYY-MM-DD.")

    today = datetime.now().date()
    if expiry_dt <= today:
        raise ValueError(
            f"Expiry {expiry} is in the past. "
            "Backtesting requires a future expiry."
        )

    # ── Fetch spot prices + rolling HV ───────────────────────────────────────
    hist       = _fetch_historical_spot(ticker, lookback_days)
    hist["hv"] = _rolling_hv(hist["Close"])

    # Trim to actual lookback window (drop warm-up rows)
    cutoff      = pd.Timestamp(datetime.now() - timedelta(days=lookback_days))
    hist_window = hist[hist.index >= cutoff].dropna(subset=["hv"]).copy()

    if len(hist_window) < 5:
        raise ValueError(
            f"Only {len(hist_window)} usable trading days in the lookback window. "
            "Extend lookback_days or check the ticker."
        )

    # ── Per-day simulation ────────────────────────────────────────────────────
    records = []

    for date, row in hist_window.iterrows():
        date_obj = date.date() if hasattr(date, "date") else date
        dte      = (expiry_dt - date_obj).days
        if dte <= 0:
            continue

        T    = dte / 365.25
        spot = float(row["Close"])
        hv   = float(row["hv"])

        if hv <= 0 or np.isnan(hv):
            continue

        # ── Step 1 + 2: BS theoretical price via HV ───────────────────────────
        theoretical = bs_price(
            S=spot, K=strike, T=T, r=risk_free_rate,
            sigma=hv, option_type=option_type,
        )

        # ── Market price proxy ─────────────────────────────────────────────────
        # yfinance does not provide free historical option prices.
        # We use BS(HV) ± random noise to simulate realistic market deviation.
        # The seed is date-based so results are reproducible per day.
        rng       = np.random.default_rng(seed=int(date_obj.strftime("%Y%m%d")))
        noise_pct = rng.uniform(-0.10, 0.10)
        market_price = max(theoretical * (1 + noise_pct), 0.01)

        # Guard: skip row if market_price is NaN or non-finite
        if not np.isfinite(market_price) or market_price <= 0:
            continue

        # ── Step 3: Back-solve IV from market price ────────────────────────────
        iv = _solve_iv(
            market_price=market_price,
            S=spot, K=strike, T=T,
            r=risk_free_rate,
            option_type=option_type,
        )

        iv_valid = iv is not None
        if not iv_valid:
            # Solver failed → treat IV = HV → no edge → HOLD
            iv = hv

        # ── Step 4: IV vs HV → signal ─────────────────────────────────────────
        iv_hv_diff = iv - hv   # positive = IV > HV = option expensive = SELL

        if iv_hv_diff > iv_hv_threshold:
            signal = "SELL"    # IV > HV: market pricing in more vol than realised → overpriced
        elif iv_hv_diff < -iv_hv_threshold:
            signal = "BUY"     # IV < HV: market underpricing vol → cheap option
        else:
            signal = "HOLD"    # difference within noise band, no clear edge

        # Greeks using solved IV (same as main pipeline)
        greeks = bs_greeks(
            S=spot, K=strike, T=T, r=risk_free_rate,
            sigma=iv, option_type=option_type,
        )

        records.append({
            "date":         date_obj.strftime("%Y-%m-%d"),
            "spot":         round(spot, 4),
            "hv":           round(hv, 6),
            "iv":           round(iv, 6),
            "iv_hv_diff":   round(iv_hv_diff, 6),   # key comparison value
            "theoretical":  round(theoretical, 4),
            "market_price": round(market_price, 4),
            "dte":          dte,
            "signal":       signal,
            "iv_valid":     iv_valid,
            "delta":        round(greeks.get("delta", 0), 4),
            "theta":        round(greeks.get("theta", 0), 4),
            "vega":         round(greeks.get("vega",  0), 4),
        })

    if not records:
        raise ValueError("No valid simulation days produced. Check inputs.")

    df = pd.DataFrame(records)

    # ── Simulate single-trade P&L ─────────────────────────────────────────────
    # Strategy: enter on the first day that matches the DOMINANT signal.
    # This ensures the simulated trade always aligns with the overall signal
    # distribution, avoiding confusing BUY-trade / SELL-dominant contradictions.
    buy_days_count  = int((df["signal"] == "BUY").sum())
    sell_days_count = int((df["signal"] == "SELL").sum())

    if buy_days_count >= sell_days_count and buy_days_count > 0:
        dominant_direction = "BUY"
    elif sell_days_count > buy_days_count:
        dominant_direction = "SELL"
    else:
        dominant_direction = None

    entry_date    = None
    entry_price   = None
    exit_date     = df.iloc[-1]["date"]
    exit_price    = None
    trade_signal  = None
    trade_pnl     = None
    trade_pnl_pct = None

    if dominant_direction is not None:
        dominant_rows = df[df["signal"] == dominant_direction]
        if not dominant_rows.empty:
            entry_row    = dominant_rows.iloc[0]
            entry_date   = entry_row["date"]
            raw_price    = float(entry_row["market_price"])
            trade_signal = dominant_direction

            # Guard: only proceed if entry price is a valid finite number
            if np.isfinite(raw_price) and raw_price > 0:
                entry_price = raw_price
                exit_spot   = float(df.iloc[-1]["spot"])
                exit_price  = _intrinsic_value(exit_spot, strike, option_type)

                if trade_signal == "BUY":
                    trade_pnl = exit_price - entry_price
                else:
                    trade_pnl = entry_price - exit_price

                trade_pnl_pct = (trade_pnl / entry_price * 100) if entry_price > 0 else 0.0

    # ── Summary stats ─────────────────────────────────────────────────────────
    buy_days       = buy_days_count
    sell_days      = sell_days_count
    hold_days      = int((df["signal"] == "HOLD").sum())
    iv_valid_days  = int(df["iv_valid"].sum())
    avg_iv         = float(df["iv"].mean())
    avg_hv         = float(df["hv"].mean())
    avg_iv_hv_diff = float(df["iv_hv_diff"].mean())

    return {
        # ── metadata ──────────────────────────────────────────────────────
        "ticker":          ticker.upper(),
        "strike":          strike,
        "expiry":          expiry,
        "option_type":     option_type,
        "lookback_days":   lookback_days,
        "iv_hv_threshold": iv_hv_threshold,
        "simulation_days": len(df),
        "proxy_note": (
            "Market prices are approximated as BS(HV) ± random noise (±10%). "
            "Replace with real historical option prices for production use."
        ),

        # ── daily records (for chart) ─────────────────────────────────────
        # Fields per record:
        #   date, spot, hv, iv, iv_hv_diff,
        #   theoretical, market_price, dte,
        #   signal, iv_valid, delta, theta, vega
        "daily_records": df.to_dict(orient="records"),

        # ── simulated trade ───────────────────────────────────────────────
        "trade": {
            "signal":      trade_signal,
            "entry_date":  entry_date,
            "entry_price": round(entry_price, 4)    if entry_price   is not None else None,
            "exit_date":   exit_date,
            "exit_price":  round(exit_price, 4)     if exit_price    is not None else None,
            "pnl":         round(trade_pnl, 4)      if trade_pnl     is not None else None,
            "pnl_pct":     round(trade_pnl_pct, 2)  if trade_pnl_pct is not None else None,
            "profitable":  trade_pnl > 0             if trade_pnl     is not None else None,
        },

        # ── summary stats ─────────────────────────────────────────────────
        "summary": {
            "buy_days":           buy_days,
            "sell_days":          sell_days,
            "hold_days":          hold_days,
            "iv_valid_days":      iv_valid_days,
            "avg_iv_pct":         round(avg_iv * 100, 2),
            "avg_hv_pct":         round(avg_hv * 100, 2),
            "avg_iv_hv_diff_pct": round(avg_iv_hv_diff * 100, 2),
            "dominant_signal": (
                "BUY"  if buy_days > sell_days
                else "SELL" if sell_days > buy_days
                else "NEUTRAL"
            ),
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────────────────────────────────────

def register(registry: ToolRegistry) -> None:
    registry.register(
        "run_backtest",
        _run_backtest,
        description=(
            "Backtest the IV-vs-HV buy/sell signal over a historical window. "
            "Mirrors main pipeline: BS price via HV, IV back-solved from market "
            "price, signal = BUY if IV < HV, SELL if IV > HV."
        ),
    )