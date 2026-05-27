import { create } from 'zustand';

type VoiceStatus = 'idle' | 'connecting' | 'active' | 'error';

interface VoiceState {
  status: VoiceStatus;
  sessionId: string | null;
  latencyMs: number;
  participants: number;
  setStatus: (status: VoiceStatus) => void;
  startSession: (sessionId: string) => void;
  endSession: () => void;
  updateLatency: (ms: number) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  status: 'idle',
  sessionId: null,
  latencyMs: 0,
  participants: 0,
  setStatus: (status) => set({ status }),
  startSession: (sessionId) => set({ status: 'active', sessionId, participants: 1 }),
  endSession: () => set({ status: 'idle', sessionId: null, latencyMs: 0, participants: 0 }),
  updateLatency: (ms) => set({ latencyMs: ms }),
}));
