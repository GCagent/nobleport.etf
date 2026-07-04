import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <>
      <Topbar pageTitle="Settings" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="Operators" subtitle="role · scope · MFA">
            <ul className="divide-y divide-ink-700 text-sm">
              <Op
                name="m.velasquez"
                role="Operator (Owner)"
                scope="full · multi-sig 1/3"
                mfa
              />
              <Op name="d.iyer" role="PM" scope="jobs · permits" mfa />
              <Op name="a.park" role="PM" scope="jobs · permits" mfa />
              <Op name="ar.collector" role="Service" scope="invoices · outreach" />
              <Op
                name="dao.governor"
                role="DAO (4/7)"
                scope="treasury · gp-floor override"
              />
            </ul>
          </Panel>

          <Panel title="Integrations" subtitle="data sources powering this dashboard">
            <ul className="space-y-2 text-sm">
              <Integration name="ERPNext" status="connected" detail="GL · costing · GP" />
              <Integration name="Stripe" status="connected" detail="deposits · settlements" />
              <Integration name="QuickBooks" status="connected" detail="AR · payables" />
              <Integration name="GCagent" status="connected" detail="construction ops" />
              <Integration name="PermitStream" status="connected" detail="AHJ workflows" />
              <Integration name="Cyborg.ai" status="connected" detail="policy · audit" />
              <Integration name="Stephanie.ai" status="connected" detail="LiveKit + ElevenLabs" />
              <Integration name="Arbitrum anchor" status="connected" detail="audit anchoring" />
              <Integration name="IPFS" status="degraded" detail="document pinning" />
            </ul>
          </Panel>

          <Panel title="API Surface" subtitle="reads served by FastAPI gateway">
            <ul className="space-y-1 font-mono text-[12px] text-ink-300">
              <li>GET /v1/dashboard/overview</li>
              <li>GET /v1/dashboard/revenue/pipeline</li>
              <li>GET /v1/dashboard/revenue/cash</li>
              <li>GET /v1/dashboard/revenue/deals?status=stale</li>
              <li>GET /v1/dashboard/revenue/invoices</li>
              <li>GET /v1/dashboard/jobs</li>
              <li>GET /v1/dashboard/permits</li>
              <li>GET /v1/dashboard/permits/forecast</li>
              <li>GET /v1/dashboard/agents</li>
              <li>GET /v1/dashboard/compliance/alerts</li>
              <li>GET /v1/dashboard/compliance/kill-switches</li>
              <li>GET /v1/dashboard/audit?cursor=&limit=</li>
              <li>WS&nbsp; /v1/voice/session/{'{sessionId}'}</li>
            </ul>
            <p className="mt-3 text-[11px] text-ink-400">
              Set <span className="num text-ink-200">NEXT_PUBLIC_DASHBOARD_API_BASE</span> to the
              gateway URL and the dashboard reads will switch from local fixtures to live data
              without UI changes.
            </p>
          </Panel>

          <Panel title="Webhooks & Realtime" subtitle="push surfaces to the dashboard">
            <ul className="space-y-2 text-sm text-ink-200">
              <li>• Stripe → /webhooks/stripe (deposits / settlements)</li>
              <li>• QuickBooks → /webhooks/qb (invoice state)</li>
              <li>• GCagent → /webhooks/gc (job state · milestone · RFI)</li>
              <li>• PermitStream → /webhooks/permit (AHJ status changes)</li>
              <li>• Cyborg.ai → /webhooks/policy (alerts · kill-switch)</li>
              <li>• Audit chain → SSE /v1/audit/stream</li>
              <li>• Voice → WebSocket /v1/voice/session/{'{sessionId}'}</li>
            </ul>
          </Panel>

          <Panel title="Environment" subtitle="runtime configuration">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Env k="ENV" v="production" />
              <Env k="REGION" v="hetzner-fsn1" />
              <Env k="EDGE" v="cloudflare" />
              <Env k="ORCHESTRATOR" v="langgraph + temporal" />
              <Env k="DB" v="postgres-15 · pgvector" />
              <Env k="QUEUE" v="redis-streams + celery" />
              <Env k="ANCHOR" v="arbitrum-one · 30m batch" />
              <Env k="OBSERVABILITY" v="otel + grafana" />
            </dl>
          </Panel>

          <Panel title="Roadmap" subtitle="MVP phases">
            <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-200">
              <li>
                <span className="font-semibold text-ink-100">Phase 1</span> — auth · revenue
                warboard · job pipeline · AI health <span className="pill-ok">live</span>
              </li>
              <li>
                <span className="font-semibold text-ink-100">Phase 2</span> — Stephanie avatar ·
                permit workflows · websocket live feeds <span className="pill-info">in flight</span>
              </li>
              <li>
                <span className="font-semibold text-ink-100">Phase 3</span> — DAO governance ·
                municipal APIs · AI automation controls <span className="pill-mute">queued</span>
              </li>
            </ol>
          </Panel>
        </div>
      </main>
    </>
  );
}

function Op({
  name,
  role,
  scope,
  mfa,
}: {
  name: string;
  role: string;
  scope: string;
  mfa?: boolean;
}) {
  return (
    <li className="flex items-center justify-between py-2">
      <div>
        <div className="num font-medium text-ink-100">{name}</div>
        <div className="text-[11px] text-ink-400">
          {role} · {scope}
        </div>
      </div>
      <span className={mfa ? 'pill-ok' : 'pill-warn'}>{mfa ? 'MFA' : 'no MFA'}</span>
    </li>
  );
}

function Integration({
  name,
  status,
  detail,
}: {
  name: string;
  status: 'connected' | 'degraded' | 'down';
  detail: string;
}) {
  const cls = status === 'connected' ? 'pill-ok' : status === 'degraded' ? 'pill-warn' : 'pill-err';
  return (
    <li className="flex items-center justify-between rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2">
      <div>
        <div className="font-medium text-ink-100">{name}</div>
        <div className="text-[11px] text-ink-400">{detail}</div>
      </div>
      <span className={cls}>{status}</span>
    </li>
  );
}

function Env({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-900/50 px-3 py-2">
      <dt className="panel-subtitle">{k}</dt>
      <dd className="num text-ink-100">{v}</dd>
    </div>
  );
}
