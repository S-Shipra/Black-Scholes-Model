from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from backend.agents.orchestrator import Orchestrator
from backend.agents.backtesting import _run_backtest

app = FastAPI(title="QuantTrade API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://black-scholes-model-kgwx.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    ticker: str
    option_type: str
    strike: float
    expiry: str
    risk_free_rate: float = 0.0525


class BacktestRequest(BaseModel):
    ticker: str
    option_type: str
    strike: float
    expiry: str
    risk_free_rate: float = 0.0525
    lookback_days: int = 60
    iv_hv_threshold: float = 0.02


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    try:
        orch = Orchestrator()
        raw = orch.run(
            ticker=req.ticker,
            option_type=req.option_type,
            strike=req.strike,
            expiry=req.expiry,
            risk_free_rate=req.risk_free_rate,
        )
        return flatten_state(raw, req)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/backtest")
def backtest(req: BacktestRequest):
    """
    Run the IV-vs-HV backtest simulation over a historical lookback window.
    Returns daily_records (for charting), a simulated trade P&L, and summary stats.
    """
    try:
        result = _run_backtest(
            ticker=req.ticker,
            strike=req.strike,
            expiry=req.expiry,
            option_type=req.option_type,
            risk_free_rate=req.risk_free_rate,
            lookback_days=req.lookback_days,
            iv_hv_threshold=req.iv_hv_threshold,
        )
        return flatten_backtest(result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# Flatteners
# ─────────────────────────────────────────────────────────────────────────────

def flatten_state(s: dict, req) -> dict:
    """Map nested orchestrator state → flat JSON the frontend expects."""
    inp          = s.get("input", {})
    spot         = s.get("spot_price_data", {})
    hv           = s.get("historical_vol_data", {})
    bs           = s.get("bs_price_data", {})
    greeks       = s.get("greeks", {})
    iv           = s.get("iv_data", {})
    misp         = s.get("mispricing", {})
    strat        = s.get("strategy", {})
    skew         = s.get("volatility_skew", {})
    risk         = s.get("model_risk", {})
    chain_raw    = s.get("options_chain", {})
    explanation  = s.get("explanation", "")
    market_price = s.get("market_price", 0)

    # Flatten options chain
    side_key = "calls" if req.option_type == "call" else "puts"
    raw_chain = chain_raw.get(side_key, [])
    options_chain = [
        {
            "strike":            r.get("strike", 0),
            "bid":               r.get("bid", 0),
            "ask":               r.get("ask", 0),
            "impliedVolatility": r.get("impliedVolatility", r.get("implied_volatility", 0)),
            "volume":            r.get("volume", 0),
            "openInterest":      r.get("openInterest", r.get("open_interest", 0)),
            "lastPrice":         r.get("lastPrice", r.get("last_price", 0)),
        }
        for r in raw_chain
    ]

    # Resolve bid/ask from chain for the target strike
    best = min(raw_chain, key=lambda r: abs(r.get("strike", 0) - req.strike)) if raw_chain else {}

    return {
        # Input
        "ticker":         inp.get("ticker", req.ticker),
        "option_type":    inp.get("option_type", req.option_type),
        "strike":         inp.get("strike", req.strike),
        "expiry":         inp.get("expiry", req.expiry),
        "risk_free_rate": req.risk_free_rate,

        # Market data
        "spot_price":       spot.get("spot_price", 0),
        "price_change_pct": spot.get("price_change_pct", 0),
        "historical_vol":   hv.get("historical_vol", 0),

        # Pricing
        "bs_price": bs.get("bs_price", 0),
        "greeks": {
            "delta": greeks.get("delta", 0),
            "gamma": greeks.get("gamma", 0),
            "theta": greeks.get("theta", 0),
            "vega":  greeks.get("vega", 0),
            "rho":   greeks.get("rho", 0),
        },

        # Market price
        "market_price": market_price,
        "bid":          best.get("bid", 0),
        "ask":          best.get("ask", 0),

        # Implied vol
        "implied_vol": iv.get("implied_volatility", 0),

        # Mispricing
        "mispricing_pct":    misp.get("mispricing_pct", 0),
        "mispricing_signal": misp.get("signal", "fairly_priced"),

        # Strategy
        "action":          strat.get("action", "HOLD"),
        "strategy":        strat.get("strategy", ""),
        "rationale":       strat.get("rationale", ""),
        "break_even":      strat.get("break_even"),
        "max_profit":      strat.get("max_profit"),
        "max_loss":        strat.get("max_loss"),
        "vol_commentary":  strat.get("vol_commentary"),
        "confidence":      strat.get("confidence"),
        "role_insights":   strat.get("role_insights"),
        "actions_by_role": strat.get("actions_by_role"),

        # Risk
        "risk_score":      risk.get("risk_score", 0),
        "risk_level":      risk.get("risk_level", "MODERATE"),
        "risk_flags":      risk.get("risk_flags", []),
        "volatility_skew": skew.get("skew_detected", False),

        # Explanation
        "explanation": explanation if isinstance(explanation, str)
                       else explanation.get("explanation", ""),

        # Chain
        "options_chain": options_chain,
    }


def flatten_backtest(b: dict) -> dict:
    """Map _run_backtest output → clean JSON the frontend expects."""
    trade   = b.get("trade", {})
    summary = b.get("summary", {})

    return {
        # ── Metadata ──────────────────────────────────────────────────────
        "ticker":          b.get("ticker", ""),
        "strike":          b.get("strike", 0),
        "expiry":          b.get("expiry", ""),
        "option_type":     b.get("option_type", ""),
        "lookback_days":   b.get("lookback_days", 60),
        "iv_hv_threshold": b.get("iv_hv_threshold", 0.02),
        "simulation_days": b.get("simulation_days", 0),
        "proxy_note":      b.get("proxy_note", ""),

        # ── Daily records (for IV vs HV chart) ────────────────────────────
        # Each record: date, spot, hv, iv, iv_hv_diff,
        #              theoretical, market_price, dte,
        #              signal, iv_valid, delta, theta, vega
        "daily_records": b.get("daily_records", []),

        # ── Simulated trade ───────────────────────────────────────────────
        "trade": {
            "signal":      trade.get("signal"),
            "entry_date":  trade.get("entry_date"),
            "entry_price": trade.get("entry_price"),
            "exit_date":   trade.get("exit_date"),
            "exit_price":  trade.get("exit_price"),
            "pnl":         trade.get("pnl"),
            "pnl_pct":     trade.get("pnl_pct"),
            "profitable":  trade.get("profitable"),
        },

        # ── Summary stats ─────────────────────────────────────────────────
        "summary": {
            "buy_days":           summary.get("buy_days", 0),
            "sell_days":          summary.get("sell_days", 0),
            "hold_days":          summary.get("hold_days", 0),
            "iv_valid_days":      summary.get("iv_valid_days", 0),
            "avg_iv_pct":         summary.get("avg_iv_pct", 0),
            "avg_hv_pct":         summary.get("avg_hv_pct", 0),
            "avg_iv_hv_diff_pct": summary.get("avg_iv_hv_diff_pct", 0),
            "dominant_signal":    summary.get("dominant_signal", "NEUTRAL"),
        },
    }
