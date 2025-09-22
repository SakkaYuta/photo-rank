import React, { useEffect, useMemo, useState } from 'react'
import { requestBattle, startBattle, finishBattle, purchaseCheerTicket, getBattleStatus, createCheerTicketIntent } from '@/services/battle.service'
import { StripeCheckout } from '@/components/checkout/StripeCheckout'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/services/supabaseClient'
import { SAMPLE_BATTLES, SAMPLE_PARTICIPANTS, SAMPLE_SCORES } from '@/sample/battleSamples'

export const BattleRoom: React.FC = () => {
  const { profile } = useAuth()
  const [battleId, setBattleId] = useState<string>('')
  const [opponentId, setOpponentId] = useState<string>('')
  const [duration, setDuration] = useState<5|30|60>(5)
  const [status, setStatus] = useState<string>('idle')
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [cheerTarget, setCheerTarget] = useState<string>('')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [participants, setParticipants] = useState<Record<string, { id: string; display_name?: string; avatar_url?: string }>>({})
  const [tick, setTick] = useState<number>(0)
  const [startTime, setStartTime] = useState<string | undefined>(undefined)
  const [durationMin, setDurationMin] = useState<number>(5)
  const [useSamples, setUseSamples] = useState<boolean>((import.meta as any).env?.VITE_ENABLE_BATTLE_SAMPLE === 'true')
  const [recent, setRecent] = useState<Array<{ creator_id: string; amount: number; purchased_at: string }>>([])
  const [cheerClientSecret, setCheerClientSecret] = useState<string | null>(null)

  const resetFeedback = () => { setMessage(''); setError('') }

  const onRequest = async () => {
    resetFeedback()
    try {
      if (useSamples) {
        const demo = SAMPLE_BATTLES[0]
        setBattleId(demo.id)
        setStatus(demo.status)
        setStartTime(demo.start_time)
        setDurationMin(demo.duration_minutes)
        setScores({ [demo.challenger_id]: SAMPLE_SCORES[demo.challenger_id] || 0, [demo.opponent_id]: SAMPLE_SCORES[demo.opponent_id] || 0 })
        setParticipants({ [demo.challenger_id]: SAMPLE_PARTICIPANTS[demo.challenger_id], [demo.opponent_id]: SAMPLE_PARTICIPANTS[demo.opponent_id] })
        setMessage('デモバトルを読み込みました')
        return
      }
      if (!opponentId) { setError('対戦相手のユーザーIDを入力してください'); return }
      const res = await requestBattle(opponentId, duration)
      setBattleId(res.battle_id)
      setStatus(res.status)
      setMessage(`バトルを作成しました（ID: ${res.battle_id}）`)
    } catch (e: any) {
      setError(e?.message || 'バトル作成に失敗しました（参加資格やレート制限の可能性）')
    }
  }

  const onStart = async () => {
    resetFeedback()
    try {
      if (!battleId) { setError('バトルIDを入力してください'); return }
      if (useSamples) {
        setStatus('live')
        setMessage('デモ：バトルを開始しました')
        setStartTime(new Date().toISOString())
      } else {
        await startBattle(battleId)
        setStatus('live')
        setMessage('バトルを開始しました')
      }
      // 初期状態取得
      try {
        const s = await getBattleStatus(battleId)
        setScores(s.scores || {})
        setStartTime(s.battle.start_time)
        setDurationMin(s.battle.duration_minutes)
        setParticipants(s.participants || {})
        setRecent(s.recent || [])
      } catch {}
    } catch (e: any) {
      setError(e?.message || '開始に失敗しました（参加者のみ開始可能/状態が不正）')
    }
  }

  const onFinish = async () => {
    resetFeedback()
    try {
      if (!battleId) { setError('バトルIDを入力してください'); return }
      const winner = cheerTarget || profile?.id || ''
      if (!winner) { setError('勝者ユーザーIDを入力してください'); return }
      await finishBattle(battleId, winner)
      setStatus('finished')
      setMessage('バトルを終了しました')
    } catch (e: any) {
      setError(e?.message || '終了に失敗しました（参加者のみ終了可能/状態が不正）')
    }
  }

  const onCheer = async () => {
    resetFeedback()
    try {
      if (!battleId) { setError('バトルIDを入力してください'); return }
      if (!cheerTarget) { setError('応援するクリエイターのユーザーIDを入力してください'); return }
      if (useSamples) {
        setScores(prev => ({ ...prev, [cheerTarget]: (prev[cheerTarget] || 0) + 100 }))
        setMessage('デモ：応援ポイント +100')
      } else if ((import.meta as any).env?.VITE_ENABLE_CHEER_CHECKOUT === 'true') {
        const { clientSecret } = await createCheerTicketIntent(battleId, cheerTarget)
        setCheerClientSecret(clientSecret)
      } else {
        const res = await purchaseCheerTicket(battleId, cheerTarget)
        setMessage(`応援チケット購入: #${res.ticket_id} / ¥${res.amount}`)
      }
    } catch (e: any) {
      setError(e?.message || 'チケット購入に失敗しました（バトルがLiveである必要）')
    }
  }

  // Timer: recompute every second when live
  useEffect(() => {
    if (status !== 'live' || !startTime) return
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [status, startTime])

  const remaining = useMemo(() => {
    if (!startTime || !durationMin) return ''
    const start = new Date(startTime).getTime()
    const end = start + durationMin * 60 * 1000
    const now = Date.now()
    const remainMs = Math.max(0, end - now)
    const mm = Math.floor(remainMs / 60000)
    const ss = Math.floor((remainMs % 60000) / 1000)
    return `${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
  }, [tick, startTime, durationMin])

  // Realtime: listen cheer_tickets inserts for this battle
  useEffect(() => {
    if (!battleId) return
    const channel = supabase.channel(`battle-${battleId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cheer_tickets', filter: `battle_id=eq.${battleId}` }, async () => {
        try { const s = await getBattleStatus(battleId); setScores(s.scores || {}); setParticipants(s.participants || {}); setRecent(s.recent || []) } catch {}
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battles', filter: `id=eq.${battleId}` }, async () => {
        try {
          const s = await getBattleStatus(battleId)
          setStatus(s.battle.status)
          setStartTime(s.battle.start_time)
          setDurationMin(s.battle.duration_minutes)
          setScores(s.scores || {})
          setParticipants(s.participants || {})
        } catch {}
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [battleId])

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">バトルルーム</h1>
      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <section className="space-y-3">
        <h2 className="font-semibold">1. バトル作成（申請）</h2>
        {useSamples && (
          <div className="rounded bg-yellow-50 border border-yellow-200 p-2 text-xs text-yellow-800 inline-flex items-center gap-2">
            デモ表示: `VITE_ENABLE_BATTLE_SAMPLE=true` でサンプルデータを表示しています。
            <button className="btn btn-xs" onClick={() => setUseSamples(false)}>デモ無効化</button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-sm text-gray-600">対戦相手ユーザーID</label>
            <input className="input input-bordered" value={opponentId} onChange={e => setOpponentId(e.target.value)} placeholder="uuid" />
          </div>
          <div>
            <label className="block text-sm text-gray-600">時間</label>
            <select className="select select-bordered" value={duration} onChange={e => setDuration(Number(e.target.value) as any)}>
              <option value={5}>5分</option>
              <option value={30}>30分</option>
              <option value={60}>60分</option>
            </select>
          </div>
          <button className="btn btn-primary" onClick={onRequest}>バトル申請</button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">2. バトル開始/終了</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-sm text-gray-600">バトルID</label>
            <input className="input input-bordered w-96" value={battleId} onChange={e => setBattleId(e.target.value)} placeholder="battle uuid" />
          </div>
          <button className="btn" onClick={onStart}>開始</button>
          <div>
            <label className="block text-sm text-gray-600">勝者ユーザーID</label>
            <input className="input input-bordered" value={cheerTarget} onChange={e => setCheerTarget(e.target.value)} placeholder="uuid（空なら自分）" />
          </div>
          <button className="btn btn-outline" onClick={onFinish}>終了</button>
        </div>
        <div className="text-sm text-gray-600 space-x-4">
          <span>状態: <span className="font-medium">{status}</span></span>
          {status === 'live' && (
            <span>残り時間: <span className="font-mono">{remaining}</span></span>
          )}
        </div>
        {status !== 'idle' && (
          <div className="mt-2">
            <h3 className="font-semibold mb-2">スコア</h3>
            <div className="flex gap-6 text-lg items-center">
              <div className="flex items-center gap-2">
                <img src={participants?.[battleId ? undefined! : ''] ? '' : participants?.[Object.keys(participants)[0]]?.avatar_url || 'https://placehold.co/32x32'} alt="" className="w-8 h-8 rounded-full border hidden" />
              </div>
              {(() => {
                // Show both participants if known
                const ids = Object.keys(participants || {})
                return (
                  <>
                    {ids.map(pid => (
                      <div key={pid} className="flex items-center gap-2">
                        <img src={participants?.[pid]?.avatar_url || 'https://placehold.co/32x32'} alt="" className="w-8 h-8 rounded-full border" />
                        <span className="text-sm text-gray-600">{participants?.[pid]?.display_name || pid.slice(0,8)}</span>
                        <span className="font-bold">{scores?.[pid] ?? 0}</span>
                      </div>
                    ))}
                  </>
                )
              })()}
            </div>
            {recent?.length > 0 && (
              <div className="mt-3 text-sm">
                <div className="font-semibold mb-1">最近の応援</div>
                <ul className="space-y-1">
                  {recent.map((r, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-gray-700">
                      <img src={participants?.[r.creator_id]?.avatar_url || 'https://placehold.co/24x24'} className="w-6 h-6 rounded-full border" />
                      <span className="text-xs">{participants?.[r.creator_id]?.display_name || r.creator_id.slice(0,8)}</span>
                      <span className="text-xs text-green-700">+¥{r.amount}</span>
                      <span className="text-[10px] text-gray-500">{new Date(r.purchased_at).toLocaleTimeString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">3. 応援チケット購入</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-sm text-gray-600">応援するクリエイターID</label>
            <input className="input input-bordered" value={cheerTarget} onChange={e => setCheerTarget(e.target.value)} placeholder="uuid" />
          </div>
          <button className="btn btn-success" onClick={onCheer}>100円で応援する</button>
        </div>
        {cheerClientSecret && (
          <div className="max-w-md">
            <StripeCheckout clientSecret={cheerClientSecret} workId={battleId}
              onSuccess={() => { setMessage('応援ありがとうございました！'); setCheerClientSecret(null) }}
              onError={(m) => setError(m)}
              onCancel={() => setCheerClientSecret(null)}
            />
          </div>
        )}
      </section>
    </div>
  )
}

export default BattleRoom
