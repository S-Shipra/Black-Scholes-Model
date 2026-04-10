import { Suspense } from 'react'
import DashboardPage from './DashboardPage'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DashboardPage />
    </Suspense>
  )
}