import React from 'react'
import { Palette, Heart, Sparkles, TrendingUp, Users, ShoppingBag } from 'lucide-react'

interface UserIntentModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectIntent: (intent: 'creator' | 'fan') => void
}

export function UserIntentModal({ isOpen, onClose, onSelectIntent }: UserIntentModalProps) {
  if (!isOpen) return null

  const handleSelect = (intent: 'creator' | 'fan') => {
    onSelectIntent(intent)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Animated backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/80 via-blue-900/80 to-pink-900/80 backdrop-blur-md">
        <div className="absolute inset-0 bg-white/5 animate-pulse" />
      </div>

      {/* Modal content */}
      <div className="relative w-full max-w-4xl mx-4 transform transition-all duration-500 ease-out scale-100">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header with gradient */}
          <div className="relative bg-gradient-to-r from-purple-600 via-blue-600 to-pink-600 p-8 text-center">
            <div className="absolute inset-0 bg-black/10" />
            <div className="relative z-10">
              <Sparkles className="w-12 h-12 text-white mx-auto mb-4 animate-bounce" />
              <h2 className="text-3xl font-bold text-white mb-2">
                PhotoRankへようこそ！
              </h2>
              <p className="text-white/90 text-lg">
                どちらの目的でご利用されますか？
              </p>
            </div>
          </div>

          {/* Options grid */}
          <div className="p-8 grid md:grid-cols-2 gap-8">
            {/* Creator option */}
            <button
              onClick={() => handleSelect('creator')}
              className="group relative p-8 rounded-2xl border-2 border-transparent bg-gradient-to-br from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 hover:border-purple-300 hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-400 to-blue-400 opacity-0 group-hover:opacity-20 blur transition-opacity duration-300" />

              <div className="relative z-10">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center group-hover:animate-pulse">
                  <Palette className="w-8 h-8 text-white" />
                </div>

                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  クリエイターとして参加
                </h3>

                <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                  あなたの創作活動を収益化しませんか？作品をグッズにしてファンと繋がり、バトルで稼ごう！
                </p>

                <div className="space-y-3">
                  <div className="flex items-center text-left text-sm text-gray-700">
                    <TrendingUp className="w-4 h-4 text-purple-500 mr-3 flex-shrink-0" />
                    <span>作品をグッズ化して収益を得る</span>
                  </div>
                  <div className="flex items-center text-left text-sm text-gray-700">
                    <Users className="w-4 h-4 text-blue-500 mr-3 flex-shrink-0" />
                    <span>バトルでファンと盛り上がる</span>
                  </div>
                </div>

                <div className="mt-6 px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-full font-medium group-hover:shadow-lg transition-shadow">
                  創作を始める
                </div>
              </div>
            </button>

            {/* Fan option */}
            <button
              onClick={() => handleSelect('fan')}
              className="group relative p-8 rounded-2xl border-2 border-transparent bg-gradient-to-br from-pink-50 to-orange-50 hover:from-pink-100 hover:to-orange-100 hover:border-pink-300 hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-pink-400 to-orange-400 opacity-0 group-hover:opacity-20 blur transition-opacity duration-300" />

              <div className="relative z-10">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 flex items-center justify-center group-hover:animate-pulse">
                  <Heart className="w-8 h-8 text-white" />
                </div>

                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  ファンとして楽しむ
                </h3>

                <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                  推しクリエイターを見つけて応援しよう！お気に入りのグッズを購入してバトルで盛り上がろう！
                </p>

                <div className="space-y-3">
                  <div className="flex items-center text-left text-sm text-gray-700">
                    <ShoppingBag className="w-4 h-4 text-pink-500 mr-3 flex-shrink-0" />
                    <span>推しグッズを見つけて購入</span>
                  </div>
                  <div className="flex items-center text-left text-sm text-gray-700">
                    <Heart className="w-4 h-4 text-orange-500 mr-3 flex-shrink-0" />
                    <span>バトルでクリエイターを応援</span>
                  </div>
                </div>

                <div className="mt-6 px-6 py-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white rounded-full font-medium group-hover:shadow-lg transition-shadow">
                  推し活を始める
                </div>
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-gray-500">
              後からいつでも切り替えできます
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}