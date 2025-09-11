import { useEffect, useState } from 'react'
import type { Work } from '../types'
import { listTrendingWorks } from '../services/work.service'

export function useTrendingWorks() {
  const [works, setWorks] = useState<Work[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try {
        const data = await listTrendingWorks()
        if (active) setWorks(data)
      } catch (e: any) {
        setError(e.message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [])

  return { works, loading, error }
}

