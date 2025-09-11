import { supabase } from './supabaseClient'

export async function acquireWorkLock(workId: string) {
  const { data, error } = await supabase.functions.invoke('acquire-work-lock', {
    body: { workId, userId: (await supabase.auth.getUser()).data.user?.id },
  })
  if (error) throw error
  return data as { locked: boolean }
}

export async function releaseWorkLock(workId: string) {
  const { error } = await supabase.functions.invoke('release-work-lock', {
    body: { workId },
  })
  if (error) throw error
}

export async function createPaymentIntent(workId: string) {
  const { data, error } = await supabase.functions.invoke('create-payment-intent', {
    body: { workId, userId: (await supabase.auth.getUser()).data.user?.id },
  })
  if (error) throw error
  // accept either clientSecret or client_secret key
  const clientSecret = (data as any).clientSecret ?? (data as any).client_secret
  return { clientSecret }
}
