export enum AvatarState {
  Loading = 'loading',
  Idle = 'idle',
  Listening = 'listening',
  Thinking = 'thinking',
  Speaking = 'speaking',
  Error = 'error',
  Ended = 'ended',
}

export enum AvatarEvent {
  Loaded = 'loaded',
  UserSpeaking = 'user_speaking',
  UserDone = 'user_done',
  Thinking = 'thinking',
  Speaking = 'speaking',
  DoneSpeaking = 'done_speaking',
  Error = 'error',
  Recover = 'recover',
  SessionEnd = 'session_end',
}

const TRANSITIONS: Record<AvatarState, Partial<Record<AvatarEvent, AvatarState>>> = {
  [AvatarState.Loading]: {
    [AvatarEvent.Loaded]: AvatarState.Idle,
    [AvatarEvent.Error]: AvatarState.Error,
  },
  [AvatarState.Idle]: {
    [AvatarEvent.UserSpeaking]: AvatarState.Listening,
    [AvatarEvent.Thinking]: AvatarState.Thinking,
    [AvatarEvent.Speaking]: AvatarState.Speaking,
    [AvatarEvent.Error]: AvatarState.Error,
    [AvatarEvent.SessionEnd]: AvatarState.Ended,
  },
  [AvatarState.Listening]: {
    [AvatarEvent.UserDone]: AvatarState.Thinking,
    [AvatarEvent.Thinking]: AvatarState.Thinking,
    [AvatarEvent.Speaking]: AvatarState.Speaking,
    [AvatarEvent.Error]: AvatarState.Error,
    [AvatarEvent.SessionEnd]: AvatarState.Ended,
  },
  [AvatarState.Thinking]: {
    [AvatarEvent.Speaking]: AvatarState.Speaking,
    [AvatarEvent.Error]: AvatarState.Error,
    [AvatarEvent.SessionEnd]: AvatarState.Ended,
  },
  [AvatarState.Speaking]: {
    [AvatarEvent.DoneSpeaking]: AvatarState.Idle,
    [AvatarEvent.Error]: AvatarState.Error,
    [AvatarEvent.SessionEnd]: AvatarState.Ended,
  },
  [AvatarState.Error]: {
    [AvatarEvent.Recover]: AvatarState.Idle,
    [AvatarEvent.SessionEnd]: AvatarState.Ended,
  },
  [AvatarState.Ended]: {},
};

export class AvatarStateMachine {
  private state: AvatarState = AvatarState.Idle;
  private history: Array<{ from: AvatarState; event: AvatarEvent; to: AvatarState; at: number }> = [];

  transition(event: AvatarEvent): AvatarState {
    const allowed = TRANSITIONS[this.state];
    const next = allowed[event];

    if (next === undefined) {
      // Invalid transition — stay in current state, log for debugging
      console.warn(`[Avatar] Invalid transition: ${this.state} + ${event}`);
      return this.state;
    }

    this.history.push({ from: this.state, event, to: next, at: Date.now() });
    this.state = next;
    return this.state;
  }

  getState(): string {
    return this.state;
  }

  getHistory() {
    return this.history;
  }

  isHealthy(): boolean {
    return this.state !== AvatarState.Error && this.state !== AvatarState.Ended;
  }
}
