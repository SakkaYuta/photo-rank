import { useTrendingWorks } from '../../hooks/useWorks'
import { WorkCard } from '../common/WorkCard'

export function TrendingView() {
  const { works, loading, error } = useTrendingWorks()
  if (loading) return <div className="p-4">読み込み中...</div>
  if (error) return <div className="p-4 text-red-600">{error}</div>
  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
      {works.map((w) => (
        <WorkCard key={w.id} work={w} />
      ))}
    </div>
  )
}

