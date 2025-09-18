import React, { useState, useEffect } from 'react';
import { useUserRole } from '../hooks/useUserRole';
import { fetchOrderHistory, OrderHistory } from '../services/dashboardService';
import { Package, Calendar, CreditCard, Truck, CheckCircle, Clock, AlertCircle } from 'lucide-react';

const OrderHistoryPage: React.FC = () => {
  const { user } = useUserRole();
  const [orders, setOrders] = useState<OrderHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrderHistory = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        const data = await fetchOrderHistory(user.id);
        setOrders(data);
      } catch (error) {
        console.error('Failed to fetch order history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOrderHistory();
  }, [user?.id]);

  const formatPrice = (price: number) => {
    return `¥${price.toLocaleString()}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: '注文確認中',
          color: 'text-yellow-600 bg-yellow-100',
          icon: Clock
        };
      case 'confirmed':
        return {
          label: '注文確定',
          color: 'text-blue-600 bg-blue-100',
          icon: CheckCircle
        };
      case 'processing':
        return {
          label: '製作中',
          color: 'text-purple-600 bg-purple-100',
          icon: Package
        };
      case 'shipped':
        return {
          label: '発送済み',
          color: 'text-green-600 bg-green-100',
          icon: Truck
        };
      case 'delivered':
        return {
          label: '配送完了',
          color: 'text-green-700 bg-green-200',
          icon: CheckCircle
        };
      case 'cancelled':
        return {
          label: 'キャンセル',
          color: 'text-red-600 bg-red-100',
          icon: AlertCircle
        };
      default:
        return {
          label: '不明',
          color: 'text-gray-600 bg-gray-100',
          icon: AlertCircle
        };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <div className="h-8 bg-gray-200 rounded animate-pulse w-48 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded animate-pulse w-96"></div>
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start space-x-4">
                  <div className="w-20 h-20 bg-gray-200 rounded-lg animate-pulse"></div>
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded animate-pulse mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded animate-pulse mb-4 w-3/4"></div>
                    <div className="flex space-x-4">
                      <div className="h-3 bg-gray-200 rounded animate-pulse w-24"></div>
                      <div className="h-3 bg-gray-200 rounded animate-pulse w-32"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">注文履歴</h1>
          <p className="text-gray-600">
            これまでに注文したグッズの履歴と配送状況を確認できます
          </p>
        </div>

        {orders.length > 0 ? (
          <div className="space-y-6">
            {orders.map((order) => {
              const statusInfo = getStatusInfo(order.status);
              const StatusIcon = statusInfo.icon;

              return (
                <div
                  key={order.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start space-x-4">
                    {/* Work Image */}
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                      <img
                        src={order.work_image_url}
                        alt={order.work_title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Order Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900 truncate">
                            {order.work_title}
                          </h3>
                          <p className="text-gray-600 text-sm">
                            by {order.creator_name}
                          </p>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                            <StatusIcon className="w-4 h-4 mr-1" />
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      {/* Order Info */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="flex items-center text-sm text-gray-600">
                          <CreditCard className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span>{formatPrice(order.price)}</span>
                        </div>
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="w-4 h-4 mr-2 flex-shrink-0" />
                          <span>{formatDate(order.purchased_at)}</span>
                        </div>
                        {order.tracking_number && (
                          <div className="flex items-center text-sm text-gray-600">
                            <Truck className="w-4 h-4 mr-2 flex-shrink-0" />
                            <span className="truncate">追跡番号: {order.tracking_number}</span>
                          </div>
                        )}
                      </div>

                      {/* Shipping Info */}
                      {(order.shipped_at || order.delivered_at) && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="flex space-x-6 text-sm text-gray-600">
                            {order.shipped_at && (
                              <div>
                                <span className="font-medium">発送日時:</span> {formatDate(order.shipped_at)}
                              </div>
                            )}
                            {order.delivered_at && (
                              <div>
                                <span className="font-medium">配送完了:</span> {formatDate(order.delivered_at)}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              まだ注文履歴がありません
            </h3>
            <p className="text-gray-600 mb-6">
              作品を購入すると、ここに注文履歴が表示されます
            </p>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: { view: 'search' } }))}
              className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              作品を探す
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistoryPage;