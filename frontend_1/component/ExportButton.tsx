'use client'

import { useState, useCallback } from 'react'
import type { AnalysisResult } from '@/types/analysis'

import { createRoot } from 'react-dom/client'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

// ✅ IMPORT ALL TABS
import OverviewTab from '@/component/tabs/OverviewTab'
import StrategyTab from '@/component/tabs/StrategyTab'
import GreeksTab from '@/component/tabs/GreeksTab'
import PayoffTab from '@/component/tabs/PayoffTab'
import HeatmapTab from '@/component/tabs/HeatmapTab'
import VolSmileTab from '@/component/tabs/VolSmileTab'
import BSStrikesTab from '@/component/tabs/BSStrikesTab'
import RawDataTab from '@/component/tabs/RawDataTab'
import BacktestTab from '@/component/tabs/BacktestTab'

// ─────────────────────────────────────────

interface ExportButtonProps {
  dashboardId: string
  data: AnalysisResult | null
}

// ─────────────────────────────────────────

async function buildPDF(data: AnalysisResult) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const PAGE_W = 210
  const MARGIN = 10
  const CONTENT = PAGE_W - MARGIN * 2

  // ✅ LIGHT THEME
  const TEXT = [0, 0, 0] as [number, number, number]
  const SUB = [80, 80, 80] as [number, number, number]

  // ── PAGE 1: SUMMARY ─────────────────────
  doc.setFont('courier', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...TEXT)
  doc.text('Options Analysis Report', MARGIN, 20)

  doc.setFontSize(10)
  doc.setTextColor(...SUB)
  doc.text(
    `${data.ticker} · ${data.option_type.toUpperCase()} $${data.strike} · ${data.expiry}`,
    MARGIN,
    28
  )

  let y = 40

  const row = (label: string, value: string) => {
    doc.setTextColor(...SUB)
    doc.text(label, MARGIN, y)

    doc.setTextColor(...TEXT)
    doc.text(value, PAGE_W - MARGIN, y, { align: 'right' })

    y += 6
  }

  row('Spot Price', `$${data.spot_price}`)
  row('Market Price', `$${data.market_price}`)
  row('BS Price', `$${data.bs_price}`)
  row('IV', `${(data.implied_vol * 100).toFixed(2)}%`)
  row('HV', `${(data.historical_vol * 100).toFixed(2)}%`)
  row('Mispricing', `${data.mispricing_pct}%`)
  row('Risk Score', `${data.risk_score}`)

  // ───────────────────────────────────────
  // ✅ MULTI TAB EXPORT
  // ───────────────────────────────────────

  const TAB_MAP: Record<string, any> = {
    Overview: OverviewTab,
    Strategy: StrategyTab,
    Greeks: GreeksTab,
    Payoff: PayoffTab,
    Heatmap: HeatmapTab,
    'Vol Smile': VolSmileTab,
    'BS Strikes': BSStrikesTab,
    'Raw Data': RawDataTab,
    Backtest: BacktestTab,
  }

  // hidden container
  const hiddenRoot = document.createElement('div')
  hiddenRoot.style.position = 'fixed'
  hiddenRoot.style.top = '-9999px'
  hiddenRoot.style.left = '0'
  hiddenRoot.style.width = '1200px'
  hiddenRoot.style.background = 'white'
  document.body.appendChild(hiddenRoot)

  for (const [label, Comp] of Object.entries(TAB_MAP)) {
    const mount = document.createElement('div')
    hiddenRoot.appendChild(mount)

    const root = createRoot(mount)

    root.render(
      <div style={{ padding: '20px', background: 'white' }}>
        <h2 style={{ color: 'black', marginBottom: '10px' }}>{label}</h2>
        <Comp data={data} />
      </div>
    )

    // wait for render
    await new Promise((r) => setTimeout(r, 600))

    const canvas = await html2canvas(hiddenRoot, {
      backgroundColor: '#ffffff',
      scale: 2,
    })

    const img = canvas.toDataURL('image/png')

    doc.addPage()
    doc.addImage(img, 'PNG', MARGIN, 10, CONTENT, 0)

    root.unmount()
    hiddenRoot.innerHTML = ''
  }

  document.body.removeChild(hiddenRoot)

  doc.save(`report_${data.ticker}.pdf`)
}

// ─────────────────────────────────────────

export default function ExportButton({ data }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = useCallback(async () => {
    if (!data) return
    setLoading(true)

    try {
      await buildPDF(data)
    } catch (err) {
      console.error(err)
    }

    setLoading(false)
  }, [data])

  return (
    <button
      onClick={handleExport}
      disabled={!data || loading}
      style={{
        padding: '6px 12px',
        fontSize: '11px',
        cursor: 'pointer',
        background: '#111827',
        color: '#fff',
        border: '1px solid #333',
        borderRadius: '6px',
      }}
    >
      {loading ? 'Exporting...' : 'Export PDF'}
    </button>
  )
}