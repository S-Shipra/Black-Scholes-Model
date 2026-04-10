'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  const [ticker, setTicker] = useState<string>('AAPL')
  const [optionType, setOptionType] = useState<string>('call')
  const [strike, setStrike] = useState<string>('')
  const [expiry, setExpiry] = useState<string>('')
  const [riskFreeRate, setRiskFreeRate] = useState<string>('0.0525')

  const handleSubmit = () => {
    if (!ticker || !strike || !expiry) return

    router.push(
      `/dashboard?ticker=${ticker}&type=${optionType}&strike=${strike}&expiry=${expiry}&rfr=${riskFreeRate}`
    )
  }

  return (
    <div
      style={{
        height: '100vh',
        background: 'var(--qt-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--qt-bg-card)',
          border: '0.5px solid var(--qt-border)',
          borderRadius: 12,
          padding: 32,
          width: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <p
          style={{
            fontSize: 11,
            color: 'var(--qt-muted)',
            letterSpacing: '0.1em',
          }}
        >
          ⬡ OPTIONS ANALYST
        </p>

        {/* Ticker */}
        <div style={fieldStyle}>
          <label style={labelStyle}>TICKER</label>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="AAPL"
            style={inputStyle}
          />
        </div>

        {/* Option Type */}
        <div style={fieldStyle}>
          <label style={labelStyle}>OPTION TYPE</label>
          <select
            value={optionType}
            onChange={(e) => setOptionType(e.target.value)}
            style={inputStyle}
          >
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </div>

        {/* Strike */}
        <div style={fieldStyle}>
          <label style={labelStyle}>STRIKE PRICE ($)</label>
          <input
            type="number"
            value={strike}
            onChange={(e) => setStrike(e.target.value)}
            placeholder="255.00"
            style={inputStyle}
          />
        </div>

        {/* Expiry */}
        <div style={fieldStyle}>
          <label style={labelStyle}>EXPIRY DATE</label>
          <input
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* Risk Free Rate */}
        <div style={fieldStyle}>
          <label style={labelStyle}>RISK FREE RATE</label>
          <input
            type="number"
            value={riskFreeRate}
            onChange={(e) => setRiskFreeRate(e.target.value)}
            placeholder="0.0525"
            step="0.001"
            style={inputStyle}
          />
        </div>

        {/* Button */}
        <button
          onClick={handleSubmit}
          style={{
            marginTop: 8,
            padding: '10px',
            background: 'var(--qt-amber-dim)',
            border: '0.5px solid var(--qt-amber)',
            borderRadius: 6,
            color: 'var(--qt-amber)',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.1em',
            cursor: 'pointer',
          }}
        >
          ANALYSE →
        </button>
      </div>
    </div>
  )
}

/* ---------- STYLES ---------- */

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--qt-muted)',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--qt-bg)',
  border: '0.5px solid var(--qt-border)',
  borderRadius: 6,
  padding: '8px 12px',
  color: 'var(--qt-text)',
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 13,
  width: '100%',
}