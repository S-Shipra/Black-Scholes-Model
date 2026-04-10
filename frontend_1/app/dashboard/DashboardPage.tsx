'use client'

import React, { useState } from 'react'
import type { JSX } from 'react'
import { useSearchParams } from 'next/navigation'

/* Layout */
import TopBar from '@/component/layout/TopBar'
import Sidebar from '@/component/layout/Sidebar'

/* ✅ ADD THIS IMPORT */
import ExportButton from '@/component/ExportButton'

/* Tabs */
import OverviewTab from '@/component/tabs/OverviewTab'
import StrategyTab from '@/component/tabs/StrategyTab'
import GreeksTab from '@/component/tabs/GreeksTab'
import PayoffTab from '@/component/tabs/PayoffTab'
import HeatmapTab from '@/component/tabs/HeatmapTab'
import VolSmileTab from '@/component/tabs/VolSmileTab'
import BSStrikesTab from '@/component/tabs/BSStrikesTab'
import RawDataTab from '@/component/tabs/RawDataTab'
import BacktestTab from '@/component/tabs/BacktestTab'

/* Hooks */
import { useAnalysis } from '@/hooks/useAnalysis'
import type { AnalysisResult } from '@/types/analysis'

/* Types */

export type TabId =
  | 'overview'
  | 'strategy'
  | 'greeks'
  | 'payoff'
  | 'heatmap'
  | 'volsmile'
  | 'bsstrikes'
  | 'rawdata'
  | 'backtest'

export interface Tab {
  id: TabId
  icon: string
  label: string
}

/* Tabs Config */

export const TABS: Tab[] = [
  { id: 'overview', icon: '◈', label: 'OVER' },
  { id: 'strategy', icon: '◎', label: 'STRAT' },
  { id: 'greeks', icon: '∂', label: 'GREEK' },
  { id: 'payoff', icon: '⌇', label: 'PAYOF' },
  { id: 'heatmap', icon: '▦', label: 'HEAT' },
  { id: 'volsmile', icon: '∿', label: 'SMILE' },
  { id: 'bsstrikes', icon: '◫', label: 'BSM' },
  { id: 'rawdata', icon: '{}', label: 'RAW' },
  { id: 'backtest', icon: '⟳', label: 'BTEST' },
]

/* Tab Renderer */

const TAB_COMPONENTS: Record<
  TabId,
  (data: AnalysisResult | null) => JSX.Element
> = {
  overview: (data) => <OverviewTab data={data} />,
  strategy: (data) => <StrategyTab data={data} />,
  greeks: (data) => <GreeksTab data={data} />,
  payoff: (data) => <PayoffTab data={data} />,
  heatmap: (data) => <HeatmapTab data={data} />,
  volsmile: (data) => <VolSmileTab data={data} />,
  bsstrikes: (data) => <BSStrikesTab data={data} />,
  rawdata: (data) => <RawDataTab data={data} />,
  backtest: (data) =>
    data ? (
      <BacktestTab data={data} />
    ) : (
      <div style={{ padding: 20, color: 'var(--qt-muted)' }}>
        No analysis data available
      </div>
    ),
}

/* UI States */

function LoadingSkeleton() {
  return (
    <div style={styles.loadingContainer}>
      <div style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{ ...styles.card, animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>

      <div style={{ ...styles.card, height: '200px' }} />

      <style>{`@keyframes qtPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div style={styles.errorWrapper}>
      <div style={styles.errorCard}>
        <div style={{ color: 'var(--qt-red)', marginBottom: '8px' }}>
          ⚠ Pipeline Error
        </div>
        <p style={{ fontSize: '12px', marginBottom: '12px' }}>
          {message || 'Something went wrong'}
        </p>
        <button onClick={onRetry}>Retry</button>
      </div>
    </div>
  )
}

/* Main Page */

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const params = {
    ticker: searchParams.get('ticker') ?? '',
    option_type: searchParams.get('type') ?? 'call',
    strike: Number(searchParams.get('strike') ?? 0),
    expiry: searchParams.get('expiry') ?? '',
    risk_free_rate: Number(searchParams.get('rfr') ?? 0.0525),
  }

  const { data, loading, error, refetch } = useAnalysis(params)

  const renderContent = () => {
    if (loading) return <LoadingSkeleton />
    if (error)
      return <ErrorState message={error} onRetry={refetch} />

    return TAB_COMPONENTS[activeTab](data)
  }

  return (
    <div style={styles.page}>
      <TopBar
        ticker={params.ticker}
        optionType={params.option_type}
        strike={params.strike}
        expiry={params.expiry}
        isLoading={loading}
      />

      <div style={styles.body}>
        <Sidebar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as TabId)}
        />

        <main style={styles.main}>
          {data && <StatsBar data={data} />}

          {/* ✅ IMPORTANT: dashboard-root added */}
          <div id="dashboard-root" style={styles.content}>
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  )
}

/* ✅ UPDATED StatsBar */

function StatsBar({ data }: { data: AnalysisResult }) {
  return (
    <div
      style={{
        ...styles.statsBar,
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      {/* LEFT */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <span>Spot: ${data.spot_price?.toFixed(2)}</span>
        <span>
          HV: {((data.historical_vol ?? 0) * 100).toFixed(1)}%
        </span>
        <span>
          IV: {((data.implied_vol ?? 0) * 100).toFixed(1)}%
        </span>
      </div>

      {/* RIGHT BUTTON */}
      <ExportButton
        dashboardId="dashboard-root"
        data={data}
      />
    </div>
  )
}

/* Styles */

const styles = {
  page: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'var(--qt-bg)',
  },
  body: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    overflowY: 'auto' as const,
  },
  statsBar: {
    padding: '6px 16px',
    borderBottom: '0.5px solid var(--qt-border)',
    display: 'flex',
    gap: '16px',
    background: 'var(--qt-bg-bar)',
  },
  loadingContainer: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  card: {
    background: 'var(--qt-bg-card)',
    border: '0.5px solid var(--qt-border)',
    borderRadius: '8px',
    height: '80px',
    animation: 'qtPulse 1.5s ease-in-out infinite',
  },
  errorWrapper: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    background: 'var(--qt-bg-card)',
    border: '0.5px solid var(--qt-red-border)',
    borderRadius: '10px',
    padding: '24px',
    textAlign: 'center' as const,
  },
}