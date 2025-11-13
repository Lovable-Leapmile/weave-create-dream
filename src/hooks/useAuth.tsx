import { useEffect, useState } from 'react';
import { 
  getCurrentUser, 
  setCurrentUser, 
  findUserByMobile, 
  saveUser, 
  generateId,
  type User 
} from '@/lib/localStorage';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing user session
    const currentUser = getCurrentUser();
    setUser(currentUser);
    setLoading(false);
  }, []);

  const signIn = async (mobileNumber: string, password: string) => {
    try {
      const existingUser = findUserByMobile(mobileNumber, password);
      
      if (!existingUser) {
        return { 
          data: null, 
          error: { message: 'Invalid mobile number or password.' } 
        };
      }

      setCurrentUser(existingUser);
      setUser(existingUser);
      
      return { data: { user: existingUser }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  };

  const signUp = async (mobileNumber: string, password: string) => {
    try {
      const existingUser = findUserByMobile(mobileNumber);
      
      if (existingUser) {
        return { 
          data: null, 
          error: { message: 'User already exists. Please sign in.' } 
        };
      }

      const newUser: User = {
        id: generateId(),
        mobileNumber,
        password,
        createdAt: new Date().toISOString(),
      };

      saveUser(newUser);
      setCurrentUser(newUser);
      setUser(newUser);
      
      return { data: { user: newUser }, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error.message } };
    }
  };

  const signOut = async () => {
    try {
      setCurrentUser(null);
      setUser(null);
      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message } };
    }
  };

  const resetAuth = async () => {
    try {
      setCurrentUser(null);
      setUser(null);
    } catch {}
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    resetAuth,
  };
};
