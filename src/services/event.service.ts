import { supabase } from './supabaseClient'
import type { Event } from '../types'

export async function listEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('start_date', { ascending: true })
  if (error) throw error
  return data as Event[]
}

