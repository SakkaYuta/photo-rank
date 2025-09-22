import React, { useState, useEffect } from 'react';
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
  Sparkles
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedDuration, setSelectedDuration] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [battles, setBattles] = useState<Battle[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock data for demonstration
  useEffect(() => {
    const mockBattles: Battle[] = [
      {
        id: '1',
        title: '推しイラストバトル - 冬コミ直前対決！',
        challenger: { id: '1', name: 'ArtMaster_Yuki', avatar: '/api/placeholder/40/40', worksCount: 156 },
        opponent: { id: '2', name: 'PixelQueen', avatar: '/api/placeholder/40/40', worksCount: 203 },
        status: 'live',
        duration: 30,
        startTime: '2025-01-22T14:00:00Z',
        viewerCount: 2847,
        totalPoints: { challenger: 15600, opponent: 18200 },
        category: 'イラスト',
        prizePool: 50000
      },
      {
        id: '2',
        title: 'アニメグッズ究極対決',
        challenger: { id: '3', name: 'OtakuPro', avatar: '/api/placeholder/40/40', worksCount: 89 },
        opponent: { id: '4', name: 'FigureKing', avatar: '/api/placeholder/40/40', worksCount: 134 },
        status: 'scheduled',
        duration: 60,
        startTime: '2025-01-22T19:00:00Z',
        viewerCount: 0,
        totalPoints: { challenger: 0, opponent: 0 },
        category: 'フィギュア',
        prizePool: 75000
      },
      {
        id: '3',
        title: 'Vtuberグッズ速攻バトル',
        challenger: { id: '5', name: 'VtuberFan_Mai', avatar: '/api/placeholder/40/40', worksCount: 67 },
        opponent: { id: '6', name: 'StreamMaster', avatar: '/api/placeholder/40/40', worksCount: 112 },
        status: 'finished',
        duration: 5,
        startTime: '2025-01-22T12:00:00Z',
        endTime: '2025-01-22T12:05:00Z',
        viewerCount: 1523,
        totalPoints: { challenger: 8900, opponent: 12300 },
        category: 'Vtuber',
        prizePool: 25000
      }
    ];

    setTimeout(() => {
      setBattles(mockBattles);
      setLoading(false);
    }, 1000);
  }, []);

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
      <div className={`bg-white rounded-xl shadow-lg overflow-hidden border-2 transition-all duration-300 hover:shadow-2xl hover:scale-105 cursor-pointer ${
        isLive ? 'border-red-500 bg-gradient-to-br from-red-50 to-pink-50' : 'border-gray-200 hover:border-purple-300'
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
            <div className={`text-center p-3 rounded-lg ${challengerWinning && isLive ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-gray-50'}`}>
              <img
                src={battle.challenger.avatar}
                alt={battle.challenger.name}
                className="w-12 h-12 rounded-full mx-auto mb-2 border-2 border-white shadow-lg"
              />
              <div className="font-semibold text-sm truncate">{battle.challenger.name}</div>
              <div className="text-xs text-gray-600">{battle.challenger.worksCount}作品</div>
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
            <div className={`text-center p-3 rounded-lg ${!challengerWinning && isLive ? 'bg-yellow-100 border-2 border-yellow-400' : 'bg-gray-50'}`}>
              <img
                src={battle.opponent.avatar}
                alt={battle.opponent.name}
                className="w-12 h-12 rounded-full mx-auto mb-2 border-2 border-white shadow-lg"
              />
              <div className="font-semibold text-sm truncate">{battle.opponent.name}</div>
              <div className="text-xs text-gray-600">{battle.opponent.worksCount}作品</div>
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
              <span className="text-gray-600">賞金プール:</span>
              <span className="font-bold text-green-600">¥{battle.prizePool.toLocaleString()}</span>
            </div>
          </div>

          {/* Action Button */}
          <div className="mt-4">
            {isLive ? (
              <button className="w-full bg-gradient-to-r from-red-500 to-pink-500 text-white py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 hover:from-red-600 hover:to-pink-600 transition-all transform hover:scale-105">
                <Play className="w-4 h-4" />
                ライブ観戦
              </button>
            ) : battle.status === 'scheduled' ? (
              <button className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105">
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Gamepad2 className="w-12 h-12 animate-bounce" />
              <Flame className="w-8 h-8 text-orange-300 animate-pulse" />
            </div>
            <h1 className="text-4xl font-bold mb-4">
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

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Search and Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
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
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
              <div key={i} className="bg-white rounded-xl shadow-lg overflow-hidden animate-pulse">
                <div className="h-32 bg-gray-200"></div>
                <div className="p-6">
                  <div className="h-4 bg-gray-200 rounded mb-4"></div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded"></div>
                    </div>
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto"></div>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded"></div>
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
            <h3 className="text-xl font-semibold text-gray-600 mb-2">バトルが見つかりません</h3>
            <p className="text-gray-500">検索条件を変更してお試しください</p>
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
    </div>
  );
};

export default BattleSearch;