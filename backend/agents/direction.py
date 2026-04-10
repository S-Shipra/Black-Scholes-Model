"""
Agent – Market Direction
========================
Tools registered:
  • compute_directional_bias   → overall bullish / bearish / neutral score
  • compute_trend_indicators   → SMA, EMA, MACD, ADX internals
  • compute_momentum_indicators → RSI, Stochastic, Rate-of-Change
  • get_direction_summary      → single-call wrapper; returns final BUY/SELL hint

Direction score convention
--------------------------
  score ∈ [-1.0, +1.0]
  +1.0  → strongly bullish  (favour buying calls / selling puts)
  -1.0  → strongly bearish  (favour buying puts  / selling calls)
   0.0  → neutral / no edge
"""
from __future__ import annotations

import logging
from typing import Literal

import numpy as np
import pandas as pd
import yfinance as yf

from utils.tool_registry import ToolRegistry

logger = logging.getLogger(__name__)

# ─── tuneable constants ───────────────────────────────────────────────────────
SMA_FAST   = 20
SMA_SLOW   = 50
EMA_FAST   = 12
EMA_SLOW   = 26
MACD_SIGNAL= 9
RSI_PERIOD = 14
STOCH_K    = 14
STOCH_D    = 3
ROC_PERIOD = 10
ADX_PERIOD = 14
# ─────────────────────────────────────────────────────────────────────────────


# ─────────────────────────────────────────────────────────────────────────────
# Internal maths helpers
# ─────────────────────────────────────────────────────────────────────────────

def _sma(series: pd.Series, window: int) -> pd.Series:
    return series.rolling(window).mean()


def _ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def _rsi(close: pd.Series, period: int = RSI_PERIOD) -> pd.Series:
    delta   = close.diff()
    gain    = delta.clip(lower=0)
    loss    = (-delta).clip(lower=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs  = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)


def _macd(close: pd.Series) -> tuple[pd.Series, pd.Series, pd.Series]:
    """Returns (macd_line, signal_line, histogram)."""
    fast   = _ema(close, EMA_FAST)
    slow   = _ema(close, EMA_SLOW)
    macd   = fast - slow
    signal = _ema(macd, MACD_SIGNAL)
    hist   = macd - signal
    return macd, signal, hist


def _stochastic(high: pd.Series, low: pd.Series, close: pd.Series,
                k: int = STOCH_K, d: int = STOCH_D) -> tuple[pd.Series, pd.Series]:
    """Returns (%K, %D)."""
    lowest_low   = low.rolling(k).min()
    highest_high = high.rolling(k).max()
    denom        = (highest_high - lowest_low).replace(0, np.nan)
    pct_k        = 100 * (close - lowest_low) / denom
    pct_d        = pct_k.rolling(d).mean()
    return pct_k.fillna(50), pct_d.fillna(50)


def _adx(high: pd.Series, low: pd.Series, close: pd.Series,
         period: int = ADX_PERIOD) -> pd.Series:
    """Returns ADX series (trend strength, not direction)."""
    tr = pd.concat([
        high - low,
        (high - close.shift()).abs(),
        (low  - close.shift()).abs(),
    ], axis=1).max(axis=1)

    plus_dm  = high.diff().clip(lower=0)
    minus_dm = (-low.diff()).clip(lower=0)
    # when +DM < -DM set +DM=0 and vice-versa
    mask = plus_dm >= minus_dm
    plus_dm  = plus_dm.where(mask,  0)
    minus_dm = minus_dm.where(~mask, 0)

    atr      = tr.ewm(com=period - 1, min_periods=period).mean()
    plus_di  = 100 * plus_dm.ewm(com=period - 1, min_periods=period).mean() / atr
    minus_di = 100 * minus_dm.ewm(com=period - 1, min_periods=period).mean() / atr
    dx       = (100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan))
    adx      = dx.ewm(com=period - 1, min_periods=period).mean()
    return adx.fillna(0)


def _roc(close: pd.Series, period: int = ROC_PERIOD) -> pd.Series:
    """Rate of change (%)."""
    return ((close - close.shift(period)) / close.shift(period) * 100).fillna(0)


def _fetch_history(ticker: str, period: str = "6mo") -> pd.DataFrame:
    t    = yf.Ticker(ticker)
    hist = t.history(period=period)
    if hist.empty:
        raise ValueError(f"No price history found for '{ticker}'")
    return hist


# ─────────────────────────────────────────────────────────────────────────────
# Tool 1 – Trend indicators
# ─────────────────────────────────────────────────────────────────────────────

def _compute_trend_indicators(ticker: str) -> dict:
    """
    SMA crossover, EMA crossover, MACD, and ADX trend-strength.
    Returns latest values + a sub-score in [-1, +1].
    """
    hist  = _fetch_history(ticker)
    close = hist["Close"]
    high  = hist["High"]
    low   = hist["Low"]

    sma_f = _sma(close, SMA_FAST).iloc[-1]
    sma_s = _sma(close, SMA_SLOW).iloc[-1]
    ema_f = _ema(close, EMA_FAST).iloc[-1]
    ema_s = _ema(close, EMA_SLOW).iloc[-1]

    macd_line, signal_line, macd_hist = _macd(close)
    macd_val    = macd_line.iloc[-1]
    signal_val  = signal_line.iloc[-1]
    macd_hist_v = macd_hist.iloc[-1]

    adx_val     = _adx(high, low, close).iloc[-1]
    spot        = float(close.iloc[-1])

    # ── sub-scoring ──────────────────────────────────────────────────────────
    signals: list[float] = []

    # price vs slow SMA
    signals.append(+1.0 if spot > sma_s else -1.0)

    # fast / slow SMA crossover
    signals.append(+1.0 if sma_f > sma_s else -1.0)

    # EMA crossover
    signals.append(+1.0 if ema_f > ema_s else -1.0)

    # MACD line vs signal
    signals.append(+1.0 if macd_val > signal_val else -1.0)

    # MACD histogram slope (momentum of momentum)
    prev_hist = macd_hist.iloc[-2] if len(macd_hist) >= 2 else macd_hist_v
    signals.append(+0.5 if macd_hist_v > prev_hist else -0.5)

    trend_score = float(np.clip(np.mean(signals), -1, 1))

    # ADX > 25 → trending market → amplify score; ADX < 20 → chop → dampen
    strength_factor = float(np.clip(adx_val / 25.0, 0.5, 1.5))
    trend_score = float(np.clip(trend_score * strength_factor, -1, 1))

    return {
        "ticker":          ticker.upper(),
        "spot":            round(spot, 4),
        "sma_fast":        round(sma_f, 4),
        "sma_slow":        round(sma_s, 4),
        "ema_fast":        round(ema_f, 4),
        "ema_slow":        round(ema_s, 4),
        "macd":            round(macd_val, 6),
        "macd_signal":     round(signal_val, 6),
        "macd_histogram":  round(macd_hist_v, 6),
        "adx":             round(adx_val, 2),
        "trend_score":     round(trend_score, 4),   # [-1, +1]
        "sma_crossover":   "bullish" if sma_f > sma_s else "bearish",
        "macd_crossover":  "bullish" if macd_val > signal_val else "bearish",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Tool 2 – Momentum indicators
# ─────────────────────────────────────────────────────────────────────────────

def _compute_momentum_indicators(ticker: str) -> dict:
    """
    RSI, Stochastic %K/%D, and Rate-of-Change.
    Returns latest values + a sub-score in [-1, +1].
    """
    hist  = _fetch_history(ticker)
    close = hist["Close"]
    high  = hist["High"]
    low   = hist["Low"]

    rsi_val          = float(_rsi(close).iloc[-1])
    pct_k, pct_d     = _stochastic(high, low, close)
    stoch_k          = float(pct_k.iloc[-1])
    stoch_d          = float(pct_d.iloc[-1])
    roc_val          = float(_roc(close).iloc[-1])

    # ── sub-scoring ──────────────────────────────────────────────────────────
    signals: list[float] = []

    # RSI: >55 bullish, <45 bearish, middle = muted signal
    if rsi_val > 55:
        signals.append(min((rsi_val - 55) / 15.0, 1.0))      # 0 → +1
    elif rsi_val < 45:
        signals.append(max((rsi_val - 45) / 15.0, -1.0))     # 0 → -1
    else:
        signals.append(0.0)

    # Stochastic position (oversold < 20, overbought > 80)
    stoch_mid = (stoch_k + stoch_d) / 2
    stoch_score = (stoch_mid - 50) / 50.0                      # -1 → +1
    signals.append(float(np.clip(stoch_score, -1, 1)))

    # Stochastic crossover
    signals.append(+0.5 if stoch_k > stoch_d else -0.5)

    # Rate-of-change: positive = bullish
    roc_score = float(np.clip(roc_val / 10.0, -1, 1))          # ±10 % → ±1
    signals.append(roc_score)

    momentum_score = float(np.clip(np.mean(signals), -1, 1))

    # RSI extremes (>70 or <30) signal potential reversal → dampen
    if rsi_val > 70 or rsi_val < 30:
        momentum_score *= 0.6

    return {
        "ticker":          ticker.upper(),
        "rsi":             round(rsi_val, 2),
        "stoch_k":         round(stoch_k, 2),
        "stoch_d":         round(stoch_d, 2),
        "roc_pct":         round(roc_val, 4),
        "momentum_score":  round(momentum_score, 4),  # [-1, +1]
        "rsi_zone":        (
            "overbought" if rsi_val > 70
            else "oversold" if rsi_val < 30
            else "bullish" if rsi_val > 55
            else "bearish" if rsi_val < 45
            else "neutral"
        ),
        "stoch_zone": (
            "overbought" if stoch_k > 80
            else "oversold" if stoch_k < 20
            else "neutral"
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Tool 3 – Composite directional bias
# ─────────────────────────────────────────────────────────────────────────────

# Weights must sum to 1.0
_TREND_WEIGHT    = 0.60
_MOMENTUM_WEIGHT = 0.40

def _compute_directional_bias(ticker: str) -> dict:
    """
    Combine trend + momentum sub-scores into one composite direction score.

    Returns
    -------
    direction      : 'bullish' | 'bearish' | 'neutral'
    direction_score: float in [-1, +1]   (+ve = bullish)
    confidence     : 'high' | 'medium' | 'low'
    bs_suggestion  : 'buy_call' | 'buy_put' | 'sell_call' | 'sell_put' | 'no_trade'
    """
    trend    = _compute_trend_indicators(ticker)
    momentum = _compute_momentum_indicators(ticker)

    t_score = trend["trend_score"]
    m_score = momentum["momentum_score"]

    composite = _TREND_WEIGHT * t_score + _MOMENTUM_WEIGHT * m_score
    composite = float(np.clip(composite, -1, 1))

    # ── direction label ───────────────────────────────────────────────────────
    if composite > 0.15:
        direction = "bullish"
    elif composite < -0.15:
        direction = "bearish"
    else:
        direction = "neutral"

    # ── confidence ───────────────────────────────────────────────────────────
    abs_score = abs(composite)
    if abs_score >= 0.55:
        confidence = "high"
    elif abs_score >= 0.25:
        confidence = "medium"
    else:
        confidence = "low"

    # ── Black-Scholes trade suggestion ───────────────────────────────────────
    # High-confidence directional bias → outright buy; weaker → sell premium
    if direction == "bullish" and confidence == "high":
        bs_suggestion = "buy_call"
    elif direction == "bullish" and confidence == "medium":
        bs_suggestion = "sell_put"          # collect premium with bullish tilt
    elif direction == "bearish" and confidence == "high":
        bs_suggestion = "buy_put"
    elif direction == "bearish" and confidence == "medium":
        bs_suggestion = "sell_call"         # collect premium with bearish tilt
    else:
        bs_suggestion = "no_trade"          # neutral / low-confidence → wait

    return {
        "ticker":           ticker.upper(),
        "spot":             trend["spot"],
        # sub-scores
        "trend_score":      round(t_score, 4),
        "momentum_score":   round(m_score, 4),
        "direction_score":  round(composite, 4),
        # labels
        "direction":        direction,
        "confidence":       confidence,
        "bs_suggestion":    bs_suggestion,
        # key indicator snapshot
        "sma_crossover":    trend["sma_crossover"],
        "macd_crossover":   trend["macd_crossover"],
        "adx":              trend["adx"],
        "rsi":              momentum["rsi"],
        "rsi_zone":         momentum["rsi_zone"],
        "stoch_zone":       momentum["stoch_zone"],
    }


# ─────────────────────────────────────────────────────────────────────────────
# Tool 4 – Single-call summary (convenience wrapper for the BS model)
# ─────────────────────────────────────────────────────────────────────────────

def _get_direction_summary(ticker: str) -> dict:
    """
    Thin wrapper that returns *only* the fields the Black-Scholes decision
    layer needs, keeping the inter-agent message small.

    Fields
    ------
    direction_score  : float [-1, +1]
    direction        : 'bullish' | 'bearish' | 'neutral'
    confidence       : 'high' | 'medium' | 'low'
    bs_suggestion    : 'buy_call' | 'buy_put' | 'sell_call' | 'sell_put' | 'no_trade'
    supporting_data  : dict  ← one-liner snapshot for logging / audit
    """
    bias = _compute_directional_bias(ticker)

    supporting = {
        "trend_score":    bias["trend_score"],
        "momentum_score": bias["momentum_score"],
        "adx":            bias["adx"],
        "rsi":            bias["rsi"],
        "rsi_zone":       bias["rsi_zone"],
        "sma_crossover":  bias["sma_crossover"],
        "macd_crossover": bias["macd_crossover"],
    }

    return {
        "ticker":          bias["ticker"],
        "spot":            bias["spot"],
        "direction_score": bias["direction_score"],   # plug straight into BS model
        "direction":       bias["direction"],
        "confidence":      bias["confidence"],
        "bs_suggestion":   bias["bs_suggestion"],
        "supporting_data": supporting,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Registration
# ─────────────────────────────────────────────────────────────────────────────

def register(registry: ToolRegistry) -> None:
    registry.register(
        "compute_trend_indicators",
        _compute_trend_indicators,
        description=(
            "Compute SMA/EMA crossover, MACD, and ADX for a ticker. "
            "Returns trend_score ∈ [-1, +1]."
        ),
    )
    registry.register(
        "compute_momentum_indicators",
        _compute_momentum_indicators,
        description=(
            "Compute RSI, Stochastic %%K/%%D, and Rate-of-Change for a ticker. "
            "Returns momentum_score ∈ [-1, +1]."
        ),
    )
    registry.register(
        "compute_directional_bias",
        _compute_directional_bias,
        description=(
            "Combine trend + momentum into a composite direction_score ∈ [-1, +1] "
            "with a bullish / bearish / neutral label and confidence level."
        ),
    )
    registry.register(
        "get_direction_summary",
        _get_direction_summary,
        description=(
            "Lightweight wrapper — returns direction_score, direction, confidence, "
            "and bs_suggestion (buy_call / buy_put / sell_call / sell_put / no_trade). "
            "Designed for direct consumption by the Black-Scholes decision layer."
        ),
    )