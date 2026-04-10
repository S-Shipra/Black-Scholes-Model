"""
Agent 1 – Market Data
=====================
Tools registered:
  • fetch_spot_price
  • fetch_options_chain
  • compute_historical_volatility
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
import yfinance as yf

from config import HV_WINDOW
from utils.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Session helper — impersonates Chrome to bypass Yahoo rate-limiting
# ─────────────────────────────────────────────────────────────────────────────

def _make_ticker(symbol: str) -> yf.Ticker:
    """
    Return a yf.Ticker with a curl_cffi Chrome-impersonating session.
    Falls back to a plain requests session if curl_cffi is unavailable.
    """
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
# Tool handlers
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_spot_price(ticker: str) -> dict:
    """Return current spot price and basic info for *ticker*."""
    try:
        t = _make_ticker(ticker)
        hist = t.history(period="5d")
        if hist.empty:
            raise ValueError(f"No price data found for '{ticker}'")
        spot = float(hist["Close"].iloc[-1])
        prev = float(hist["Close"].iloc[-2]) if len(hist) >= 2 else spot
        change_pct = (spot - prev) / prev * 100

        info = t.fast_info
        return {
            "ticker":              ticker.upper(),
            "spot_price":          round(spot, 4),
            "prev_close":          round(prev, 4),
            "change_pct":          round(change_pct, 4),
            "currency":            getattr(info, "currency", "USD"),
            "exchange":            getattr(info, "exchange", ""),
            "market_cap":          getattr(info, "market_cap", None),
            "fifty_two_week_high": getattr(info, "year_high", None),
            "fifty_two_week_low":  getattr(info, "year_low", None),
        }
    except Exception as exc:
        logger.error("fetch_spot_price error: %s", exc)
        raise


def _fetch_options_chain(ticker: str, expiry: str) -> dict:
    """
    Fetch options chain for *ticker* on *expiry* date (YYYY-MM-DD).
    Returns calls + puts as list-of-dicts.
    Finds the nearest available expiry if exact date not found.
    """
    try:
        t = _make_ticker(ticker)
        available = t.options  # tuple of expiry strings

        if not available:
            raise ValueError(f"No options data available for '{ticker}'")

        # Parse the requested expiry date
        try:
            target = datetime.strptime(expiry, "%Y-%m-%d").date()
        except Exception:
            logger.error(f"Invalid expiry format: {expiry}")
            raise ValueError(f"Invalid expiry format: {expiry}. Use YYYY-MM-DD")

        # Parse all available expiries
        parsed_expiries = []
        for e in available:
            try:
                parsed_expiries.append(datetime.strptime(e, "%Y-%m-%d").date())
            except Exception:
                continue

        if not parsed_expiries:
            raise ValueError(f"No valid expiry dates found for '{ticker}'")

        # Find the closest expiry to the requested date
        closest = min(parsed_expiries, key=lambda d: abs((d - target).days))
        closest_str = closest.strftime("%Y-%m-%d")

        if closest_str != expiry:
            logger.warning(
                f"Requested expiry {expiry} not found; using nearest: {closest_str} "
                f"(difference: {abs((closest - target).days)} days)"
            )

        # Fetch the option chain
        chain = t.option_chain(closest_str)

        def _df_to_records(df: pd.DataFrame) -> list[dict]:
            cols = [
                "strike", "lastPrice", "bid", "ask",
                "volume", "openInterest", "impliedVolatility",
                "inTheMoney",
            ]
            present = [c for c in cols if c in df.columns]
            records = df[present].fillna(0).to_dict(orient="records")
            for rec in records:
                for key in ["lastPrice", "bid", "ask"]:
                    if key in rec:
                        rec[key] = round(float(rec[key]), 4)
            return records

        today = datetime.now().date()
        days_to_expiry = (closest - today).days

        return {
            "ticker":             ticker.upper(),
            "expiry":             closest_str,
            "requested_expiry":   expiry,
            "days_to_expiry":     days_to_expiry,
            "years_to_expiry":    round(max(days_to_expiry, 1) / 365.25, 4),
            "calls":              _df_to_records(chain.calls),
            "puts":               _df_to_records(chain.puts),
            "available_expiries": list(available),
        }
    except Exception as exc:
        logger.error(f"fetch_options_chain error: {exc}")
        raise


def _compute_historical_volatility(ticker: str, window: int = HV_WINDOW) -> dict:
    """
    Compute annualised historical (realised) volatility using log-returns.
    Uses *window* trading-day rolling std × √252.
    """
    try:
        t = _make_ticker(ticker)
        hist = t.history(period="1y")
        if len(hist) < window + 5:
            raise ValueError(
                f"Insufficient history for '{ticker}': got {len(hist)} rows, need >{window}"
            )

        current_spot = float(hist["Close"].iloc[-1])

        log_returns = np.log(hist["Close"] / hist["Close"].shift(1)).dropna()
        hv    = float(log_returns.rolling(window).std().iloc[-1]) * np.sqrt(252)
        hv_10 = float(log_returns.rolling(10).std().iloc[-1]) * np.sqrt(252) if len(log_returns) >= 10 else hv
        hv_60 = float(log_returns.rolling(min(60, len(log_returns))).std().iloc[-1]) * np.sqrt(252)

        return {
            "ticker":         ticker.upper(),
            "spot_price":     round(current_spot, 4),
            "hv_window":      window,
            "historical_vol": round(hv, 6),
            "hv_10d":         round(hv_10, 6),
            "hv_60d":         round(hv_60, 6),
            "annualisation":  252,
            "num_obs":        len(log_returns),
        }
    except Exception as exc:
        logger.error("compute_historical_volatility error: %s", exc)
        raise


# ─────────────────────────────────────────────────────────────────────────────
# Helper — get option data for a specific strike
# ─────────────────────────────────────────────────────────────────────────────

def _get_option_data(ticker: str, expiry: str, strike: float, option_type: str) -> dict:
    """Get specific option data for a given strike and type."""
    try:
        chain_data = _fetch_options_chain(ticker, expiry)
        options = chain_data["calls"] if option_type == "call" else chain_data["puts"]

        for opt in options:
            if opt["strike"] == strike:
                return {
                    "found":              True,
                    "strike":             opt["strike"],
                    "market_price":       opt["lastPrice"],
                    "bid":                opt.get("bid", 0),
                    "ask":                opt.get("ask", 0),
                    "implied_volatility": opt.get("impliedVolatility", 0),
                    "volume":             opt.get("volume", 0),
                    "open_interest":      opt.get("openInterest", 0),
                }

        return {
            "found":             False,
            "available_strikes": [opt["strike"] for opt in options[:10]],
            "message":           f"Strike {strike} not found for {ticker} {expiry} {option_type}s",
        }
    except Exception as exc:
        logger.error(f"get_option_data error: {exc}")
        return {"found": False, "error": str(exc)}


# ─────────────────────────────────────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────────────────────────────────────

def register(registry: ToolRegistry) -> None:
    registry.register(
        "fetch_spot_price",
        _fetch_spot_price,
        description="Fetch current spot price + basic info for a ticker.",
    )
    registry.register(
        "fetch_options_chain",
        _fetch_options_chain,
        description="Fetch full options chain (calls + puts) for a ticker and expiry.",
    )
    registry.register(
        "compute_historical_volatility",
        _compute_historical_volatility,
        description="Compute annualised historical volatility from daily log-returns.",
    )
    registry.register(
        "get_option_data",
        _get_option_data,
        description="Get specific option data for a given strike and type.",
    )