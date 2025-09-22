import React, { useState, useEffect } from 'react';
import { useUserRole } from '../hooks/useUserRole';
import {
  Users,
  UserPlus,
  TrendingUp,
  Camera,
  Star,
  CheckCircle,
  XCircle,
  Plus,
  Eye,
  DollarSign,
  AlertCircle,
  Search,
  Filter,
  MoreVertical,
  Award,
  MessageSquare,
  Calendar
} from 'lucide-react';
import {
  fetchOrganizerDashboard,
  updateCreatorStatus,
  approveWork,
  bulkApproveWorks,
  inviteCreator,
  generateInviteCode,
  type OrganizerDashboardData,
  type OrganizerCreator,
  type PendingWork
} from '../services/organizerService';

const OrganizerDashboard: React.FC = () => {
  const { userProfile } = useUserRole();
  const [dashboardData, setDashboardData] = useState<OrganizerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  const [selectedWorks, setSelectedWorks] = useState<Set<string>>(new Set());
  const [pendingStatusChanges, setPendingStatusChanges] = useState<Map<string, OrganizerCreator['status']>>(new Map());
  const [hasChanges, setHasChanges] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  useEffect(() => {
    loadDashboard();
  }, [userProfile?.id]);

  const loadDashboard = async () => {
    if (!userProfile?.id) {
      setLoading(false);
      return;
    }

    try {
      const data = await fetchOrganizerDashboard(userProfile.id);
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to fetch organizer dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (creatorId: string, newStatus: OrganizerCreator['status']) => {
    const newChanges = new Map(pendingStatusChanges);
    newChanges.set(creatorId, newStatus);
    setPendingStatusChanges(newChanges);
    setHasChanges(true);
  };

  const saveStatusChanges = async () => {
    if (!userProfile?.id || pendingStatusChanges.size === 0) return;

    try {
      const promises = Array.from(pendingStatusChanges.entries()).map(
        ([creatorId, status]) => updateCreatorStatus(userProfile.id, creatorId, status)
      );

      await Promise.all(promises);
      setPendingStatusChanges(new Map());
      setHasChanges(false);
      await loadDashboard();
    } catch (error) {
      console.error('Failed to save status changes:', error);
    }
  };

  const handleWorkApproval = async (workId: string, approved: boolean) => {
    try {
      await approveWork(workId, approved);
      await loadDashboard();
    } catch (error) {
      console.error('Failed to approve/reject work:', error);
    }
  };

  const handleBulkApproval = async (approved: boolean) => {
    if (selectedWorks.size === 0) return;

    try {
      await bulkApproveWorks(Array.from(selectedWorks), approved);
      setSelectedWorks(new Set());
      await loadDashboard();
    } catch (error) {
      console.error('Failed to bulk approve/reject works:', error);
    }
  };

  const handleInviteCreator = async () => {
    if (!userProfile?.id || !inviteEmail.trim()) return;

    setInviteLoading(true);
    try {
      await inviteCreator(userProfile.id, inviteEmail.trim());
      setInviteEmail('');
      setShowInviteModal(false);
      alert('クリエイターへの招待メールを送信しました！');
    } catch (error: any) {
      alert(`招待に失敗しました: ${error.message}`);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleGenerateCode = async () => {
    if (!userProfile?.id || !userProfile?.display_name) return;

    try {
      const code = await generateInviteCode(userProfile.id, userProfile.display_name);
      setGeneratedCode(code);
      setShowCodeModal(true);
    } catch (error: any) {
      alert(`招待コードの生成に失敗しました: ${error.message}`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatPrice = (price: number) => {
    return `¥${price.toLocaleString()}`;
  };

  const filteredCreators = dashboardData?.creators.filter(creator => {
    const matchesSearch = creator.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         creator.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || creator.status === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="mb-8">
            <div className="h-8 bg-gray-200 rounded animate-pulse w-96 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-64"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow-sm">
                <div className="h-6 bg-gray-200 rounded animate-pulse mb-4"></div>
                <div className="h-8 bg-gray-200 rounded animate-pulse mb-2"></div>
                <div className="h-4 bg-gray-200 rounded animate-pulse w-20"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">データの読み込みに失敗しました</h3>
          <button
            onClick={loadDashboard}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-gray-900">
                クリエイター管理ダッシュボード
              </h1>
              <p className="text-gray-600">
                こんにちは、{userProfile?.display_name}さん
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasChanges && (
                <button
                  onClick={saveStatusChanges}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  変更を保存
                </button>
              )}
              <button
                onClick={handleGenerateCode}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                招待コード生成
              </button>
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                <UserPlus className="w-5 h-5" />
                直接招待
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">総クリエイター数</h3>
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{dashboardData.stats.totalCreators}</p>
            <p className="text-sm text-green-600">アクティブ: {dashboardData.stats.activeCreators}名</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">今月の売上</h3>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{formatPrice(dashboardData.stats.monthlyRevenue)}</p>
            <p className="text-sm text-gray-600">総売上: {formatPrice(dashboardData.stats.totalRevenue)}</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">作品数</h3>
              <Camera className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{dashboardData.stats.totalWorks}</p>
            <p className="text-sm text-green-600">今月: +{dashboardData.stats.monthlyWorks}作品</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">承認待ち</h3>
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{dashboardData.stats.pendingApprovals}</p>
            <p className="text-sm text-red-600">品質問題: {dashboardData.stats.qualityIssues}件</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Creator Management */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">クリエイター管理</h2>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder="クリエイターを検索..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="all">全ステータス</option>
                      <option value="active">アクティブ</option>
                      <option value="inactive">非アクティブ</option>
                      <option value="pending">承認待ち</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {filteredCreators.map((creator) => {
                    const pendingStatus = pendingStatusChanges.get(creator.id);
                    const displayStatus = pendingStatus || creator.status;
                    const hasUnsavedChanges = pendingStatus && pendingStatus !== creator.status;

                    return (
                      <div key={creator.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex items-center gap-4">
                          <img
                            src={creator.avatar_url || '/default-avatar.png'}
                            alt={creator.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-gray-900">{creator.name}</h3>
                              {hasUnsavedChanges && (
                                <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                                  未保存
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{creator.email}</p>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                              <span>作品: {creator.total_works}点</span>
                              <span>売上: {formatPrice(creator.total_revenue)}</span>
                              <span>承認率: {creator.approval_rating}%</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <select
                            value={displayStatus}
                            onChange={(e) => handleStatusChange(creator.id, e.target.value as OrganizerCreator['status'])}
                            className={`px-3 py-1 text-sm rounded-full border ${
                              displayStatus === 'active' ? 'bg-green-100 text-green-800 border-green-200' :
                              displayStatus === 'inactive' ? 'bg-gray-100 text-gray-800 border-gray-200' :
                              'bg-yellow-100 text-yellow-800 border-yellow-200'
                            }`}
                          >
                            <option value="active">アクティブ</option>
                            <option value="inactive">非アクティブ</option>
                            <option value="pending">承認待ち</option>
                          </select>
                          <button className="p-2 text-gray-400 hover:text-gray-600">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Top Performers & Pending Approvals */}
          <div className="space-y-6">
            {/* Top Performers */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">トップパフォーマー</h2>
              </div>
              <div className="p-6 space-y-4">
                {dashboardData.topPerformers.slice(0, 5).map((creator, index) => (
                  <div key={creator.id} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      index === 0 ? 'bg-yellow-100' :
                      index === 1 ? 'bg-gray-100' :
                      index === 2 ? 'bg-orange-100' : 'bg-blue-100'
                    }`}>
                      {index < 3 ? (
                        <Award className={`w-5 h-5 ${
                          index === 0 ? 'text-yellow-600' :
                          index === 1 ? 'text-gray-600' :
                          'text-orange-600'
                        }`} />
                      ) : (
                        <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                      )}
                    </div>
                    <img
                      src={creator.avatar_url || '/default-avatar.png'}
                      alt={creator.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{creator.name}</p>
                      <p className="text-xs text-gray-600">
                        {formatPrice(creator.monthly_revenue)} / {creator.monthly_works}作品
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending Work Approvals */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">承認待ち作品</h2>
                  {selectedWorks.size > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleBulkApproval(true)}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        一括承認
                      </button>
                      <button
                        onClick={() => handleBulkApproval(false)}
                        className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                      >
                        一括却下
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 space-y-4">
                {dashboardData.pendingWorks.slice(0, 5).map((work) => (
                  <div key={work.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedWorks.has(work.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedWorks);
                        if (e.target.checked) {
                          newSelected.add(work.id);
                        } else {
                          newSelected.delete(work.id);
                        }
                        setSelectedWorks(newSelected);
                      }}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <img
                      src={work.image_url}
                      alt={work.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{work.title}</p>
                      <p className="text-xs text-gray-600">
                        {work.creator_name} • {formatDate(work.submitted_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleWorkApproval(work.id, true)}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleWorkApproval(work.id, false)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activities */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">最近のアクティビティ</h2>
              </div>
              <div className="p-6 space-y-4">
                {dashboardData.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      activity.type === 'work_submitted' ? 'bg-blue-100' :
                      activity.type === 'sale_made' ? 'bg-green-100' :
                      activity.type === 'creator_joined' ? 'bg-purple-100' : 'bg-yellow-100'
                    }`}>
                      {activity.type === 'work_submitted' ? (
                        <Camera className="w-5 h-5 text-blue-600" />
                      ) : activity.type === 'sale_made' ? (
                        <DollarSign className="w-5 h-5 text-green-600" />
                      ) : activity.type === 'creator_joined' ? (
                        <UserPlus className="w-5 h-5 text-purple-600" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-yellow-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {activity.creator_name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {activity.description} • {formatDate(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Creator Performance Table */}
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-lg font-semibold text-gray-900">クリエイター詳細データ</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      クリエイター
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      参加日
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      作品数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      今月売上
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      承認率
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ステータス
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      最終活動
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCreators.map((creator) => (
                    <tr key={creator.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <img
                            src={creator.avatar_url || '/default-avatar.png'}
                            alt={creator.name}
                            className="w-10 h-10 rounded-full object-cover mr-3"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{creator.name}</div>
                            <div className="text-sm text-gray-500">{creator.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(creator.joined_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {creator.total_works}作品
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPrice(creator.monthly_revenue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${
                            creator.approval_rating >= 90 ? 'bg-green-500' :
                            creator.approval_rating >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}></div>
                          {creator.approval_rating}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          creator.status === 'active' ? 'bg-green-100 text-green-800' :
                          creator.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {creator.status === 'active' ? 'アクティブ' :
                           creator.status === 'inactive' ? '非アクティブ' : '承認待ち'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(creator.last_activity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Invite Creator Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">クリエイターを招待</h3>
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4">
                <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  メールアドレス
                </label>
                <input
                  id="inviteEmail"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="creator@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={inviteLoading}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  disabled={inviteLoading}
                >
                  キャンセル
                </button>
                <button
                  onClick={handleInviteCreator}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={inviteLoading || !inviteEmail.trim()}
                >
                  {inviteLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      送信中...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-5 h-5" />
                      招待を送信
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Invite Code Modal */}
        {showCodeModal && generatedCode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">招待コードが生成されました</h3>
                <button
                  onClick={() => {
                    setShowCodeModal(false);
                    setGeneratedCode('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  このコードをクリエイターと共有してください。コードは7日間有効で、最大10回まで使用できます。
                </p>

                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <div className="text-3xl font-mono font-bold text-gray-900 mb-2 tracking-wider">
                    {generatedCode}
                  </div>
                  <p className="text-sm text-gray-500">招待コード</p>
                </div>

                <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>使用方法:</strong><br />
                    クリエイターはプロフィール設定画面で「オーガナイザーに参加」を選択し、このコードを入力します。
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generatedCode);
                    alert('招待コードをクリップボードにコピーしました！');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  コピー
                </button>
                <button
                  onClick={() => {
                    setShowCodeModal(false);
                    setGeneratedCode('');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizerDashboard;