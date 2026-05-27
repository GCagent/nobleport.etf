import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';

export const dynamic = 'force-dynamic';

export default function StreamPage() {
  return (
    <>
      <Topbar pageTitle="Live Avatar Stream" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <Panel title="Stephanie.ai — Live Stream" subtitle="LiveKit · ElevenLabs TTS · Real-time">
              <div className="flex aspect-video items-center justify-center rounded-md border border-ink-700 bg-ink-950">
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-violet-600/20 ring-2 ring-violet-500/30">
                    <svg className="h-8 w-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <p className="text-sm text-ink-300">Avatar stream standby</p>
                  <p className="mt-1 text-xs text-ink-400">LiveKit room ready · waiting for session</p>
                </div>
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="Stream Config" subtitle="LiveKit parameters">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-ink-300">Protocol</span>
                  <span className="num text-ink-100">WebRTC / LiveKit</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-ink-300">Voice</span>
                  <span className="num text-ink-100">ElevenLabs v3</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-ink-300">Avatar</span>
                  <span className="num text-ink-100">Stephanie v2.1</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-ink-300">Latency Target</span>
                  <span className="num text-emerald-300">&lt;200ms</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-ink-300">Region</span>
                  <span className="num text-ink-100">us-east-1</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-ink-300">Status</span>
                  <span className="pill-warn">standby</span>
                </li>
              </ul>
            </Panel>

            <Panel title="Voice Signature" subtitle="Anchored authentication">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center justify-between">
                  <span className="text-ink-300">Model</span>
                  <span className="num text-ink-100">stephanie-v3</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-ink-300">ASR</span>
                  <span className="num text-ink-100">nova-3</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-ink-300">Signature</span>
                  <span className="pill-ok">anchored</span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-ink-300">Lip Sync</span>
                  <span className="num text-ink-100">real-time</span>
                </li>
              </ul>
            </Panel>
          </div>
        </div>
      </main>
    </>
  );
}
