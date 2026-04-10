'use client'

interface Tab {
  id:    string
  icon:  string
  label: string
}

interface Props {
  tabs:        Tab[]
  activeTab:   string
  onTabChange: (id: string) => void
}

export default function Sidebar({ tabs, activeTab, onTabChange }: Props) {
  return (
    <div style={{
      width:        '52px',
      background:   'var(--qt-bg-bar)',
      borderRight:  '0.5px solid var(--qt-border)',
      display:      'flex',
      flexDirection:'column',
      paddingTop:   '6px',
      paddingBottom:'6px',
      gap:          '2px',
      flexShrink:   0,
      overflowY:    'auto',
    }}>
      {tabs.map(tab => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={tab.id}
            style={{
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '3px',
              padding:        '9px 0',
              cursor:         'pointer',
              background:     isActive ? 'rgba(0,229,180,0.06)' : 'transparent',
              border:         'none',
              borderLeft:     isActive ? '2px solid var(--qt-cyan)' : '2px solid transparent',
              borderRight:    'none',
              borderTop:      'none',
              borderBottom:   'none',
              transition:     'all 0.15s',
              width:          '100%',
            }}
            onMouseEnter={e => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)'
              }
            }}
            onMouseLeave={e => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }
            }}
          >
            <span style={{
              fontSize:   '13px',
              color:      isActive ? 'var(--qt-cyan)' : 'var(--qt-muted)',
              fontFamily: 'JetBrains Mono, monospace',
              lineHeight: 1,
              transition: 'color 0.15s',
            }}>
              {tab.icon}
            </span>
            <span style={{
              fontSize:      '8px',
              color:         isActive ? 'var(--qt-cyan)' : 'var(--qt-muted)',
              fontFamily:    'JetBrains Mono, monospace',
              letterSpacing: '0.04em',
              transition:    'color 0.15s',
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
