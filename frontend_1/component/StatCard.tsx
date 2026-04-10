'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  label:      string
  value:      string | number
  sub?:       string
  color?:     string
  prefix?:    string
  suffix?:    string
  animate?:   boolean
}

function useCountUp(target: number, duration = 800, animate = true) {
  const [current, setCurrent] = useState(animate ? 0 : target)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    if (!animate) { setCurrent(target); return }
    const start     = performance.now()
    const startVal  = 0

    function step(now: number) {
      const elapsed  = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease out cubic
      const eased    = 1 - Math.pow(1 - progress, 3)
      setCurrent(startVal + (target - startVal) * eased)
      if (progress < 1) frame.current = requestAnimationFrame(step)
    }

    frame.current = requestAnimationFrame(step)
    return () => { if (frame.current) cancelAnimationFrame(frame.current) }
  }, [target, duration, animate])

  return current
}

export default function StatCard({ label, value, sub, color, prefix = '', suffix = '', animate = true }: Props) {
  const isNumber  = typeof value === 'number'
  const animated  = useCountUp(isNumber ? (value as number) : 0, 800, animate && isNumber)
  const displayed = isNumber
    ? `${prefix}${animated.toFixed(2)}${suffix}`
    : `${value}`

  return (
    <div style={{
      background:   'var(--qt-bg-card)',
      border:       '0.5px solid var(--qt-border)',
      borderRadius: '8px',
      padding:      '14px 16px',
    }}>
      <p style={{
        fontSize:      '10px',
        color:         'var(--qt-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom:  '6px',
      }}>
        {label}
      </p>
      <p style={{
        fontSize:   '20px',
        fontWeight: 700,
        color:      color ?? 'var(--qt-text)',
        fontFamily: 'JetBrains Mono, monospace',
        lineHeight:  1.1,
        marginBottom: sub ? '4px' : 0,
      }}>
        {displayed}
      </p>
      {sub && (
        <p style={{
          fontSize: '10px',
          color:    'var(--qt-muted)',
          marginTop: '3px',
        }}>
          {sub}
        </p>
      )}
    </div>
  )
}
