import React, { useEffect, useMemo, useRef, useState } from 'react'
import { requestBattle, getBattleStatus } from '@/services/battle.service'
import { supabase } from '@/services/supabaseClient'
import { SAMPLE_BATTLES, SAMPLE_PARTICIPANTS, SAMPLE_SCORES } from '@/sample/battleSamples'
import { resolveImageUrl } from '@/utils/imageFallback'
import { defaultImages } from '@/utils/defaultImages'

export const BattleRoom: React.FC = () => {
  const [battleId, setBattleId] = useState<string>('')
  const [opponentId, setOpponentId] = useState<string>('')
  const [duration, setDuration] = useState<5|30|60>(5)
  const [battleTitle, setBattleTitle] = useState<string>('')
  const [visibility, setVisibility] = useState<'public'|'private'>('public')
  const [requestedStartAt, setRequestedStartAt] = useState<string>('')
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false)
  const [nameQuery, setNameQuery] = useState<string>('')
  const [nameSuggestions, setNameSuggestions] = useState<Array<{ id: string; display_name?: string; avatar_url?: string }>>([])
  const suggestTimer = useRef<any>(null)
  const [status, setStatus] = useState<string>('idle')
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [scores, setScores] = useState<Record<string, number>>({})
  const [participants, setParticipants] = useState<Record<string, { id: string; display_name?: string; avatar_url?: string }>>({})
  const [tick, setTick] = useState<number>(0)
  const [startTime, setStartTime] = useState<string | undefined>(undefined)
  const [durationMin, setDurationMin] = useState<number>(5)
  const [useSamples, setUseSamples] = useState<boolean>((import.meta as any).env?.VITE_ENABLE_BATTLE_SAMPLE === 'true')
  const [recent, setRecent] = useState<Array<{ creator_id: string; amount: number; purchased_at: string }>>([])
  

  const resetFeedback = () => { setMessage(''); setError('') }

  // バトル開始/終了の操作UIは削除済み

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
      if (!agreeTerms) { setError('バトル申請の利用規約に同意してください'); return }
      if (battleTitle && battleTitle.length > 120) { setError('タイトルは120文字以内で入力してください'); return }
      if (!requestedStartAt) { setError('開始予定は必須です'); return }
      if (isNaN(new Date(requestedStartAt).getTime())) { setError('開始予定日時の形式が正しくありません'); return }
      const res = await requestBattle(opponentId, duration, {
        title: battleTitle || undefined,
        visibility,
        requested_start_at: requestedStartAt || undefined,
      })
      setBattleId(res.battle_id)
      setStatus(res.status)
      setMessage(`バトルを作成しました（ID: ${res.battle_id}）`)
    } catch (e: any) {
      setError(e?.message || 'バトル作成に失敗しました（参加資格やレート制限の可能性）')
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
            <h2 className="text-2xl font-black text-white">バトル作成</h2>
          </div>
          {useSamples && (
            <div className="rounded-lg bg-yellow-500 p-3 text-sm text-gray-900 font-semibold inline-flex items-center gap-2 shadow-lg">
              デモモード有効
              <button className="btn btn-xs bg-white hover:bg-gray-100" onClick={() => setUseSamples(false)}>無効化</button>
            </div>
          )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-bold text-white mb-2 drop-shadow-lg">タイトル（任意）</label>
            <input className="input input-bordered w-full bg-white/90 backdrop-blur-sm focus:bg-white focus:ring-2 focus:ring-yellow-400 font-semibold text-base text-gray-900" value={battleTitle} onChange={e => setBattleTitle(e.target.value)} placeholder="例: スピード対決 #1" />
          </div>
          <div>
            <label className="block text-sm font-bold text-white mb-2 drop-shadow-lg">公開設定</label>
            <select className="select select-bordered w-full bg-white/90 backdrop-blur-sm focus:ring-2 focus:ring-yellow-400 font-bold text-base text-gray-900" value={visibility} onChange={e => setVisibility(e.target.value as any)}>
              <option value="public">公開</option>
              <option value="private">非公開</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm font-bold text-white mb-2 drop-shadow-lg">対戦相手ID</label>
            <input
              className="input input-bordered w-full bg-white/90 backdrop-blur-sm focus:bg-white focus:ring-2 focus:ring-yellow-400 font-semibold text-base text-gray-900"
              value={opponentId}
              onChange={e => setOpponentId(e.target.value)}
              onBlur={async () => {
                if (!opponentId) return
                try {
                  const { data, error } = await supabase
                    .from('user_public_profiles')
                    .select('id, display_name, avatar_url')
                    .eq('id', opponentId)
                    .single()
                  ;(window as any)._opPrev = data
                  const preview = document.getElementById('opponent-preview')
                  if (preview) {
                    preview.innerHTML = error || !data
                      ? '<span class="text-red-200 text-xs">相手が見つかりません</span>'
                      : `<div class="flex items-center gap-2 text-white/90"><img src="${data.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${data.id}`}" class="w-8 h-8 rounded-full border border-white/30" /><span class="text-sm font-semibold">${data.display_name || data.id.slice(0,8)}</span></div>`
                  }
                } catch {}
              }}
              placeholder="相手のユーザーID"
            />
            <div id="opponent-preview" className="mt-2 min-h-[20px]"></div>
            <div className="mt-3">
              <label className="block text-sm font-bold text-white mb-2 drop-shadow-lg">🔎 名前で検索（任意）</label>
              <input
                className="input input-bordered w-full bg-white/90 backdrop-blur-sm focus:bg-white text-gray-900"
                value={nameQuery}
                onChange={(e) => {
                  const q = e.target.value
                  setNameQuery(q)
                  if (suggestTimer.current) clearTimeout(suggestTimer.current)
                  suggestTimer.current = setTimeout(async () => {
                    if (!q || q.length < 2) { setNameSuggestions([]); return }
                    try {
                      const { data } = await supabase
                        .from('user_public_profiles')
                        .select('id, display_name, avatar_url')
                        .ilike('display_name', `%${q}%`)
                        .limit(5)
                      setNameSuggestions(data || [])
                    } catch { setNameSuggestions([]) }
                  }, 300)
                }}
                placeholder="相手の表示名を入力（2文字以上）"
              />
              {nameSuggestions.length > 0 && (
                <div className="mt-2 bg-white/90 rounded shadow border max-h-60 overflow-auto">
                  {nameSuggestions.map(s => (
                    <button key={s.id} className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2" onClick={() => { setOpponentId(s.id); setNameQuery(''); setNameSuggestions([]) }}>
                      <img src={s.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${s.id}`} className="w-6 h-6 rounded-full" />
                      <span className="text-gray-900 text-sm">{s.display_name || s.id.slice(0,8)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-white mb-2 drop-shadow-lg">バトル時間</label>
            <select className="select select-bordered w-full bg-white/90 backdrop-blur-sm focus:ring-2 focus:ring-yellow-400 font-bold text-base text-gray-900" value={duration} onChange={e => setDuration(Number(e.target.value) as any)}>
              <option value={5}>5分</option>
              <option value={30}>30分</option>
              <option value={60}>60分</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-white mb-2 drop-shadow-lg">開始予定（必須）</label>
            <input
              type="datetime-local"
              required
              className="input input-bordered w-full bg-white/90 backdrop-blur-sm focus:bg-white text-gray-900"
              value={requestedStartAt}
              onChange={e => setRequestedStartAt(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-200/90">
              注意: 開始時刻の1時間前までに相手の承認が得られない場合、この申請は不成立（自動キャンセル）となります。
            </p>
          </div>
          <div className="md:col-span-2 lg:col-span-4 bg-yellow-500/20 border-2 border-yellow-400 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-bold text-yellow-300">バトル報酬ボーナス</h3>
            </div>
            <p className="text-white text-sm font-semibold">バトル中の獲得報酬が<span className="text-yellow-300 text-lg font-black">20%アップ</span>！</p>
          </div>
          <div className="md:col-span-2 lg:col-span-4">
            <label className="inline-flex items-center gap-2 text-white mb-3">
              <input type="checkbox" className="checkbox checkbox-sm" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} />
              <span className="text-sm">バトル申請に関する <a className="underline" onClick={() => import('@/utils/navigation').then(m => m.navigate('terms'))}>利用規約</a> に同意します</span>
            </label>
            <button className="btn bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 border-0 text-gray-900 font-black text-lg shadow-xl transform hover:scale-105 transition-transform h-auto py-3" onClick={() => {
              // client-side min-lead guard (15min)
              const minLeadMin = 15
              const t = requestedStartAt ? new Date(requestedStartAt).getTime() : 0
              const minAllowed = Date.now() + minLeadMin * 60 * 1000
              if (!t || isNaN(t)) { setError('開始予定日時の形式が正しくありません'); return }
              if (t < minAllowed) { setError(`開始予定は現在時刻から${minLeadMin}分以上先を指定してください`); return }
              onRequest()
            }}>
              バトル申請
            </button>
          </div>
        </div>
        </div>
      </section>

      {/* Offers link - Enhanced visibility */}
      {battleId && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 p-1 shadow-2xl animate-pulse">
          <div className="bg-gradient-to-br from-gray-900 to-purple-900 rounded-xl p-6 text-center">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">🎁</span>
                <div className="text-left">
                  <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-pink-300">
                    限定アイテム販売中！
                  </h3>
                  <p className="text-sm text-gray-300">このバトル限定のレアアイテム</p>
                </div>
              </div>
              <button
                className="btn bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 hover:from-yellow-500 hover:via-pink-500 hover:to-purple-500 border-0 text-gray-900 font-black px-8 shadow-xl transform hover:scale-110 transition-transform"
                onClick={() => {
                  import('@/utils/navigation').then(m => m.navigate('live-offers', { event: battleId }))
                }}
              >
                🛍️ 今すぐチェック
              </button>
            </div>
          </div>
        </div>
      )}

      {/* removed per request: バトル開始/終了カード */}
      {/*
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-900 to-pink-900 p-6 shadow-2xl border-2 border-red-400">
        <div className="absolute top-0 left-0 w-64 h-64 bg-red-500 rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">⚡</span>
            <h2 className="text-2xl font-black text-white">バトル開始/終了</h2>
          </div>
        <div className="space-y-4">
          {/* Battle ID and Start - removed */}
          {/* 承認系UIは不要のため削除 */}

          {/* Winner ID and Finish - removed */}
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

      {/* removed per request: 応援チケット購入カード 完全削除 */}
      </div>
  )
}

export default BattleRoom
