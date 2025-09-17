import React, { useState, useEffect } from 'react'
import { Star, User, Edit2, Trash2, Plus } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { 
  getPartnerReviews, 
  createPartnerReview, 
  updatePartnerReview, 
  deletePartnerReview,
  canUserReviewPartner 
} from '../../services/partner.service'
import type { PartnerReview } from '../../types'

interface PartnerReviewsProps {
  partnerId: string
  manufacturingOrderId?: string
}

interface ReviewWithUser extends PartnerReview {
  users?: {
    username: string
    avatar_url?: string
  }
}

export function PartnerReviews({ partnerId, manufacturingOrderId }: PartnerReviewsProps) {
  const [reviews, setReviews] = useState<ReviewWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [canReview, setCanReview] = useState(false)
  const [editingReview, setEditingReview] = useState<ReviewWithUser | null>(null)
  
  const [newReview, setNewReview] = useState({
    rating: 5,
    comment: ''
  })

  useEffect(() => {
    loadReviews()
    checkCanReview()
  }, [partnerId])

  const loadReviews = async () => {
    try {
      setLoading(true)
      const data = await getPartnerReviews(partnerId)
      setReviews(data as ReviewWithUser[])
    } catch (error) {
      console.error('レビュー読み込み失敗:', error)
    } finally {
      setLoading(false)
    }
  }

  const checkCanReview = async () => {
    try {
      const result = await canUserReviewPartner(partnerId, manufacturingOrderId)
      setCanReview(result)
    } catch (error) {
      console.error('レビュー権限確認失敗:', error)
    }
  }

  const handleSubmitReview = async () => {
    if (!newReview.rating || newReview.rating < 1 || newReview.rating > 5) {
      alert('1-5の評価を選択してください')
      return
    }

    try {
      if (editingReview) {
        await updatePartnerReview(editingReview.id, {
          rating: newReview.rating,
          comment: newReview.comment.trim() || undefined
        })
      } else {
        await createPartnerReview({
          partner_id: partnerId,
          manufacturing_order_id: manufacturingOrderId,
          rating: newReview.rating,
          comment: newReview.comment.trim() || undefined
        })
      }

      setNewReview({ rating: 5, comment: '' })
      setShowReviewForm(false)
      setEditingReview(null)
      loadReviews()
      checkCanReview()
    } catch (error) {
      console.error('レビュー送信失敗:', error)
      alert('レビュー送信に失敗しました')
    }
  }

  const handleEditReview = (review: ReviewWithUser) => {
    setEditingReview(review)
    setNewReview({
      rating: review.rating,
      comment: review.comment || ''
    })
    setShowReviewForm(true)
  }

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('レビューを削除しますか？')) return

    try {
      await deletePartnerReview(reviewId)
      loadReviews()
      checkCanReview()
    } catch (error) {
      console.error('レビュー削除失敗:', error)
      alert('レビュー削除に失敗しました')
    }
  }

  const renderStars = (rating: number, interactive = false, onChange?: (rating: number) => void) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-5 h-5 ${
              star <= rating 
                ? 'fill-yellow-400 text-yellow-400' 
                : 'text-gray-300'
            } ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
            onClick={interactive && onChange ? () => onChange(star) : undefined}
          />
        ))}
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const averageRating = reviews.length > 0 
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length 
    : 0

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>パートナーレビュー</CardTitle>
        </CardHeader>
        <CardContent>
          <p>読み込み中...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* レビューサマリー */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>パートナーレビュー</CardTitle>
            <div className="flex items-center gap-2 mt-2">
              {renderStars(Math.round(averageRating))}
              <span className="text-lg font-semibold">{averageRating.toFixed(1)}</span>
              <span className="text-sm text-gray-600">({reviews.length}件のレビュー)</span>
            </div>
          </div>
          {canReview && !showReviewForm && (
            <Button 
              onClick={() => setShowReviewForm(true)}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              レビューを書く
            </Button>
          )}
        </CardHeader>
      </Card>

      {/* レビュー投稿フォーム */}
      {showReviewForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingReview ? 'レビューを編集' : '新しいレビューを投稿'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>評価</Label>
              <div className="mt-2">
                {renderStars(newReview.rating, true, (rating) => 
                  setNewReview(prev => ({ ...prev, rating }))
                )}
              </div>
            </div>
            
            <div>
              <Label htmlFor="comment">コメント（任意）</Label>
              <Textarea
                id="comment"
                placeholder="このパートナーとの取引について詳しく教えてください..."
                value={newReview.comment}
                onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                rows={4}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmitReview}>
                {editingReview ? '更新' : '投稿'}
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => {
                  setShowReviewForm(false)
                  setEditingReview(null)
                  setNewReview({ rating: 5, comment: '' })
                }}
              >
                キャンセル
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* レビュー一覧 */}
      <div className="space-y-4">
        {reviews.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-gray-500">
              まだレビューがありません
            </CardContent>
          </Card>
        ) : (
          reviews.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      {review.users?.avatar_url ? (
                        <img 
                          src={review.users.avatar_url} 
                          alt={review.users?.username || '匿名ユーザー'}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <User className="w-5 h-5 text-gray-500" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{review.users?.username || '匿名ユーザー'}</p>
                      <div className="flex items-center gap-2">
                        {renderStars(review.rating)}
                        <span className="text-sm text-gray-600">
                          {formatDate(review.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 自分のレビューの場合は編集・削除ボタン表示 */}
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditReview(review)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteReview(review.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {review.comment && (
                  <div className="mt-3 pl-13">
                    <p className="text-gray-700">{review.comment}</p>
                  </div>
                )}

                {review.manufacturing_order_id && (
                  <div className="mt-3 pl-13">
                    <Badge variant="default" className="text-xs">
                      注文ID: {review.manufacturing_order_id.slice(-8)}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
