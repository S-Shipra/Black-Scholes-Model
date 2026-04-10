'use client'

import type { AnalysisResult } from '@/types/analysis'
import VolSmile from '@/component/charts/VolSmile'

interface Props { data: AnalysisResult | null }

export default function VolSmileTab({ data }: Props) {
  if (!data) return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--qt-muted)', fontSize: '12px' }}>
      No data available
    </div>
  )

  const ivSpread = ((data.implied_vol ?? 0) - (data.historical_vol ?? 0)) * 100
  const hasSkew  = data.volatility_skew ?? false

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Vol stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        {[
          { label: 'Implied Vol',   value: `${((data.implied_vol ?? 0) * 100).toFixed(2)}%`,   color: 'var(--qt-amber)' },
          { label: 'Historical Vol', value: `${((data.historical_vol ?? 0) * 100).toFixed(2)}%`, color: 'var(--qt-cyan)' },
          { label: 'IV − HV Spread', value: `${ivSpread >= 0 ? '+' : ''}${ivSpread.toFixed(2)}%`, color: ivSpread > 0 ? 'var(--qt-red)' : 'var(--qt-cyan)' },
          { label: 'Skew Detected',  value: hasSkew ? 'YES' : 'NO',                              color: hasSkew ? 'var(--qt-amber)' : 'var(--qt-cyan)' },
        ].map(m => (
          <div key={m.label} style={{
            background: 'var(--qt-bg-card)',
            border: '0.5px solid var(--qt-border)',
            borderRadius: '8px',
            padding: '12px 14px',
            textAlign: 'center',
          }}>
            <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{m.label}</p>
            <p style={{ fontSize: '16px', fontWeight: 700, color: m.color, fontFamily: 'JetBrains Mono, monospace' }}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Vol smile chart */}
      <div style={{
        background: 'var(--qt-bg-card)',
        border: '0.5px solid var(--qt-border)',
        borderRadius: '8px',
        padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
          <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Volatility Smile — IV across Strikes
          </p>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--qt-cyan)' }} />
              <span style={{ fontSize: '10px', color: 'var(--qt-muted)' }}>Selected strike</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--qt-amber)' }} />
              <span style={{ fontSize: '10px', color: 'var(--qt-muted)' }}>IV curve</span>
            </div>
          </div>
        </div>
        <VolSmile data={data} />
      </div>

      {/* Skew interpretation */}
      <div style={{
        background: 'var(--qt-bg-card)',
        border: `0.5px solid ${hasSkew ? 'var(--qt-amber-border)' : 'var(--qt-border)'}`,
        borderRadius: '8px',
        padding: '12px 16px',
      }}>
        <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
          Skew Interpretation
        </p>
        <p style={{ fontSize: '11px', color: 'var(--qt-text-sub)', lineHeight: '1.6', fontFamily: 'JetBrains Mono, monospace' }}>
          {hasSkew
            ? `Volatility skew detected. OTM puts are pricing higher IV than OTM calls — typical of equity markets with downside fear. Current IV ${((data.implied_vol ?? 0) * 100).toFixed(1)}% at selected strike.`
            : `No significant skew detected. IV is relatively flat across strikes. Current IV ${((data.implied_vol ?? 0) * 100).toFixed(1)}% near historical vol ${((data.historical_vol ?? 0) * 100).toFixed(1)}%.`
          }
        </p>
      </div>
    </div>
  )
}
