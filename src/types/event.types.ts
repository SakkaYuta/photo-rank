export type Event = {
  id: string
  title: string
  description?: string | null
  theme: string
  total_prize: number
  start_date: string
  end_date: string
  status: 'active' | 'upcoming' | 'ended' | string
  created_at: string
}

