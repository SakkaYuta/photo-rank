import { useEffect, useState } from 'react'
import { supabase } from '../../services/supabaseClient'
import { useAuth } from '../../hooks/useAuth'

function sumAmount(rows?: { net_amount?: number; final_payout?: number }[] | null) {
  return (rows || []).reduce((acc, r) => acc + (r.net_amount ?? r.final_payout ?? 0), 0)
}

function startOfMonth(d = new Date()) { const t = new Date(d.getFullYear(), d.getMonth(), 1); return t.toISOString() }
function endOfMonth(d = new Date()) { const t = new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59); return t.toISOString() }
function startOfLastMonth() { const d = new Date(); d.setMonth(d.getMonth()-1); return startOfMonth(d) }
function endOfLastMonth() { const d = new Date(); d.setMonth(d.getMonth()-1); return endOfMonth(d) }

export const RevenueManagement = () => {
  const { profile } = useAuth()
  const [revenue, setRevenue] = useState({ currentMonth: 0, lastMonth: 0, pending: 0 })

  useEffect(() => { if (profile?.id) void fetchRevenue() }, [profile?.id])

  const fetchRevenue = async () => {
    if (!profile?.id) return
    const currentMonth = await supabase
      .from('sales')
      .select('net_amount')
      .eq('organizer_id', profile.id)
      .gte('created_at', startOfMonth())
      .lte('created_at', endOfMonth())

    const lastMonth = await supabase
      .from('sales')
      .select('net_amount')
      .eq('organizer_id', profile.id)
      .gte('created_at', startOfLastMonth())
      .lte('created_at', endOfLastMonth())

    const pending = await supabase
      .from('payouts_v31')
      .select('final_payout')
      .eq('recipient_id', profile.id)
      .eq('recipient_type', 'organizer')
      .eq('status', 'scheduled')

    setRevenue({
      currentMonth: sumAmount(currentMonth.data as any[]),
      lastMonth: sumAmount(lastMonth.data as any[]),
      pending: sumAmount(pending.data as any[])
    })
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">売上管理</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">今月の売上（手数料後）</div>
          <div className="text-2xl font-bold">¥{revenue.currentMonth.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">先月の売上</div>
          <div className="text-2xl font-bold">¥{revenue.lastMonth.toLocaleString()}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-sm text-gray-600">振込予定額</div>
          <div className="text-2xl font-bold text-green-600">¥{revenue.pending.toLocaleString()}</div>
          <div className="text-xs text-gray-500">翌々月末振込</div>
        </div>
      </div>
      {/* クリエイター別売上表（任意拡張） */}
    </div>
  )
}

export default RevenueManagement

