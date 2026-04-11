# Black-Scholes-Model

# Agentic Options Trading Analyst

A production-grade multi-agent system that analyzes stock options using the Black-Scholes model. Fetches live market data, computes theoretical prices, detects mispricing, suggests trade strategies, backtests them, and explains everything in plain English.

🔗 **[Live Demo →](https://black-scholes-model-kgwx.vercel.app/)**

---

## What It Does

- Fetches real-time stock prices and full options chains via `yfinance`
- Computes Black-Scholes theoretical prices and all 5 Greeks
- Reverse-solves implied volatility using Brent's method
- Detects mispricing by comparing BS price vs live market price
- Recommends **BUY / SELL / HOLD** with rationale and break-even levels
- Flags model risk — volatility skew, IV vs HV gaps, BS assumption breaks
- Generates plain-English AI summaries via **Groq (LLaMA 3.3 70B)**
- **Backtests strategies** against historical data
- **Exports full analysis as PDF**

---

## Tech Stack

**Backend** — Python, NumPy, SciPy, yfinance, Plotly, Groq API  
**Frontend** — Next.js, React, TypeScript  
**AI** — LLaMA 3.3 70B via Groq (`llama-3.3-70b-versatile`)

---

## Architecture

7 agents, 10 tools, 1 orchestrator. Agents never call each other directly — everything routes through a central `ToolRegistry`.

**Pipeline (in order):**
```
fetch_spot_price → compute_historical_vol → fetch_options_chain →
compute_bs_price → compute_greeks → resolve_market_price →
compute_implied_vol → detect_mispricing → suggest_strategy →
check_volatility_skew → assess_model_risk → generate_explanation
```

| Agent | What It Does |
|---|---|
| Market Data | Spot price, options chain, 30-day historical vol |
| Pricing | Black-Scholes price + all Greeks |
| Implied Volatility | Reverse-solves BS via Brent's method |
| Mispricing Detection | % gap between BS price and market price |
| Strategy | BUY / SELL / HOLD with full rationale |
| Model Risk | Flags skew, assumption breaks, risk score 0–100 |
| Explanation | Groq LLaMA plain-English summary of full state |

---

## Dashboard

10 tabs across a Next.js frontend:

| Tab | Content |
|---|---|
| Overview | Mispricing bar chart + AI explanation + risk flags |
| Strategy | Action, rationale, vol commentary, break-even |
| Greeks | Table + Greeks vs spot interactive chart |
| Payoff Diagram | P&L at expiry + pre-expiry BS curve |
| Price Heatmap | BS price + delta across spot × vol grid |
| Vol Smile | Implied vol vs strikes from live chain |
| BS vs Strikes | Theoretical price across full strike range |
| Backtesting | Strategy performance on historical data |
| Raw Data | Full JSON pipeline state + download |

---

## Sample Input / Output

```json
// Input
{
  "ticker": "AAPL",
  "option_type": "call",
  "expiry": "2026-04-17",
  "strike": 250
}

// Output
{
  "spot_price": 247.99,
  "bs_price": 12.45,
  "market_price": 11.80,
  "mispricing_pct": -5.22,
  "action": "BUY",
  "strategy": "Long Call",
  "delta": 0.52,
  "implied_vol": 0.28,
  "historical_vol": 0.24,
  "risk_level": "MODERATE"
}
```

---

## Setup

```bash
git clone https://github.com/your-username/options-analyst.git
cd options-analyst
pip install -r requirements.txt
```

Create a `.env` file:

```env
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
RISK_FREE_RATE=0.045
```

Run backend:
```bash
python main.py
```

Run frontend:
```bash
cd frontend
npm install
npm run dev
```
