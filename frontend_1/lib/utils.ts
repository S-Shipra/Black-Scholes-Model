// ─── Price Formatters ─────────────────────────────────────────────

export function formatPrice(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '—'
  return `$${value.toFixed(2)}`
}

export function formatPct(value: number | undefined | null, decimals = 2): string {
  if (value == null || isNaN(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function formatGreek(value: number | undefined | null, decimals = 4): string {
  if (value == null || isNaN(value)) return '—'
  return value.toFixed(decimals)
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return dateStr
  }
}

export function formatVolPct(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '—'
  return `${(value * 100).toFixed(2)}%`
}

export function formatNumber(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '—'
  return value.toLocaleString()
}

// ─── Color Helpers ────────────────────────────────────────────────

export const QT = {
  cyan:         '#00E5B4',
  cyanDim:      'rgba(0,229,180,0.08)',
  cyanBorder:   'rgba(0,229,180,0.22)',
  amber:        '#F5A623',
  amberDim:     'rgba(245,166,35,0.10)',
  amberBorder:  'rgba(245,166,35,0.28)',
  red:          '#FF4560',
  redDim:       'rgba(255,69,96,0.10)',
  redBorder:    'rgba(255,69,96,0.28)',
  text:         '#DFE8F5',
  textSub:      '#7A90A8',
  muted:        '#364A62',
  bg:           '#07090F',
  bgBar:        '#090D18',
  bgCard:       '#0E1320',
  bgInput:      '#111827',
  border:       '#0E1A28',
  borderMid:    '#162030',
}

export function signalColor(action: string | undefined): string {
  switch (action) {
    case 'BUY':  return QT.amber
    case 'SELL': return QT.red
    case 'HOLD': return QT.cyan
    default:     return QT.muted
  }
}

export function signalBorderColor(action: string | undefined): string {
  switch (action) {
    case 'BUY':  return QT.amberBorder
    case 'SELL': return QT.redBorder
    case 'HOLD': return QT.cyanBorder
    default:     return QT.border
  }
}

export function signalDimColor(action: string | undefined): string {
  switch (action) {
    case 'BUY':  return QT.amberDim
    case 'SELL': return QT.redDim
    case 'HOLD': return QT.cyanDim
    default:     return QT.bgCard
  }
}

export function riskColor(level: string | undefined): string {
  switch (level) {
    case 'LOW':      return QT.cyan
    case 'MODERATE': return QT.amber
    case 'HIGH':     return QT.red
    default:         return QT.muted
  }
}

export function mispricingColor(pct: number | undefined): string {
  if (pct == null) return QT.muted
  if (pct < -1)  return QT.amber  // underpriced — BUY
  if (pct > 1)   return QT.red    // overpriced  — SELL
  return QT.cyan                   // fairly priced
}

// ─── Recharts Dark Theme ──────────────────────────────────────────

export const chartTheme = {
  background:      QT.bgCard,
  gridColor:       QT.border,
  axisColor:       QT.muted,
  tooltipBg:       QT.bgCard,
  tooltipBorder:   QT.borderMid,
  fontFamily:      'JetBrains Mono, monospace',
  fontSize:        10,
}

export const tooltipStyle = {
  background:   QT.bgCard,
  border:       `0.5px solid ${QT.borderMid}`,
  borderRadius: '6px',
  padding:      '10px 14px',
  fontFamily:   'JetBrains Mono, monospace',
  fontSize:     '11px',
  color:        QT.text,
}

// ─── Misc ─────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function daysToExpiry(expiry: string | undefined): number {
  if (!expiry) return 0
  const diff = new Date(expiry).getTime() - new Date().getTime()
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)))
}