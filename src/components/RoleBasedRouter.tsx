import React from 'react';
import { useUserRole } from '../hooks/useUserRole';
import { DASHBOARD_ROUTES } from '../types/user';
import CreatorDashboard from '../pages/CreatorDashboard';
import FactoryDashboard from '../pages/FactoryDashboard';
import OrganizerDashboard from '../pages/OrganizerDashboard';
import GeneralHomepage from '../pages/GeneralHomepage';
import GeneralDashboard from '../pages/GeneralDashboard';
import { LoadingSpinner } from './common/LoadingSpinner';

interface RoleBasedRouterProps {
  defaultComponent?: React.ComponentType;
}

const RoleBasedRouter: React.FC<RoleBasedRouterProps> = ({
  defaultComponent: DefaultComponent = GeneralHomepage
}) => {
  const { userType, loading, error, user } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">ユーザー情報を読み込み中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">エラーが発生しました</p>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  // If not logged in, show default component (general homepage)
  if (!user) {
    return <DefaultComponent />;
  }

  // Route based on user type
  switch (userType) {
    case 'creator':
      return <CreatorDashboard />;
    case 'factory':
      return <FactoryDashboard />;
    case 'organizer':
      return <OrganizerDashboard />;
    case 'general':
    default:
      return <GeneralDashboard />;
  }
};

export default RoleBasedRouter;