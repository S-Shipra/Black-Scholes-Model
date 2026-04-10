'use client'

import type { AnalysisResult } from '@/types/analysis'
import GreeksChart from '@/component/charts/GreeksChart'

interface Props { data: AnalysisResult | null }

export default function GreeksTab({ data }: Props) {
  if (!data) return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--qt-muted)', fontSize: '12px' }}>
      No data available
    </div>
  )

  const greeks = [
    {
      label: 'Delta',
      value: data.greeks?.delta,
      color: 'var(--qt-cyan)',
      desc: 'Rate of change in option price per $1 move in underlying',
    },
    {
      label: 'Gamma',
      value: data.greeks?.gamma,
      color: 'var(--qt-text)',
      desc: 'Rate of change in Delta per $1 move in underlying',
    },
    {
      label: 'Theta',
      value: data.greeks?.theta,
      color: 'var(--qt-red)',
      desc: 'Time decay — option value lost per day',
    },
    {
      label: 'Vega',
      value: data.greeks?.vega,
      color: 'var(--qt-amber)',
      desc: 'Sensitivity to 1% change in implied volatility',
    },
    {
      label: 'Rho',
      value: data.greeks?.rho,
      color: 'var(--qt-text-sub)',
      desc: 'Sensitivity to 1% change in risk-free rate',
    },
  ]

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Greeks cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
        {greeks.map(g => (
          <div key={g.label} style={{
            background: 'var(--qt-bg-card)',
            border: '0.5px solid var(--qt-border)',
            borderRadius: '8px',
            padding: '14px 12px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              {g.label}
            </p>
            <p style={{ fontSize: '20px', fontWeight: 700, color: g.color, fontFamily: 'JetBrains Mono, monospace', marginBottom: '6px' }}>
              {g.value?.toFixed(4) ?? '—'}
            </p>
            <p style={{ fontSize: '9px', color: 'var(--qt-muted)', lineHeight: '1.4' }}>
              {g.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Greeks table */}
      <div style={{
        background: 'var(--qt-bg-card)',
        border: '0.5px solid var(--qt-border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 16px',
          borderBottom: '0.5px solid var(--qt-border)',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Greek</span>
          <span style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Value</span>
          <span style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Interpretation</span>
        </div>
        {greeks.map((g, i) => (
          <div key={g.label} style={{
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: i < greeks.length - 1 ? '0.5px solid var(--qt-border)' : 'none',
            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: g.color, fontFamily: 'JetBrains Mono, monospace', width: '60px' }}>{g.label}</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: g.color, fontFamily: 'JetBrains Mono, monospace' }}>{g.value?.toFixed(6) ?? '—'}</span>
            <span style={{ fontSize: '11px', color: 'var(--qt-text-sub)', maxWidth: '260px', textAlign: 'right' }}>{g.desc}</span>
          </div>
        ))}
      </div>

      {/* Greeks chart */}
      <div style={{
        background: 'var(--qt-bg-card)',
        border: '0.5px solid var(--qt-border)',
        borderRadius: '8px',
        padding: '14px 16px',
      }}>
        <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
          Greeks vs Spot Price
        </p>
        <GreeksChart data={data} />
      </div>
    </div>
  )
}
