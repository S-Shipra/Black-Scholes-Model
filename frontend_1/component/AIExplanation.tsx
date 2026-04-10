'use client'

import { useEffect, useState, useRef } from 'react'

interface Props {
  text:        string
  isStreaming?: boolean
}

export default function AIExplanation({ text, isStreaming = false }: Props) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone]           = useState(false)
  const indexRef                  = useRef(0)
  const rafRef                    = useRef<number | null>(null)

  useEffect(() => {
    // Reset on new text
    setDisplayed('')
    setDone(false)
    indexRef.current = 0

    if (!text) return

    // Typewriter effect — 18ms per character
    function type() {
      if (indexRef.current < text.length) {
        indexRef.current++
        setDisplayed(text.slice(0, indexRef.current))
        rafRef.current = window.setTimeout(type, 18)
      } else {
        setDone(true)
      }
    }

    rafRef.current = window.setTimeout(type, 18)
    return () => {
      if (rafRef.current) clearTimeout(rafRef.current)
    }
  }, [text])

  if (!text) {
    return (
      <div style={{
        background:   'var(--qt-bg-card)',
        border:       '0.5px solid var(--qt-border)',
        borderRadius: '8px',
        padding:      '14px 16px',
      }}>
        <p style={{ fontSize: '10px', color: 'var(--qt-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
          AI Insight · Groq llama-3.3-70b
        </p>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width:        '5px',
              height:       '5px',
              borderRadius: '50%',
              background:   'var(--qt-muted)',
              animation:    'qtDot 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
          <style>{`@keyframes qtDot { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }`}</style>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background:   'var(--qt-bg-card)',
      border:       '0.5px solid var(--qt-border)',
      borderRadius: '8px',
      padding:      '14px 16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{
          width:        '6px',
          height:       '6px',
          borderRadius: '50%',
          background:   done ? 'var(--qt-cyan)' : 'var(--qt-amber)',
          flexShrink:   0,
          animation:    done ? 'none' : 'qtBlink 0.8s step-end infinite',
        }} />
        <p style={{
          fontSize:      '10px',
          color:         'var(--qt-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          AI Insight · Groq llama-3.3-70b
          {!done && <span style={{ color: 'var(--qt-amber)', marginLeft: '6px' }}>streaming...</span>}
        </p>
        <style>{`@keyframes qtBlink { 0%,100%{opacity:1} 50%{opacity:0.2} }`}</style>
      </div>

      {/* Text */}
      <p style={{
        fontSize:   '12px',
        color:      'var(--qt-text-sub)',
        lineHeight: '1.75',
        fontFamily: 'JetBrains Mono, monospace',
        margin:     0,
      }}>
        {displayed}
        {/* Blinking cursor while typing */}
        {!done && (
          <span style={{
            display:     'inline-block',
            width:       '7px',
            height:      '13px',
            background:  'var(--qt-amber)',
            marginLeft:  '2px',
            verticalAlign: 'middle',
            animation:   'qtBlink 0.8s step-end infinite',
          }} />
        )}
      </p>
    </div>
  )
}
