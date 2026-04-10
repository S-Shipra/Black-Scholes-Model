"""
Orchestrator
============
Holds a shared-state dict and calls tools in sequence via ToolRegistry.
Agents never call each other directly – everything flows through here.

Pipeline (in order)
-------------------
 1.  fetch_spot_price
 2.  compute_historical_volatility
 3.  fetch_options_chain
 4.  compute_bs_price              ← theoretical price via HV
 5.  resolve market price          ← mid-price from chain
 6.  compute_implied_volatility    ← back-solve IV from market price
 7.  compute_greeks                ← greeks via IV
 8.  detect_mispricing             ← bs_price vs market_price
 9.  get_direction_summary         ← NEW: trend + momentum → direction score
10.  suggest_strategy              ← NOW receives direction data
11.  check_volatility_skew
12.  assess_model_risk
13.  generate_explanation
"""
from __future__ import annotations

import logging
from typing import Any

from backend.utils.tool_registry import ToolRegistry
import backend.agents.market_data  as _market_data
import backend.agents.pricing      as _pricing
import backend.agents.volatility   as _volatility
import backend.agents.mispricing   as _mispricing
import backend.agents.strategy     as _strategy
import backend.agents.risk         as _risk
import backend.agents.explanation  as _explanation
import backend.agents.direction    as _direction# ← NEW

logger = logging.getLogger(__name__)


class Orchestrator:
    def __init__(self):
        self.registry = ToolRegistry()
        self.state: dict[str, Any] = {}
        self._register_all()

    # ─── registration ────────────────────────────────────────────────────────

    def _register_all(self):
        for mod in (
            _market_data,
            _pricing,
            _volatility,
            _mispricing,
            _direction,           # ← NEW — must be before strategy
            _strategy,
            _risk,
            _explanation,
        ):
            mod.register(self.registry)
        logger.info("Registered tools: %s", self.registry.list_tools())

    # ─── helpers ─────────────────────────────────────────────────────────────

    def _call(self, tool: str, **kwargs) -> Any:
        result = self.registry.call(tool, **kwargs)
        self.state[tool] = result
        return result

    def _step(self, label: str, tool: str, **kwargs):
        logger.info("▶ %s …", label)
        try:
            result = self._call(tool, **kwargs)
            logger.info("  ✓ %s complete", label)
            return result
        except Exception as exc:
            logger.error("  ✗ %s FAILED: %s", label, exc)
            raise

    # ─── main pipeline ───────────────────────────────────────────────────────

    def run(
        self,
        ticker: str,
        option_type: str,
        expiry: str,
        strike: float,
        risk_free_rate: float,
        progress_callback=None,
    ) -> dict:
        self.state = {
            "input": {
                "ticker":      ticker.upper(),
                "option_type": option_type.lower(),
                "expiry":      expiry,
                "strike":      float(strike),
            }
        }

        def progress(label: str, pct: int):
            logger.info("[%3d%%] %s", pct, label)
            if progress_callback:
                progress_callback(label, pct)

        # ── Step 1: Spot price ──────────────────────────────────────────────
        progress("Fetching spot price", 5)
        spot_data = self._step(
            "Fetch spot price", "fetch_spot_price", ticker=ticker
        )
        self.state["spot_price_data"] = spot_data
        spot = spot_data["spot_price"]

        # ── Step 2: Historical volatility ───────────────────────────────────
        progress("Computing historical volatility", 12)
        hv_data = self._step(
            "Historical volatility", "compute_historical_volatility", ticker=ticker
        )
        self.state["historical_vol_data"] = hv_data
        sigma = hv_data["historical_vol"]

        # ── Step 3: Options chain ───────────────────────────────────────────
        progress("Fetching options chain", 22)
        chain = self._step(
            "Fetch options chain", "fetch_options_chain", ticker=ticker, expiry=expiry
        )
        self.state["options_chain"] = chain

        # ── Step 4: BS price ────────────────────────────────────────────────
        progress("Computing Black-Scholes price", 32)
        bs_data = self._step(
            "BS price", "compute_bs_price",
            spot_price=spot, strike=strike, expiry=expiry,
            sigma=sigma, option_type=option_type,
            risk_free_rate=risk_free_rate,
        )
        self.state["bs_price_data"] = bs_data

        # ── Step 5: Resolve market price ────────────────────────────────────
        market_price = _resolve_market_price(chain, strike, option_type)
        self.state["market_price"] = market_price
        progress("Resolved market price", 42)

        # ── Step 6: Implied volatility ──────────────────────────────────────
        progress("Solving implied volatility", 50)
        iv_data = self._step(
            "Implied volatility", "compute_implied_volatility",
            market_price=market_price, spot_price=spot,
            strike=strike, expiry=expiry, option_type=option_type,
            risk_free_rate=risk_free_rate,
        )
        self.state["iv_data"] = iv_data

        # Guard: if IV solver returns None fall back to HV
        solved_iv = iv_data.get("implied_volatility")
        if solved_iv is None:
            logger.warning(
                "IV solver returned None for market_price=%.4f — "
                "falling back to historical vol (%.4f)",
                market_price, sigma,
            )
            solved_iv = sigma
            iv_data["implied_volatility"] = sigma
            iv_data["iv_valid"]    = False
            iv_data["iv_fallback"] = True
        self.state["iv_data"] = iv_data

        # ── Step 7: Greeks ──────────────────────────────────────────────────
        progress("Computing Greeks", 58)
        greeks = self._step(
            "Greeks", "compute_greeks",
            spot_price=spot, strike=strike, expiry=expiry,
            sigma=solved_iv, option_type=option_type,
            risk_free_rate=risk_free_rate,
        )
        self.state["greeks"] = greeks

        # ── Step 8: Mispricing detection ────────────────────────────────────
        progress("Detecting mispricing", 65)
        misp = self._step(
            "Mispricing", "detect_mispricing",
            bs_price=bs_data["bs_price"], market_price=market_price,
        )
        self.state["mispricing"] = misp

        # ── Step 9: Market direction  ────────────────────────────────────────
        # This is the NEW step — runs trend + momentum analysis and returns:
        #   direction_score  ∈ [-1, +1]   (+ve = bullish)
        #   direction        : 'bullish' | 'bearish' | 'neutral'
        #   confidence       : 'high' | 'medium' | 'low'
        #   bs_suggestion    : 'buy_call' | 'buy_put' | 'sell_call' | 'sell_put' | 'no_trade'
        progress("Analysing market direction", 72)
        try:
            direction_data = self._step(
                "Market direction", "get_direction_summary", ticker=ticker
            )
        except Exception as exc:
            logger.warning("Direction analysis failed (%s) — using neutral fallback", exc)
            direction_data = {
                "ticker":          ticker.upper(),
                "spot":            spot,
                "direction_score": 0.0,
                "direction":       "neutral",
                "confidence":      "low",
                "bs_suggestion":   "no_trade",
                "supporting_data": {},
                "error":           str(exc),
            }
        self.state["direction_data"] = direction_data

        # ── Step 10: Strategy ────────────────────────────────────────────────
        # strategy now receives direction data so it can reconcile
        # volatility-mispricing signal with market direction.
        progress("Generating strategy", 80)
        strat = self._step(
            "Strategy", "suggest_strategy",
            signal=misp["signal"],
            option_type=option_type,
            delta=greeks["delta"],
            mispricing_pct=misp["mispricing_pct"] or 0.0,
            implied_vol=solved_iv,
            historical_vol=sigma,
            strike=strike,
            premium=market_price,
            # ── direction args (NEW) ─────────────────────────────────────────
            direction_score=direction_data["direction_score"],
            direction=direction_data["direction"],
            direction_confidence=direction_data["confidence"],
            direction_suggestion=direction_data["bs_suggestion"],
        )
        self.state["strategy"] = strat

        # ── Step 11: Volatility skew ─────────────────────────────────────────
        progress("Checking volatility skew", 86)
        skew = self._step(
            "Volatility skew", "check_volatility_skew",
            options_chain=chain, option_type=option_type,
        )
        self.state["volatility_skew"] = skew

        # ── Step 12: Model risk ──────────────────────────────────────────────
        progress("Assessing model risk", 92)
        model_risk = self._step(
            "Model risk", "assess_model_risk",
            implied_vol=solved_iv,
            historical_vol=sigma,
            skew_detected=skew.get("skew_detected", False),
            T_years=bs_data["T_years"],
            option_type=option_type,
            delta=greeks["delta"],
        )
        self.state["model_risk"] = model_risk

        # ── Step 13: Plain-English explanation ──────────────────────────────
        progress("Generating explanation", 96)
        explanation = self._step(
            "Explanation", "generate_explanation", state=self.state
        )
        self.state["explanation"] = explanation

        progress("Analysis complete", 100)
        return self.state


# ─────────────────────────────────────────────────────────────────────────────

def _resolve_market_price(chain: dict, strike: float, option_type: str) -> float:
    """
    Find the mid-price for the given strike from the options chain.
    Falls back to lastPrice, then to 0.01 if not found.
    """
    side = chain.get("calls" if option_type == "call" else "puts", [])
    if not side:
        return 0.01

    best = min(side, key=lambda r: abs(r.get("strike", 0) - strike))
    bid  = best.get("bid",  0) or 0
    ask  = best.get("ask",  0) or 0
    last = best.get("lastPrice", 0) or 0

    if bid > 0 and ask > 0:
        return round((bid + ask) / 2, 4)
    if last > 0:
        return round(float(last), 4)
    return 0.01
