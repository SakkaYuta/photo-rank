import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { getFactoryProductMockups, createFactoryProductMockup, updateFactoryProductMockup, deleteFactoryProductMockup, type FactoryProductMockup } from '@/services/factory-mockups.service'

type Geometry = {
  x: number; y: number; width: number; rotation?: number; skewX?: number; skewY?: number; opacity?: number; blendMode?: string; maskUrl?: string | null
}

type Props = { factoryProductId: string; onClose: () => void }

export const MockupEditor: React.FC<Props> = ({ factoryProductId, onClose }) => {
  const [items, setItems] = useState<FactoryProductMockup[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newImageUrl, setNewImageUrl] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { (async () => { await refresh() })() }, [factoryProductId])

  async function refresh() {
    setLoading(true)
    try {
      const data = await getFactoryProductMockups(factoryProductId)
      setItems(data)
      if (data.length && !selectedId) setSelectedId(data[0].id)
    } finally { setLoading(false) }
  }

  const selected = useMemo(() => items.find(i => i.id === selectedId) || null, [items, selectedId])
  const geometry: Geometry = useMemo(() => ({
    x: 20, y: 20, width: 60, rotation: 0, opacity: 0.95, blendMode: 'multiply',
    ...(selected?.geometry || {})
  }), [selected])

  async function handleAdd() {
    if (!newImageUrl.trim()) return
    setBusy(true)
    try {
      const created = await createFactoryProductMockup({
        factory_product_id: factoryProductId,
        image_url: newImageUrl.trim(),
        label: newLabel || null,
        geometry,
        sort_order: (items[items.length-1]?.sort_order ?? -1) + 1,
        is_active: true,
      })
      setNewImageUrl(''); setNewLabel('')
      setItems(prev => [...prev, created])
      setSelectedId(created.id)
    } finally { setBusy(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('このモックアップを削除しますか？')) return
    await deleteFactoryProductMockup(id)
    setItems(prev => prev.filter(i => i.id !== id))
    if (selectedId === id) setSelectedId(items[0]?.id || null)
  }

  async function saveGeometry(next: Partial<Geometry>) {
    if (!selected) return
    const merged = { ...geometry, ...next }
    await updateFactoryProductMockup(selected.id, { geometry: merged })
    setItems(prev => prev.map(i => i.id === selected.id ? { ...i, geometry: merged } : i))
  }

  // Drag/resize overlay
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<{ mode: 'move' | 'resize' | null, startX: number, startY: number, baseX: number, baseY: number, baseW: number }>({ mode: null, startX: 0, startY: 0, baseX: 0, baseY: 0, baseW: 0 })

  function onPointerDown(e: React.PointerEvent, mode: 'move' | 'resize') {
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    setDrag({ mode, startX: e.clientX, startY: e.clientY, baseX: geometry.x, baseY: geometry.y, baseW: geometry.width })
    ;(e.target as Element).setPointerCapture?.((e as any).pointerId)
  }
  async function onPointerMove(e: React.PointerEvent) {
    if (!drag.mode) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    const el = wrapRef.current!
    const rect = el.getBoundingClientRect()
    const dxPct = (dx / rect.width) * 100
    const dyPct = (dy / rect.height) * 100
    if (drag.mode === 'move') {
      const nx = Math.max(0, Math.min(100 - geometry.width, drag.baseX + dxPct))
      const ny = Math.max(0, Math.min(100, drag.baseY + dyPct))
      await saveGeometry({ x: nx, y: ny })
    } else if (drag.mode === 'resize') {
      const nw = Math.max(1, Math.min(100 - geometry.x, drag.baseW + dxPct))
      await saveGeometry({ width: nw })
    }
  }
  function onPointerUp() { setDrag(prev => ({ ...prev, mode: null })) }

  if (loading) {
    return (
      <div className="p-6">
        <p>読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 w-full max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">モックアップ編集</h2>
        <button className="btn btn-outline" onClick={onClose}>閉じる</button>
      </div>

      {/* List */}
      <div className="flex gap-4 overflow-x-auto pb-2 mb-4">
        {items.map((m) => (
          <button key={m.id} onClick={() => setSelectedId(m.id)} className={`flex-shrink-0 w-28 h-28 rounded border ${selectedId === m.id ? 'border-purple-600' : 'border-gray-300'} overflow-hidden`}> 
            <img src={m.image_url} alt={m.label || ''} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>

      {/* Add new */}
      <div className="bg-gray-50 rounded p-3 mb-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">ベース写真URL</label>
          <Input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="https://..." />
        </div>
        <div className="w-full sm:w-48">
          <label className="block text-sm font-medium mb-1">ラベル（任意）</label>
          <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="正面/斜め など" />
        </div>
        <button className="btn btn-primary" onClick={handleAdd} disabled={busy || !newImageUrl.trim()}>追加</button>
      </div>

      {selected && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview with overlay */}
          <div className="space-y-2">
            <div ref={wrapRef} className="relative w-full aspect-square bg-gray-100 rounded overflow-hidden select-none" onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
              <img src={selected.image_url} alt={selected.label || ''} className="absolute inset-0 w-full h-full object-cover" />
              {/* Overlay rect */}
              <div
                className="absolute border-2 border-purple-600/80 bg-purple-500/10"
                style={{ left: `${geometry.x}%`, top: `${geometry.y}%`, width: `${geometry.width}%`, height: `${Math.max(geometry.width * 1, 10)}%` }}
                onPointerDown={(e) => onPointerDown(e, 'move')}
              />
              {/* Resize handle */}
              <div
                className="absolute -right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white shadow border border-gray-300 cursor-ew-resize"
                style={{ left: `calc(${geometry.x + geometry.width}% - 12px)`, top: `calc(${geometry.y + (Math.max(geometry.width * 1, 10) / 2)}%)` }}
                onPointerDown={(e) => onPointerDown(e, 'resize')}
                title="幅を変更"
              />
            </div>
            <div className="text-xs text-gray-600">矩形（x,y,width）はドラッグ＆右ハンドルで編集できます。高さは簡易的に幅に比例（1:1）です。</div>
          </div>

          {/* Controls */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium">不透明度</label>
              <input type="range" min={0} max={1} step={0.01} value={geometry.opacity ?? 0.95} onChange={async (e) => saveGeometry({ opacity: parseFloat(e.target.value) })} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium">回転（deg）</label>
              <input type="range" min={-30} max={30} step={1} value={geometry.rotation ?? 0} onChange={async (e) => saveGeometry({ rotation: parseFloat(e.target.value) })} className="w-full" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium">blendMode</label>
                <select value={geometry.blendMode || 'multiply'} onChange={async (e) => saveGeometry({ blendMode: e.target.value })} className="w-full border rounded px-2 py-1">
                  {['normal','multiply','screen','overlay','darken','lighten'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">maskUrl（任意）</label>
                <Input value={geometry.maskUrl || ''} onChange={(e) => saveGeometry({ maskUrl: e.target.value || null })} placeholder="https://.../mask.png" />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-outline" onClick={() => handleDelete(selected.id)}>このモックアップを削除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MockupEditor

