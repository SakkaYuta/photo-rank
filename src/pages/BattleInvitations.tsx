import React, { useEffect, useState } from 'react'
import { supabase } from '@/services/supabaseClient'
import { acceptBattle, declineBattle, listMyBattleInvitations, getBattleStatus } from '@/services/battle.service'

type Invitation = {
  id: string
  battle_id: string
  inviter_id: string
  opponent_id: string
  status: string
  created_at: string
  title?: string
  duration_minutes?: number
  requested_start_at?: string
  opponent_accepted?: boolean
}

const BattleInvitations: React.FC = () => {
  const [items, setItems] = useState<Invitation[]>([])
  const [participants, setParticipants] = useState<Record<string, { id: string; display_name?: string; avatar_url?: string }>>({})
  const [detail, setDetail] = useState<{ open: boolean; item: Invitation | null; reason: string; loading: boolean; status: any | null }>({ open: false, item: null, reason: '', loading: false, status: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError(null)
      try {
        // 統一: 関数ベースでバトル招待を取得
        try {
          const res = await listMyBattleInvitations()
          const rows = (res?.items || []).map((b: any) => ({
            id: b.id,
            battle_id: b.id,
            inviter_id: b.challenger_id,
            opponent_id: b.opponent_id,
            status: b.status,
            created_at: b.requested_start_at || b.created_at || new Date().toISOString(),
            title: b.title,
            duration_minutes: b.duration_minutes,
            requested_start_at: b.requested_start_at,
            opponent_accepted: b.opponent_accepted,
          }))
          if (rows.length === 0) throw new Error('no-rows')
          setItems(rows as any)
          setParticipants(res?.participants || {})
        } catch {
          // フォールバック: battle_invitations テーブル
          const { data } = await supabase
            .from('battle_invitations')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)
          const rows = data || []
          if (rows.length === 0) {
            const now = Date.now()
            setItems([
              { id: 'demo-1', battle_id: 'BATTLE-001', inviter_id: 'user-a', opponent_id: 'me', status: 'pending', created_at: new Date(now - 3600_000).toISOString() },
              { id: 'demo-2', battle_id: 'BATTLE-002', inviter_id: 'user-b', opponent_id: 'me', status: 'accepted', created_at: new Date(now - 7200_000).toISOString() },
              { id: 'demo-3', battle_id: 'BATTLE-003', inviter_id: 'user-c', opponent_id: 'me', status: 'declined', created_at: new Date(now - 10800_000).toISOString() },
              { id: 'demo-4', battle_id: 'BATTLE-004', inviter_id: 'user-d', opponent_id: 'me', status: 'expired', created_at: new Date(now - 172800_000).toISOString() },
            ] as Invitation[])
          } else {
            setItems(rows as any)
          }
        }
      } catch (e: any) {
        // テーブル未作成/権限なしでもサンプルを表示
        const now = Date.now()
        setItems([
          { id: 'demo-1', battle_id: 'BATTLE-001', inviter_id: 'user-a', opponent_id: 'me', status: 'pending', created_at: new Date(now - 3600_000).toISOString() },
          { id: 'demo-2', battle_id: 'BATTLE-002', inviter_id: 'user-b', opponent_id: 'me', status: 'accepted', created_at: new Date(now - 7200_000).toISOString() },
          { id: 'demo-3', battle_id: 'BATTLE-003', inviter_id: 'user-c', opponent_id: 'me', status: 'declined', created_at: new Date(now - 10800_000).toISOString() },
          { id: 'demo-4', battle_id: 'BATTLE-004', inviter_id: 'user-d', opponent_id: 'me', status: 'expired', created_at: new Date(now - 172800_000).toISOString() },
        ] as Invitation[])
        setError(null)
      } finally {
        setLoading(false)
      }
    }
    load()
    // 即時反映: battles テーブルを購読（自分宛の招待）
    let ch: any
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const uid = user?.id
        if (!uid) return
        ch = supabase
          .channel(`rt-invites-${uid}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'battles', filter: `opponent_id=eq.${uid}` }, () => load())
          .subscribe()
      } catch {}
    })()
    return () => { try { ch && supabase.removeChannel(ch) } catch {} }
  }, [])

  const openDetail = async (it: Invitation) => {
    setDetail({ open: true, item: it, reason: '', loading: true, status: null })
    try {
      const st = await getBattleStatus(it.battle_id)
      setDetail(prev => ({ ...prev, loading: false, status: st }))
    } catch {
      setDetail(prev => ({ ...prev, loading: false }))
    }
  }
  const closeDetail = () => setDetail({ open: false, item: null, reason: '', loading: false, status: null })

  return (
    <div className="p-6 text-gray-900 dark:text-gray-100">
      <h1 className="text-3xl font-bold mb-5 text-indigo-700 dark:text-indigo-300">バトル招待一覧</h1>
      {loading && <div className="text-gray-800 dark:text-gray-200">読み込み中...</div>}
      {error && <div className="alert alert-error mb-3">{error}</div>}
      {!loading && items.length === 0 && (
        <div className="text-gray-700 dark:text-gray-300">現在、招待はありません。</div>
      )}
      <div className="space-y-3">
        {items.map((it) => {
          const accepted = Boolean(it.opponent_accepted)
          const statusLabel = accepted ? '承諾済み' : '承諾待ち'
          const statusClass = accepted ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
          return (
            <div key={it.id} className="rounded border p-4 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">ID: <span className="font-mono text-gray-800 dark:text-gray-200">{it.id}</span></div>
              <div className="text-sm text-gray-700 dark:text-gray-300">タイトル: <span className="text-gray-900 dark:text-gray-100">{it.title || 'バトル招待'}</span></div>
              <div className="text-sm text-gray-700 dark:text-gray-300">挑戦者: <span className="text-gray-900 dark:text-gray-100">{participants[it.inviter_id]?.display_name || it.inviter_id?.slice(0,8)}</span></div>
              <div className="text-sm text-gray-700 dark:text-gray-300">時間: <span className="text-gray-900 dark:text-gray-100">{it.duration_minutes}分</span> / 開始予定: <span className="text-gray-900 dark:text-gray-100">{it.requested_start_at ? new Date(it.requested_start_at).toLocaleString('ja-JP') : '未定'}</span></div>
              <div className="text-sm text-gray-700 dark:text-gray-300">状態: <span className={`font-semibold ${statusClass}`}>{statusLabel}</span></div>
              <div className="text-xs text-gray-500 dark:text-gray-400">作成: {new Date(it.created_at).toLocaleString('ja-JP')}</div>
              <div className="mt-3 flex gap-2">
                <button className="btn btn-xs btn-outline" onClick={() => openDetail(it)}>詳細を見る</button>
                <button
                  className="btn btn-xs btn-success"
                  onClick={async () => { try { await acceptBattle(it.battle_id); } catch {} }}
                  title="この招待を承認する"
                >承認</button>
                <button
                  className="btn btn-xs"
                  onClick={async () => { try { await declineBattle(it.battle_id) } catch {} }}
                  title="この招待を削除する"
                >非承認（削除）</button>
              </div>
            </div>
          )
        })}
      </div>

      {detail.open && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/40 p-4" onClick={closeDetail}>
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl" onClick={(e)=>e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-indigo-700">バトル詳細</h2>
              <button className="text-gray-500 hover:text-gray-700" onClick={closeDetail}>×</button>
            </div>
            {detail.loading ? (
              <div className="text-gray-600">読み込み中...</div>
            ) : (
              <div className="space-y-3">
                <div>
                  <div className="text-sm text-gray-600">タイトル</div>
                  <div className="font-medium text-gray-900">{detail.status?.battle?.title || detail.item?.title || 'バトル招待'}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-gray-600">挑戦者</div>
                    <div className="font-medium text-gray-900">{participants[detail.item!.inviter_id]?.display_name || detail.item!.inviter_id?.slice(0,8)}</div>
                  </div>
                  <div>
                    <div className="text-gray-600">時間</div>
                    <div className="font-medium text-gray-900">{detail.item?.duration_minutes}分</div>
                  </div>
                  <div>
                    <div className="text-gray-600">開始予定</div>
                    <div className="font-medium text-gray-900">{detail.item?.requested_start_at ? new Date(detail.item.requested_start_at).toLocaleString('ja-JP') : '未定'}</div>
                  </div>
                </div>
                {detail.status?.battle?.description && (
                  <div>
                    <div className="text-sm text-gray-600">説明</div>
                    <div className="text-sm text-gray-900 whitespace-pre-wrap">{detail.status?.battle?.description}</div>
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-700">理由（任意）</label>
                  <textarea className="mt-1 w-full rounded border p-2 text-sm text-gray-900" rows={3} placeholder="承諾/辞退の理由を入力（任意）"
                    value={detail.reason}
                    onChange={(e)=> setDetail(prev => ({ ...prev, reason: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button className="btn btn-outline" onClick={closeDetail}>閉じる</button>
                  <button className="btn" onClick={async ()=>{ if(!detail.item) return; try { await declineBattle(detail.item.battle_id, detail.reason?.trim() || undefined); closeDetail() } catch {} }}>辞退（理由送信）</button>
                  <button className="btn btn-primary" onClick={async ()=>{ if(!detail.item) return; try { await acceptBattle(detail.item.battle_id, detail.reason?.trim() || undefined); closeDetail() } catch {} }}>承諾（理由送信）</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default BattleInvitations
