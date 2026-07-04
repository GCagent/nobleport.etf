import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';
import { VoiceConsole } from '@/components/dashboard/VoiceConsole';
import { fetchVoiceSession, fetchVoiceTranscript } from '@/lib/dashboard/api';
import { fmtMs, fmtRelative } from '@/lib/dashboard/format';

export const dynamic = 'force-dynamic';

export default async function VoicePage() {
  const [session, transcript] = await Promise.all([
    fetchVoiceSession(),
    fetchVoiceTranscript(),
  ]);

  return (
    <>
      <Topbar pageTitle="Stephanie.ai · Live Console" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat
            label="Session"
            value={session.active ? 'LIVE' : 'idle'}
            tone={session.active ? 'ok' : 'info'}
            hint={session.sessionId ?? '—'}
          />
          <Stat
            label="Latency"
            value={fmtMs(session.latencyMs)}
            tone={session.latencyMs > 500 ? 'warn' : 'ok'}
          />
          <Stat
            label="Packet Loss"
            value={`${session.packetLossPct.toFixed(1)}%`}
            tone={session.packetLossPct > 2 ? 'warn' : 'ok'}
          />
          <Stat label="Participants" value={String(session.participants)} />
          <Stat label="ASR" value={session.asrModel} />
          <Stat label="TTS Voice" value={session.ttsVoice} />
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel
            title="Live Transcript"
            subtitle={
              session.startedAt
                ? `started ${fmtRelative(session.startedAt)}`
                : 'no active session'
            }
            className="xl:col-span-2"
          >
            <VoiceConsole initialTurns={transcript} />
          </Panel>

          <div className="space-y-4">
            <Panel title="Routing" subtitle="agents subscribed to this session">
              {session.routedTo.length === 0 ? (
                <p className="text-sm text-ink-400">No agents routed.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {session.routedTo.map((r) => (
                    <li
                      key={r}
                      className="flex items-center justify-between rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2"
                    >
                      <span className="text-ink-100">{r}</span>
                      <span className="pill-ai">subscribed</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Stack" subtitle="voice + orchestration">
              <ul className="space-y-1.5 text-sm text-ink-200">
                <li>• LiveKit · WebRTC transport</li>
                <li>• ElevenLabs · TTS</li>
                <li>• Deepgram Nova-3 · ASR</li>
                <li>• FastAPI websocket gateway</li>
                <li>• LangGraph supervisor · agent routing</li>
              </ul>
            </Panel>

            <Panel title="Operator Controls" subtitle="all writes audit-chained">
              <div className="grid grid-cols-2 gap-2">
                <button className="btn">Mute</button>
                <button className="btn">Hold</button>
                <button className="btn">Hand-off</button>
                <button className="btn">End</button>
              </div>
              <p className="mt-3 text-[11px] text-ink-400">
                Stephanie outbound calls require the <span className="num">stephanie-outbound</span>{' '}
                kill-switch to be safe and a 1/1 operator approval.
              </p>
            </Panel>
          </div>
        </div>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'ok' | 'warn' | 'err' | 'info';
}) {
  const toneCls =
    tone === 'ok'
      ? 'text-emerald-300'
      : tone === 'warn'
        ? 'text-yellow-300'
        : tone === 'err'
          ? 'text-red-300'
          : tone === 'info'
            ? 'text-blue-300'
            : 'text-ink-50';
  return (
    <div className="panel panel-pad">
      <div className="panel-subtitle">{label}</div>
      <div className={`num mt-1.5 text-xl font-semibold tracking-tight ${toneCls}`}>{value}</div>
      {hint && <div className="num mt-1 text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}
