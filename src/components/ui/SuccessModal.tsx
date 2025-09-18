import React from 'react'
import { CheckCircle, ShoppingBag, Heart, X } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './button'

export type SuccessModalProps = {
  isOpen: boolean
  onClose: () => void
  type: 'purchase' | 'cart' | 'favorite' | 'order' | 'general'
  title?: string
  message?: string
  actionLabel?: string
  onAction?: () => void
  secondaryActionLabel?: string
  onSecondaryAction?: () => void
  showGoToCart?: boolean
  onGoToCart?: () => void
  amount?: number
  itemCount?: number
}

const SUCCESS_CONFIGS = {
  purchase: {
    icon: CheckCircle,
    defaultTitle: 'ご購入ありがとうございます！',
    defaultMessage: 'お支払いが完了しました。注文履歴で詳細をご確認いただけます。',
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20'
  },
  cart: {
    icon: ShoppingBag,
    defaultTitle: 'カートに追加しました',
    defaultMessage: '商品をカートに追加いたしました。お買い物を続けるか、カートで確認してください。',
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20'
  },
  favorite: {
    icon: Heart,
    defaultTitle: 'お気に入りに追加',
    defaultMessage: 'お気に入りリストに追加しました。マイページからいつでも確認できます。',
    iconColor: 'text-red-500',
    bgColor: 'bg-red-50 dark:bg-red-900/20'
  },
  order: {
    icon: CheckCircle,
    defaultTitle: '注文を受け付けました',
    defaultMessage: 'ご注文ありがとうございます。製造開始までしばらくお待ちください。注文履歴で詳細をご確認いただけます。',
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20'
  },
  general: {
    icon: CheckCircle,
    defaultTitle: '完了しました',
    defaultMessage: '操作が正常に完了しました。',
    iconColor: 'text-green-500',
    bgColor: 'bg-green-50 dark:bg-green-900/20'
  }
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  type,
  title,
  message,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  showGoToCart = false,
  onGoToCart,
  amount,
  itemCount
}) => {
  const config = SUCCESS_CONFIGS[type]
  const Icon = config.icon

  const displayTitle = title || config.defaultTitle
  const displayMessage = message || config.defaultMessage

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      className="text-center"
    >
      <div className="p-6">
        {/* アイコン */}
        <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${config.bgColor}`}>
          <Icon className={`h-8 w-8 ${config.iconColor}`} />
        </div>

        {/* タイトル */}
        <h2 className="mb-3 text-xl font-bold text-gray-900 dark:text-gray-100 jp-text">
          {displayTitle}
        </h2>

        {/* 金額・数量情報 */}
        {(amount !== undefined || itemCount !== undefined) && (
          <div className="mb-4 rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
            {amount !== undefined && (
              <div className="text-lg font-semibold text-primary-600">
                ¥{amount.toLocaleString()}
              </div>
            )}
            {itemCount !== undefined && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {itemCount}点の商品
              </div>
            )}
          </div>
        )}

        {/* メッセージ */}
        <p className="mb-6 text-gray-600 dark:text-gray-400 jp-text leading-relaxed">
          {displayMessage}
        </p>

        {/* アクション */}
        <div className="space-y-3">
          {/* カートに移動ボタン */}
          {showGoToCart && onGoToCart && (
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                onGoToCart()
                onClose()
              }}
            >
              <ShoppingBag className="mr-2 h-4 w-4" />
              カートを確認
            </Button>
          )}

          {/* カスタムアクション */}
          {actionLabel && onAction && (
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                onAction()
                onClose()
              }}
            >
              {actionLabel}
            </Button>
          )}

          {/* セカンダリアクション */}
          {secondaryActionLabel && onSecondaryAction && (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                onSecondaryAction()
                onClose()
              }}
            >
              {secondaryActionLabel}
            </Button>
          )}

          {/* 閉じるボタン */}
          <Button
            variant={actionLabel || showGoToCart ? "secondary" : "primary"}
            className="w-full"
            onClick={onClose}
          >
            {actionLabel || showGoToCart ? "続ける" : "OK"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// 特定用途向けのプリセットコンポーネント
export const PurchaseSuccessModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  amount?: number
  itemCount?: number
  message?: string
}> = ({ isOpen, onClose, amount, itemCount, message }) => (
  <SuccessModal
    isOpen={isOpen}
    onClose={onClose}
    type="purchase"
    amount={amount}
    itemCount={itemCount}
    message={message}
  />
)

export const CartSuccessModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  onGoToCart?: () => void
  showGoToCart?: boolean
}> = ({ isOpen, onClose, onGoToCart, showGoToCart = true }) => (
  <SuccessModal
    isOpen={isOpen}
    onClose={onClose}
    type="cart"
    showGoToCart={showGoToCart}
    onGoToCart={onGoToCart}
  />
)

export const FavoriteSuccessModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  onGoToFavorites?: () => void
}> = ({ isOpen, onClose, onGoToFavorites }) => (
  <SuccessModal
    isOpen={isOpen}
    onClose={onClose}
    type="favorite"
    actionLabel="お気に入りを見る"
    onAction={onGoToFavorites}
  />
)

export const OrderSuccessModal: React.FC<{
  isOpen: boolean
  onClose: () => void
  onViewOrders?: () => void
}> = ({ isOpen, onClose, onViewOrders }) => (
  <SuccessModal
    isOpen={isOpen}
    onClose={onClose}
    type="order"
    actionLabel="注文履歴を見る"
    onAction={onViewOrders}
  />
)

export default SuccessModal
