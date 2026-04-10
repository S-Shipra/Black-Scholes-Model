'use client'

import type { AnalysisResult } from '@/types/analysis'
import ReactMarkdown from 'react-markdown'

interface Props { data: AnalysisResult | null }

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--qt-bg-card)',
      border: '0.5px solid var(--qt-border)',
      borderRadius: '8px',
      padding: '14px 16px',
    }}>
      <p style={{ fontSize: '10px', color: 'var(--qt-text)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{label}</p>
      <p style={{ fontSize: '20px', fontWeight: 700, color: color ?? 'var(--qt-text)', fontFamily: 'JetBrains Mono, monospace', marginBottom: sub ? '4px' : 0 }}>{value}</p>
      {sub && <p style={{ fontSize: '10px', color: 'var(--qt-text)' }}>{sub}</p>}
    </div>
  )
}

function SignalBadge({ action }: { action: string }) {
  const colors: Record<string, { bg: string; border: string; color: string }> = {
    BUY:  { bg: 'var(--qt-amber-dim)',  border: 'var(--qt-amber-border)',  color: 'var(--qt-amber)' },
    SELL: { bg: 'var(--qt-red-dim)',    border: 'var(--qt-red-border)',    color: 'var(--qt-red)'   },
    HOLD: { bg: 'var(--qt-cyan-dim)',   border: 'var(--qt-cyan-border)',   color: 'var(--qt-cyan)'  },
  }
  const c = colors[action] ?? colors.HOLD
  return (
    <div style={{
      background: c.bg,
      border: `0.5px solid ${c.border}`,
      borderRadius: '6px',
      padding: '6px 14px',
      display: 'inline-block',
    }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: c.color, letterSpacing: '0.12em' }}>{action}</span>
    </div>
  )
}

function MispricingGauge({ pct }: { pct: number }) {
  const clamped = Math.max(-20, Math.min(20, pct))
  const isUnder = pct < 0
  const widthPct = Math.abs(clamped) * 5

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '10px', color: 'var(--qt-text)' }}>← OVERPRICED (SELL)</span>
        <span style={{ fontSize: '10px', color: isUnder ? 'var(--qt-amber)' : 'var(--qt-red)', fontWeight: 700 }}>
          {pct > 0 ? '+' : ''}{pct.toFixed(2)}%
        </span>
        <span style={{ fontSize: '10px', color: 'var(--qt-text)' }}>UNDERPRICED (BUY) →</span>
      </div>
      <div style={{ background: '#111827', borderRadius: '3px', height: '6px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, height: '100%', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{
          position: 'absolute',
          top: 0,
          height: '100%',
          width: `${widthPct}%`,
          background: isUnder ? 'var(--qt-amber)' : 'var(--qt-red)',
          borderRadius: '2px',
          left: isUnder ? '50%' : `${50 - widthPct}%`,
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  )
}

export default function OverviewTab({ data }: Props) {
  if (!data) return (
    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--qt-text)', fontSize: '12px' }}>
      No data available
    </div>
  )

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--qt-text)', fontFamily: 'JetBrains Mono, monospace' }}>
          ${data.spot_price?.toFixed(2)}
        </span>
        <span style={{
          fontSize: '13px',
          color: (data.price_change_pct ?? 0) >= 0 ? 'var(--qt-cyan)' : 'var(--qt-red)',
          fontWeight: 700,
        }}>
          {(data.price_change_pct ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(data.price_change_pct ?? 0).toFixed(2)}%
        </span>
        <span style={{ fontSize: '11px', color: 'var(--qt-text)', marginLeft: '4px' }}>
          {data.ticker} · {data.option_type?.toUpperCase()} · ${data.strike} · {data.expiry}
        </span>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
        <StatCard label="BS Price" value={`$${data.bs_price?.toFixed(2)}`} sub="Theoretical" color="var(--qt-cyan)" />
        <StatCard label="Mkt Price" value={`$${data.market_price?.toFixed(2)}`} sub="Mid bid/ask" />
        <StatCard label="Mispricing" value={`${data.mispricing_pct?.toFixed(2)}%`} sub={data.mispricing_signal?.replace('_', ' ')} color={data.mispricing_pct < 0 ? 'var(--qt-amber)' : 'var(--qt-red)'} />
        <StatCard label="Risk Score" value={`${data.risk_score ?? 0} / 100`} sub={data.risk_level} color="var(--qt-amber)" />
      </div>

      {/* Signal + Gauge */}
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '10px' }}>
        <div style={{ background: 'var(--qt-bg-card)', border: '0.5px solid var(--qt-border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '12px 8px' }}>
          <span style={{ fontSize: '10px', color: 'var(--qt-text)' }}>Signal</span>
          <SignalBadge action={data.action ?? 'HOLD'} />
          <span style={{ fontSize: '10px', color: 'var(--qt-text)' }}>{data.strategy}</span>
        </div>

        <div style={{ background: 'var(--qt-bg-card)', border: '0.5px solid var(--qt-border)', borderRadius: '8px', padding: '14px 16px' }}>
          <p style={{ fontSize: '10px', color: 'var(--qt-text)', marginBottom: '4px' }}>
            Mispricing Gauge
          </p>
          <MispricingGauge pct={data.mispricing_pct ?? 0} />
        </div>
      </div>

      {/* Greeks */}
      <div style={{ background: 'var(--qt-bg-card)', border: '0.5px solid var(--qt-border)', borderRadius: '8px', padding: '12px 16px' }}>
        <p style={{ fontSize: '10px', color: 'var(--qt-text)', marginBottom: '10px' }}>Greeks</p>
        <div style={{ display: 'flex', justifyContent: 'space-around' }}>
          {[
            { label: 'Delta', value: data.greeks?.delta?.toFixed(4), color: 'var(--qt-cyan)' },
            { label: 'Gamma', value: data.greeks?.gamma?.toFixed(4), color: 'var(--qt-text)' },
            { label: 'Theta', value: data.greeks?.theta?.toFixed(4), color: 'var(--qt-red)' },
            { label: 'Vega', value: data.greeks?.vega?.toFixed(4), color: 'var(--qt-amber)' },
            { label: 'Rho', value: data.greeks?.rho?.toFixed(4), color: 'var(--qt-text)' },
          ].map(g => (
            <div key={g.label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: 'var(--qt-text)' }}>{g.label}</p>
              <p style={{ fontSize: '15px', fontWeight: 700, color: g.color, fontFamily: 'JetBrains Mono, monospace' }}>{g.value ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* AI Explanation */}
      <div style={{ background: 'var(--qt-bg-card)', border: '0.5px solid var(--qt-border)', borderRadius: '8px', padding: '14px 16px' }}>
        <p style={{ fontSize: '10px', color: 'var(--qt-text)', marginBottom: '8px' }}>
          AI Insight
        </p>
        <div style={{ fontSize: '12px', color: 'var(--qt-text)', lineHeight: '1.7', fontFamily: 'JetBrains Mono, monospace' }}>
          <ReactMarkdown>
            {data.explanation ?? 'No explanation available.'}
          </ReactMarkdown>
        </div>
      </div>

      {/* Risk flags */}
      {data.risk_flags && (
        <div style={{ background: 'var(--qt-bg-card)', border: '0.5px solid var(--qt-red-border)', borderRadius: '8px', padding: '12px 16px' }}>
          <p style={{ fontSize: '10px', color: 'var(--qt-red)', marginBottom: '8px' }}>
            Risk Flags
          </p>
          {data.risk_flags.map((flag, i) => (
            <p key={i} style={{ fontSize: '11px', color: 'var(--qt-text)' }}>
              ⚠ {flag}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}