'use client'

import { useEffect, useState } from 'react'
import ExportButton from './ExportButton'
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
  ticker:      string
  optionType:  string
  strike:      number
  expiry:      string
  isLoading:   boolean
  /** Pass the full analysis result so ExportButton can build the report */
  data?:       AnalysisResult | null
  /** Pass the earnings info if fetched */
  earnings?:   EarningsInfo | null
  /** The id of your dashboard wrapper div */
  dashboardId?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function TopBar({
  ticker,
  optionType,
  strike,
  expiry,
  isLoading,
  data        = null,
  earnings    = null,
  dashboardId = 'qt-dashboard',
}: Props) {
  const [time, setTime] = useState('')

  useEffect(() => {
    function tick() {
      setTime(
        new Date().toLocaleTimeString('en-US', {
          hour:     '2-digit',
          minute:   '2-digit',
          second:   '2-digit',
          hour12:   false,
          timeZone: 'Asia/Kolkata',
        }) + ' IST',
      )
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '12px',
      padding:      '0 14px',
      height:       '44px',
      background:   'var(--qt-bg-bar)',
      borderBottom: '0.5px solid var(--qt-border)',
      flexShrink:   0,
    }}>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <div style={{
          width:          '26px',
          height:         '26px',
          background:     'var(--qt-cyan)',
          borderRadius:   '5px',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
        }}>
          <span style={{
            fontSize:      '10px',
            fontWeight:    700,
            color:         '#07090F',
            fontFamily:    'JetBrains Mono, monospace',
            letterSpacing: '-0.03em',
          }}>QT</span>
        </div>
        <span style={{
          fontSize:      '12px',
          fontWeight:    700,
          color:         'var(--qt-text)',
          fontFamily:    'JetBrains Mono, monospace',
          letterSpacing: '0.1em',
        }}>
          QUANT<span style={{ color: 'var(--qt-cyan)' }}>TRADE</span>
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: '0.5px', height: '16px', background: 'var(--qt-border-mid)', flexShrink: 0 }} />

      {/* Active contract pill */}
      {ticker && (
        <div style={{
          background:   'var(--qt-bg-input)',
          border:       '0.5px solid var(--qt-cyan-border)',
          borderRadius: '5px',
          padding:      '3px 10px',
          display:      'flex',
          alignItems:   'center',
          gap:          '8px',
          flexShrink:   0,
        }}>
          <span style={{
            fontSize:   '13px',
            fontWeight: 700,
            color:      'var(--qt-cyan)',
            fontFamily: 'JetBrains Mono, monospace',
          }}>{ticker}</span>
          <span style={{ width: '0.5px', height: '10px', background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize: '10px', color: 'var(--qt-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            {optionType?.toUpperCase()} · ${strike} · {expiry}
          </span>
        </div>
      )}

      {/* Analyzing indicator */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <div style={{
            width:        '5px',
            height:       '5px',
            borderRadius: '50%',
            background:   'var(--qt-amber)',
            animation:    'qtBlink 0.8s step-end infinite',
          }} />
          <span style={{
            fontSize:      '10px',
            color:         'var(--qt-amber)',
            fontFamily:    'JetBrains Mono, monospace',
            letterSpacing: '0.06em',
          }}>
            ANALYZING
          </span>
          <style>{`@keyframes qtBlink { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
        </div>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Export button */}
      <ExportButton data={data} dashboardId={dashboardId} />

      {/* Divider */}
      <div style={{ width: '0.5px', height: '16px', background: 'var(--qt-border-mid)', flexShrink: 0 }} />

      {/* Live dot + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
        <div style={{
          width:        '6px',
          height:       '6px',
          borderRadius: '50%',
          background:   'var(--qt-cyan)',
          flexShrink:   0,
          animation:    'livePulse 2s ease-in-out infinite',
        }} />
        <span style={{
          fontSize:      '11px',
          color:         'var(--qt-muted)',
          fontFamily:    'JetBrains Mono, monospace',
          letterSpacing: '0.04em',
        }}>{time}</span>
      </div>

    </div>
  )
}
