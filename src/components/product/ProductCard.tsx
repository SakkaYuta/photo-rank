import * as React from 'react'
import { Star, ShoppingCart } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCart } from '../../contexts/CartContext'
import { useToast } from '../../contexts/ToastContext'

export type ProductCardProps = {
  id: string
  imageUrl: string
  title: string
  price: number
  rating?: number
  reviewsCount?: number
  creatorName?: string
  badgeText?: string
  onClick?: () => void
  onAddToCart?: () => void
  className?: string
  factoryId?: string | null
}

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  imageUrl,
  title,
  price,
  rating = 0,
  reviewsCount = 0,
  creatorName,
  badgeText,
  onClick,
  onAddToCart,
  className,
  factoryId,
}) => {
  const { addToCart } = useCart()
  const { showToast } = useToast()
  const roundedRating = Math.round(rating)
  return (
    <Card hoverable className={`group relative overflow-hidden transition-base ${className || ''}`}>
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img
          src={imageUrl}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />

        {/* Hover overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        {/* Quick actions */}
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <Button
            variant="secondary"
            size="sm"
            className="pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation()
              addToCart({
                id,
                title,
                price,
                imageUrl,
                factoryId
              })
              showToast({ message: 'カートに追加しました', variant: 'success' })
              onAddToCart?.()
            }}
          >
            <ShoppingCart className="w-4 h-4" />
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation()
              onClick?.()
            }}
          >
            詳細
          </Button>
        </div>

        {badgeText && (
          <div className="absolute left-3 top-3">
            <Badge variant="secondary">{badgeText}</Badge>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 jp-text text-base font-semibold text-gray-900 dark:text-gray-100" title={title}>
            {title}
          </h3>
          <div className="text-right text-lg font-bold text-gray-900 dark:text-gray-100">¥{price.toLocaleString()}</div>
        </div>

        <div className="mt-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star key={i} className={`h-4 w-4 ${i <= roundedRating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
            ))}
            <span className="ml-1">({reviewsCount})</span>
          </div>
          {creatorName && <span className="truncate">by {creatorName}</span>}
        </div>
      </div>
    </Card>
  )
}

export default ProductCard
