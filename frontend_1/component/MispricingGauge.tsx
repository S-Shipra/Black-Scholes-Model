'use client'

import { useEffect, useState } from 'react'

interface Props {
  pct: number   // e.g. -5.22 = underpriced, +3.1 = overpriced
}

export default function MispricingGauge({ pct }: Props) {
  const [animated, setAnimated] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(pct), 100)
    return () => clearTimeout(timer)
  }, [pct])

  const isUnder   = pct < 0
  const clamped   = Math.max(-20, Math.min(20, animated))
  const widthPct  = Math.abs(clamped) * 5   // max 20% → 100%
  const color     = isUnder ? 'var(--qt-amber)' : 'var(--qt-red)'
  const label     = isUnder
    ? `${Math.abs(pct).toFixed(2)}% underpriced → BUY signal`
    : `${pct.toFixed(2)}% overpriced → SELL signal`

  return (
    <div>
      {/* Labels row */}
      <div style={{
        display:        'flex',
        justifyContent: 'space-between',
        marginBottom:   '7px',
      }}>
        <span style={{ fontSize: '10px', color: 'var(--qt-red)',   fontFamily: 'JetBrains Mono, monospace' }}>← SELL</span>
        <span style={{ fontSize: '11px', color,                     fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
          {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
        </span>
        <span style={{ fontSize: '10px', color: 'var(--qt-amber)', fontFamily: 'JetBrains Mono, monospace' }}>BUY →</span>
      </div>

      {/* Track */}
      <div style={{
        background:   '#111827',
        borderRadius: '4px',
        height:       '7px',
        position:     'relative',
        overflow:     'hidden',
      }}>
        {/* Center line */}
        <div style={{
          position:   'absolute',
          left:       '50%',
          top:        0,
          height:     '100%',
          width:      '1px',
          background: 'rgba(255,255,255,0.12)',
          zIndex:     2,
        }} />

        {/* Fill bar */}
        <div style={{
          position:   'absolute',
          top:        0,
          height:     '100%',
          width:      `${widthPct}%`,
          background: color,
          borderRadius: '2px',
          left:       isUnder ? '50%' : `${50 - widthPct}%`,
          transition: 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1), left 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex:     1,
        }} />
      </div>

      {/* Bottom label */}
      <p style={{
        fontSize:   '10px',
        color:      'var(--qt-muted)',
        marginTop:  '5px',
        fontFamily: 'JetBrains Mono, monospace',
        textAlign:  'center',
      }}>
        {label}
      </p>
    </div>
  )
}
