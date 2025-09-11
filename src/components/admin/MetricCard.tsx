import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

type Props = {
  title: string
  value: string | number
  change?: number
  prefix?: string
  suffix?: string
  trend?: 'up' | 'down' | 'neutral'
  className?: string
}

export const MetricCard: React.FC<Props> = ({
  title,
  value,
  change,
  prefix = '',
  suffix = '',
  trend = 'neutral',
  className = '',
}) => {
  const TrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'

  return (
    <div className={`rounded-lg bg-white p-6 shadow dark:bg-gray-900 ${className}`}>
      <p className="mb-2 text-sm text-gray-600 dark:text-gray-400">{title}</p>
      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-bold">
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </p>
        {change !== undefined && (
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon />
            <span className="text-sm font-medium">{change > 0 ? '+' : ''}{change}%</span>
          </div>
        )}
      </div>
    </div>
  )
}

