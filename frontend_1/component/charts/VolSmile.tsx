'use client'

import {
  ComposedChart, Line, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
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
  /** Pass the earnings object from the API (or null if not fetched yet) */
  earnings?: EarningsInfo | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip
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
      <p style={{ color: '#364A62', marginBottom: '6px' }}>Strike: ${label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, marginBottom: '2px' }}>
          {p.name}: {(p.value * 100).toFixed(2)}%
        </p>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Earnings banner (shown above chart — X axis is strikes, not dates)
// ─────────────────────────────────────────────────────────────────────────────

function EarningsBanner({ earnings, expiry }: { earnings: EarningsInfo; expiry: string | null }) {
  if (!earnings.available || !earnings.earnings_date) return null

  // Determine whether earnings fall before expiry (high-risk scenario)
  const beforeExpiry = expiry
    ? new Date(earnings.earnings_date) <= new Date(expiry)
    : null

  const isImminent = (earnings.days_from_today ?? 999) <= 14

  const borderColor = isImminent ? 'var(--qt-red-border)' : 'var(--qt-amber-border)'
  const bgColor     = isImminent ? 'var(--qt-red-dim)'    : 'var(--qt-amber-dim)'
  const textColor   = isImminent ? 'var(--qt-red)'        : 'var(--qt-amber)'

  return (
    <div style={{
      background:     bgColor,
      border:         `0.5px solid ${borderColor}`,
      borderRadius:   '6px',
      padding:        '8px 12px',
      display:        'flex',
      justifyContent: 'space-between',
      alignItems:     'center',
      marginBottom:   '8px',
    }}>
      <p style={{
        fontSize:   '11px',
        color:      textColor,
        fontFamily: 'JetBrains Mono, monospace',
      }}>
        ⚡ Earnings {earnings.earnings_date}
        {earnings.days_from_today !== null && (
          <span style={{ color: 'var(--qt-muted)', marginLeft: '6px' }}>
            ({earnings.days_from_today >= 0
              ? `in ${earnings.days_from_today}d`
              : `${Math.abs(earnings.days_from_today)}d ago`})
          </span>
        )}
        {beforeExpiry === true && (
          <span style={{ marginLeft: '8px', color: textColor, fontWeight: 700 }}>
            · before expiry — IV skew likely distorted
          </span>
        )}
      </p>
      <p style={{ fontSize: '10px', color: 'var(--qt-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
        Vol smile may not reflect post-earnings pricing
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function VolSmile({ data, earnings }: Props) {
  if (!data) return null

  const chainData     = data.options_chain as any[] | undefined
  const spot          = data.spot_price    ?? 100
  const selectedStrike = data.strike       ?? 100
  const baseIV        = data.implied_vol   ?? 0.25

  // ── Build smile data ────────────────────────────────────────────────────────
  let smileData: Array<{ strike: number; iv: number; isSelected: boolean }> = []

  if (chainData && chainData.length > 0) {
    smileData = chainData
      .filter((c: any) => c.impliedVolatility > 0 && c.impliedVolatility < 5)
      .map((c: any) => ({
        strike:     c.strike,
        iv:         c.impliedVolatility,
        isSelected: c.strike === selectedStrike,
      }))
      .sort((a, b) => a.strike - b.strike)
  } else {
    const low  = spot * 0.80
    const high = spot * 1.20
    const step = (high - low) / 12
    const strikes: number[] = []
    for (let k = low; k <= high; k += step) strikes.push(parseFloat(k.toFixed(0)))

    smileData = strikes.map(k => {
      const moneyness = k / spot
      const skewAdj   = moneyness < 1
        ? 0.08 * (1 - moneyness) * 3
        : 0.03 * (moneyness - 1) * 2
      const smileAdj  = 0.05 * Math.pow(Math.log(k / spot), 2) * 10
      const iv        = Math.max(0.05, baseIV + skewAdj + smileAdj)
      return { strike: k, iv: parseFloat(iv.toFixed(4)), isSelected: k === selectedStrike }
    })
  }

  const selectedPoint = smileData.find(d => d.isSelected) ??
    smileData.reduce(
      (best, d) => Math.abs(d.strike - selectedStrike) < Math.abs(best.strike - selectedStrike) ? d : best,
      smileData[0],
    )

  const scatterData = selectedPoint
    ? [{ strike: selectedPoint.strike, iv: selectedPoint.iv }]
    : []

  // ── Earnings-adjusted strike (nearest available strike to spot) ─────────────
  // The X axis is strikes, not dates — we mark the spot price as a proxy for
  // "where the market is" when earnings hit.
  const showEarningsMarker =
    earnings?.available &&
    earnings.earnings_date &&
    earnings.is_upcoming

  // Find the strike nearest to spot for the earnings reference line
  const nearestStrikeToSpot = smileData.length > 0
    ? smileData.reduce(
        (best, d) => Math.abs(d.strike - spot) < Math.abs(best.strike - spot) ? d : best,
        smileData[0],
      ).strike
    : spot

  return (
    <div>
      {/* Earnings banner — shown above chart (date doesn't map to strike axis) */}
      {earnings && earnings.available && (
        <EarningsBanner earnings={earnings} expiry={data.expiry ?? null} />
      )}

      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0E1A28" />
          <XAxis
            dataKey="strike"
            type="number"
            domain={['auto', 'auto']}
            tick={{ fill: '#364A62', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickFormatter={(v) => `$${v}`}
          />
          <YAxis
            dataKey="iv"
            type="number"
            tick={{ fill: '#364A62', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Selected strike marker */}
          <ReferenceLine
            x={selectedStrike}
            stroke="#364A62"
            strokeDasharray="4 4"
            label={{ value: 'Strike', fill: '#364A62', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
          />

          {/* Spot price marker */}
          <ReferenceLine
            x={spot}
            stroke="#6366F1"
            strokeDasharray="4 4"
            label={{ value: 'Spot', fill: '#6366F1', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }}
          />

          {/* Earnings marker — drawn at nearest strike to spot */}
          {showEarningsMarker && (
            <ReferenceLine
              x={nearestStrikeToSpot}
              stroke="var(--qt-red)"
              strokeWidth={1}
              strokeDasharray="2 4"
              label={{
                value:      `⚡ ${earnings!.days_from_today}d`,
                fill:       'var(--qt-red)',
                fontSize:   9,
                fontFamily: 'JetBrains Mono, monospace',
                position:   'insideTopRight',
              }}
            />
          )}

          {/* Vol smile line */}
          <Line
            data={smileData}
            type="monotone"
            dataKey="iv"
            name="IV"
            stroke="#F5A623"
            strokeWidth={2}
            dot={{ fill: '#F5A623', r: 3 }}
          />

          {/* Selected strike dot */}
          <Scatter
            data={scatterData}
            dataKey="iv"
            name="Selected"
            fill="#00E5B4"
            r={6}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}