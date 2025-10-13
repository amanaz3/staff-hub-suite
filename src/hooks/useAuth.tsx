
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: any | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: any) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    let profileFetchTimeout: NodeJS.Timeout;
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        
        // Check if we're in password recovery mode
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const isRecoveryMode = hashParams.get('type') === 'recovery';
        
        console.log('Auth state change:', event, session?.user?.email, 'Recovery mode:', isRecoveryMode);
        
        // If in recovery mode and not on reset password page, redirect there
        if (isRecoveryMode && window.location.pathname !== '/reset-password') {
          window.location.href = `/reset-password${window.location.hash}`;
          return;
        }
        
        // If in recovery mode on reset password page, don't set session yet
        if (isRecoveryMode && window.location.pathname === '/reset-password') {
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Clear any pending profile fetch
        if (profileFetchTimeout) {
          clearTimeout(profileFetchTimeout);
        }
        
        if (session?.user && event !== 'SIGNED_OUT') {
          // Bootstrap user profile/employee if needed, then fetch profile
          profileFetchTimeout = setTimeout(async () => {
            if (mounted) {
              await bootstrapUserIfNeeded(session.user);
              await fetchProfile(session.user.id);
            }
          }, 200);
        } else {
          setProfile(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      console.log('Initial session check:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Bootstrap and fetch profile for existing session
        profileFetchTimeout = setTimeout(async () => {
          if (mounted) {
            await bootstrapUserIfNeeded(session.user);
            await fetchProfile(session.user.id);
          }
        }, 200);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      if (profileFetchTimeout) {
        clearTimeout(profileFetchTimeout);
      }
      subscription.unsubscribe();
    };
  }, []);

  const bootstrapUserIfNeeded = async (user: User) => {
    try {
      // Check if user already has a profile to avoid overriding admin roles
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      // Only call bootstrap if no profile exists, or preserve existing admin role
      const preservedRole = existingProfile?.role === 'admin' ? 'admin' : (user.user_metadata?.role || 'staff');
      
      // Call bootstrap function to ensure profile and employee records exist
      const { error } = await supabase.rpc('bootstrap_user', {
        _email: user.email || '',
        _full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        _role: preservedRole,
        _department: user.user_metadata?.department || 'General',
        _position: user.user_metadata?.position || 'Staff'
      });
      
      if (error) {
        console.error('Error bootstrapping user:', error);
      }
    } catch (error) {
      console.error('Error in bootstrapUserIfNeeded:', error);
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId);
      
      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return;
      }

      // Fetch user roles from user_roles table
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
      }

      const roles = rolesData?.map(r => r.role) || [];
      setUserRoles(roles);
      
      // Add role to profile for backward compatibility
      const enrichedProfile = {
        ...profileData,
        role: roles.includes('admin') ? 'admin' : 'staff'
      };

      console.log('Profile fetched:', enrichedProfile);
      console.log('User roles:', roles);
      setProfile(enrichedProfile);
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const signUp = async (email: string, password: string, userData: any) => {
    try {
      console.log('Attempting to sign up with:', { email, userData });
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: userData.full_name,
            role: userData.role || 'staff',
            department: userData.department || 'General',
            position: userData.position || 'Staff'
          }
        }
      });

      if (error) {
        console.error('Sign up error:', error);
        toast({
          title: "Sign Up Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sign Up Successful",
          description: "Please check your email to verify your account.",
        });
      }

      return { error };
    } catch (err) {
      console.error('Sign up exception:', err);
      return { error: err };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      console.log('Attempting to sign in with:', email);
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        toast({
          title: "Sign In Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        console.log('Sign in successful');
        toast({
          title: "Welcome back!",
          description: "You have been successfully signed in.",
        });
      }

      return { error };
    } catch (err) {
      console.error('Sign in exception:', err);
      return { error: err };
    }
  };

  const cleanupAuthState = () => {
    // Remove all Supabase auth keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    // Remove from sessionStorage if in use
    Object.keys(sessionStorage || {}).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        sessionStorage.removeItem(key);
      }
    });
  };

  const signOut = async () => {
    try {
      // Clean up auth state first
      cleanupAuthState();
      
      // Attempt global sign out (ignore errors)
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        console.log('Global signout failed, continuing with cleanup');
      }
      
      // Force page reload for a clean state
      window.location.href = '/auth';
    } catch (error) {
      console.error('Signout error:', error);
      // Force redirect even if signout fails
      window.location.href = '/auth';
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const hasRole = (role: string): boolean => {
    return userRoles.includes(role);
  };

  const value = {
    user,
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    refreshProfile,
    hasRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
