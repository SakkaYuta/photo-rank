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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
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
            setLoading(false);
            return;
          }
        }

        // Regular user profile fetch
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (userError) {
          // If user doesn't exist in our users table, create one
          if (userError.code === 'PGRST116') {
            const { data: newUser, error: createError } = await supabase
              .from('users')
              .insert({
                id: user.id,
                email: user.email,
                display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
                user_type: 'general'
              })
              .select()
              .single();

            if (createError) throw createError;
            setUserProfile(newUser);
            setUserType('general');
          } else {
            throw userError;
          }
        } else {
          // Detect effective user type by checking associated profiles as a fallback
          let effectiveType = (userData.user_type as UserType) || 'general'
          let profileData: UserWithProfiles = userData

          // Fetch both profiles to robustly infer role
          const [factoryResult, organizerResult] = await Promise.all([
            supabase.from('factory_profiles').select('*').eq('user_id', user.id).maybeSingle(),
            supabase.from('organizer_profiles').select('*').eq('user_id', user.id).maybeSingle(),
          ])

          const factoryProfile = factoryResult.data
          const organizerProfile = organizerResult.data

          // Handle errors gracefully
          if (import.meta.env.DEV) {
            if (factoryResult.error) {
              console.debug('Factory profiles table issue:', factoryResult.error.message)
            }
            if (organizerResult.error) {
              console.debug('Organizer profiles table issue:', organizerResult.error.message)
            }
            console.debug('Profile detection', {
              hasFactory: !!factoryProfile,
              hasOrganizer: !!organizerProfile,
              userType: userData.user_type,
              isCreator: userData.is_creator
            })
          }

          if (organizerProfile) {
            profileData.organizer_profile = organizerProfile as any
            effectiveType = 'organizer'
          } else if (factoryProfile) {
            profileData.factory_profile = factoryProfile as any
            effectiveType = 'factory'
          } else if (userData.is_creator) {
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

      // updating user type

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

      const { error: updateError } = await supabase
        .from('users')
        .update({
          user_type: newUserType,
          is_creator: newUserType === 'creator',
          is_factory: newUserType === 'factory'
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setUserType(newUserType);

      // Refresh user profile
      if (userProfile) {
        setUserProfile({
          ...userProfile,
          user_type: newUserType,
          is_creator: newUserType === 'creator',
          is_factory: newUserType === 'factory'
        });
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
