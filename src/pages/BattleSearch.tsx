import React, { useState, useEffect } from 'react';
import { listBattles } from '@/services/battle.service'
import { SAMPLE_BATTLES, SAMPLE_PARTICIPANTS } from '@/sample/battleSamples'
import { useNav } from '@/contexts/NavContext'
import {
  Gamepad2,
  Clock,
  Users,
  Trophy,
  Zap,
  Filter,
  Search,
  Play,
  Eye,
  Heart,
  Star,
  Flame,
  Target,
  Timer,
  Crown,
  Sparkles,
  Bell,
  BellRing,
  X,
  Check,
  Mail,
  Smartphone
} from 'lucide-react';

interface Battle {
  id: string;
  title: string;
  challenger: {
    id: string;
    name: string;
    avatar: string;
    worksCount: number;
  };
  opponent: {
    id: string;
    name: string;
    avatar: string;
    worksCount: number;
  };
  status: 'scheduled' | 'live' | 'finished';
  duration: 5 | 30 | 60;
  startTime: string;
  endTime?: string;
  viewerCount: number;
  totalPoints: {
    challenger: number;
    opponent: number;
  };
  category: string;
  prizePool: number;
}

const BattleSearch: React.FC = () => {
  const { navigate } = useNav();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDuration, setSelectedDuration] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);

  // 通知設定のモーダル状態
  const [notificationModal, setNotificationModal] = useState<{
    isOpen: boolean;
    battle: Battle | null;
  }>({ isOpen: false, battle: null });

  // 通知設定の状態
  const [notifications, setNotifications] = useState<Record<string, {
    email: boolean;
    push: boolean;
    sms: boolean;
  }>>({});

  // Load from backend (fallback to sample data when enabled or on error)
  useEffect(() => {
    // プリセット検索クエリ
    try {
      const preset = localStorage.getItem('battle_query')
      if (preset) {
        setSearchQuery(preset)
        localStorage.removeItem('battle_query')
      }
    } catch {}
    (async () => {
      setLoading(true)
      try {
        const useSamples = (import.meta as any).env?.VITE_ENABLE_BATTLE_SAMPLE === 'true'
        if (useSamples) {
          const samples = SAMPLE_BATTLES
            .filter(b => selectedStatus === 'all' || b.status === selectedStatus)
            .filter(b => selectedDuration === 'all' || String(b.duration_minutes) === selectedDuration)
            .map(b => ({
              id: b.id,
              title: b.title,
              challenger: { id: b.challenger_id, name: SAMPLE_PARTICIPANTS[b.challenger_id]?.display_name || 'Challenger', avatar: SAMPLE_PARTICIPANTS[b.challenger_id]?.avatar_url || '/api/placeholder/40/40', worksCount: 0 },
              opponent: { id: b.opponent_id, name: SAMPLE_PARTICIPANTS[b.opponent_id]?.display_name || 'Opponent', avatar: SAMPLE_PARTICIPANTS[b.opponent_id]?.avatar_url || '/api/placeholder/40/40', worksCount: 0 },
              status: b.status,
              duration: b.duration_minutes,
              startTime: b.start_time,
              viewerCount: 1200,
              totalPoints: { challenger: 15600, opponent: 14800 },
              category: 'デモ',
              prizePool: 56000,
            }))
          setBattles(samples as any)
        } else {
          const res = await listBattles({
            limit: 20,
            status: selectedStatus !== 'all' ? (selectedStatus as any) : undefined,
            duration: selectedDuration !== 'all' ? (Number(selectedDuration) as any) : undefined
          })
          const items: Battle[] = (res.items || []).map((b: any) => ({
            id: b.id,
            title: 'グッズバトル',
            challenger: { id: b.challenger_id, name: res.participants?.[b.challenger_id]?.display_name || b.challenger_id.slice(0,8), avatar: res.participants?.[b.challenger_id]?.avatar_url || '/api/placeholder/40/40', worksCount: 0 },
            opponent: { id: b.opponent_id, name: res.participants?.[b.opponent_id]?.display_name || b.opponent_id.slice(0,8), avatar: res.participants?.[b.opponent_id]?.avatar_url || '/api/placeholder/40/40', worksCount: 0 },
            status: b.status,
            duration: (b.duration_minutes as 5|30|60) ?? 5,
            startTime: b.start_time || new Date().toISOString(),
            viewerCount: 0,
            totalPoints: {
              challenger: res.aggregates?.[b.id]?.by_user?.[b.challenger_id] || 0,
              opponent: res.aggregates?.[b.id]?.by_user?.[b.opponent_id] || 0,
            },
            category: 'グッズ',
            prizePool: res.aggregates?.[b.id]?.amount || 0,
          }))
          setBattles(items)
        }
      } catch (e) {
        const samples = SAMPLE_BATTLES
          .filter(b => selectedStatus === 'all' || b.status === selectedStatus)
          .map(b => ({
            id: b.id,
            title: b.title,
            challenger: { id: b.challenger_id, name: SAMPLE_PARTICIPANTS[b.challenger_id]?.display_name || 'Challenger', avatar: SAMPLE_PARTICIPANTS[b.challenger_id]?.avatar_url || '/api/placeholder/40/40', worksCount: 0 },
            opponent: { id: b.opponent_id, name: SAMPLE_PARTICIPANTS[b.opponent_id]?.display_name || 'Opponent', avatar: SAMPLE_PARTICIPANTS[b.opponent_id]?.avatar_url || '/api/placeholder/40/40', worksCount: 0 },
            status: b.status,
            duration: b.duration_minutes,
            startTime: b.start_time,
            viewerCount: 1200,
            totalPoints: { challenger: 15600, opponent: 14800 },
            category: 'デモ',
            prizePool: 56000,
          }))
        setBattles(samples as any)
      } finally {
        setLoading(false)
      }
    })()
  }, [selectedStatus])

  // 通知設定関数
  const openNotificationModal = (battle: Battle) => {
    setNotificationModal({ isOpen: true, battle });
    // ローカルストレージから既存の通知設定を読み込み
    const savedNotifications = localStorage.getItem(`notifications_${battle.id}`);
    if (savedNotifications) {
      setNotifications(prev => ({
        ...prev,
        [battle.id]: JSON.parse(savedNotifications)
      }));
    } else {
      setNotifications(prev => ({
        ...prev,
        [battle.id]: { email: false, push: false, sms: false }
      }));
    }
  };

  const closeNotificationModal = () => {
    setNotificationModal({ isOpen: false, battle: null });
  };

  const updateNotificationSetting = (battleId: string, type: 'email' | 'push' | 'sms', value: boolean) => {
    setNotifications(prev => {
      const updated = {
        ...prev,
        [battleId]: {
          ...prev[battleId],
          [type]: value
        }
      };
      // ローカルストレージに保存
      localStorage.setItem(`notifications_${battleId}`, JSON.stringify(updated[battleId]));
      return updated;
    });
  };

  const saveNotificationSettings = () => {
    if (!notificationModal.battle) return;

    const settings = notifications[notificationModal.battle.id];
    const enabledTypes = Object.entries(settings)
      .filter(([_, enabled]) => enabled)
      .map(([type]) => type);

    if (enabledTypes.length > 0) {
      alert(`通知設定が完了しました！\n設定された通知方法: ${enabledTypes.map(t => t === 'email' ? 'メール' : t === 'push' ? 'プッシュ通知' : 'SMS').join(', ')}\n\nバトル開始時にお知らせします。`);
    } else {
      alert('通知が無効になりました。');
    }

    closeNotificationModal();
  };

  const filteredBattles = battles.filter(battle => {
    const matchesSearch = battle.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         battle.challenger.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         battle.opponent.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || battle.status === selectedStatus;
    const matchesDuration = selectedDuration === 'all' || battle.duration.toString() === selectedDuration;
    const matchesCategory = selectedCategory === 'all' || battle.category === selectedCategory;

    return matchesSearch && matchesStatus && matchesDuration && matchesCategory;
  });

  const getStatusBadge = (status: Battle['status']) => {
    switch (status) {
      case 'live':
        return (
          <div className="flex items-center gap-1 px-3 py-1 bg-red-500 text-white rounded-full text-xs font-bold animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
            LIVE
          </div>
        );
      case 'scheduled':
        return (
          <div className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white rounded-full text-xs font-bold">
            <Clock className="w-3 h-3" />
            予定
          </div>
        );
      case 'finished':
        return (
          <div className="flex items-center gap-1 px-3 py-1 bg-gray-500 text-white rounded-full text-xs font-bold">
            <Trophy className="w-3 h-3" />
            終了
          </div>
        );
    }
  };

  const formatTimeRemaining = (startTime: string) => {
    const now = new Date();
    const start = new Date(startTime);
    const diff = start.getTime() - now.getTime();

    if (diff <= 0) return '開始済み';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `${hours}時間${minutes}分後`;
  };

  const BattleCard = ({ battle }: { battle: Battle }) => {
    const isLive = battle.status === 'live';
    const challengerWinning = battle.totalPoints.challenger > battle.totalPoints.opponent;

    return (
      <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border-2 transition-all duration-300 hover:shadow-2xl hover:scale-105 cursor-pointer ${
        isLive ? 'border-red-500 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600'
      }`}>
        {/* Header */}
        <div className={`p-4 ${isLive ? 'bg-gradient-to-r from-red-500 to-pink-500' : 'bg-gradient-to-r from-purple-500 to-blue-500'} text-white`}>
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              {getStatusBadge(battle.status)}
              <span className="text-xs opacity-90">{battle.category}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Timer className="w-3 h-3" />
              {battle.duration}分
            </div>
          </div>
          <h3 className="font-bold text-lg mb-2 leading-tight">{battle.title}</h3>
          {battle.status === 'scheduled' && (
            <div className="text-xs opacity-90">
              {formatTimeRemaining(battle.startTime)}
            </div>
          )}
        </div>

        {/* Creators Battle Section */}
        <div className="p-4">
          <div className="grid grid-cols-3 gap-4 items-center">
            {/* Challenger */}
            <div className={`text-center p-3 rounded-lg ${challengerWinning && isLive ? 'bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-500' : 'bg-gray-50 dark:bg-gray-700'}`}>
              <img
                src={battle.challenger.avatar}
                alt={battle.challenger.name}
                className="w-12 h-12 rounded-full mx-auto mb-2 border-2 border-white shadow-lg"
              />
              <div className="font-semibold text-sm truncate text-gray-900 dark:text-white">{battle.challenger.name}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">{battle.challenger.worksCount}作品</div>
              {isLive && (
                <div className="text-lg font-bold text-purple-600 mt-1">
                  {battle.totalPoints.challenger.toLocaleString()}pt
                </div>
              )}
              {challengerWinning && isLive && <Crown className="w-4 h-4 text-yellow-500 mx-auto mt-1" />}
            </div>

            {/* VS Section */}
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-2 ${
                isLive ? 'bg-gradient-to-r from-red-500 to-pink-500 animate-pulse' : 'bg-gradient-to-r from-purple-500 to-blue-500'
              }`}>
                <span className="text-white font-bold text-lg">VS</span>
              </div>
              {isLive && (
                <div className="flex items-center justify-center gap-1 text-xs text-red-600">
                  <Eye className="w-3 h-3" />
                  {battle.viewerCount.toLocaleString()}
                </div>
              )}
            </div>

            {/* Opponent */}
            <div className={`text-center p-3 rounded-lg ${!challengerWinning && isLive ? 'bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-400 dark:border-yellow-500' : 'bg-gray-50 dark:bg-gray-700'}`}>
              <img
                src={battle.opponent.avatar}
                alt={battle.opponent.name}
                className="w-12 h-12 rounded-full mx-auto mb-2 border-2 border-white shadow-lg"
              />
              <div className="font-semibold text-sm truncate text-gray-900 dark:text-white">{battle.opponent.name}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">{battle.opponent.worksCount}作品</div>
              {isLive && (
                <div className="text-lg font-bold text-purple-600 mt-1">
                  {battle.totalPoints.opponent.toLocaleString()}pt
                </div>
              )}
              {!challengerWinning && isLive && <Crown className="w-4 h-4 text-yellow-500 mx-auto mt-1" />}
            </div>
          </div>

          {/* Prize Pool */}
          <div className="mt-4 text-center">
            <div className="flex items-center justify-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <span className="text-gray-600 dark:text-gray-400">賞金プール:</span>
              <span className="font-bold text-green-600">¥{battle.prizePool.toLocaleString()}</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-4">
            {isLive ? (
              <button
                onClick={() => {
                  // ライブバトルページにナビゲート
                  window.location.hash = `live-battle?battle=${encodeURIComponent(battle.id)}`;
                  navigate('live-battle');
                }}
                className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 hover:from-red-600 hover:to-pink-600 transition-all transform hover:scale-105"
              >
                <Play className="w-4 h-4" />
                ライブ観戦
              </button>
            ) : battle.status === 'scheduled' ? (
              <button
                onClick={() => openNotificationModal(battle)}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105"
              >
                <Heart className="w-4 h-4" />
                通知設定
              </button>
            ) : (
              <button className="w-full bg-gray-500 text-white py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-gray-600 transition-all">
                <Trophy className="w-4 h-4" />
                結果を見る
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Gamepad2 className="w-12 h-12 animate-bounce" />
              <Flame className="w-8 h-8 text-orange-300 animate-pulse" />
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold mb-4">
              リアルタイム
              <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                バトル検索
              </span>
            </h1>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">
              推し活クリエイター同士の熱いバトルをリアルタイムで観戦しよう！
              あなたの応援が勝敗を左右する
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search Input */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="バトル・クリエイター名で検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">全ての状態</option>
              <option value="live">ライブ配信中</option>
              <option value="scheduled">開催予定</option>
              <option value="finished">終了済み</option>
            </select>

            {/* Duration Filter */}
            <select
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(e.target.value)}
              className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">全ての時間</option>
              <option value="5">5分バトル</option>
              <option value="30">30分バトル</option>
              <option value="60">60分バトル</option>
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="all">全カテゴリ</option>
              <option value="イラスト">イラスト</option>
              <option value="フィギュア">フィギュア</option>
              <option value="Vtuber">Vtuber</option>
              <option value="アニメ">アニメ</option>
              <option value="ゲーム">ゲーム</option>
            </select>
          </div>
        </div>

        {/* Battle Grid */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden animate-pulse">
                <div className="h-32 bg-gray-200 dark:bg-gray-700"></div>
                <div className="p-6">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto"></div>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredBattles.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBattles.map((battle) => (
              <BattleCard key={battle.id} battle={battle} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400 mb-2">バトルが見つかりません</h3>
            <p className="text-gray-500 dark:text-gray-500">検索条件を変更してお試しください</p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white p-6 rounded-xl text-center">
            <div className="flex items-center justify-center mb-2">
              <div className="w-3 h-3 bg-white rounded-full animate-ping mr-2"></div>
              <span className="text-2xl font-bold">{battles.filter(b => b.status === 'live').length}</span>
            </div>
            <p className="text-sm opacity-90">ライブバトル</p>
          </div>
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6 rounded-xl text-center">
            <div className="text-2xl font-bold mb-2">{battles.filter(b => b.status === 'scheduled').length}</div>
            <p className="text-sm opacity-90">開催予定</p>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-6 rounded-xl text-center">
            <div className="text-2xl font-bold mb-2">{battles.reduce((sum, b) => sum + b.viewerCount, 0).toLocaleString()}</div>
            <p className="text-sm opacity-90">総観戦者数</p>
          </div>
        </div>
      </div>

      {/* 通知設定モーダル */}
      {notificationModal.isOpen && notificationModal.battle && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            {/* モーダルヘッダー */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-6 h-6" />
                  <h2 className="text-lg font-bold">通知設定</h2>
                </div>
                <button
                  onClick={closeNotificationModal}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="text-sm opacity-90">
                <div className="font-semibold">{notificationModal.battle!.title}</div>
                <div>{formatTimeRemaining(notificationModal.battle!.startTime)}</div>
              </div>
            </div>

            {/* モーダルボディ */}
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                バトル開始時にお知らせする方法を選択してください
              </p>

              <div className="space-y-4">
                {/* メール通知 */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-blue-500" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">メール通知</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">登録メールアドレスに送信</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications[notificationModal.battle!.id]?.email || false}
                      onChange={(e) => updateNotificationSetting(notificationModal.battle!.id, 'email', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* プッシュ通知 */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <BellRing className="w-5 h-5 text-green-500" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">プッシュ通知</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">ブラウザ通知で表示</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications[notificationModal.battle!.id]?.push || false}
                      onChange={(e) => updateNotificationSetting(notificationModal.battle!.id, 'push', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
                  </label>
                </div>

                {/* SMS通知 */}
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-5 h-5 text-orange-500" />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">SMS通知</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">携帯電話にテキストメッセージ</div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications[notificationModal.battle!.id]?.sms || false}
                      onChange={(e) => updateNotificationSetting(notificationModal.battle!.id, 'sms', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-600"></div>
                  </label>
                </div>
              </div>

              {/* モーダルフッター */}
              <div className="flex gap-3 mt-8">
                <button
                  onClick={closeNotificationModal}
                  className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  キャンセル
                </button>
                <button
                  onClick={saveNotificationSettings}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  設定完了
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BattleSearch;
