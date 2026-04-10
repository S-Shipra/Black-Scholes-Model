'use client'

import { useState } from 'react'

export interface BacktestParams {
  ticker: string
  option_type: string
  strike: number
  expiry: string
  risk_free_rate: number
  lookback_days: number
  iv_hv_threshold: number
}

export function useBacktest() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runBacktest = async (params: BacktestParams) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('http://localhost:8000/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      })

      const result = await response.json()

      // Handle backend error (like expiry issue)
      if (!response.ok) {
        throw new Error(result.detail || 'Backtest failed')
      }

      setData(result)
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setData(null)
    setError(null)
    setLoading(false)
  }

  return {
    data,
    loading,
    error,
    runBacktest,
    reset,
  }
}