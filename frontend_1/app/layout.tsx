import type { Metadata } from 'next'
import './global.css'

export const metadata: Metadata = {
  title: 'QuantTrade | Options Analyst',
  description: 'Agentic options trading analysis powered by Black-Scholes and multi-agent AI',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  )
}
