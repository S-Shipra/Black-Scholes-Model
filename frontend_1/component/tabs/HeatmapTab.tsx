'use client'

import type { AnalysisResult } from '@/types/analysis'
import PriceHeatmap from '@/component/charts/PriceHeatmap'

interface Props { data: AnalysisResult | null }

export default function HeatmapTab({ data }: Props) {
  if (!data) return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--qt-muted)', fontSize: '12px' }}>
      No data available
    </div>
  )

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Info strip */}
      <div style={{
        background: 'var(--qt-bg-card)',
        border: '0.5px solid var(--qt-border)',
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        gap: '24px',
        alignItems: 'center',
      }}>
        <div>
          <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Current Spot</p>
          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--qt-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>${data.spot_price?.toFixed(2)}</p>
        </div>
        <div style={{ width: '0.5px', height: '30px', background: 'var(--qt-border-mid)' }} />
        <div>
          <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Current IV</p>
          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--qt-amber)', fontFamily: 'JetBrains Mono, monospace' }}>{((data.implied_vol ?? 0) * 100).toFixed(1)}%</p>
        </div>
        <div style={{ width: '0.5px', height: '30px', background: 'var(--qt-border-mid)' }} />
        <div>
          <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>BS Price at current</p>
          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--qt-text)', fontFamily: 'JetBrains Mono, monospace' }}>${data.bs_price?.toFixed(2)}</p>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--qt-muted)', lineHeight: '1.5', textAlign: 'right' }}>
          X axis: Spot price range<br />Y axis: Implied vol range
        </div>
      </div>

      {/* Heatmap */}
      <div style={{
        background: 'var(--qt-bg-card)',
        border: '0.5px solid var(--qt-border)',
        borderRadius: '8px',
        padding: '14px 16px',
      }}>
        <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
          BS Option Price — Spot × Implied Vol Grid
        </p>
        <PriceHeatmap data={data} />
      </div>

      {/* Color scale legend */}
      <div style={{
        background: 'var(--qt-bg-card)',
        border: '0.5px solid var(--qt-border)',
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <span style={{ fontSize: '10px', color: 'var(--qt-muted)' }}>Low price</span>
        <div style={{
          flex: 1,
          height: '8px',
          borderRadius: '4px',
          background: 'linear-gradient(to right, #0E1320, #185FA5, #00E5B4, #F5A623, #FF4560)',
        }} />
        <span style={{ fontSize: '10px', color: 'var(--qt-muted)' }}>High price</span>
      </div>
    </div>
  )
}
