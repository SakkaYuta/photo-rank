import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Flame, Crown, Zap, Sparkles, Heart, Timer, PartyPopper, ShoppingCart, Gift } from 'lucide-react'
import { SAMPLE_BATTLES, SAMPLE_PARTICIPANTS } from '@/sample/battleSamples'
import { purchaseCheerTicket, purchaseBattleGoods, getBattleStatus, purchaseCheerPoints } from '@/services/battle.service'
import { BATTLE_GOODS_TYPES } from '@/utils/constants'
import { formatJPY } from '@/utils/helpers'
import { supabase } from '@/services/supabaseClient'

type Side = 'challenger' | 'opponent'

const LiveBattle: React.FC = () => {
  const [battleId, setBattleId] = useState<string>('')
  const [title, setTitle] = useState<string>('ライブバトル')
  const [challenger, setChallenger] = useState<{ id: string; name: string; avatar: string }>({ id: '', name: 'Challenger', avatar: '' })
  const [opponent, setOpponent] = useState<{ id: string; name: string; avatar: string }>({ id: '', name: 'Opponent', avatar: '' })
  const [scores, setScores] = useState<{ challenger: number; opponent: number }>({ challenger: 0, opponent: 0 })
  const [effects, setEffects] = useState<{ burst: boolean; side?: Side }>({ burst: false })
  const [useSamples, setUseSamples] = useState<boolean>((import.meta as any).env?.VITE_ENABLE_BATTLE_SAMPLE === 'true')
  const [buying, setBuying] = useState<Side | null>(null)
  const [selectedGoods, setSelectedGoods] = useState<string>('')
  const [selectedPlayer, setSelectedPlayer] = useState<Side | null>(null)
  const [showGoodsModal, setShowGoodsModal] = useState<boolean>(false)
  const [buyingGoods, setBuyingGoods] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string>('')
  const [userId, setUserId] = useState<string>('')
  const [remainingSeconds, setRemainingSeconds] = useState<number>(3600)
  const lastCheerTsRef = useRef<number>(0)

  // 無料応援システム
  const [freeCheerCount, setFreeCheerCount] = useState<number>(30)
  const [lastResetTime, setLastResetTime] = useState<number>(Date.now())
  const [showPointPurchaseModal, setShowPointPurchaseModal] = useState<boolean>(false)
  const [selectedCheerSide, setSelectedCheerSide] = useState<Side | null>(null)

  // ポイント購入オプション
  const pointPurchaseOptions = [
    { points: 100, price: 100, label: '100pt' },
    { points: 1000, price: 800, label: '1,000pt', bonus: '20%お得!' },
    { points: 10000, price: 7000, label: '10,000pt', bonus: '30%お得!' },
    { points: 100000, price: 60000, label: '100,000pt', bonus: '40%お得!' }
  ]

  // ユーザーIDの取得
  useEffect(() => {
    ;(async () => {
      try { const { data: { user } } = await supabase.auth.getUser(); setUserId(user?.id || '') } catch {}
    })()
  }, [])

  const cheerKey = (bid: string, uid: string) => `battleCheerData_${bid || 'noid'}_${uid || 'anon'}`

  // 無料応援カウントの初期化と60分リセット
  useEffect(() => {
    const savedCheerData = battleId ? localStorage.getItem(cheerKey(battleId, userId)) : null
    if (savedCheerData) {
      try {
        const data = JSON.parse(savedCheerData)
        const timeDiff = Math.max(0, Date.now() - (Number(data.lastResetTime) || Date.now()))
        // 60分（3600000ms）経過していたらリセット
        if (timeDiff >= 3600000) {
          setFreeCheerCount(30)
          setLastResetTime(Date.now())
        } else {
          const cnt = Number(data.freeCheerCount)
          setFreeCheerCount(Number.isFinite(cnt) ? Math.min(30, Math.max(0, cnt)) : 30)
          setLastResetTime(Number(data.lastResetTime) || Date.now())
          setRemainingSeconds(Math.ceil((3600000 - timeDiff)/1000))
        }
      } catch {
        setFreeCheerCount(30)
        setLastResetTime(Date.now())
        setRemainingSeconds(3600)
      }
    } else {
      // 初期化
      setFreeCheerCount(30)
      setLastResetTime(Date.now())
      setRemainingSeconds(3600)
    }
  }, [battleId, userId])

  // 無料応援データをlocalStorageに保存
  useEffect(() => {
    if (battleId) {
      localStorage.setItem(cheerKey(battleId, userId), JSON.stringify({
        freeCheerCount,
        lastResetTime
      }))
    }
  }, [freeCheerCount, lastResetTime, battleId, userId])

  // 1秒ごとに残り時間を更新し、0になったら自動リセット
  useEffect(() => {
    const t = window.setInterval(() => {
      const diff = Math.max(0, 3600000 - (Date.now() - lastResetTime))
      const sec = Math.ceil(diff / 1000)
      setRemainingSeconds(sec)
      if (diff <= 0) {
        setFreeCheerCount(30)
        setLastResetTime(Date.now())
        setRemainingSeconds(3600)
      }
    }, 1000)
    return () => window.clearInterval(t)
  }, [lastResetTime])

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, '')
    const qs = raw.split('?')[1]
    const params = new URLSearchParams(qs)
    const id = params.get('battle') || ''
    setBattleId(id)

    if ((import.meta as any).env?.VITE_ENABLE_BATTLE_SAMPLE === 'true') {
      const b = SAMPLE_BATTLES.find(x => x.id === id) || SAMPLE_BATTLES[0]
      if (b) {
        setTitle(b.title)
        setChallenger({ id: b.challenger_id, name: SAMPLE_PARTICIPANTS[b.challenger_id]?.display_name || 'Challenger', avatar: SAMPLE_PARTICIPANTS[b.challenger_id]?.avatar_url || '' })
        setOpponent({ id: b.opponent_id, name: SAMPLE_PARTICIPANTS[b.opponent_id]?.display_name || 'Opponent', avatar: SAMPLE_PARTICIPANTS[b.opponent_id]?.avatar_url || '' })
        setScores({ challenger: 15600, opponent: 14800 })
      }
    } else if (id) {
      (async () => {
        try {
          setLoading(true)
          await refreshFromBackend(id)
        } catch (e: any) {
          setError(e?.message || 'バトル情報の取得に失敗しました')
        } finally {
          setLoading(false)
        }
      })()
    }
  }, [])

  // 本番モードではリアルタイムにスコア/状態を追従
  useEffect(() => {
    if (!battleId || (import.meta as any).env?.VITE_ENABLE_BATTLE_SAMPLE === 'true') return
    const channel = supabase
      .channel(`live-battle-${battleId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cheer_tickets', filter: `battle_id=eq.${battleId}` }, async () => {
        try { await refreshFromBackend(battleId) } catch {}
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battles', filter: `id=eq.${battleId}` }, async () => {
        try { await refreshFromBackend(battleId) } catch {}
      })
      .subscribe()

    return () => { try { supabase.removeChannel(channel) } catch {} }
  }, [battleId])

  const refreshFromBackend = async (id: string) => {
    const res = await getBattleStatus(id)
    setTitle('グッズバトル')
    const ch = res.battle.challenger_id
    const op = res.battle.opponent_id
    const p = res.participants || {}
    setChallenger({ id: ch, name: p[ch]?.display_name || ch.slice(0, 8), avatar: p[ch]?.avatar_url || '' })
    setOpponent({ id: op, name: p[op]?.display_name || op.slice(0, 8), avatar: p[op]?.avatar_url || '' })
    setScores({
      challenger: res.scores?.[ch] || 0,
      opponent: res.scores?.[op] || 0,
    })
  }

  const total = useMemo(() => scores.challenger + scores.opponent, [scores])
  const pct = (side: Side) => total === 0 ? 50 : Math.round((scores[side] / total) * 100)

  const cheer = async (side: Side) => {
    // 短時間の連打防止（500ms）
    const now = Date.now()
    if (now - (lastCheerTsRef.current || 0) < 500) return
    lastCheerTsRef.current = now
    // 無料応援回数をチェック
    if (freeCheerCount <= 0) {
      // 無料応援回数がない場合はポイント購入モーダルを表示
      setSelectedCheerSide(side)
      setShowPointPurchaseModal(true)
      return
    }

    setBuying(side)
    try {
      // 無料応援を1回減らす
      setFreeCheerCount(prev => prev - 1)

      if (useSamples) {
        setScores(prev => ({ ...prev, [side]: prev[side] + 100 }))
        setEffects({ burst: true, side })
        setTimeout(() => setEffects({ burst: false }), 1200)
      } else {
        const target = side === 'challenger' ? challenger.id : opponent.id
        await purchaseCheerTicket(battleId, target, { mode: 'free' })
        await refreshFromBackend(battleId)
        setEffects({ burst: true, side })
        setTimeout(() => setEffects({ burst: false }), 1200)
      }
    } catch (e) {
      alert('応援に失敗しました')
      // エラー時は減らした回数を戻す
      setFreeCheerCount(prev => prev + 1)
    } finally {
      setBuying(null)
    }
  }

  const purchasePoints = async (option: typeof pointPurchaseOptions[0]) => {
    if (!selectedCheerSide) return

    try {
      // ここで実際の課金処理を実装
      if (useSamples) {
        setScores(prev => ({ ...prev, [selectedCheerSide]: prev[selectedCheerSide] + option.points }))
        setEffects({ burst: true, side: selectedCheerSide })
        setTimeout(() => setEffects({ burst: false }), 1200)
      } else {
        const target = selectedCheerSide === 'challenger' ? challenger.id : opponent.id
        await purchaseCheerPoints(battleId, target, option.points)
        await refreshFromBackend(battleId)
        setEffects({ burst: true, side: selectedCheerSide })
        setTimeout(() => setEffects({ burst: false }), 1200)
      }

      setShowPointPurchaseModal(false)
      setSelectedCheerSide(null)
      alert(`${option.label}を購入しました！`)
    } catch (e) {
      alert('購入に失敗しました')
    }
  }

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen min-h-screen bg-gradient-to-br from-black via-gray-900 to-purple-900 text-white">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,0,128,0.35),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(0,128,255,0.35),transparent_40%)]" />
        <div className="max-w-6xl mx-auto px-6 py-10 relative">
          <div className="flex items-center gap-3 mb-3">
            <Flame className="w-6 h-6 text-orange-300 animate-pulse" />
            <span className="uppercase tracking-widest text-xs text-gray-300">Live Battle</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold drop-shadow">{title}</h1>
          <p className="text-sm text-gray-300 mt-1">あなたの購入が勝敗を左右！応援してポイントを加算しよう</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <SideCard name={challenger.name} avatar={challenger.avatar} score={scores.challenger} crown={scores.challenger>=scores.opponent} active={effects.burst && effects.side==='challenger'} />
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2"><Timer className="w-4 h-4 text-pink-300" /><span className="text-pink-300 text-sm">リアルタイム更新</span></div>
            <div className="h-6 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
              <div className="h-full bg-gradient-to-r from-pink-500 to-red-500 transition-all" style={{ width: `${pct('challenger')}%` }} />
            </div>
            <div className="text-center text-sm text-gray-300">{pct('challenger')}% vs {pct('opponent')}%</div>
          </div>
          <SideCard name={opponent.name} avatar={opponent.avatar} score={scores.opponent} crown={scores.opponent>=scores.challenger} active={effects.burst && effects.side==='opponent'} />
        </div>

        {/* 無料応援回数表示 */}
        <div className="mt-6 bg-white/10 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Heart className="w-5 h-5 text-pink-300" />
            <span className="text-pink-300 font-semibold">無料応援回数</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">{freeCheerCount}/30回</div>
          <div className="text-xs text-gray-400">
            {freeCheerCount > 0
              ? `あと${freeCheerCount}回無料で応援できます`
              : '無料応援回数がありません。追加ポイントをご購入ください'
            }
          </div>
          {freeCheerCount <= 0 && (
            <div className="text-xs text-yellow-300 mt-1">
              ⏰ リセットまで約 {Math.floor(remainingSeconds/60)}分{remainingSeconds%60}秒
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <button
            onClick={()=>cheer('challenger')}
            disabled={buying!==null}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 transition-all font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Heart className="w-5 h-5" />
            <div className="text-center">
              <div>{challenger.name} を応援</div>
              <div className="text-xs opacity-90">
                {freeCheerCount > 0 ? '+100pt（無料）' : '追加ポイント購入'}
              </div>
            </div>
          </button>
          <button
            onClick={()=>cheer('opponent')}
            disabled={buying!==null}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Heart className="w-5 h-5" />
            <div className="text-center">
              <div>{opponent.name} を応援</div>
              <div className="text-xs opacity-90">
                {freeCheerCount > 0 ? '+100pt（無料）' : '追加ポイント購入'}
              </div>
            </div>
          </button>
        </div>

        {effects.burst && (
          <div className="fixed inset-0 pointer-events-none">
            <div className="absolute inset-0 animate-pulse opacity-20 bg-white" />
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-yellow-300">
              <PartyPopper className="w-6 h-6" />
              <span className="font-extrabold">+100pt!</span>
              <Sparkles className="w-6 h-6" />
            </div>
          </div>
        )}

        <div className="mt-10 bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="font-semibold mb-6 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> ライブ限定アイテム</h3>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Challenger Items */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <img src={challenger.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(challenger.name)}`} className="w-8 h-8 rounded-full border-2 border-pink-400/50" />
                <h4 className="font-bold text-pink-300">{challenger.name} 応援アイテム</h4>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {BATTLE_GOODS_TYPES.slice(0, 3).map((item, index) => (
                  <div key={`challenger-${item.id}`} className="bg-pink-500/10 border border-pink-400/20 rounded-lg p-3 hover:bg-pink-500/20 transition-colors cursor-pointer" onClick={() => { setSelectedGoods(item.id); setSelectedPlayer('challenger'); setShowGoodsModal(true) }}>
                    <div className="flex items-start gap-3">
                      <Gift className="w-6 h-6 text-pink-400 flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-white text-sm">{item.label}</h5>
                        <p className="text-xs text-gray-300 mt-1 line-clamp-2">{challenger.name}限定デザイン - {item.description}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-pink-300 font-bold text-sm">{formatJPY(item.basePrice)}</span>
                          <span className="text-xs text-pink-200">+50pt</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Opponent Items */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <img src={opponent.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(opponent.name)}`} className="w-8 h-8 rounded-full border-2 border-teal-400/50" />
                <h4 className="font-bold text-teal-300">{opponent.name} 応援アイテム</h4>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {BATTLE_GOODS_TYPES.slice(3, 6).map((item, index) => (
                  <div key={`opponent-${item.id}`} className="bg-teal-500/10 border border-teal-400/20 rounded-lg p-3 hover:bg-teal-500/20 transition-colors cursor-pointer" onClick={() => { setSelectedGoods(item.id); setSelectedPlayer('opponent'); setShowGoodsModal(true) }}>
                    <div className="flex items-start gap-3">
                      <Gift className="w-6 h-6 text-teal-400 flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-white text-sm">{item.label}</h5>
                        <p className="text-xs text-gray-300 mt-1 line-clamp-2">{opponent.name}限定デザイン - {item.description}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-teal-300 font-bold text-sm">{formatJPY(item.basePrice)}</span>
                          <span className="text-xs text-teal-200">+50pt</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-400 bg-white/5 rounded-lg p-3 mt-6">
            💡 アイテム購入で応援するプレイヤーに50ポイントが加算されます！限定デザインで推しクリエイターを応援しよう
          </div>
        </div>

        {/* Goods Purchase Modal */}
        {showGoodsModal && selectedGoods && selectedPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 max-w-md w-full">
              {(() => {
                const item = BATTLE_GOODS_TYPES.find(g => g.id === selectedGoods)!
                const targetPlayer = selectedPlayer === 'challenger' ? challenger : opponent
                const playerColor = selectedPlayer === 'challenger' ? 'pink' : 'teal'
                return (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white">アイテム購入</h3>
                      <button onClick={() => { setShowGoodsModal(false); setSelectedPlayer(null); }} className="text-gray-400 hover:text-white">
                        <Sparkles className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      {/* 応援するプレイヤーを明確に表示 */}
                      <div className={selectedPlayer === 'challenger'
                        ? "bg-pink-500/20 border border-pink-400/30 rounded-lg p-4"
                        : "bg-teal-500/20 border border-teal-400/30 rounded-lg p-4"
                      }>
                        <div className="flex items-center gap-3 mb-2">
                          <img
                            src={targetPlayer.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(targetPlayer.name)}`}
                            className={selectedPlayer === 'challenger'
                              ? "w-8 h-8 rounded-full border-2 border-pink-400/50"
                              : "w-8 h-8 rounded-full border-2 border-teal-400/50"
                            }
                          />
                          <div>
                            <h4 className={selectedPlayer === 'challenger'
                              ? "font-bold text-pink-300"
                              : "font-bold text-teal-300"
                            }>{targetPlayer.name} を応援</h4>
                            <p className="text-xs text-gray-300">このプレイヤーに50ポイントが加算されます</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Gift className={selectedPlayer === 'challenger'
                          ? "w-12 h-12 text-pink-400"
                          : "w-12 h-12 text-teal-400"
                        } />
                        <div>
                          <h4 className="font-medium text-white">{item.label}</h4>
                          <p className="text-sm text-gray-300">{targetPlayer.name}限定デザイン - {item.description}</p>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-300">価格</span>
                          <span className="text-white font-bold">{formatJPY(item.basePrice)}</span>
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-300">応援ポイント</span>
                          <span className={selectedPlayer === 'challenger'
                            ? "text-pink-300 font-bold"
                            : "text-teal-300 font-bold"
                          }>+50pt</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">応援先</span>
                          <span className={selectedPlayer === 'challenger'
                            ? "text-pink-300 font-bold"
                            : "text-teal-300 font-bold"
                          }>{targetPlayer.name}</span>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setShowGoodsModal(false)} className="flex-1 py-2 px-4 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white">
                          キャンセル
                        </button>
                        <button
                          onClick={async () => {
                            setBuyingGoods(true)
                            try {
                              if (useSamples) {
                                // サンプル環境では選択されたプレイヤーにポイントを追加
                                setScores(prev => ({ ...prev, [selectedPlayer]: prev[selectedPlayer] + 50 }))
                                setEffects({ burst: true, side: selectedPlayer })
                                setTimeout(() => setEffects({ burst: false }), 1200)
                              } else {
                                // 本番環境では選択されたプレイヤーのIDを使用
                                const targetId = selectedPlayer === 'challenger' ? challenger.id : opponent.id
                                await purchaseBattleGoods(battleId, targetId, selectedGoods)
                                await refreshFromBackend(battleId)
                                setEffects({ burst: true, side: selectedPlayer })
                                setTimeout(() => setEffects({ burst: false }), 1200)
                              }
                              setShowGoodsModal(false)
                              setSelectedPlayer(null)
                              alert(`${item.label}を購入しました！${targetPlayer.name}に50ポイントが追加されました！`)
                            } catch (e) {
                              alert('購入に失敗しました')
                            } finally {
                              setBuyingGoods(false)
                            }
                          }}
                          disabled={buyingGoods}
                          className={`flex-1 py-2 px-4 rounded-lg bg-gradient-to-r ${
                            selectedPlayer === 'challenger'
                              ? 'from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600'
                              : 'from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600'
                          } transition-colors text-white font-bold disabled:opacity-50`}
                        >
                          {buyingGoods ? '購入中...' : `${targetPlayer.name}を応援して購入`}
                        </button>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}

        {/* Point Purchase Modal */}
        {showPointPurchaseModal && selectedCheerSide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 max-w-lg w-full">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white">追加ポイント購入</h3>
                <button
                  onClick={() => {
                    setShowPointPurchaseModal(false)
                    setSelectedCheerSide(null)
                  }}
                  className="text-gray-400 hover:text-white"
                >
                  <Sparkles className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <img
                    src={(selectedCheerSide === 'challenger' ? challenger : opponent).avatar ||
                      `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent((selectedCheerSide === 'challenger' ? challenger : opponent).name)}`}
                    className="w-10 h-10 rounded-full border-2 border-pink-400/50"
                  />
                  <div>
                    <h4 className="font-bold text-pink-300">
                      {selectedCheerSide === 'challenger' ? challenger.name : opponent.name} を応援
                    </h4>
                    <p className="text-sm text-gray-400">無料応援回数がありません</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {pointPurchaseOptions.map((option, index) => (
                  <div
                    key={index}
                    className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer"
                    onClick={() => purchasePoints(option)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-r ${
                          index === 0 ? 'from-blue-500 to-blue-600' :
                          index === 1 ? 'from-purple-500 to-purple-600' :
                          index === 2 ? 'from-orange-500 to-orange-600' :
                          'from-yellow-500 to-yellow-600'
                        } flex items-center justify-center`}>
                          <Zap className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h5 className="font-bold text-white">{option.label}</h5>
                          {option.bonus && (
                            <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full">
                              {option.bonus}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-white">¥{option.price.toLocaleString()}</div>
                        <div className="text-xs text-gray-400">1pt = {(option.price / option.points).toFixed(1)}円</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-xs text-gray-400 bg-white/5 rounded-lg p-3">
                💡 購入したポイントで即座に応援できます！大きなパッケージほどお得です。
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SideCard({ name, avatar, score, crown, active }: { name: string; avatar?: string; score: number; crown?: boolean; active?: boolean }) {
  return (
    <div className={`relative rounded-xl p-4 bg-white/5 border border-white/10 ${active ? 'ring-4 ring-pink-500/40' : ''}`}>
      <div className="flex items-center gap-3">
        <img src={avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name)}`} className="w-14 h-14 rounded-full border-2 border-white/20" />
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-lg">{name}</h4>
            {crown && <Crown className="w-4 h-4 text-yellow-400" />}
          </div>
          <div className="text-pink-300 font-mono">{score.toLocaleString()} pt</div>
        </div>
      </div>
      <div className="absolute -top-2 -right-2 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white text-xs px-2 py-1 rounded-md shadow-lg flex items-center gap-1"><Zap className="w-3 h-3" /> LIVE</div>
    </div>
  )
}

export default LiveBattle
