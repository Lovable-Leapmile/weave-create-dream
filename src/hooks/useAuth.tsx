import { useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
  const withJitter = (baseMs: number, attempt: number) => {
    const backoff = baseMs * Math.pow(2, attempt);
    const jitter = Math.floor(Math.random() * 250);
    return Math.min(4000, backoff + jitter);
  };
  const isTransientError = (error: any) => {
    const status = (error as any)?.status;
    const msg = String((error as any)?.message || "");
    return [429, 502, 503, 504].includes(status) || /Service Unavailable|network|fetch failed|ECONNRESET|timeout/i.test(msg);
  };

  const signIn = async (mobileNumber: string, password: string) => {
    // Use mobile number as email (format: mobilenumber@app.local)
    const email = `${mobileNumber}@app.local`;

    let lastError: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) return { data, error: null };

      lastError = error;
      // Retry on transient backend errors
      if (isTransientError(error)) {
        await delay(withJitter(500, attempt));
        continue;
      }
      break;
    }

    return { data: null, error: lastError };
  };

  const signUp = async (mobileNumber: string, password: string) => {
    // Include base path in redirect URL for email redirects
    const baseUrl = import.meta.env.BASE_URL;
    const redirectUrl = `${window.location.origin}${baseUrl}`;
    const email = `${mobileNumber}@app.local`;

    let lastError: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: { mobile_number: mobileNumber },
        },
      });

      if (!error) return { data, error: null };

      lastError = error;
      if (isTransientError(error)) {
        await delay(withJitter(500, attempt));
        continue;
      }
      break;
    }

    return { data: null, error: lastError };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  // Utility to clear any stale local tokens that can trigger infinite refresh loops
  const resetAuth = async () => {
    try {
      await supabase.auth.signOut();
    } catch {}
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-')) localStorage.removeItem(k);
      });
    } catch {}
  };

  return {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetAuth,
  };
};
