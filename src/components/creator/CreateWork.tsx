import { useMemo, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Select } from '../ui/select'
import { createWork } from '../../services/work.service'
import { supabase } from '../../services/supabaseClient'

export function CreateWork() {
  // 基本情報
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('wallpaper')
  const [description, setDescription] = useState('')
  const [contentUrl, setContentUrl] = useState('')
  const [price, setPrice] = useState<number | ''>(1000)
  const [isPrivate, setIsPrivate] = useState(true)
  // 販売期間（開始・終了）
  const [saleStart, setSaleStart] = useState<string>('')
  const [saleEnd, setSaleEnd] = useState<string>('')

  // タグ
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])

  // 画像（最大12）
  const [imageInput, setImageInput] = useState('')
  const [images, setImages] = useState<string[]>([
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop',
  ])

  // ファイル（最大50）
  const [files, setFiles] = useState<File[]>([])

  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const titleLimit = 100
  const descLimit = 10000

  const usedBytes = useMemo(() => files.reduce((sum, f) => sum + (f.size || 0), 0), [files])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 KB'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const val = parseFloat((bytes / Math.pow(k, i)).toFixed(2))
    return `${val} ${sizes[i]}`
  }

  const onSubmit = async () => {
    setBusy(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('ログインが必要です')
      const primaryImage = images[0] || 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=1200&auto=format&fit=crop'
      await createWork({
        creator_id: user.id,
        title,
        image_url: primaryImage,
        thumbnail_url: primaryImage,
        price: typeof price === 'number' ? price : 0,
        message: description,
        is_published: !isPrivate,
        sale_start_at: saleStart ? new Date(saleStart).toISOString() : null,
        sale_end_at: saleEnd ? new Date(saleEnd).toISOString() : null,
      } as any)
      setMessage(isPrivate ? '下書きとして保存しました' : '作品を公開しました')
      // 簡易リセット（必要に応じて保持）
      setTitle('')
      setDescription('')
      setContentUrl('')
      setTags([])
      setFiles([])
      setImageInput('')
      setSaleStart('')
      setSaleEnd('')
    } catch (e: any) {
      setMessage(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6 p-4 max-w-3xl mx-auto">
      {/* タイトル */}
      <section className="card space-y-2 p-4">
        <label className="block">
          <div className="flex items-baseline justify-between gap-2">
            <span className="mb-1 block text-sm font-medium">タイトル（必須）</span>
            <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">{title.length} /{titleLimit}</span>
          </div>
          <Input
            placeholder="例：SURISURI 忍者"
            value={title}
            maxLength={titleLimit}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      </section>

      {/* カテゴリ */}
      <section className="card space-y-2 p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">カテゴリ</span>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="wallpaper">壁紙</option>
          </Select>
        </label>
      </section>

      {/* 説明 */}
      <section className="card space-y-2 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="block text-sm font-medium">説明</span>
          <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">{description.length} /{descLimit}</span>
        </div>
        <p className="text-xs text-gray-900 dark:text-gray-400">
          商品に関する必要な情報と魅力を伝える情報を記入してください。詳しくは、よくある質問。<br />
          例：忍者すりすりくんの公式デジタル絵本。<br />
          ※説明文はマークダウン記法。
        </p>
        <Textarea
          placeholder="商品の魅力や仕様、利用条件などを詳しく記載してください"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, descLimit))}
          rows={6}
        />
      </section>

      {/* コンテンツURL */}
      <section className="card space-y-2 p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">表示するコンテンツのURLを入力してください</span>
          <Input
            placeholder="https://www"
            value={contentUrl}
            onChange={(e) => setContentUrl(e.target.value)}
          />
        </label>
        <p className="text-xs text-gray-900 dark:text-gray-400">
          製品の説明に YouTube、Vimeo、SoundCloud、Spotify を埋め込むことができます。
        </p>
      </section>

      {/* 販売期間 */}
      <section className="card space-y-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="block text-sm font-medium">販売期間</span>
          <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">任意</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-gray-600">販売開始日時</span>
            <Input type="datetime-local" value={saleStart} onChange={(e) => setSaleStart(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-gray-600">販売終了日時</span>
            <Input type="datetime-local" value={saleEnd} onChange={(e) => setSaleEnd(e.target.value)} />
          </label>
        </div>
        <p className="text-xs text-gray-900 dark:text-gray-400">未設定の場合は常時販売となります。終了日時を過ぎると自動的に販売停止します。</p>
      </section>

      {/* タグ */}
      <section className="card space-y-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="block text-sm font-medium">タグ</span>
          <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">{tags.length} / 10</span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="キーワードを追加"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const t = tagInput.trim()
                if (t && !tags.includes(t) && tags.length < 10) {
                  setTags([...tags, t])
                  setTagInput('')
                }
              }
            }}
          />
          <Button
            type="button"
            onClick={() => {
              const t = tagInput.trim()
              if (t && !tags.includes(t) && tags.length < 10) {
                setTags([...tags, t])
                setTagInput('')
              }
            }}
          >追加</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.map((t, i) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
              {t}
              <button className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200" onClick={() => setTags(tags.filter((x) => x !== t))}>×</button>
            </span>
          ))}
        </div>
      </section>

      {/* 画像 */}
      <section className="card space-y-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="block text-sm font-medium">製品の画像</span>
          <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">{images.length}/12</span>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="画像URLを入力"
            value={imageInput}
            onChange={(e) => setImageInput(e.target.value)}
          />
          <Button
            type="button"
            onClick={() => {
              const url = imageInput.trim()
              if (!url) return
              if (images.length >= 12) return
              setImages([...images, url])
              setImageInput('')
            }}
          >追加</Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {images.map((url, idx) => (
            <div key={url + idx} className="rounded-lg border p-2">
              <img src={url} alt={`image-${idx}`} className="h-28 w-full rounded object-cover" />
              <div className="mt-2 flex items-center justify-between text-xs text-gray-900 dark:text-gray-400">
                <span>{idx + 1}</span>
                <div className="flex gap-1">
                  <Button size="sm" type="button" className="px-2 py-1" onClick={() => {
                    if (idx === 0) return
                    const arr = [...images]
                    const tmp = arr[idx - 1]
                    arr[idx - 1] = arr[idx]
                    arr[idx] = tmp
                    setImages(arr)
                  }}>↑</Button>
                  <Button size="sm" type="button" className="px-2 py-1" onClick={() => {
                    if (idx === images.length - 1) return
                    const arr = [...images]
                    const tmp = arr[idx + 1]
                    arr[idx + 1] = arr[idx]
                    arr[idx] = tmp
                    setImages(arr)
                  }}>↓</Button>
                  <Button size="sm" type="button" variant="secondary" className="px-2 py-1" onClick={() => setImages(images.filter((_, i) => i !== idx))}>削除</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-900 dark:text-gray-400">※画像の順番はドラッグ＆ドロップで変更できます</p>
      </section>

      {/* ファイル */}
      <section className="card space-y-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="block text-sm font-medium">ファイル</span>
          <span className="text-xs text-gray-500 shrink-0 whitespace-nowrap">{files.length}/50</span>
        </div>
        <input
          type="file"
          multiple
          onChange={(e) => {
            const picked = Array.from(e.target.files || [])
            const next = [...files, ...picked].slice(0, 50)
            setFiles(next)
          }}
        />
        <div className="rounded-lg border p-3 text-xs text-gray-900 dark:text-gray-300">
          <div className="mb-2 font-medium">ショップのファイル使用状況</div>
          <div>{formatBytes(usedBytes)} / 10GB</div>
        </div>
        <p className="text-xs text-gray-900 dark:text-gray-400">複数のファイルをアップロードできます。</p>
      </section>

      {/* バリエーション */}
      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <span className="block text-sm font-medium">バリエーション</span>
          <Button type="button" onClick={() => alert('バリエーションは近日対応予定です。')}>新しい</Button>
        </div>
        <p className="text-xs text-gray-900 dark:text-gray-400">
          サイズ、色、その他のオプションのバリエーションを追加できます。詳しい使い方については、バリエーション機能の使い方
        </p>
      </section>

      {/* 価格 */}
      <section className="card space-y-2 p-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">価格</span>
          <div className="text-xs text-gray-500 mb-1">必須</div>
          <div className="flex items-baseline gap-2">
            <Input
              type="number"
              min={0}
              value={price}
              onChange={(e) => {
                const v = e.target.value
                if (v === '') setPrice('')
                else setPrice(Math.max(0, Math.floor(Number(v) || 0)))
              }}
            />
            <span className="text-sm text-gray-900 shrink-0 whitespace-nowrap">円</span>
          </div>
        </label>
      </section>

      {/* 公開設定 */}
      <section className="card space-y-2 p-4">
        <span className="mb-1 block text-sm font-medium">公開設定</span>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
          />
          プライベート
        </label>
      </section>

      {/* 送信 */}
      <div className="flex justify-end gap-2">
        <Button onClick={onSubmit} disabled={busy || !title || title.length === 0 || title.length > titleLimit || price === ''}>
          {isPrivate ? '下書きとして保存' : '公開する'}
        </Button>
      </div>
      {message && <div className="text-sm text-gray-900">{message}</div>}
    </div>
  )
}
