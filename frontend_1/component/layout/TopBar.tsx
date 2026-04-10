'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Props {
  ticker:     string
  optionType: string
  strike:     number
  expiry:     string
  isLoading:  boolean
}

function LiveClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    function update() {
      const str = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        timeZone: 'America/New_York', hour12: false,
      })
      setTime(str + ' EST')
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span style={{ fontSize: '10px', color: 'var(--qt-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
      {time}
    </span>
  )
}

export default function TopBar({ ticker, optionType, strike, expiry, isLoading }: Props) {
  return (
    <div style={{
      height: '44px',
      background: 'var(--qt-bg-bar)',
      borderBottom: '0.5px solid var(--qt-border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 14px',
      gap: '12px',
      flexShrink: 0,
    }}>

      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          width: '24px', height: '24px',
          background: 'var(--qt-cyan)',
          borderRadius: '4px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: '9px', fontWeight: 700, color: '#07090F', fontFamily: 'JetBrains Mono, monospace' }}>QT</span>
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--qt-text)', letterSpacing: '0.1em', fontFamily: 'JetBrains Mono, monospace' }}>
          QUANT<span style={{ color: 'var(--qt-cyan)' }}>TRADE</span>
        </span>
      </Link>

      <div style={{ width: '0.5px', height: '16px', background: 'var(--qt-border-mid)' }} />

      {/* Contract pill */}
      {ticker && (
        <div style={{
          background: 'var(--qt-bg-input)',
          border: '0.5px solid var(--qt-cyan-border)',
          borderRadius: '4px',
          padding: '3px 10px',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--qt-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>
            {ticker}
          </span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.15)' }}>|</span>
          <span style={{ fontSize: '10px', color: 'var(--qt-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            {optionType?.toUpperCase()} · ${strike} · {expiry}
          </span>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: 'var(--qt-amber)',
            animation: 'qtBlink 1s ease-in-out infinite',
          }} />
          <span style={{ fontSize: '10px', color: 'var(--qt-amber)', fontFamily: 'JetBrains Mono, monospace' }}>
            ANALYZING...
          </span>
          <style>{`@keyframes qtBlink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
        </>
      )}

      {/* Right side */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{
            width: '5px', height: '5px', borderRadius: '50%',
            background: 'var(--qt-cyan)',
            animation: 'qtLive 2s ease-in-out infinite',
          }} />
          <style>{`@keyframes qtLive{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
          <span style={{ fontSize: '10px', color: 'var(--qt-muted)', fontFamily: 'JetBrains Mono, monospace' }}>LIVE</span>
        </div>

        <div style={{ width: '0.5px', height: '12px', background: 'var(--qt-border-mid)' }} />
        <LiveClock />
        <div style={{ width: '0.5px', height: '12px', background: 'var(--qt-border-mid)' }} />

        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{
            padding: '4px 10px',
            background: 'transparent',
            border: '0.5px solid var(--qt-border-mid)',
            borderRadius: '4px',
            fontSize: '10px',
            color: 'var(--qt-muted)',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}>
            + NEW
          </span>
        </Link>
      </div>
    </div>
  )
}