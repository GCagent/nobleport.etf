import { create } from 'zustand';

interface Operator {
  id: string;
  name: string;
  email: string;
  role: 'managing_member' | 'officer' | 'pm' | 'viewer';
}

interface SessionState {
  operator: Operator | null;
  authenticated: boolean;
  environment: 'production' | 'staging' | 'development';
  region: string;
  setOperator: (op: Operator) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  operator: null,
  authenticated: false,
  environment: (process.env.NEXT_PUBLIC_VERCEL_ENV as SessionState['environment']) || 'development',
  region: process.env.NEXT_PUBLIC_VERCEL_REGION || 'local',
  setOperator: (op) => set({ operator: op, authenticated: true }),
  clearSession: () => set({ operator: null, authenticated: false }),
}));
