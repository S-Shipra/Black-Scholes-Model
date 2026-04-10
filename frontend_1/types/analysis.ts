// src/types/analysis.ts
// Auto-matched to FastAPI flatten_state() output


export interface Greeks {
  delta: number
  gamma: number
  theta: number
  vega:  number
  rho:   number
}

export interface OptionChainRow {
  strike:            number
  bid:               number
  ask:               number
  impliedVolatility: number
  volume:            number
  openInterest:      number
  lastPrice:         number
}

export interface RoleMap {
  trader:      'BUY' | 'SELL' | 'HOLD' | string
  hedger:      'BUY' | 'SELL' | 'HOLD' | string
  arbitrageur: 'BUY' | 'SELL' | 'HOLD' | string
}

export interface RoleInsights {
  trader?:      string
  hedger?:      string
  arbitrageur?: string
}

export interface AnalysisResult {

  // ── Input params ───────────────────────────────────────────
  ticker:      string
  option_type: 'call' | 'put'
  strike:      number
  expiry:      string
  risk_free_rate: number

  // ── Market data ────────────────────────────────────────────
  spot_price:       number
  price_change_pct: number
  historical_vol:   number

  // ── Pricing ────────────────────────────────────────────────
  bs_price: number
  greeks:   Greeks

  // ── Market price ───────────────────────────────────────────
  market_price: number
  bid:          number
  ask:          number

  // ── Implied vol ────────────────────────────────────────────
  implied_vol: number

  // ── Mispricing ─────────────────────────────────────────────
  mispricing_pct:    number
  mispricing_signal: 'buy_candidate' | 'sell_candidate' | 'fairly_priced'

  // ── Strategy ───────────────────────────────────────────────
  action:    'BUY' | 'SELL' | 'HOLD'
  strategy:  string
  rationale: string

  break_even: number | null
  max_profit: string | number | null  // ← string too (e.g. "Unlimited")
  max_loss:   string | number | null  // ← string too (e.g. "Unlimited")

  vol_commentary?:  string | null
  confidence?:      string | number | null  // ← LLM may return "HIGH" or 0.9
  role_insights?:   RoleInsights | null
  actions_by_role?: RoleMap | null

  // ── Risk ───────────────────────────────────────────────────
  risk_score:      number
  risk_level:      'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH'
  risk_flags:      string[]
  volatility_skew: boolean

  // ── Explanation ────────────────────────────────────────────
  explanation: string

  // ── Options chain ──────────────────────────────────────────
  options_chain?: OptionChainRow[]
}

// ── Request shape (mirrors FastAPI AnalyzeRequest) ──────────
export interface AnalyzeRequest {
  ticker:        string
  option_type:   string
  strike:        number
  expiry:        string
  risk_free_rate: number
}