'use client'

import type { AnalysisResult } from '@/types/analysis'
import BSvsStrikes from '@/component/charts/BSvsStrikes'

interface Props { data: AnalysisResult | null }

export default function BSStrikesTab({ data }: Props) {
  if (!data) return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--qt-muted)', fontSize: '12px' }}>
      No data available
    </div>
  )

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {[
          { label: 'Selected Strike', value: `$${data.strike}`,                          color: 'var(--qt-cyan)'  },
          { label: 'BS Price',        value: `$${data.bs_price?.toFixed(2) ?? '—'}`,     color: 'var(--qt-text)'  },
          { label: 'Market Price',    value: `$${data.market_price?.toFixed(2) ?? '—'}`, color: 'var(--qt-amber)' },
        ].map(m => (
          <div key={m.label} style={{
            background: 'var(--qt-bg-card)',
            border: '0.5px solid var(--qt-border)',
            borderRadius: '8px',
            padding: '12px 14px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{m.label}</p>
            <p style={{ fontSize: '18px', fontWeight: 700, color: m.color, fontFamily: 'JetBrains Mono, monospace' }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{
        background: 'var(--qt-bg-card)',
        border: '0.5px solid var(--qt-border)',
        borderRadius: '8px',
        padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            BS Theoretical Price vs Strike Range
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '20px', height: '2px', background: 'var(--qt-cyan)' }} />
              <span style={{ fontSize: '10px', color: 'var(--qt-muted)' }}>BS price</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--qt-amber)' }} />
              <span style={{ fontSize: '10px', color: 'var(--qt-muted)' }}>Market price</span>
            </div>
          </div>
        </div>
        <BSvsStrikes data={data} />
      </div>

      {/* Note */}
      <div style={{
        background: 'var(--qt-bg-card)',
        border: '0.5px solid var(--qt-border)',
        borderRadius: '8px',
        padding: '12px 16px',
      }}>
        <p style={{ fontSize: '11px', color: 'var(--qt-text-sub)', lineHeight: '1.6', fontFamily: 'JetBrains Mono, monospace' }}>
          The cyan line shows Black-Scholes theoretical prices computed across a range of strikes using the current spot, IV, HV, and risk-free rate.
          Amber dots are live market mid-prices from the options chain. Gaps between the line and dots indicate mispricing opportunities.
        </p>
      </div>
    </div>
  )
}
