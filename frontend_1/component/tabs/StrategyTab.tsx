'use client'
import React from 'react'

import type { AnalysisResult } from '@/types/analysis'

interface Props {
  data: AnalysisResult | null
}

/* ---------- Helpers ---------- */

const formatCurrency = (val: string | number | null | undefined) => {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'string') {
    if (val === 'Unlimited') return '∞'
    return val
  }
  return `$${val.toFixed(2)}`
}

const formatNumber = (val: number | null | undefined) => {
  if (val === null || val === undefined) return '—'
  return `$${val.toFixed(2)}`
}

const formatPercent = (val?: number) => {
  if (val === undefined || val === null) return '—'
  return (val * 100).toFixed(1) + '%'
}

/* ---------- Component ---------- */

export default function StrategyTab({ data }: Props) {
  if (!data) {
    return <div style={{ padding: 20 }}>No data available</div>
  }

  const isHold = data.action === 'HOLD'

  const actionColor =
    data.action === 'BUY'
      ? 'var(--qt-amber)'
      : data.action === 'SELL'
        ? 'var(--qt-red)'
        : 'var(--qt-cyan)'

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* HEADER */}
      <div style={{
        background: 'var(--qt-bg-card)',
        borderRadius: 8,
        padding: 20,
        border: '0.5px solid var(--qt-border)'
      }}>
        <p style={{ fontSize: 12, color: 'var(--qt-muted)' }}>RECOMMENDED ACTION</p>
        <h1 style={{ fontSize: 32, color: actionColor, fontFamily: 'monospace' }}>
          {data.action}
        </h1>
        <p style={{ fontSize: 16 }}>
          {isHold ? 'No Trade Opportunity' : data.strategy}
        </p>
        <p style={{ fontSize: 12, marginTop: 6 }}>
          Risk: <b>{data.risk_level}</b> | Confidence: <b>{formatPercent(data.confidence)}</b>
        </p>
      </div>

      {/* METRICS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        <MetricCard label="Break-even" value={isHold ? '—' : formatNumber(data.break_even)} />
        <MetricCard label="Max Profit" value={isHold ? '—' : formatCurrency(data.max_profit)} />
        <MetricCard label="Max Loss" value={isHold ? '—' : formatCurrency(data.max_loss)} />
      </div>

      {/* RATIONALE */}
      <Section title="Agent Rationale">
        {data.rationale || 'No rationale available'}
      </Section>

      {/* VOL COMMENTARY */}
      <Section title="Volatility Commentary">
        {data.vol_commentary ?? 'No commentary'}
      </Section>

      {/* MULTI-AGENT INSIGHTS — now shows actions_by_role + role_insights together */}
      <Section title="Multi-Agent Insights">
        {(['trader', 'hedger', 'arbitrageur'] as const).map((role) => {
          const roleAction = data.actions_by_role?.[role]
          const roleInsight = data.role_insights?.[role]

          const roleActionColor =
            roleAction === 'BUY' ? 'var(--qt-amber)' :
              roleAction === 'SELL' ? 'var(--qt-red)' :
                'var(--qt-cyan)'

          return (
            <div
              key={role}
              style={{
                marginBottom: 12,
                paddingBottom: 12,
                borderBottom: '0.5px solid var(--qt-border)',
              }}
            >
              {/* Role label + action badge on the same row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <b style={{ textTransform: 'capitalize', fontSize: 13 }}>{role}</b>
                {roleAction && (
                  <span style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    color: roleActionColor,
                    border: `0.5px solid ${roleActionColor}`,
                    borderRadius: 4,
                    padding: '1px 6px',
                    letterSpacing: 0.5,
                  }}>
                    {roleAction}
                  </span>
                )}
              </div>
              {/* LLM insight text beneath */}
              <p style={{ fontSize: 12, margin: 0, color: 'var(--qt-muted)', lineHeight: 1.5 }}>
                {roleInsight ?? '—'}
              </p>
            </div>
          )
        })}
      </Section>

      {/* VOL NUMBERS */}
      <Section title="Volatility Metrics">
        <p>IV: {formatPercent(data.implied_vol)} | HV: {formatPercent(data.historical_vol)}</p>
      </Section>

    </div>
  )
}

/* ---------- Subcomponents ---------- */

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--qt-bg-card)',
      padding: 12,
      borderRadius: 8,
      border: '0.5px solid var(--qt-border)',
      textAlign: 'center'
    }}>
      <p style={{ fontSize: 10, color: 'var(--qt-muted)' }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 700 }}>{value}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--qt-bg-card)',
      padding: 14,
      borderRadius: 8,
      border: '0.5px solid var(--qt-border)'
    }}>
      <p style={{ fontSize: 12, marginBottom: 6, color: 'var(--qt-muted)' }}>{title}</p>
      <div style={{ fontSize: 13, lineHeight: 1.6 }}>{children}</div>
    </div>
  )
}