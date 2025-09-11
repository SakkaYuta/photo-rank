export type Work = {
  id: string
  creator_id: string
  event_id?: string | null
  title: string
  image_url: string
  thumbnail_url?: string | null
  price: number
  message?: string | null
  filter_type?: string | null
  frame_type?: string | null
  is_published: boolean
  created_at: string
}

export type Purchase = {
  id: string
  user_id: string
  work_id: string
  price: number
  purchased_at: string
}

export type Vote = {
  id: string
  user_id: string
  work_id: string
  created_at: string
}

