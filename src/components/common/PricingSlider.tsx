import * as React from 'react'
import { useMemo, useState } from 'react'
// recharts is optional in package.json; import directly (present in repo)
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Input } from '@/components/ui/input'

export type PricingSliderProps = {
  basePrice: number
  min?: number
  max?: number
  step?: number
  currency?: string
  value?: number
  onChangeQty?: (q: number) => void
  discountCurve?: boolean
}

export const PricingSlider: React.FC<PricingSliderProps> = ({
  basePrice,
  min = 1,
  max = 100,
  step = 1,
  currency = '¥',
  value,
  onChangeQty,
  discountCurve = true,
}) => {
  const [internal, setInternal] = useState(value ?? 10)
  const qty = value ?? internal

  const priceForQty = (q: number) => {
    if (!discountCurve) return basePrice
    const discount = Math.min(0.3, Math.log10(Math.max(1, q)) * 0.1)
    return Math.round(basePrice * (1 - discount))
  }

  const chartData = useMemo(() => {
    const points: Array<{ qty: number; price: number }> = []
    const stride = Math.max(step, Math.round((max - min) / 20))
    for (let q = min; q <= max; q += stride) {
      points.push({ qty: q, price: priceForQty(q) })
    }
    if (points[points.length - 1]?.qty !== max) points.push({ qty: max, price: priceForQty(max) })
    return points
  }, [min, max, step, basePrice, discountCurve])

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">数量</div>
          <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{qty}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500 dark:text-gray-400">最終単価</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {currency}
            {priceForQty(qty).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="qty" hide tickLine={false} axisLine={false} />
            <YAxis hide domain={[0, 'dataMax + 10']} />
            <Tooltip formatter={(v: any) => `${currency}${Number(v).toLocaleString()}`} labelFormatter={(l) => `数量 ${l}`} />
            <Line type="monotone" dataKey="price" stroke="#3B82F6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={qty}
          onChange={(e) => {
            const next = parseInt(e.target.value) || min
            if (onChangeQty) onChangeQty(next)
            else setInternal(next)
          }}
          className="w-full accent-primary-600"
          aria-label="数量スライダー"
        />
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>
            {currency}
            {priceForQty(min).toLocaleString()} ({min})
          </span>
          <span>
            {currency}
            {priceForQty(max).toLocaleString()} ({max})
          </span>
        </div>
      </div>
    </div>
  )
}

export default PricingSlider
