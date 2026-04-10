'use client'

import type { Tab, TabId } from '../../app/dashboard/DashboardPage'

interface Props {
  tabs:        Tab[]
  activeTab:   TabId
  onTabChange: (id: string) => void
}

export default function Sidebar({ tabs, activeTab, onTabChange }: Props) {
  return (
    <div style={{
      width: '52px',
      background: 'var(--qt-bg-bar)',
      borderRight: '0.5px solid var(--qt-border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '6px 0',
      gap: '2px',
      flexShrink: 0,
      overflowY: 'auto',
    }}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
            style={{
              width: '100%',
              padding: '10px 0',
              background: 'transparent',
              border: 'none',
              borderLeft: isActive
                ? '2px solid var(--qt-cyan)'
                : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              transition: 'all 0.15s',
            }}
          >
            <span style={{
              fontSize: '13px',
              fontFamily: 'JetBrains Mono, monospace',
              color: isActive ? 'var(--qt-cyan)' : 'var(--qt-muted)',
              lineHeight: 1,
              transition: 'color 0.15s',
            }}>
              {tab.icon}
            </span>
            <span style={{
              fontSize: '8px',
              fontFamily: 'JetBrains Mono, monospace',
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: isActive ? 'var(--qt-cyan)' : 'var(--qt-muted)',
              transition: 'color 0.15s',
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}