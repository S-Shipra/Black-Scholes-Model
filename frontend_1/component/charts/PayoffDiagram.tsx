'use client'

import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { AnalysisResult } from '@/types/analysis'

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface EarningsInfo {
  earnings_date:   string | null
  days_from_today: number | null
  is_upcoming:     boolean
  available:       boolean
}

interface Props {
  data:      AnalysisResult | null
  /** Pass the earnings object from the API response (or null if not fetched) */
  earnings?: EarningsInfo | null
}

// ─────────────────────────────────────────────────────────────────────────────
// BS math (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  x = Math.abs(x) / Math.sqrt(2)
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1.0 + sign * y)
}

function bsPrice(S: number, K: number, T: number, r: number, sigma: number, type: string): number {
  if (T <= 0 || sigma <= 0 || S <= 0) return Math.max(0, type === 'call' ? S - K : K - S)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T))
  const d2 = d1 - sigma * Math.sqrt(T)
  if (type === 'call') return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2)
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1)
}

function generateData(data: AnalysisResult) {
  const spot    = data.spot_price   ?? 100
  const K       = data.strike       ?? 100
  const premium = data.market_price ?? data.bs_price ?? 5
  const sigma   = data.implied_vol  ?? data.historical_vol ?? 0.25
  const r       = data.risk_free_rate ?? 0.0525

  const expiry = new Date(data.expiry ?? '')
  const today  = new Date()
  const T      = Math.max((expiry.getTime() - today.getTime()) / (365 * 24 * 60 * 60 * 1000), 0.001)
  const type   = data.option_type ?? 'call'

  const low  = spot * 0.75
  const high = spot * 1.25
  const step = (high - low) / 40

  const points = []
  for (let S = low; S <= high; S += step) {
    const intrinsic = type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S)
    const payoff    = parseFloat((intrinsic - premium).toFixed(2))
    const bsVal     = parseFloat(bsPrice(S, K, T, r, sigma, type).toFixed(2))
    points.push({ spot: parseFloat(S.toFixed(2)), payoff, bsValue: bsVal })
  }
  return points
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background:   '#0E1320',
      border:       '0.5px solid #162030',
      borderRadius: '6px',
      padding:      '10px 14px',
      fontFamily:   'JetBrains Mono, monospace',
      fontSize:     '11px',
    }}>
      <p style={{ color: '#364A62', marginBottom: '6px' }}>Spot: ${label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color, marginBottom: '2px' }}>
          {p.name}: ${p.value}
        </p>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Earnings warning card (shown below chart)
// ─────────────────────────────────────────────────────────────────────────────

function EarningsWarning({
  earnings,
  expiry,
}: {
  earnings: EarningsInfo
  expiry: string | null
}) {
  if (!earnings.available || !earnings.earnings_date) return null

  const beforeExpiry = expiry
    ? new Date(earnings.earnings_date) <= new Date(expiry)
    : null

  const isImminent  = (earnings.days_from_today ?? 999) <= 14
  const borderColor = isImminent ? 'var(--qt-red-border)' : 'var(--qt-amber-border)'
  const bgColor     = isImminent ? 'var(--qt-red-dim)'    : 'var(--qt-amber-dim)'
  const textColor   = isImminent ? 'var(--qt-red)'        : 'var(--qt-amber)'

  return (
    <div style={{
      background:   bgColor,
      border:       `0.5px solid ${borderColor}`,
      borderRadius: '6px',
      padding:      '10px 14px',
      marginTop:    '8px',
      display:      'flex',
      flexDirection: 'column',
      gap:          '3px',
    }}>
      <p style={{ fontSize: '11px', color: textColor, fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
        ⚡ Earnings {earnings.earnings_date}
        {earnings.days_from_today !== null && (
          <span style={{ fontWeight: 400, marginLeft: '6px', color: 'var(--qt-muted)' }}>
            ({earnings.days_from_today >= 0
              ? `in ${earnings.days_from_today}d`
              : `${Math.abs(earnings.days_from_today)}d ago`})
          </span>
        )}
      </p>
      {beforeExpiry === true && (
        <p style={{ fontSize: '10px', color: 'var(--qt-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          Earnings fall before expiry — IV crush post-event may significantly affect BS value line.
          Payoff at expiry is unaffected but premium paid may be inflated by earnings vol.
        </p>
      )}
      {beforeExpiry === false && (
        <p style={{ fontSize: '10px', color: 'var(--qt-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          Earnings fall after expiry — this option expires before the earnings event.
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function PayoffDiagram({ data, earnings }: Props) {
  if (!data) return null

  const chartData = generateData(data)
  const K         = data.strike       ?? 100
  const premium   = data.market_price ?? data.bs_price ?? 5
  const type      = data.option_type  ?? 'call'
  const spot      = data.spot_price   ?? 100

  const breakEven = data.break_even
    ?? (type === 'call' ? K + premium : K - premium)

  const fmtPL = (val: string | number | null | undefined) =>
    typeof val === 'number' ? `$${val.toFixed(2)}` : val ?? '—'

  // ── Earnings spot proxy ──────────────────────────────────────────────────────
  // The X axis is spot price. We mark where spot currently sits as the
  // "earnings event" reference — the actual date is shown in the warning card.
  const showEarningsLine = earnings?.available && earnings.is_upcoming

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* ── Summary row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'PREMIUM',    value: `$${premium.toFixed(4)}`,   color: 'var(--qt-text)' },
          { label: 'BREAK-EVEN', value: `$${breakEven.toFixed(2)}`, color: '#F5A623'        },
          { label: 'MAX LOSS',   value: fmtPL(data.max_loss),       color: 'var(--qt-red)'  },
          { label: 'MAX PROFIT', value: fmtPL(data.max_profit),     color: '#00E5B4'        },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background:   'var(--qt-bg-card)',
            border:       '0.5px solid var(--qt-border)',
            borderRadius: '8px',
            padding:      '10px 14px',
          }}>
            <p style={{ fontSize: '10px', color: 'var(--qt-muted)', marginBottom: '4px' }}>{label}</p>
            <p style={{ fontSize: '14px', fontWeight: 700, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Chart ── */}
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0E1A28" />
          <XAxis
            dataKey="spot"
            tick={{ fill: '#364A62', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickFormatter={(v) => `$${v}`}
          />
          <YAxis
            tick={{ fill: '#364A62', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: '#364A62' }} />

          {/* Zero line */}
          <ReferenceLine y={0} stroke="#364A62" strokeWidth={0.5} />

          {/* Spot price */}
          <ReferenceLine
            x={spot}
            stroke="#6366F1"
            strokeDasharray="4 4"
            label={{ value: 'SPOT', fill: '#6366F1', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
          />

          {/* Break-even */}
          <ReferenceLine
            x={breakEven}
            stroke="#F5A623"
            strokeDasharray="4 4"
            label={{ value: 'BE', fill: '#F5A623', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
          />

          {/* Earnings marker — vertical line at current spot as a proxy anchor */}
          {showEarningsLine && (
            <ReferenceLine
              x={spot}
              stroke="var(--qt-red)"
              strokeWidth={1.5}
              strokeDasharray="2 3"
              label={{
                value:      `⚡ Earnings in ${earnings!.days_from_today}d`,
                fill:       'var(--qt-red)',
                fontSize:   9,
                fontFamily: 'JetBrains Mono, monospace',
                position:   'insideTopLeft',
              }}
            />
          )}

          {/* P&L at expiry */}
          <Area
            type="monotone"
            dataKey="payoff"
            name="P&L at expiry"
            stroke="#00E5B4"
            fill="rgba(0,229,180,0.06)"
            strokeWidth={1.5}
          />

          {/* BS current value */}
          <Line
            type="monotone"
            dataKey="bsValue"
            name="BS current value"
            stroke="#F5A623"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="4 4"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* ── Earnings warning card ── */}
      {earnings && earnings.available && (
        <EarningsWarning earnings={earnings} expiry={data.expiry ?? null} />
      )}

    </div>
  )
}