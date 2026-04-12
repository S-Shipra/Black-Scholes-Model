import { useState, useEffect, useCallback } from 'react'
import type { AnalysisResult } from '@/types/analysis'

interface UseAnalysisParams {
  ticker: string
  option_type: string
  strike: number
  expiry: string
  risk_free_rate: number
}

interface UseAnalysisReturn {
  data: AnalysisResult | null
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useAnalysis(params: UseAnalysisParams): UseAnalysisReturn {
  const [data, setData] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!params.ticker || !params.strike || !params.expiry) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')}/analyze`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ticker: params.ticker.toUpperCase(),
            option_type: params.option_type,
            strike: params.strike,
            expiry: params.expiry,
            risk_free_rate: params.risk_free_rate,
          }),
        }
      )

      const json = await res.json()
      console.log('API STATUS:', res.status)
      console.log('API RESPONSE:', json)

      if (!res.ok) {
        throw new Error(json?.detail || `HTTP ${res.status}`)
      }

      if (json && Object.keys(json).length > 0) {
        setData(json)
      } else {
        setData(null)
        setError('Empty response from API')
      }
    } catch (err: unknown) {
      console.error('FETCH ERROR:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [
    params.ticker,
    params.option_type,
    params.strike,
    params.expiry,
    params.risk_free_rate
  ])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}
