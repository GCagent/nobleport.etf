import { Topbar } from '@/components/dashboard/Topbar';
import { OrchestrasBoard } from '@/components/dashboard/OrchestrasBoard';
import { fetchScores } from '@/lib/orchestras/api';

export const dynamic = 'force-dynamic';

export default async function OrchestrasPage() {
  const scores = await fetchScores();

  return (
    <>
      <Topbar pageTitle="Stephanie Orchestras" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="panel panel-pad">
          <h2 className="panel-title">Conduct the mesh</h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-300">
            A <span className="text-ink-100">score</span> is a named, multi-step workflow Stephanie
            conducts across the agent mesh — each <span className="text-ink-100">movement</span> is
            routed to one agent section and recorded in the audit trail. Stephanie is advisory: any
            movement that maps to a frozen command (payment release, permit submission, contract
            execution) is <span className="text-yellow-300">staged for human approval</span>, never
            executed.
          </p>
        </section>

        <OrchestrasBoard scores={scores} />
      </main>
    </>
  );
}
