'use client'

interface Props {
  action: 'BUY' | 'SELL' | 'HOLD' | string
  size?:  'sm' | 'md' | 'lg'
}

const STYLES: Record<string, { bg: string; border: string; color: string }> = {
  BUY:  { bg: 'var(--qt-amber-dim)',  border: 'var(--qt-amber-border)',  color: 'var(--qt-amber)' },
  SELL: { bg: 'var(--qt-red-dim)',    border: 'var(--qt-red-border)',    color: 'var(--qt-red)'   },
  HOLD: { bg: 'var(--qt-cyan-dim)',   border: 'var(--qt-cyan-border)',   color: 'var(--qt-cyan)'  },
}

const SIZES = {
  sm: { fontSize: '10px', padding: '3px 8px',   letterSpacing: '0.08em' },
  md: { fontSize: '12px', padding: '5px 12px',  letterSpacing: '0.10em' },
  lg: { fontSize: '16px', padding: '8px 18px',  letterSpacing: '0.14em' },
}

export default function SignalBadge({ action, size = 'md' }: Props) {
  const style = STYLES[action] ?? STYLES.HOLD
  const sz    = SIZES[size]

  return (
    <div style={{
      display:      'inline-flex',
      alignItems:   'center',
      justifyContent: 'center',
      background:   style.bg,
      border:       `0.5px solid ${style.border}`,
      borderRadius: '5px',
      padding:      sz.padding,
    }}>
      <span style={{
        fontSize:      sz.fontSize,
        fontWeight:    700,
        color:         style.color,
        fontFamily:    'JetBrains Mono, monospace',
        letterSpacing: sz.letterSpacing,
      }}>
        {action}
      </span>
    </div>
  )
}
