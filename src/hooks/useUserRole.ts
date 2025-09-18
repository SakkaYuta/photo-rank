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
          const userTypeValue = userData.user_type as UserType;
          setUserType(userTypeValue);

          // Fetch additional profiles based on user type
          let profileData: UserWithProfiles = userData;

          if (userTypeValue === 'factory') {
            const { data: factoryProfile } = await supabase
              .from('factory_profiles')
              .select('*')
              .eq('user_id', user.id)
              .single();

            if (factoryProfile) {
              profileData.factory_profile = factoryProfile;
            }
          }

          if (userTypeValue === 'organizer') {
            const { data: organizerProfile } = await supabase
              .from('organizer_profiles')
              .select('*')
              .eq('user_id', user.id)
              .single();

            if (organizerProfile) {
              profileData.organizer_profile = organizerProfile;
            }
          }

          setUserProfile(profileData);
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