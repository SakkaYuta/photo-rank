import { supabase } from './supabaseClient'

export type ProcessResult = {
  ok: boolean
  original?: { bucket: string; path: string; signedUrl?: string }
  preview?: { bucket: string; path: string; signedUrl?: string }
  error?: string
  errorId?: string // For debugging support
}

/**
 * After uploading to `user-content/uploads/works/{uid}/...`, call this to sanitize & generate preview.
 */
export async function processUploadedWorkImage(tempPath: string, bucket: string = 'user-content'): Promise<ProcessResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { ok: false, error: 'Unauthorized' }
  const { data, error } = await supabase.functions.invoke('process-uploaded-image', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { path: tempPath, bucket },
  })
  if (error) return { ok: false, error: error.message }
  return data as ProcessResult
}

export type RegenResult = {
  ok: boolean
  preview?: { bucket: string; path: string }
  error?: string
  errorId?: string // For debugging support
}

export async function regeneratePreviewFromOriginal(originalPath: string, workId?: string): Promise<RegenResult> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return { ok: false, error: 'Unauthorized' }
  const { data, error } = await supabase.functions.invoke('regenerate-preview', {
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: { original_path: originalPath, work_id: workId },
  })
  if (error) return { ok: false, error: error.message }
  return data as RegenResult
}
