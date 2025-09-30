import React, { useEffect, useMemo, useState } from 'react'
import { requestBattle, startBattle, finishBattle, purchaseCheerTicket, getBattleStatus, createCheerTicketIntent } from '@/services/battle.service'
import { StripeCheckout } from '@/components/checkout/StripeCheckout'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/services/supabaseClient'
import { SAMPLE_BATTLES, SAMPLE_PARTICIPANTS, SAMPLE_SCORES } from '@/sample/battleSamples'
import { resolveImageUrl } from '@/utils/imageFallback'
import { defaultImages } from '@/utils/defaultImages'

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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-800 to-red-900 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Hero Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500 p-1">
          <div className="bg-gradient-to-br from-gray-900 to-purple-900 rounded-xl p-6 sm:p-8">
            <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 mb-2 animate-pulse">
              ⚔️ BATTLE ROOM ⚔️
            </h1>
            <p className="text-gray-300 text-sm sm:text-base">リアルタイムクリエイター対決アリーナ</p>
          </div>
        </div>

        {message && (
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl p-4 shadow-2xl border-2 border-green-300 animate-bounce">
            <p className="text-white font-bold text-center">✨ {message}</p>
          </div>
        )}
        {error && (
          <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-xl p-4 shadow-2xl border-2 border-red-300 animate-shake">
            <p className="text-white font-bold text-center">⚠️ {error}</p>
          </div>
        )}

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 to-purple-900 p-6 shadow-2xl border-2 border-blue-400">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎮</span>
            <h2 className="text-2xl font-black text-white">バトル作成</h2>
          </div>
          {useSamples && (
            <div className="rounded-lg bg-yellow-500 p-3 text-sm text-gray-900 font-semibold inline-flex items-center gap-2 shadow-lg">
              <span className="text-xl">🎯</span>
              デモモード有効
              <button className="btn btn-xs bg-white hover:bg-gray-100" onClick={() => setUseSamples(false)}>無効化</button>
            </div>
          )}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px] max-w-xs">
            <label className="block text-sm font-bold text-white mb-2 drop-shadow-lg">👤 対戦相手ID</label>
            <input className="input input-bordered w-full bg-white/90 backdrop-blur-sm focus:bg-white font-semibold" value={opponentId} onChange={e => setOpponentId(e.target.value)} placeholder="相手のユーザーID" />
          </div>
          <div>
            <label className="block text-sm font-bold text-white mb-2 drop-shadow-lg">⏱️ バトル時間</label>
            <select className="select select-bordered w-full sm:w-auto bg-white/90 backdrop-blur-sm font-bold" value={duration} onChange={e => setDuration(Number(e.target.value) as any)}>
              <option value={5}>⚡ 5分</option>
              <option value={30}>🔥 30分</option>
              <option value={60}>💪 60分</option>
            </select>
          </div>
          <button className="btn bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 border-0 text-gray-900 font-black w-full sm:w-auto shadow-xl transform hover:scale-105 transition-transform" onClick={onRequest}>
            ⚔️ バトル申請
          </button>
        </div>
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-900 to-pink-900 p-6 shadow-2xl border-2 border-red-400">
        <div className="absolute top-0 left-0 w-64 h-64 bg-red-500 rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚡</span>
            <h2 className="text-2xl font-black text-white">バトル開始/終了</h2>
          </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px] max-w-md">
            <label className="block text-sm font-bold text-white mb-2 drop-shadow-lg">🎯 バトルID</label>
            <input className="input input-bordered w-full bg-white/90 backdrop-blur-sm focus:bg-white font-mono font-semibold" value={battleId} onChange={e => setBattleId(e.target.value)} placeholder="バトルID" />
          </div>
          <button className="btn bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 border-0 text-white font-black shadow-xl transform hover:scale-105 transition-transform" onClick={onStart}>
            🚀 開始
          </button>
          <div className="flex-1 min-w-[200px] max-w-xs">
            <label className="block text-sm font-bold text-white mb-2 drop-shadow-lg">👑 勝者ID</label>
            <input className="input input-bordered w-full bg-white/90 backdrop-blur-sm focus:bg-white font-semibold" value={cheerTarget} onChange={e => setCheerTarget(e.target.value)} placeholder="空なら自分" />
          </div>
          <button className="btn bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 border-0 text-white font-black shadow-xl transform hover:scale-105 transition-transform" onClick={onFinish}>
            🏁 終了
          </button>
        </div>

        {/* Status Bar */}
        <div className="flex flex-wrap gap-4 items-center bg-gradient-to-r from-purple-800 to-pink-800 p-5 rounded-xl border-2 border-pink-400 shadow-2xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔴</span>
            <span className="text-sm font-bold text-white drop-shadow-lg">状態:</span>
            <span className={`font-black px-4 py-2 rounded-full text-base shadow-lg transform hover:scale-110 transition-transform ${
              status === 'live' ? 'bg-gradient-to-r from-green-400 to-emerald-400 text-gray-900 animate-pulse' :
              status === 'finished' ? 'bg-gradient-to-r from-gray-400 to-gray-500 text-white' :
              'bg-gradient-to-r from-blue-400 to-cyan-400 text-gray-900'
            }`}>{status.toUpperCase()}</span>
          </div>
          {status === 'live' && (
            <div className="flex items-center gap-3 animate-pulse">
              <span className="text-2xl">⏰</span>
              <span className="text-sm font-bold text-white drop-shadow-lg">残り時間:</span>
              <span className="font-mono font-black text-3xl text-yellow-300 drop-shadow-[0_0_10px_rgba(253,224,71,0.5)]">{remaining}</span>
            </div>
          )}
        </div>
        {status !== 'idle' && (
          <div className="mt-4 relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-900 via-orange-900 to-red-900 p-8 shadow-2xl border-4 border-yellow-400">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjEpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>
            <div className="relative z-10">
              <div className="text-center mb-6">
                <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-orange-200 to-red-200 mb-2 drop-shadow-lg">
                  🏆 SCOREBOARD 🏆
                </h3>
                <p className="text-yellow-200 text-sm font-semibold">リアルタイムバトルスコア</p>
              </div>
              <div className="flex flex-wrap gap-6 justify-center">
                {(() => {
                  // Show both participants if known
                  const ids = Object.keys(participants || {})
                  return (
                    <>
                      {ids.map((pid, idx) => (
                        <div key={pid} className="relative group">
                          <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity"></div>
                          <div className="relative flex flex-col items-center gap-4 bg-gradient-to-br from-gray-900 to-purple-900 p-8 rounded-2xl shadow-2xl border-4 border-yellow-400 min-w-[220px] transform hover:scale-105 transition-transform">
                            <div className="absolute -top-4 -right-4 w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center font-black text-gray-900 text-lg shadow-xl">
                              #{idx + 1}
                            </div>
                            <img src={resolveImageUrl(participants?.[pid]?.avatar_url, [defaultImages.avatar])} alt="" className="w-20 h-20 rounded-full border-4 border-yellow-400 shadow-2xl ring-4 ring-yellow-500/50" />
                            <span className="text-base font-black text-white drop-shadow-lg">{participants?.[pid]?.display_name || pid.slice(0,8)}</span>
                            <div className="flex flex-col items-center bg-gradient-to-br from-yellow-400 to-orange-500 px-6 py-3 rounded-xl shadow-xl">
                              <span className="text-5xl font-black text-gray-900 drop-shadow-lg">{scores?.[pid] ?? 0}</span>
                              <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">POINTS</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )
                })()}
              </div>
            {recent?.length > 0 && (
              <div className="mt-8 bg-gradient-to-br from-green-900 to-emerald-900 p-6 rounded-2xl border-2 border-green-400 shadow-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">🎉</span>
                  <h4 className="text-xl font-black text-white">最近の応援</h4>
                </div>
                <ul className="space-y-3">
                  {recent.map((r, idx) => (
                    <li key={idx} className="flex items-center gap-3 bg-gradient-to-r from-green-400/20 to-emerald-400/20 backdrop-blur-sm p-4 rounded-xl border-2 border-green-400 shadow-lg hover:scale-105 transition-transform">
                      <img src={resolveImageUrl(participants?.[r.creator_id]?.avatar_url, [defaultImages.avatar])} className="w-12 h-12 rounded-full border-3 border-green-300 shadow-lg" />
                      <span className="text-base font-black text-white">{participants?.[r.creator_id]?.display_name || r.creator_id.slice(0,8)}</span>
                      <span className="text-lg font-black text-green-300 px-3 py-1 bg-green-900/50 rounded-lg">+¥{r.amount}</span>
                      <span className="text-xs font-semibold text-green-200 ml-auto">{new Date(r.purchased_at).toLocaleTimeString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            </div>
          </div>
        )}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-900 to-emerald-900 p-6 shadow-2xl border-2 border-green-400">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500 rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💰</span>
            <h2 className="text-2xl font-black text-white">応援チケット購入</h2>
          </div>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px] max-w-xs">
            <label className="block text-sm font-bold text-white mb-2 drop-shadow-lg">🌟 応援するクリエイターID</label>
            <input className="input input-bordered w-full bg-white/90 backdrop-blur-sm focus:bg-white font-semibold" value={cheerTarget} onChange={e => setCheerTarget(e.target.value)} placeholder="クリエイターID" />
          </div>
          <button className="btn bg-gradient-to-r from-yellow-400 via-green-400 to-emerald-400 hover:from-yellow-500 hover:via-green-500 hover:to-emerald-500 border-0 text-gray-900 font-black w-full sm:w-auto shadow-xl transform hover:scale-105 transition-transform text-lg" onClick={onCheer}>
            💸 100円で応援する
          </button>
        </div>
        {cheerClientSecret && (
          <div className="max-w-md bg-white/90 backdrop-blur-sm p-6 rounded-xl shadow-2xl">
            <StripeCheckout clientSecret={cheerClientSecret} workId={battleId}
              onSuccess={() => { setMessage('応援ありがとうございました！'); setCheerClientSecret(null) }}
              onError={(m) => setError(m)}
              onCancel={() => setCheerClientSecret(null)}
            />
          </div>
        )}
        </div>
      </section>
      </div>
    </div>
  )
}

export default BattleRoom
