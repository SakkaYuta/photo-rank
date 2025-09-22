import React, { useEffect, useMemo, useState } from 'react'
import { Flame, Crown, Zap, Sparkles, Heart, Timer, PartyPopper, ShoppingCart, Gift } from 'lucide-react'
import { SAMPLE_BATTLES, SAMPLE_PARTICIPANTS } from '@/sample/battleSamples'
import { purchaseCheerTicket, purchaseBattleGoods } from '@/services/battle.service'
import { BATTLE_GOODS_TYPES } from '@/utils/constants'
import { formatJPY } from '@/utils/helpers'

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
  const [showGoodsModal, setShowGoodsModal] = useState<boolean>(false)
  const [buyingGoods, setBuyingGoods] = useState<boolean>(false)

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
    }
  }, [])

  const total = useMemo(() => scores.challenger + scores.opponent, [scores])
  const pct = (side: Side) => total === 0 ? 50 : Math.round((scores[side] / total) * 100)

  const cheer = async (side: Side) => {
    setBuying(side)
    try {
      if (useSamples) {
        setScores(prev => ({ ...prev, [side]: prev[side] + 100 }))
        setEffects({ burst: true, side })
        setTimeout(() => setEffects({ burst: false }), 1200)
      } else {
        const target = side === 'challenger' ? challenger.id : opponent.id
        await purchaseCheerTicket(battleId, target)
        setEffects({ burst: true, side })
        setTimeout(() => setEffects({ burst: false }), 1200)
      }
    } catch (e) {
      alert('購入に失敗しました')
    } finally {
      setBuying(null)
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <button onClick={()=>cheer('challenger')} disabled={buying!==null} className="w-full py-4 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 transition-all font-bold flex items-center justify-center gap-2">
            <Heart className="w-5 h-5" /> {challenger.name} を応援（+100pt / ¥300）
          </button>
          <button onClick={()=>cheer('opponent')} disabled={buying!==null} className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 transition-all font-bold flex items-center justify-center gap-2">
            <Heart className="w-5 h-5" /> {opponent.name} を応援（+100pt / ¥300）
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
          <h3 className="font-semibold mb-4 flex items-center gap-2"><ShoppingCart className="w-4 h-4" /> ライブ限定アイテム</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {BATTLE_GOODS_TYPES.map((item) => (
              <div key={item.id} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => { setSelectedGoods(item.id); setShowGoodsModal(true) }}>
                <div className="flex items-start gap-3">
                  <Gift className="w-8 h-8 text-pink-400 flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white text-sm">{item.label}</h4>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-2">{item.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-pink-300 font-bold">{formatJPY(item.basePrice)}</span>
                      <span className="text-xs text-gray-400">+50pt</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-400 bg-white/5 rounded-lg p-3">
            💡 アイテム購入でも応援ポイントが加算されます！限定デザインで推しクリエイターを応援しよう
          </div>
        </div>

        {/* Goods Purchase Modal */}
        {showGoodsModal && selectedGoods && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 max-w-md w-full">
              {(() => {
                const item = BATTLE_GOODS_TYPES.find(g => g.id === selectedGoods)!
                return (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-white">アイテム購入</h3>
                      <button onClick={() => setShowGoodsModal(false)} className="text-gray-400 hover:text-white">
                        <Sparkles className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Gift className="w-12 h-12 text-pink-400" />
                        <div>
                          <h4 className="font-medium text-white">{item.label}</h4>
                          <p className="text-sm text-gray-300">{item.description}</p>
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-gray-300">価格</span>
                          <span className="text-white font-bold">{formatJPY(item.basePrice)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">応援ポイント</span>
                          <span className="text-pink-300 font-bold">+50pt</span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 bg-white/5 rounded p-3">
                        このアイテムを購入すると、現在リードしている側に50ポイントが加算されます
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
                                // サンプル環境では簡単な処理
                                const leadingSide = scores.challenger >= scores.opponent ? 'challenger' : 'opponent'
                                setScores(prev => ({ ...prev, [leadingSide]: prev[leadingSide] + 50 }))
                                setEffects({ burst: true, side: leadingSide })
                                setTimeout(() => setEffects({ burst: false }), 1200)
                              } else {
                                // 本番環境ではバトルグッズサービスを使用
                                const leadingSide = scores.challenger >= scores.opponent ? 'challenger' : 'opponent'
                                const targetId = leadingSide === 'challenger' ? challenger.id : opponent.id
                                await purchaseBattleGoods(battleId, targetId, selectedGoods)
                                setEffects({ burst: true, side: leadingSide })
                                setTimeout(() => setEffects({ burst: false }), 1200)
                              }
                              setShowGoodsModal(false)
                              alert(`${item.label}を購入しました！`)
                            } catch (e) {
                              alert('購入に失敗しました')
                            } finally {
                              setBuyingGoods(false)
                            }
                          }}
                          disabled={buyingGoods}
                          className="flex-1 py-2 px-4 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 transition-colors text-white font-bold disabled:opacity-50"
                        >
                          {buyingGoods ? '購入中...' : '購入する'}
                        </button>
                      </div>
                    </div>
                  </>
                )
              })()}
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
