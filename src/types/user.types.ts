export type User = {
  id: string
  display_name: string
  bio?: string | null
  avatar_url?: string | null
  is_creator: boolean
  is_verified: boolean
  created_at: string
}

