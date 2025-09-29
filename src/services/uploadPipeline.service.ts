import { supabase } from './supabaseClient'

export type ProcessResult = {
  ok: boolean
  original?: { bucket: string; path: string }
  preview?: { bucket: string; path: string }
  error?: string
}

/**
 * After uploading to `user-content/uploads/works/{uid}/...`, call this to sanitize & generate preview.
 */
export async function processUploadedWorkImage(tempPath: string): Promise<ProcessResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { ok: false, error: 'Unauthorized' }
  const { data, error } = await supabase.functions.invoke('process-uploaded-image', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { path: tempPath },
  })
  if (error) return { ok: false, error: error.message }
  return data as ProcessResult
}

