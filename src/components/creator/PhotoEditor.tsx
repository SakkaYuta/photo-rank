import { FILTER_TYPES, FRAME_TYPES } from '../../utils/constants'

type Props = {
  imageUrl: string
  filterType: string
  frameType: string
  onChange: (v: { filterType: string; frameType: string }) => void
}

export function PhotoEditor({ imageUrl, filterType, frameType, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="card">
        <img src={imageUrl} alt="編集対象の画像" className="h-80 w-full rounded-md object-cover" />
      </div>
      <div className="card space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">フィルター</label>
          <select
            value={filterType}
            onChange={(e) => onChange({ filterType: e.target.value, frameType })}
            className="w-full rounded-md border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
          >
            {FILTER_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">フレーム</label>
          <select
            value={frameType}
            onChange={(e) => onChange({ filterType, frameType: e.target.value })}
            className="w-full rounded-md border border-gray-300 bg-white p-2 dark:border-gray-700 dark:bg-gray-900"
          >
            {FRAME_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
