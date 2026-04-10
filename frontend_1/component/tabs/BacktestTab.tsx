'use client'

import { useState, useCallback } from 'react'
import {
  ComposedChart, Line, Scatter, XAxis, YAxis,
  Tooltip, ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import type { AnalysisResult } from '@/types/analysis'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DailyRecord {
  date:         string
  spot:         number
  hv:           number
  iv:           number
  iv_hv_diff:   number
  theoretical:  number
  market_price: number
  dte:          number
  signal:       'BUY' | 'SELL' | 'HOLD'
  iv_valid:     boolean
  delta:        number
  theta:        number
  vega:         number
}

interface BacktestTrade {
  signal:      string | null
  entry_date:  string | null
  entry_price: number | null
  exit_date:   string | null
  exit_price:  number | null
  pnl:         number | null
  pnl_pct:     number | null
  profitable:  boolean | null
}

interface BacktestSummary {
  buy_days:           number
  sell_days:          number
  hold_days:          number
  iv_valid_days:      number
  avg_iv_pct:         number
  avg_hv_pct:         number
  avg_iv_hv_diff_pct: number
  dominant_signal:    string
}

interface BacktestResult {
  ticker:          string
  strike:          number
  expiry:          string
  option_type:     string
  lookback_days:   number
  iv_hv_threshold: number
  simulation_days: number
  proxy_note:      string
  daily_records:   DailyRecord[]
  trade:           BacktestTrade
  summary:         BacktestSummary
}

interface BacktestResponse {
  input:    object
  backtest: BacktestResult
  earnings: {
    earnings_date:   string | null
    days_from_today: number | null
    is_upcoming:     boolean
    available:       boolean
  }
}

interface Props { data: AnalysisResult | null }

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, color,
}: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background:   'var(--qt-bg-card)',
      border:       '0.5px solid var(--qt-border)',
      borderRadius: '8px',
      padding:      '14px 16px',
    }}>
      <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
        {label}
      </p>
      <p style={{ fontSize: '20px', fontWeight: 700, color: color ?? 'var(--qt-text)', fontFamily: 'JetBrains Mono, monospace', marginBottom: sub ? '4px' : 0 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: '10px', color: 'var(--qt-muted)' }}>{sub}</p>}
    </div>
  )
}

function SignalBadge({ action }: { action: string }) {
  const colors: Record<string, { bg: string; border: string; color: string }> = {
    BUY:     { bg: 'var(--qt-amber-dim)',  border: 'var(--qt-amber-border)',  color: 'var(--qt-amber)' },
    SELL:    { bg: 'var(--qt-red-dim)',    border: 'var(--qt-red-border)',    color: 'var(--qt-red)'   },
    HOLD:    { bg: 'var(--qt-cyan-dim)',   border: 'var(--qt-cyan-border)',   color: 'var(--qt-cyan)'  },
    NEUTRAL: { bg: 'var(--qt-cyan-dim)',   border: 'var(--qt-cyan-border)',   color: 'var(--qt-cyan)'  },
  }
  const c = colors[action] ?? colors.HOLD
  return (
    <div style={{
      background:   c.bg,
      border:       `0.5px solid ${c.border}`,
      borderRadius: '6px',
      padding:      '6px 14px',
      display:      'inline-block',
    }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: c.color, letterSpacing: '0.12em' }}>
        {action}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom tooltip for the chart
// ─────────────────────────────────────────────────────────────────────────────

function BacktestTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const d = payload[0]?.payload as DailyRecord & { iv_pct: number; hv_pct: number }

  const signalColor: Record<string, string> = {
    BUY:  'var(--qt-amber)',
    SELL: 'var(--qt-red)',
    HOLD: 'var(--qt-muted)',
  }

  return (
    <div style={{
      background:   'var(--qt-bg-card)',
      border:       '0.5px solid var(--qt-border)',
      borderRadius: '8px',
      padding:      '10px 14px',
      fontSize:     '11px',
      fontFamily:   'JetBrains Mono, monospace',
      minWidth:     '180px',
    }}>
      <p style={{ color: 'var(--qt-muted)', marginBottom: '6px', fontSize: '10px' }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <p style={{ color: 'var(--qt-cyan)' }}>
          IV: {d?.iv_pct?.toFixed(2)}%
        </p>
        <p style={{ color: 'var(--qt-amber)' }}>
          HV: {d?.hv_pct?.toFixed(2)}%
        </p>
        <p style={{ color: 'var(--qt-text-sub)' }}>
          Spot: ${d?.spot?.toFixed(2)}
        </p>
        <p style={{ color: 'var(--qt-text-sub)' }}>
          DTE: {d?.dte}d
        </p>
        <p style={{ color: signalColor[d?.signal] ?? 'var(--qt-muted)', fontWeight: 700, marginTop: '4px' }}>
          Signal: {d?.signal}
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function BacktestTab({ data }: Props) {
  const [lookback,   setLookback]   = useState(60)
  const [threshold,  setThreshold]  = useState(0.02)
  const [result,     setResult]     = useState<BacktestResponse | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [hasRun,     setHasRun]     = useState(false)

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const runBacktest = useCallback(async () => {
    if (!data) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker:          data.ticker,
          option_type:     data.option_type,
          strike:          data.strike,
          expiry:          data.expiry,
          risk_free_rate:  data.risk_free_rate,
          lookback_days:   lookback,
          iv_hv_threshold: threshold,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json?.detail || `HTTP ${res.status}`)

      setResult({
        input: {},

        earnings: {
          earnings_date:   null,
          days_from_today: null,
          is_upcoming:     false,
          available:       false,
        },

        backtest: {
          ticker:          data.ticker,
          strike:          data.strike,
          expiry:          data.expiry,
          option_type:     data.option_type,
          lookback_days:   lookback,
          iv_hv_threshold: threshold,
          simulation_days: json.simulation_days ?? json.daily_records?.length ?? 0,
          proxy_note:      json.proxy_note ?? '',

          summary: json.summary,

          trade: {
            signal:      json.trade?.signal      ?? null,
            entry_date:  json.trade?.entry_date  ?? null,
            entry_price: json.trade?.entry_price ?? null,
            exit_date:   json.trade?.exit_date   ?? null,
            exit_price:  json.trade?.exit_price  ?? null,
            pnl:         json.trade?.pnl         ?? null,
            pnl_pct:     json.trade?.pnl_pct     ?? null,
            profitable:  json.trade?.profitable  ?? null,
          },

          daily_records: (json.daily_records ?? []).map((r: any) => ({
            date:         r.date,
            spot:         r.spot,
            hv:           r.hv,
            iv:           r.iv,
            iv_hv_diff:   r.iv_hv_diff,
            theoretical:  r.theoretical,
            market_price: r.market_price,
            dte:          r.dte   ?? 0,
            signal:       r.signal,
            iv_valid:     r.iv_valid ?? true,
            delta:        r.delta ?? 0,
            theta:        r.theta ?? 0,
            vega:         r.vega  ?? 0,
          })),
        },
      })

      setHasRun(true)

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [data, lookback, threshold])

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!data) return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--qt-muted)', fontSize: '12px' }}>
      No data available
    </div>
  )

  // ── Derived chart data ───────────────────────────────────────────────────────
  const bt       = result?.backtest
  const earnings = result?.earnings
  const summary  = bt?.summary
  const trade    = bt?.trade

  const dominantSignal =
    summary
      ? summary.buy_days > summary.sell_days && summary.buy_days > summary.hold_days
        ? 'BUY'
        : summary.sell_days > summary.buy_days && summary.sell_days > summary.hold_days
        ? 'SELL'
        : 'HOLD'
      : 'HOLD'

  const chartData = (bt?.daily_records ?? []).map(r => ({
    ...r,
    iv_pct:  +(r.iv * 100).toFixed(2),
    hv_pct:  +(r.hv * 100).toFixed(2),
    buy_iv:  r.signal === 'BUY'  ? +(r.iv * 100).toFixed(2) : null,
    sell_iv: r.signal === 'SELL' ? +(r.iv * 100).toFixed(2) : null,
  }))

  const pnlPositive = (trade?.pnl ?? 0) >= 0

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Controls ─────────────────────────────────────────────────────────── */}
      <div style={{
        background:   'var(--qt-bg-card)',
        border:       '0.5px solid var(--qt-border)',
        borderRadius: '8px',
        padding:      '14px 16px',
      }}>
        <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
          Backtest Parameters
        </p>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', flexWrap: 'wrap' }}>

          {/* Read-only fields from main analysis */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { label: 'Ticker',      value: data.ticker                    },
              { label: 'Strike',      value: `$${data.strike}`              },
              { label: 'Option Type', value: data.option_type.toUpperCase() },
              { label: 'Expiry',      value: data.expiry                    },
            ].map(f => (
              <div key={f.label}>
                <p style={{ fontSize: '9px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                  {f.label}
                </p>
                <div style={{
                  background:   '#111827',
                  border:       '0.5px solid var(--qt-border)',
                  borderRadius: '6px',
                  padding:      '6px 10px',
                  fontSize:     '12px',
                  fontFamily:   'JetBrains Mono, monospace',
                  color:        'var(--qt-text-sub)',
                }}>
                  {f.value}
                </div>
              </div>
            ))}
          </div>

          {/* Lookback selector */}
          <div>
            <p style={{ fontSize: '9px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              Lookback
            </p>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[30, 60, 90].map(d => (
                <button
                  key={d}
                  onClick={() => setLookback(d)}
                  style={{
                    background:   lookback === d ? 'var(--qt-cyan-dim)' : '#111827',
                    border:       `0.5px solid ${lookback === d ? 'var(--qt-cyan-border)' : 'var(--qt-border)'}`,
                    borderRadius: '6px',
                    padding:      '6px 12px',
                    fontSize:     '12px',
                    fontFamily:   'JetBrains Mono, monospace',
                    color:        lookback === d ? 'var(--qt-cyan)' : 'var(--qt-muted)',
                    cursor:       'pointer',
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {/* IV-HV threshold */}
          <div>
            <p style={{ fontSize: '9px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
              IV–HV Threshold
            </p>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[0.01, 0.02, 0.05].map(t => (
                <button
                  key={t}
                  onClick={() => setThreshold(t)}
                  style={{
                    background:   threshold === t ? 'var(--qt-amber-dim)' : '#111827',
                    border:       `0.5px solid ${threshold === t ? 'var(--qt-amber-border)' : 'var(--qt-border)'}`,
                    borderRadius: '6px',
                    padding:      '6px 12px',
                    fontSize:     '12px',
                    fontFamily:   'JetBrains Mono, monospace',
                    color:        threshold === t ? 'var(--qt-amber)' : 'var(--qt-muted)',
                    cursor:       'pointer',
                  }}
                >
                  {(t * 100).toFixed(0)}%
                </button>
              ))}
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={runBacktest}
            disabled={loading}
            style={{
              background:    loading ? '#111827' : 'var(--qt-cyan-dim)',
              border:        `0.5px solid ${loading ? 'var(--qt-border)' : 'var(--qt-cyan-border)'}`,
              borderRadius:  '6px',
              padding:       '7px 20px',
              fontSize:      '12px',
              fontWeight:    700,
              fontFamily:    'JetBrains Mono, monospace',
              color:         loading ? 'var(--qt-muted)' : 'var(--qt-cyan)',
              cursor:        loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.06em',
            }}
          >
            {loading ? 'Running…' : 'Run Backtest'}
          </button>
        </div>
      </div>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          background:   'var(--qt-red-dim)',
          border:       '0.5px solid var(--qt-red-border)',
          borderRadius: '8px',
          padding:      '12px 16px',
        }}>
          <p style={{ fontSize: '11px', color: 'var(--qt-red)', fontFamily: 'JetBrains Mono, monospace' }}>
            ⚠ {error}
          </p>
        </div>
      )}

      {/* ── Pre-run placeholder ──────────────────────────────────────────────── */}
      {!hasRun && !loading && !error && (
        <div style={{
          background:   'var(--qt-bg-card)',
          border:       '0.5px solid var(--qt-border)',
          borderRadius: '8px',
          padding:      '40px 16px',
          textAlign:    'center',
        }}>
          <p style={{ fontSize: '12px', color: 'var(--qt-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            Configure parameters above and press <span style={{ color: 'var(--qt-cyan)' }}>Run Backtest</span> to simulate the IV vs HV signal.
          </p>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      {bt && summary && trade && (
        <>

          {/* ── Summary stat cards ─────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            <StatCard
              label="Simulation Days"
              value={`${bt.simulation_days}`}
              sub={`${lookback}d lookback`}
              color="var(--qt-text)"
            />
            <StatCard
              label="Avg IV"
              value={`${summary.avg_iv_pct}%`}
              sub="Implied volatility"
              color="var(--qt-cyan)"
            />
            <StatCard
              label="Avg HV"
              value={`${summary.avg_hv_pct}%`}
              sub="Historical volatility"
              color="var(--qt-amber)"
            />
            <StatCard
              label="Avg IV−HV"
              value={`${summary.avg_iv_hv_diff_pct > 0 ? '+' : ''}${summary.avg_iv_hv_diff_pct}%`}
              sub={summary.avg_iv_hv_diff_pct > 0 ? 'IV > HV (overpriced)' : 'IV < HV (underpriced)'}
              color={summary.avg_iv_hv_diff_pct > 0 ? 'var(--qt-red)' : 'var(--qt-amber)'}
            />
          </div>

          {/* ── Signal distribution + Trade P&L ──────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>

            {/* Signal distribution */}
            <div style={{
              background:   'var(--qt-bg-card)',
              border:       '0.5px solid var(--qt-border)',
              borderRadius: '8px',
              padding:      '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Signal Distribution
                </p>
                <SignalBadge action={dominantSignal} />
              </div>

              <div style={{ display: 'flex', gap: '0', justifyContent: 'space-around' }}>
                {[
                  { label: 'BUY days',  value: summary.buy_days,  color: 'var(--qt-amber)' },
                  { label: 'SELL days', value: summary.sell_days, color: 'var(--qt-red)'   },
                  { label: 'HOLD days', value: summary.hold_days, color: 'var(--qt-muted)' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', color: 'var(--qt-muted)', marginBottom: '4px' }}>{s.label}</p>
                    <p style={{ fontSize: '22px', fontWeight: 700, color: s.color, fontFamily: 'JetBrains Mono, monospace' }}>
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Visual bar */}
              <div style={{ display: 'flex', borderRadius: '3px', overflow: 'hidden', height: '4px', marginTop: '12px', gap: '2px' }}>
                {[
                  { days: summary.buy_days,  color: 'var(--qt-amber)' },
                  { days: summary.sell_days, color: 'var(--qt-red)'   },
                  { days: summary.hold_days, color: '#1f2937'         },
                ].map((s, i) => (
                  <div key={i} style={{
                    flex:       s.days,
                    background: s.color,
                    minWidth:   s.days > 0 ? '2px' : 0,
                  }} />
                ))}
              </div>
            </div>

            {/* Trade P&L */}
            <div style={{
              background:   'var(--qt-bg-card)',
              border:       `0.5px solid ${trade.pnl !== null ? (pnlPositive ? 'var(--qt-cyan-border)' : 'var(--qt-red-border)') : 'var(--qt-border)'}`,
              borderRadius: '8px',
              padding:      '14px 16px',
            }}>
              <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                Simulated Trade
              </p>

              {trade.signal ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', color: 'var(--qt-muted)' }}>Signal</span>
                    <SignalBadge action={trade.signal} />
                  </div>
                  {[
                    { label: 'Entry date',  value: trade.entry_date  ?? '—'                                   },
                    { label: 'Entry price', value: trade.entry_price !== null ? `$${trade.entry_price}` : '—' },
                    { label: 'Exit date',   value: trade.exit_date   ?? '—'                                   },
                    { label: 'Exit price',  value: trade.exit_price  !== null ? `$${trade.exit_price}`  : '—' },
                  ].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '11px', color: 'var(--qt-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {r.label}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--qt-text-sub)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {r.value}
                      </span>
                    </div>
                  ))}

                  {/* P&L highlight */}
                  <div style={{
                    marginTop:      '6px',
                    background:     pnlPositive ? 'var(--qt-cyan-dim)' : 'var(--qt-red-dim)',
                    border:         `0.5px solid ${pnlPositive ? 'var(--qt-cyan-border)' : 'var(--qt-red-border)'}`,
                    borderRadius:   '6px',
                    padding:        '8px 12px',
                    display:        'flex',
                    justifyContent: 'space-between',
                    alignItems:     'center',
                  }}>
                    <span style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      P&L
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: pnlPositive ? 'var(--qt-cyan)' : 'var(--qt-red)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {trade.pnl !== null
                        ? `${pnlPositive ? '+' : ''}$${trade.pnl.toFixed(4)} (${trade.pnl_pct?.toFixed(2)}%)`
                        : '—'}
                    </span>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '11px', color: 'var(--qt-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  No signal generated in this window.
                </p>
              )}
            </div>
          </div>

          {/* ── IV vs HV chart ────────────────────────────────────────────────── */}
          <div style={{
            background:   'var(--qt-bg-card)',
            border:       '0.5px solid var(--qt-border)',
            borderRadius: '8px',
            padding:      '14px 16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                IV vs HV — {bt.simulation_days} Trading Days
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {[
                  { dot: false, line: true,  color: 'var(--qt-cyan)',  label: 'Implied Vol (IV)'    },
                  { dot: false, line: true,  color: 'var(--qt-amber)', label: 'Historical Vol (HV)' },
                  { dot: true,  line: false, color: 'var(--qt-amber)', label: 'BUY signal'          },
                  { dot: true,  line: false, color: 'var(--qt-red)',   label: 'SELL signal'         },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    {l.line && <div style={{ width: '20px', height: '2px', background: l.color }} />}
                    {l.dot  && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: l.color }} />}
                    <span style={{ fontSize: '10px', color: 'var(--qt-muted)' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: 'var(--qt-muted)', fontFamily: 'JetBrains Mono, monospace' }}
                  tickLine={false}
                  axisLine={{ stroke: 'var(--qt-border)' }}
                  interval="preserveStartEnd"
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 9, fill: 'var(--qt-muted)', fontFamily: 'JetBrains Mono, monospace' }}
                  tickLine={false}
                  axisLine={false}
                  width={38}
                />
                <Tooltip content={<BacktestTooltip />} />

                <Line
                  type="monotone"
                  dataKey="iv_pct"
                  stroke="var(--qt-cyan)"
                  strokeWidth={1.5}
                  dot={false}
                  name="IV"
                />
                <Line
                  type="monotone"
                  dataKey="hv_pct"
                  stroke="var(--qt-amber)"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="4 3"
                  name="HV"
                />
                <Scatter dataKey="buy_iv"  fill="var(--qt-amber)" name="BUY"  r={4} />
                <Scatter dataKey="sell_iv" fill="var(--qt-red)"   name="SELL" r={4} />

                {trade.entry_date && (
                  <ReferenceLine
                    x={trade.entry_date}
                    stroke="var(--qt-cyan)"
                    strokeDasharray="3 3"
                    label={{ value: 'Entry', position: 'top', fontSize: 9, fill: 'var(--qt-cyan)', fontFamily: 'JetBrains Mono, monospace' }}
                  />
                )}

                {earnings?.available && earnings.earnings_date && (
                  <ReferenceLine
                    x={earnings.earnings_date}
                    stroke="var(--qt-red)"
                    strokeDasharray="2 4"
                    label={{ value: '⚡ Earnings', position: 'insideTopRight', fontSize: 9, fill: 'var(--qt-red)', fontFamily: 'JetBrains Mono, monospace' }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* ── Earnings badge ─────────────────────────────────────────────────── */}
          {earnings?.is_upcoming && (
            <div style={{
              background:     'var(--qt-red-dim)',
              border:         '0.5px solid var(--qt-red-border)',
              borderRadius:   '8px',
              padding:        '10px 16px',
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
            }}>
              <p style={{ fontSize: '11px', color: 'var(--qt-red)', fontFamily: 'JetBrains Mono, monospace' }}>
                ⚡ Earnings in {earnings.days_from_today}d — IV may spike near this date
              </p>
              <p style={{ fontSize: '11px', color: 'var(--qt-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                {earnings.earnings_date}
              </p>
            </div>
          )}

          {/* ── Proxy note ─────────────────────────────────────────────────────── */}
          <div style={{
            background:   'var(--qt-bg-card)',
            border:       '0.5px solid var(--qt-border)',
            borderRadius: '8px',
            padding:      '12px 16px',
          }}>
            <p style={{ fontSize: '11px', color: 'var(--qt-text-sub)', lineHeight: '1.6', fontFamily: 'JetBrains Mono, monospace' }}>
              <span style={{ color: 'var(--qt-muted)' }}>Note · </span>
              {bt.proxy_note} The IV vs HV decision logic mirrors the live analysis pipeline exactly:
              BS price computed using rolling HV, IV back-solved via Newton-Raphson from the market price proxy,
              signal generated when |IV − HV| &gt; {(bt.iv_hv_threshold * 100).toFixed(0)}%.
            </p>
          </div>

        </>
      )}
    </div>
  )
}