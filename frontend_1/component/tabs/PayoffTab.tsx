'use client'

import type { AnalysisResult } from '@/types/analysis'
import PayoffDiagram from '@/component/charts/PayoffDiagram'

interface Props { data: AnalysisResult | null }

// Safe formatter — handles number, "Unlimited", null, undefined
const fmtPL = (val: string | number | null | undefined, prefix = '$') =>
  typeof val === 'number' ? `${prefix}${val.toFixed(2)}` : val ?? '—'

export default function PayoffTab({ data }: Props) {
  if (!data) return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--qt-muted)', fontSize: '12px' }}>
      No data available
    </div>
  )

  const K        = data.strike       ?? 0
  const premium  = data.market_price ?? data.bs_price ?? 0
  const type     = data.option_type  ?? 'call'
  const breakEven = data.break_even
    ?? (type === 'call' ? K + premium : K - premium)

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Key levels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Strike',     value: `$${K}`,                    color: 'var(--qt-text)'  },
          { label: 'Break-Even', value: `$${breakEven.toFixed(2)}`, color: 'var(--qt-amber)' },
          { label: 'Premium',    value: fmtPL(premium),             color: 'var(--qt-cyan)'  },
          { label: 'Max Loss',   value: fmtPL(data.max_loss),       color: 'var(--qt-red)'   },
        ].map(m => (
          <div key={m.label} style={{
            background: 'var(--qt-bg-card)',
            border: '0.5px solid var(--qt-border)',
            borderRadius: '8px',
            padding: '12px 14px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              {m.label}
            </p>
            <p style={{ fontSize: '16px', fontWeight: 700, color: m.color, fontFamily: 'JetBrains Mono, monospace' }}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* Payoff chart */}
      <div style={{
        background: 'var(--qt-bg-card)',
        border: '0.5px solid var(--qt-border)',
        borderRadius: '8px',
        padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            P&L at Expiry
          </p>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '20px', height: '2px', background: 'var(--qt-cyan)' }} />
              <span style={{ fontSize: '10px', color: 'var(--qt-muted)' }}>At expiry</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '20px', height: '2px', background: 'var(--qt-amber)', borderTop: '2px dashed var(--qt-amber)' }} />
              <span style={{ fontSize: '10px', color: 'var(--qt-muted)' }}>BS current value</span>
            </div>
          </div>
        </div>
        <PayoffDiagram data={data} />
      </div>

      {/* Strategy note */}
      <div style={{
        background: 'var(--qt-bg-card)',
        border: '0.5px solid var(--qt-border)',
        borderRadius: '8px',
        padding: '12px 16px',
      }}>
        <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
          Strategy Note
        </p>
        <p style={{ fontSize: '11px', color: 'var(--qt-text-sub)', lineHeight: '1.6', fontFamily: 'JetBrains Mono, monospace' }}>
          {data.strategy} — Break-even at ${breakEven.toFixed(2)}. Max loss is {fmtPL(data.max_loss)}.{' '}
          {type === 'call'
            ? 'Profit is unlimited above break-even.'
            : 'Max profit capped at strike minus premium.'}
        </p>
      </div>

    </div>
  )
}