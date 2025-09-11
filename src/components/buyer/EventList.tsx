import { useEffect, useState } from 'react'
import { listEvents } from '../../services/event.service'
import type { Event } from '../../types'

export function EventList() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      try { const data = await listEvents(); if (active) setEvents(data) }
      catch (e: any) { setError(e.message) }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [])

  if (loading) return <div className="p-4">読み込み中...</div>
  if (error) return <div className="p-4 text-red-600">{error}</div>

  return (
    <div className="p-4">
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {events.map(ev => (
          <li key={ev.id} className="card">
            <h3 className="text-lg font-semibold">{ev.title}</h3>
            <p className="text-sm text-gray-600">テーマ: {ev.theme}</p>
            <p className="text-sm text-gray-600">賞金総額: {ev.total_prize.toLocaleString()}円</p>
            <p className="text-xs text-gray-500">{new Date(ev.start_date).toLocaleDateString()} - {new Date(ev.end_date).toLocaleDateString()}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}

