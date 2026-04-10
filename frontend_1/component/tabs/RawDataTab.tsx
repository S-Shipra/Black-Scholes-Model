'use client'

import { useState } from 'react'
import type { AnalysisResult } from '@/types/analysis'

interface Props { data: AnalysisResult | null }

export default function RawDataTab({ data }: Props) {
  const [copied, setCopied] = useState(false)

  if (!data) return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--qt-muted)', fontSize: '12px' }}>
      No data available
    </div>
  )

  const jsonString = JSON.stringify(data, null, 2)

  function handleCopy() {
    navigator.clipboard.writeText(jsonString)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDownload() {
  if (!data) return
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${data.ticker}_${data.option_type}_${data.strike}_${data.expiry}.json`
  a.click()
  URL.revokeObjectURL(url)
}

  // Simple syntax highlighting
  function highlight(json: string): string {
    return json
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
        let color = '#00E5B4'  // number — cyan
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            color = '#7A90A8'  // key — muted blue
          } else {
            color = '#DFE8F5'  // string value — white
          }
        } else if (/true|false/.test(match)) {
          color = '#F5A623'    // boolean — amber
        } else if (/null/.test(match)) {
          color = '#FF4560'    // null — red
        }
        return `<span style="color:${color}">${match}</span>`
      })
  }

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Header + actions */}
      <div style={{
        background: 'var(--qt-bg-card)',
        border: '0.5px solid var(--qt-border)',
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Raw Pipeline State</p>
          <p style={{ fontSize: '11px', color: 'var(--qt-text-sub)' }}>
            {Object.keys(data).length} fields · {jsonString.length.toLocaleString()} bytes
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleCopy}
            style={{
              padding: '7px 14px',
              background: copied ? 'var(--qt-cyan-dim)' : 'transparent',
              border: `0.5px solid ${copied ? 'var(--qt-cyan-border)' : 'var(--qt-border-mid)'}`,
              borderRadius: '5px',
              color: copied ? 'var(--qt-cyan)' : 'var(--qt-muted)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {copied ? 'COPIED!' : 'COPY JSON'}
          </button>
          <button
            onClick={handleDownload}
            style={{
              padding: '7px 14px',
              background: 'var(--qt-cyan-dim)',
              border: '0.5px solid var(--qt-cyan-border)',
              borderRadius: '5px',
              color: 'var(--qt-cyan)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              cursor: 'pointer',
            }}
          >
            DOWNLOAD ↓
          </button>
        </div>
      </div>

      {/* JSON viewer */}
      <div style={{
        background: 'var(--qt-bg-card)',
        border: '0.5px solid var(--qt-border)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
        {/* File tab header */}
        <div style={{
          background: 'var(--qt-bg-bar)',
          borderBottom: '0.5px solid var(--qt-border)',
          padding: '6px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--qt-amber)' }} />
          <span style={{ fontSize: '10px', color: 'var(--qt-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            {data.ticker}_{data.option_type}_{data.strike}_{data.expiry}.json
          </span>
        </div>

        {/* JSON content */}
        <div style={{
          padding: '16px',
          overflowX: 'auto',
          maxHeight: '500px',
          overflowY: 'auto',
        }}>
          <pre
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '12px',
              lineHeight: '1.6',
              color: 'var(--qt-text)',
              margin: 0,
              whiteSpace: 'pre',
            }}
            dangerouslySetInnerHTML={{ __html: highlight(jsonString) }}
          />
        </div>
      </div>
    </div>
  )
}
