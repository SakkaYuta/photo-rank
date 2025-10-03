import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { getCurrentUserProfile, setupUserProfileAfterAuth, getDemoUser } from '../services/auth.service';
import type { User, UserType, UserWithProfiles } from '../types/user';

export const useUserRole = () => {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserWithProfiles | null>(null);
  const [userType, setUserType] = useState<UserType>('general');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // デモユーザーの確認
    const demoUser = getDemoUser();
    if (demoUser) {
      setUser(demoUser);
      return;
    }

    // Get current user and set up auth state listener
    const getCurrentUser = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
    };

    getCurrentUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      setUser(session?.user || null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // デモユーザーの場合
      if (user.is_demo) {
        setUserProfile(user);
        setUserType(user.user_type);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Check if user just completed OAuth and has a pending user type
        const pendingUserType = localStorage.getItem('pendingUserType');

        if (pendingUserType) {
          // User just completed OAuth with a selected user type
          const setupResult = await setupUserProfileAfterAuth();
          if (setupResult) {
            setUserProfile(setupResult);
            setUserType(setupResult.user_type as UserType);
            // ログイン直前の画面へ復帰
            try {
              const redirect = localStorage.getItem('postLoginRedirect')
              if (redirect) {
                localStorage.removeItem('postLoginRedirect')
                if (redirect.startsWith('#')) {
                  window.location.hash = redirect
                } else {
                  window.location.hash = `#${redirect}`
                }
              }
            } catch {}
            setLoading(false);
            return;
          }
        }

        // v6: users_vw を使用（user_profiles の display_name などを含む）
        const { data: userData, error: userError } = await supabase
          .from('users_vw')
          .select('*')
          .eq('id', user.id)
          .single();

        if (userError) {
          // If user doesn't exist in our users_vw, create user_profile
          if (userError.code === 'PGRST116') {
            const { data: newProfile, error: createError } = await supabase
              .from('user_profiles')
              .insert({
                user_id: user.id,
                display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
              })
              .select()
              .single();

            if (createError) throw createError;
            setUserProfile({ ...newProfile, id: user.id, email: user.email } as any);
            setUserType('general');
          } else {
            throw userError;
          }
        } else {
          let profileData: UserWithProfiles = userData as any

          // v6: user_roles テーブルでロールを確認
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id);

          const userRoles = new Set((roles || []).map((r: any) => r.role));

          // v6: partner_users と organizer_profiles を取得
          const [partnerResult, organizerResult] = await Promise.all([
            supabase.from('partner_users').select('partner_id, user_id, role').eq('user_id', user.id).maybeSingle(),
            supabase.from('organizer_profiles').select('*').eq('user_id', user.id).maybeSingle(),
          ])

          const partnerUser = partnerResult.data
          const organizerProfile = organizerResult.data

          // Handle errors gracefully
          if (import.meta.env.DEV) {
            if (partnerResult.error) {
              console.debug('Partner users table issue:', partnerResult.error.message)
            }
            if (organizerResult.error) {
              console.debug('Organizer profiles table issue:', organizerResult.error.message)
            }
            console.debug('Profile detection', {
              hasPartner: !!partnerUser,
              hasOrganizer: !!organizerProfile,
              roles: Array.from(userRoles),
            })
          }

          // v6: ロール優先順位で effectiveType を決定
          let effectiveType: UserType = 'general'
          // Note: admin role exists in user_roles but not in UserType
          // For now, we don't handle admin in this hook since UserType doesn't include it
          if (organizerProfile) {
            profileData.organizer_profile = organizerProfile as any
            effectiveType = 'organizer'
          } else if (partnerUser) {
            // v6: partner_users -> manufacturing_partners を解決
            let partnerName = ''
            try {
              if (partnerUser.partner_id) {
                const { data: mp } = await supabase
                  .from('manufacturing_partners')
                  .select('name')
                  .eq('id', partnerUser.partner_id)
                  .maybeSingle()
                partnerName = (mp as any)?.name || ''
              }
            } catch {}

            // factory_profiles 互換形式
            profileData.factory_profile = {
              id: partnerUser.partner_id,
              user_id: partnerUser.user_id,
              partner_id: partnerUser.partner_id,
              name: partnerName,
            } as any
            effectiveType = 'factory'
          } else if (userRoles.has('creator')) {
            effectiveType = 'creator'
          }

          setUserType(effectiveType)
          setUserProfile(profileData)
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [user]);

  const updateUserType = async (newUserType: UserType) => {
    if (!user) return false;

    try {
      setError(null);

      // v6: user_roles テーブルで既存ロールを取得
      const { data: existingRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      const currentRoles = new Set((existingRoles || []).map((r: any) => r.role));

      // Create organizer profile if switching to organizer
      if (newUserType === 'organizer') {
        try {
          const { data: existingOrganizerProfile, error: selectError } = await supabase
            .from('organizer_profiles')
            .select('*')
            .eq('user_id', user.id)
            .maybeSingle();

          if (!existingOrganizerProfile && !selectError) {
            const { error: orgError } = await supabase
              .from('organizer_profiles')
              .insert({
                user_id: user.id,
                name: userProfile?.display_name || user.email?.split('@')[0] || 'オーガナイザー',
                description: 'クリエイターを管理するオーガナイザーです',
              });
            // ignore orgError silently
          }
        } catch (error) { /* silent */ }
      }

      // v6: user_roles テーブルでロールを管理
      // 既存のcreator/factory/organizerロールを削除して新しいロールを追加
      const rolesToRemove = ['creator', 'factory', 'organizer'].filter(r => currentRoles.has(r as any));
      if (rolesToRemove.length > 0) {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user.id)
          .in('role', rolesToRemove);
      }

      // general以外の場合は新しいロールを追加
      if (newUserType !== 'general') {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: user.id,
            role: newUserType,
          });

        if (insertError && insertError.code !== '23505') { // 重複エラーは無視
          throw insertError;
        }
      }

      setUserType(newUserType);

      // Refresh user profile
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          user_type: newUserType,
        } as any);
      }

      return true;
    } catch (err) {
      console.error('Error updating user type:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    }
  };

  const isCreator = userType === 'creator';
  const isFactory = userType === 'factory';
  const isOrganizer = userType === 'organizer';
  const isGeneral = userType === 'general';

  const switchRole = updateUserType;

  return {
    user,
    userProfile,
    userType,
    loading,
    error,
    updateUserType,
    switchRole,
    isCreator,
    isFactory,
    isOrganizer,
    isGeneral
  };
};
