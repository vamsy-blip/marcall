import { createContext, useContext } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import type { User } from '@shared/schema';

type AuthCtx = {
  user: User | null;
  isLoading: boolean;
  refetch: () => void;
};
const AuthContext = createContext<AuthCtx>({ user: null, isLoading: false, refetch: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, refetch } = useQuery<{ user: User | null }>({
    queryKey: ['/api/auth/me'],
  });
  return (
    <AuthContext.Provider value={{ user: data?.user || null, isLoading, refetch: () => refetch() }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function useLoginAs() {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest('POST', '/api/dev/login-as', { email });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] }),
  });
}
