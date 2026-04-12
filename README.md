# 📊 Black-Scholes-Model
# Agentic Options Trading Analyst

A production-grade multi-agent system that analyzes stock options using the Black-Scholes model. Fetches live market data, computes theoretical prices, detects mispricing, suggests trade strategies, backtests them, and explains everything in plain English.

🔗 **[Live Demo →](https://black-scholes-model-kgwx.vercel.app/)**

---

## 🚀 What It Does

- 📡 Fetches real-time stock prices and full options chains via `yfinance`
- 🧮 Computes Black-Scholes theoretical prices and all 5 Greeks
- 🔍 Reverse-solves implied volatility using Brent's method
- ⚡ Detects mispricing by comparing BS price vs live market price
- 🎯 Recommends **BUY / SELL / HOLD** with rationale and break-even levels
- ⚠️ Flags model risk — volatility skew, IV vs HV gaps, BS assumption breaks
- 🤖 Generates plain-English AI summaries via **Groq (LLaMA 3.3 70B)**
- 📈 **Backtests strategies** against historical data
- 📄 **Exports full analysis as PDF**

---

## 🛠️ Tech Stack

**Backend** — Python, NumPy, SciPy, yfinance, Plotly, Groq API  
**Frontend** — Next.js, React, TypeScript  
**AI** — LLaMA 3.3 70B via Groq (`llama-3.3-70b-versatile`)

---

## 🏗️ Architecture

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
| 📡 Market Data | Spot price, options chain, 30-day historical vol |
| 🧮 Pricing | Black-Scholes price + all Greeks |
| 🔍 Implied Volatility | Reverse-solves BS via Brent's method |
| ⚡ Mispricing Detection | % gap between BS price and market price |
| 🎯 Strategy | BUY / SELL / HOLD with full rationale |
| ⚠️ Model Risk | Flags skew, assumption breaks, risk score 0–100 |
| 🤖 Explanation | Groq LLaMA plain-English summary of full state |

---

## 🤖 Agents

**1. 📡 Market Data Agent**  
Pulls live spot price, full calls + puts options chain, and computes 30-day historical volatility — all via `yfinance`. Entry point for every analysis run.

**2. 🧮 Pricing Agent**  
Runs the Black-Scholes formula to compute the theoretical option price. Also computes all 5 Greeks: delta, gamma, vega, theta, and rho.

**3. 🔍 Implied Volatility Agent**  
Reverse-solves the BS equation to find the volatility the market is currently pricing in. Uses Brent's numerical method for fast, stable convergence.

**4. ⚡ Mispricing Detection Agent**  
Compares the BS theoretical price against the live market mid-price (bid/ask average). Outputs a mispricing percentage and a directional signal — `buy_candidate`, `sell_candidate`, or `fairly_priced`.

**5. 🎯 Strategy Agent**  
Translates the mispricing signal and Greeks into a concrete trade recommendation — BUY, SELL, or HOLD — with full rationale, vol commentary, and break-even price.

**6. ⚠️ Model Risk Agent**  
Flags where the Black-Scholes assumptions break down: detects volatility skew from the live chain, measures the IV vs historical vol gap, and outputs a model risk score from 0 to 100.

**7. 🤖 Explanation Agent**  
Sends the full pipeline state to Groq (LLaMA 3.3 70B) and returns a plain-English paragraph summarising the opportunity, the risk, and the recommended action — readable by anyone.

---

## 🔧 The 10 Tools

| Tool | Agent |
|---|---|
| `fetch_spot_price` | 📡 Market Data |
| `fetch_options_chain` | 📡 Market Data |
| `compute_historical_volatility` | 📡 Market Data |
| `compute_bs_price` | 🧮 Pricing |
| `compute_greeks` | 🧮 Pricing |
| `compute_implied_volatility` | 🔍 Implied Volatility |
| `detect_mispricing` | ⚡ Mispricing Detection |
| `suggest_strategy` | 🎯 Strategy |
| `check_volatility_skew` | ⚠️ Model Risk |
| `assess_model_risk` | ⚠️ Model Risk |
| `generate_explanation` | 🤖 Explanation |

---

## 🖥️ Dashboard

10 tabs across a Next.js frontend:

| Tab | Content |
|---|---|
| 📋 Overview | Mispricing bar chart + AI explanation + risk flags |
| 🎯 Strategy | Action, rationale, vol commentary, break-even |
| 📐 Greeks | Table + Greeks vs spot interactive chart |
| 💰 Payoff Diagram | P&L at expiry + pre-expiry BS curve |
| 🌡️ Price Heatmap | BS price + delta across spot × vol grid |
| 😊 Vol Smile | Implied vol vs strikes from live chain |
| 📊 BS vs Strikes | Theoretical price across full strike range |
| 🕰️ Backtesting | Strategy performance on historical data |
| 🔍 Raw Data | Full JSON pipeline state + download |

---

## 📥 Sample Input / Output

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

## ⚙️ Setup

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
