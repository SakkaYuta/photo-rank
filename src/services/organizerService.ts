import { supabase } from './supabaseClient';

export interface OrganizerCreator {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  status: 'active' | 'inactive' | 'pending';
  joined_at: string;
  total_works: number;
  total_revenue: number;
  monthly_revenue: number;
  monthly_works: number;
  approval_rating: number; // 承認率
  last_activity: string;
}

export interface OrganizerStats {
  totalCreators: number;
  activeCreators: number;
  pendingCreators: number;
  totalRevenue: number;
  monthlyRevenue: number;
  totalWorks: number;
  monthlyWorks: number;
  pendingApprovals: number;
  qualityIssues: number;
}

export interface PendingWork {
  id: string;
  title: string;
  creator_name: string;
  creator_id: string;
  image_url: string;
  price: number;
  submitted_at: string;
  description: string;
  status: 'pending' | 'approved' | 'rejected';
  quality_score?: number;
}

export interface OrganizerDashboardData {
  stats: OrganizerStats;
  creators: OrganizerCreator[];
  pendingWorks: PendingWork[];
  topPerformers: OrganizerCreator[];
  recentActivities: Array<{
    id: string;
    type: 'work_submitted' | 'work_approved' | 'creator_joined' | 'sale_made';
    creator_name: string;
    description: string;
    timestamp: string;
  }>;
}

export const fetchOrganizerDashboard = async (organizerId: string): Promise<OrganizerDashboardData> => {
  try {
    // モックデータを使用（Supabaseテーブルが存在しない場合のため）
    console.log('Using mock data for organizer dashboard');

    // オーガナイザーに所属するクリエイターを取得
    const organizerCreators = [
      {
        creator_id: '1',
        status: 'active',
        joined_at: '2024-01-15T00:00:00Z',
        creators: {
          id: '1',
          name: '田中花子',
          email: 'hanako@example.com',
          avatar_url: 'https://images.unsplash.com/photo-1494790108755-2616b332c66a?w=150&h=150&fit=crop&crop=face'
        }
      },
      {
        creator_id: '2',
        status: 'active',
        joined_at: '2024-02-10T00:00:00Z',
        creators: {
          id: '2',
          name: '佐藤太郎',
          email: 'taro@example.com',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
        }
      },
      {
        creator_id: '3',
        status: 'pending',
        joined_at: '2024-08-20T00:00:00Z',
        creators: {
          id: '3',
          name: '山田美咲',
          email: 'misaki@example.com',
          avatar_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
        }
      },
      {
        creator_id: '4',
        status: 'active',
        joined_at: '2024-03-05T00:00:00Z',
        creators: {
          id: '4',
          name: '鈴木健一',
          email: 'kenichi@example.com',
          avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
        }
      },
      {
        creator_id: '5',
        status: 'inactive',
        joined_at: '2023-12-01T00:00:00Z',
        creators: {
          id: '5',
          name: '高橋麻衣',
          email: 'mai@example.com',
          avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face'
        }
      }
    ];

    // 各クリエイターの作品と売上情報を取得（モックデータ）
    const worksData = [
      {
        id: '1',
        creator_id: '1',
        title: '桜の季節',
        description: '春の美しい桜並木を撮影しました',
        image_url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=400&h=300&fit=crop',
        price: 2500,
        is_published: true,
        created_at: '2024-08-01T00:00:00Z',
        updated_at: '2024-08-01T00:00:00Z',
        purchases: [
          { id: 'p1', price: 2500, purchased_at: '2024-08-15T00:00:00Z' },
          { id: 'p2', price: 2500, purchased_at: '2024-08-20T00:00:00Z' }
        ]
      },
      {
        id: '2',
        creator_id: '1',
        title: '夕暮れの街',
        description: '都市の夕暮れ時の美しい景色',
        image_url: 'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1f?w=400&h=300&fit=crop',
        price: 3000,
        is_published: true,
        created_at: '2024-08-10T00:00:00Z',
        updated_at: '2024-08-10T00:00:00Z',
        purchases: [
          { id: 'p3', price: 3000, purchased_at: '2024-08-25T00:00:00Z' }
        ]
      },
      {
        id: '3',
        creator_id: '2',
        title: '山の風景',
        description: '雄大な山々の風景写真',
        image_url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop',
        price: 4000,
        is_published: true,
        created_at: '2024-08-05T00:00:00Z',
        updated_at: '2024-08-05T00:00:00Z',
        purchases: [
          { id: 'p4', price: 4000, purchased_at: '2024-08-22T00:00:00Z' },
          { id: 'p5', price: 4000, purchased_at: '2024-08-28T00:00:00Z' },
          { id: 'p6', price: 4000, purchased_at: '2024-09-01T00:00:00Z' }
        ]
      },
      {
        id: '4',
        creator_id: '4',
        title: '海辺の朝',
        description: '清々しい朝の海辺の写真',
        image_url: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=400&h=300&fit=crop',
        price: 2800,
        is_published: true,
        created_at: '2024-08-12T00:00:00Z',
        updated_at: '2024-08-12T00:00:00Z',
        purchases: [
          { id: 'p7', price: 2800, purchased_at: '2024-08-30T00:00:00Z' }
        ]
      }
    ];

    // 承認待ちの作品を取得（モックデータ）
    const pendingWorksData = [
      {
        id: '5',
        title: '雨の日の街角',
        creator_id: '1',
        image_url: 'https://images.unsplash.com/photo-1515263487990-61b07816b322?w=400&h=300&fit=crop',
        price: 2200,
        created_at: '2024-09-10T00:00:00Z',
        description: '雨に濡れた街角の情緒ある風景',
        creators: { name: '田中花子' }
      },
      {
        id: '6',
        title: '森の小径',
        creator_id: '3',
        image_url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop',
        price: 3200,
        created_at: '2024-09-12T00:00:00Z',
        description: '緑豊かな森の中の小径',
        creators: { name: '山田美咲' }
      },
      {
        id: '7',
        title: '夜景',
        creator_id: '2',
        image_url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=400&h=300&fit=crop',
        price: 3500,
        created_at: '2024-09-15T00:00:00Z',
        description: '美しい都市の夜景',
        creators: { name: '佐藤太郎' }
      }
    ];

    // 統計情報を計算
    const currentDate = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(currentDate.getMonth() - 1);

    const creators: OrganizerCreator[] = organizerCreators?.map(oc => {
      const creator = oc.creators;
      const creatorWorks = worksData?.filter(w => w.creator_id === oc.creator_id) || [];

      const totalRevenue = creatorWorks.reduce((sum, work) => {
        return sum + (work.purchases?.reduce((pSum: number, purchase: any) => pSum + purchase.price, 0) || 0);
      }, 0);

      const monthlyWorks = creatorWorks.filter(w => new Date(w.created_at) >= oneMonthAgo);
      const monthlyRevenue = monthlyWorks.reduce((sum, work) => {
        const recentPurchases = work.purchases?.filter((p: any) => new Date(p.purchased_at) >= oneMonthAgo) || [];
        return sum + recentPurchases.reduce((pSum: number, purchase: any) => pSum + purchase.price, 0);
      }, 0);

      const publishedWorks = creatorWorks.filter(w => w.is_published);
      const approvalRating = creatorWorks.length > 0 ? (publishedWorks.length / creatorWorks.length) * 100 : 100;

      const lastActivity = creatorWorks.length > 0
        ? Math.max(...creatorWorks.map(w => new Date(w.updated_at || w.created_at).getTime()))
        : new Date(oc.joined_at).getTime();

      return {
        id: creator.id,
        name: creator.name,
        email: creator.email,
        avatar_url: creator.avatar_url,
        status: oc.status,
        joined_at: oc.joined_at,
        total_works: creatorWorks.length,
        total_revenue: totalRevenue,
        monthly_revenue: monthlyRevenue,
        monthly_works: monthlyWorks.length,
        approval_rating: Math.round(approvalRating),
        last_activity: new Date(lastActivity).toISOString()
      };
    }) || [];

    const stats: OrganizerStats = {
      totalCreators: creators.length,
      activeCreators: creators.filter(c => c.status === 'active').length,
      pendingCreators: creators.filter(c => c.status === 'pending').length,
      totalRevenue: creators.reduce((sum, c) => sum + c.total_revenue, 0),
      monthlyRevenue: creators.reduce((sum, c) => sum + c.monthly_revenue, 0),
      totalWorks: creators.reduce((sum, c) => sum + c.total_works, 0),
      monthlyWorks: creators.reduce((sum, c) => sum + c.monthly_works, 0),
      pendingApprovals: pendingWorksData?.length || 0,
      qualityIssues: 0 // TODO: 品質問題の検出ロジックを実装
    };

    const pendingWorks: PendingWork[] = pendingWorksData?.map(work => ({
      id: work.id,
      title: work.title,
      creator_name: (work as any).creators.name,
      creator_id: work.creator_id,
      image_url: work.image_url,
      price: work.price,
      submitted_at: work.created_at,
      description: work.description || '',
      status: 'pending' as const,
      quality_score: Math.floor(Math.random() * 40) + 60 // TODO: 実際の品質スコア計算
    })) || [];

    const topPerformers = [...creators]
      .sort((a, b) => b.monthly_revenue - a.monthly_revenue)
      .slice(0, 5);

    // 最近のアクティビティを生成（モックデータ）
    const recentActivities = [
      {
        id: '1',
        type: 'work_submitted' as const,
        creator_name: '田中花子',
        description: '新しい作品「雨の日の街角」が投稿されました',
        timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString()
      },
      {
        id: '2',
        type: 'sale_made' as const,
        creator_name: '佐藤太郎',
        description: '作品「山の風景」が購入されました',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
      },
      {
        id: '3',
        type: 'work_approved' as const,
        creator_name: '鈴木健一',
        description: '作品「海辺の朝」が承認されました',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString()
      },
      {
        id: '4',
        type: 'creator_joined' as const,
        creator_name: '山田美咲',
        description: '新しいクリエイターが参加しました',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString()
      },
      {
        id: '5',
        type: 'sale_made' as const,
        creator_name: '田中花子',
        description: '作品「桜の季節」が購入されました',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString()
      }
    ];

    return {
      stats,
      creators,
      pendingWorks,
      topPerformers,
      recentActivities
    };

  } catch (error) {
    console.error('Failed to fetch organizer dashboard data:', error);
    throw error;
  }
};

export const updateCreatorStatus = async (organizerId: string, creatorId: string, status: OrganizerCreator['status']): Promise<void> => {
  try {
    // モック実装 - 実際のSupabase更新をシミュレート
    console.log(`Updating creator ${creatorId} status to ${status} for organizer ${organizerId}`);

    // 実際のデータベース更新をシミュレート
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Creator status updated successfully');
  } catch (error) {
    console.error('Failed to update creator status:', error);
    throw error;
  }
};

export const approveWork = async (workId: string, approved: boolean): Promise<void> => {
  try {
    // モック実装 - 実際のSupabase更新をシミュレート
    console.log(`${approved ? 'Approving' : 'Rejecting'} work ${workId}`);

    // 実際のデータベース更新をシミュレート
    await new Promise(resolve => setTimeout(resolve, 300));

    console.log(`Work ${workId} ${approved ? 'approved' : 'rejected'} successfully`);
  } catch (error) {
    console.error('Failed to approve/reject work:', error);
    throw error;
  }
};

export const bulkApproveWorks = async (workIds: string[], approved: boolean): Promise<void> => {
  try {
    // モック実装 - 実際のSupabase更新をシミュレート
    console.log(`Bulk ${approved ? 'approving' : 'rejecting'} ${workIds.length} works:`, workIds);

    // 実際のデータベース更新をシミュレート
    await new Promise(resolve => setTimeout(resolve, 800));

    console.log(`${workIds.length} works ${approved ? 'approved' : 'rejected'} successfully`);
  } catch (error) {
    console.error('Failed to bulk approve/reject works:', error);
    throw error;
  }
};

// 招待コード関連の型定義
export interface InviteCode {
  id: string;
  code: string;
  organizer_id: string;
  organizer_name: string;
  created_at: string;
  expires_at: string;
  max_uses: number;
  current_uses: number;
  is_active: boolean;
}

// 招待コードを生成
export const generateInviteCode = async (organizerId: string, organizerName: string): Promise<string> => {
  try {
    // 6桁の招待コードを生成
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 7日間有効、最大使用回数10回
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    console.log(`Generated invite code: ${code} for organizer: ${organizerName}`);
    console.log(`Code expires at: ${expiresAt.toISOString()}`);

    // モック実装 - 実際はSupabaseに保存
    await new Promise(resolve => setTimeout(resolve, 300));

    return code;
  } catch (error) {
    console.error('Failed to generate invite code:', error);
    throw error;
  }
};

// 招待コードで参加申請
export const joinOrganizerWithCode = async (userId: string, inviteCode: string): Promise<{ success: boolean; organizerName?: string; message: string }> => {
  try {
    console.log(`User ${userId} trying to join with code: ${inviteCode}`);

    // モック招待コードデータ
    const mockInviteCodes: InviteCode[] = [
      {
        id: '1',
        code: 'ABC123',
        organizer_id: 'org1',
        organizer_name: 'フォトスタジオABC',
        created_at: '2024-09-15T00:00:00Z',
        expires_at: '2024-09-25T00:00:00Z',
        max_uses: 10,
        current_uses: 3,
        is_active: true
      },
      {
        id: '2',
        code: 'XYZ789',
        organizer_id: 'org2',
        organizer_name: 'クリエイターズギルド',
        created_at: '2024-09-16T00:00:00Z',
        expires_at: '2024-09-26T00:00:00Z',
        max_uses: 5,
        current_uses: 1,
        is_active: true
      }
    ];

    // コードを検索
    const inviteCodeData = mockInviteCodes.find(ic => ic.code === inviteCode.toUpperCase());

    if (!inviteCodeData) {
      return {
        success: false,
        message: '無効な招待コードです'
      };
    }

    // 有効期限チェック
    if (new Date() > new Date(inviteCodeData.expires_at)) {
      return {
        success: false,
        message: '招待コードの有効期限が切れています'
      };
    }

    // 使用回数チェック
    if (inviteCodeData.current_uses >= inviteCodeData.max_uses) {
      return {
        success: false,
        message: '招待コードの使用回数上限に達しています'
      };
    }

    // アクティブかチェック
    if (!inviteCodeData.is_active) {
      return {
        success: false,
        message: '招待コードは無効化されています'
      };
    }

    // 既に参加済みかチェック（モック）
    const existingMembership = false; // 実際はSupabaseでチェック
    if (existingMembership) {
      return {
        success: false,
        message: 'すでにこのオーガナイザーに参加しています'
      };
    }

    // 参加処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 800));

    console.log(`User ${userId} successfully joined organizer: ${inviteCodeData.organizer_name}`);

    return {
      success: true,
      organizerName: inviteCodeData.organizer_name,
      message: `${inviteCodeData.organizer_name}への参加申請が完了しました`
    };

  } catch (error) {
    console.error('Failed to join organizer with code:', error);
    return {
      success: false,
      message: '参加処理中にエラーが発生しました'
    };
  }
};

export const inviteCreator = async (organizerId: string, email: string): Promise<void> => {
  try {
    // モック実装 - クリエイター招待機能
    console.log('Inviting creator:', email, 'to organizer:', organizerId);

    // 1. メールアドレスの形式チェック
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('無効なメールアドレス形式です');
    }

    // 2. 既存のクリエイターかチェック（モック）
    const existingEmails = ['hanako@example.com', 'taro@example.com', 'misaki@example.com', 'kenichi@example.com', 'mai@example.com'];
    if (existingEmails.includes(email)) {
      throw new Error('このクリエイターは既に招待済みです');
    }

    // 3. 招待処理をシミュレート
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 4. 招待メール送信をシミュレート
    console.log(`招待メールを ${email} に送信しました`);

    // 5. データベースに招待記録を追加（モック）
    console.log(`クリエイター ${email} をオーガナイザー ${organizerId} のpendingリストに追加しました`);

    console.log('Creator invitation sent successfully');
  } catch (error) {
    console.error('Failed to invite creator:', error);
    throw error;
  }
};