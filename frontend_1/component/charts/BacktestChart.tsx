'use client'

import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

// ─────────────────────────────────────────────────────────────────────────────
// Types (mirror BacktestTab's DailyRecord exactly)
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

interface EarningsInfo {
  earnings_date:   string | null
  days_from_today: number | null
  is_upcoming:     boolean
  available:       boolean
}

interface TradeInfo {
  signal:      string | null
  entry_date:  string | null
  entry_price: number | null
  exit_date:   string | null
  exit_price:  number | null
  pnl:         number | null
  pnl_pct:     number | null
  profitable:  boolean | null
}

export interface BacktestChartProps {
  /** Raw daily records from the backtest API */
  dailyRecords:    DailyRecord[]
  /** Simulated trade metadata (entry/exit dates for reference lines) */
  trade:           TradeInfo
  /** Earnings marker — pass null if not available */
  earnings:        EarningsInfo | null
  /** iv_hv_threshold used for this run, shown in legend label */
  ivHvThreshold:   number
  /** Chart title suffix e.g. "60 Trading Days" */
  simulationDays:  number
  /** Height in px — defaults to 300 */
  height?:         number
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Keep only MM-DD from an ISO date string */
function fmtDate(iso: string) {
  return iso.slice(5)
}

// Derived chart row type
interface ChartRow extends DailyRecord {
  iv_pct:  number
  hv_pct:  number
  buy_iv:  number | null
  sell_iv: number | null
}

function buildChartData(records: DailyRecord[]): ChartRow[] {
  return records.map(r => ({
    ...r,
    iv_pct:  +(r.iv  * 100).toFixed(2),
    hv_pct:  +(r.hv  * 100).toFixed(2),
    buy_iv:  r.signal === 'BUY'  ? +(r.iv * 100).toFixed(2) : null,
    sell_iv: r.signal === 'SELL' ? +(r.iv * 100).toFixed(2) : null,
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom tooltip
// ─────────────────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null

  const d = payload[0]?.payload as ChartRow

  const SIGNAL_COLOR: Record<string, string> = {
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
      minWidth:     '190px',
      pointerEvents: 'none',
    }}>
      {/* Date */}
      <p style={{ color: 'var(--qt-muted)', marginBottom: '7px', fontSize: '10px', letterSpacing: '0.06em' }}>
        {label}
      </p>

      {/* Core vol metrics */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <Row label="IV"   value={`${d?.iv_pct?.toFixed(2)}%`}   color="var(--qt-cyan)"     />
        <Row label="HV"   value={`${d?.hv_pct?.toFixed(2)}%`}   color="var(--qt-amber)"    />
        <Row
          label="IV−HV"
          value={`${d?.iv_hv_diff >= 0 ? '+' : ''}${(d?.iv_hv_diff * 100).toFixed(2)}%`}
          color={d?.iv_hv_diff > 0 ? 'var(--qt-red)' : d?.iv_hv_diff < 0 ? 'var(--qt-amber)' : 'var(--qt-muted)'}
        />

        {/* Divider */}
        <div style={{ borderTop: '0.5px solid var(--qt-border)', margin: '4px 0' }} />

        <Row label="Spot" value={`$${d?.spot?.toFixed(2)}`}     color="var(--qt-text-sub)"  />
        <Row label="DTE"  value={`${d?.dte}d`}                  color="var(--qt-text-sub)"  />

        {/* Greeks */}
        <div style={{ borderTop: '0.5px solid var(--qt-border)', margin: '4px 0' }} />
        <Row label="Δ delta" value={d?.delta?.toFixed(4)} color="var(--qt-text-sub)" />
        <Row label="Θ theta" value={d?.theta?.toFixed(4)} color="var(--qt-text-sub)" />
        <Row label="ν vega"  value={d?.vega?.toFixed(4)}  color="var(--qt-text-sub)" />

        {/* Signal */}
        <div style={{ borderTop: '0.5px solid var(--qt-border)', margin: '4px 0' }} />
        <Row
          label="Signal"
          value={d?.signal}
          color={SIGNAL_COLOR[d?.signal] ?? 'var(--qt-muted)'}
          bold
        />
        {!d?.iv_valid && (
          <p style={{ fontSize: '10px', color: 'var(--qt-muted)', marginTop: '2px' }}>
            ⚠ IV solver fallback — IV set to HV
          </p>
        )}
      </div>
    </div>
  )
}

function Row({
  label, value, color, bold,
}: { label: string; value: string | number; color: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
      <span style={{ color: 'var(--qt-muted)' }}>{label}</span>
      <span style={{ color, fontWeight: bold ? 700 : 400 }}>{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Legend strip (replaces Recharts default, matches BacktestTab's existing style)
// ─────────────────────────────────────────────────────────────────────────────

function LegendStrip({ threshold }: { threshold: number }) {
  const items = [
    { type: 'line',   color: 'var(--qt-cyan)',  label: 'Implied Vol (IV)'                       },
    { type: 'dashed', color: 'var(--qt-amber)', label: 'Historical Vol (HV)'                    },
    { type: 'dot',    color: 'var(--qt-amber)', label: `BUY  (IV < HV − ${(threshold*100).toFixed(0)}%)` },
    { type: 'dot',    color: 'var(--qt-red)',   label: `SELL (IV > HV + ${(threshold*100).toFixed(0)}%)` },
  ] as const

  return (
    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
      {items.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {item.type === 'line'   && <LineSwatch color={item.color} dashed={false} />}
          {item.type === 'dashed' && <LineSwatch color={item.color} dashed />}
          {item.type === 'dot'    && (
            <div style={{
              width: '8px', height: '8px',
              borderRadius: '50%',
              background: item.color,
              flexShrink: 0,
            }} />
          )}
          <span style={{ fontSize: '10px', color: 'var(--qt-muted)' }}>{item.label}</span>
        </div>
      ))}
    </div>
  )
}

function LineSwatch({ color, dashed }: { color: string; dashed: boolean }) {
  return (
    <svg width="22" height="2" viewBox="0 0 22 2" style={{ flexShrink: 0 }}>
      <line
        x1="0" y1="1" x2="22" y2="1"
        stroke={color}
        strokeWidth="2"
        strokeDasharray={dashed ? '4 3' : undefined}
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference line label (shared between entry, exit, and earnings)
// ─────────────────────────────────────────────────────────────────────────────

function refLabel(
  text: string,
  fill: string,
  position: 'top' | 'insideTopRight' | 'insideTopLeft' = 'top',
) {
  return {
    value:      text,
    position,
    fontSize:   9,
    fill,
    fontFamily: 'JetBrains Mono, monospace',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main exported component
// ─────────────────────────────────────────────────────────────────────────────

export default function BacktestChart({
  dailyRecords,
  trade,
  earnings,
  ivHvThreshold,
  simulationDays,
  height = 300,
}: BacktestChartProps) {
  if (!dailyRecords?.length) return null

  const chartData = buildChartData(dailyRecords)

  // Determine exit line visibility — only show if it differs from entry
  const showExitLine =
    trade.exit_date &&
    trade.exit_date !== trade.entry_date

  return (
    <div style={{
      background:   'var(--qt-bg-card)',
      border:       '0.5px solid var(--qt-border)',
      borderRadius: '8px',
      padding:      '14px 16px',
    }}>
      {/* ── Header ── */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'flex-start',
        marginBottom:   '12px',
        gap:            '12px',
        flexWrap:       'wrap',
      }}>
        <p style={{
          fontSize:      '10px',
          color:         'var(--qt-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          flexShrink:    0,
        }}>
          IV vs HV — {simulationDays} Trading Days
        </p>
        <LegendStrip threshold={ivHvThreshold} />
      </div>

      {/* ── Chart ── */}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={chartData}
          margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
        >
          {/* Subtle grid — single horizontal rule style */}
          <CartesianGrid
            horizontal
            vertical={false}
            stroke="var(--qt-border)"
            strokeOpacity={0.4}
            strokeDasharray="3 3"
          />

          <XAxis
            dataKey="date"
            tick={{
              fontSize:   9,
              fill:       'var(--qt-muted)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
            tickLine={false}
            axisLine={{ stroke: 'var(--qt-border)' }}
            interval="preserveStartEnd"
            tickFormatter={fmtDate}
          />

          <YAxis
            tickFormatter={(v: number) => `${v}%`}
            tick={{
              fontSize:   9,
              fill:       'var(--qt-muted)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
            tickLine={false}
            axisLine={false}
            width={38}
          />

          <Tooltip
            content={<ChartTooltip />}
            cursor={{
              stroke:      'var(--qt-border)',
              strokeWidth: 1,
            }}
          />

          {/* ── IV line ── */}
          <Line
            type="monotone"
            dataKey="iv_pct"
            stroke="var(--qt-cyan)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3, fill: 'var(--qt-cyan)', strokeWidth: 0 }}
            name="IV"
            isAnimationActive={false}
          />

          {/* ── HV line (dashed) ── */}
          <Line
            type="monotone"
            dataKey="hv_pct"
            stroke="var(--qt-amber)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3, fill: 'var(--qt-amber)', strokeWidth: 0 }}
            name="HV"
            isAnimationActive={false}
          />

          {/* ── BUY signal dots (IV < HV — cheap option) ── */}
          <Scatter
            dataKey="buy_iv"
            fill="var(--qt-amber)"
            name="BUY"
            r={4}
            isAnimationActive={false}
          />

          {/* ── SELL signal dots (IV > HV — expensive option) ── */}
          <Scatter
            dataKey="sell_iv"
            fill="var(--qt-red)"
            name="SELL"
            r={4}
            isAnimationActive={false}
          />

          {/* ── Trade entry reference line ── */}
          {trade.entry_date && (
            <ReferenceLine
              x={trade.entry_date}
              stroke="var(--qt-cyan)"
              strokeWidth={1}
              strokeDasharray="3 3"
              label={refLabel('Entry', 'var(--qt-cyan)', 'top')}
            />
          )}

          {/* ── Trade exit reference line ── */}
          {showExitLine && (
            <ReferenceLine
              x={trade.exit_date!}
              stroke={trade.profitable ? 'var(--qt-cyan)' : 'var(--qt-red)'}
              strokeWidth={1}
              strokeDasharray="3 3"
              label={refLabel(
                'Exit',
                trade.profitable ? 'var(--qt-cyan)' : 'var(--qt-red)',
                'insideTopLeft',
              )}
            />
          )}

          {/* ── Earnings date marker ── */}
          {earnings?.available && earnings.earnings_date && (
            <ReferenceLine
              x={earnings.earnings_date}
              stroke="var(--qt-red)"
              strokeWidth={1}
              strokeDasharray="2 4"
              label={refLabel('⚡ Earnings', 'var(--qt-red)', 'insideTopRight')}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* ── Footer: IV-solver warning if any rows fell back ── */}
      {chartData.some(r => !r.iv_valid) && (
        <p style={{
          marginTop:  '8px',
          fontSize:   '10px',
          color:      'var(--qt-muted)',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          ⚠ Some days had IV solver failures — those rows use IV = HV (HOLD forced).
        </p>
      )}
    </div>
  )
}