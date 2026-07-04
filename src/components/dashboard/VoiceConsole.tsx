'use client';

import { useEffect, useRef, useState } from 'react';
import type { VoiceTranscriptTurn } from '@/lib/dashboard/types';

const SPEAKER_LABEL: Record<VoiceTranscriptTurn['speaker'], { label: string; cls: string }> = {
  stephanie: { label: 'Stephanie', cls: 'pill-ai' },
  operator: { label: 'Operator', cls: 'pill-info' },
  caller: { label: 'Caller', cls: 'pill-mute' },
};

export function VoiceConsole({ initialTurns }: { initialTurns: VoiceTranscriptTurn[] }) {
  const [draft, setDraft] = useState('');
  const [turns, setTurns] = useState<VoiceTranscriptTurn[]>(initialTurns);
  const [pushToTalk, setPushToTalk] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length]);

  const submit = (text: string) => {
    if (!text.trim()) return;
    const turn: VoiceTranscriptTurn = {
      id: `t-${Date.now()}`,
      ts: new Date().toISOString(),
      speaker: 'operator',
      text: text.trim(),
    };
    setTurns((xs) => [...xs, turn]);
    setDraft('');
  };

  return (
    <div className="flex h-[480px] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-md border border-ink-700 bg-ink-950/60 p-3">
        {turns.map((t) => {
          const meta = SPEAKER_LABEL[t.speaker];
          return (
            <div key={t.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-[11px] text-ink-400">
                <span className={meta.cls}>{meta.label}</span>
                <span className="num">{new Date(t.ts).toLocaleTimeString()}</span>
                {t.routed && <span className="pill-mute">→ {t.routed}</span>}
              </div>
              <p className="text-sm text-ink-100">{t.text}</p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
      >
        <button
          type="button"
          aria-pressed={pushToTalk}
          onClick={() => setPushToTalk((v) => !v)}
          className={`btn ${pushToTalk ? 'border-violet-500/40 bg-violet-600/30 text-violet-100' : ''}`}
        >
          {pushToTalk ? '● live' : 'Push-to-talk'}
        </button>
        <input
          className="input"
          placeholder="Type to barge-in or task Stephanie…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={!draft.trim()}>
          Send
        </button>
      </form>
      <p className="mt-2 text-[11px] text-ink-400">
        All operator interactions are written to the audit chain via Cyborg.ai before execution.
      </p>
    </div>
  );
}
