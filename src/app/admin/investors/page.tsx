import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';

export const dynamic = 'force-dynamic';

const INVESTORS = [
  { id: 'inv-1', name: 'Highland Holdings LLC', status: 'verified', kyc: 'approved', tokens: 12_500, wallet: '0x4a91...8c2f' },
  { id: 'inv-2', name: 'Coastline Capital', status: 'verified', kyc: 'approved', tokens: 25_000, wallet: '0x7b3e...1d4a' },
  { id: 'inv-3', name: 'Tannery Mills LP', status: 'verified', kyc: 'approved', tokens: 18_750, wallet: '0x9c5f...6e8b' },
  { id: 'inv-4', name: 'B. Whitcomb', status: 'pending', kyc: 'in_review', tokens: 0, wallet: null },
  { id: 'inv-5', name: 'Merrimack Valley Trust', status: 'verified', kyc: 'approved', tokens: 31_250, wallet: '0x2d7a...4f9c' },
];

export default function InvestorsPage() {
  return (
    <>
      <Topbar pageTitle="Investor Management" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="panel panel-pad">
            <div className="panel-subtitle">Total Investors</div>
            <div className="num mt-1 text-xl font-semibold text-ink-100">{INVESTORS.length}</div>
          </div>
          <div className="panel panel-pad">
            <div className="panel-subtitle">Verified</div>
            <div className="num mt-1 text-xl font-semibold text-emerald-300">
              {INVESTORS.filter((i) => i.status === 'verified').length}
            </div>
          </div>
          <div className="panel panel-pad">
            <div className="panel-subtitle">Pending KYC</div>
            <div className="num mt-1 text-xl font-semibold text-yellow-300">
              {INVESTORS.filter((i) => i.kyc === 'in_review').length}
            </div>
          </div>
          <div className="panel panel-pad">
            <div className="panel-subtitle">Tokens Issued</div>
            <div className="num mt-1 text-xl font-semibold text-violet-300">
              {INVESTORS.reduce((s, i) => s + i.tokens, 0).toLocaleString()}
            </div>
          </div>
        </section>

        <Panel title="Investor Registry" subtitle="Whitelist status · KYC · token holdings">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-ink-400">
                  <th className="px-3 py-2">Investor</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">KYC</th>
                  <th className="px-3 py-2">NBPT Tokens</th>
                  <th className="px-3 py-2">Wallet</th>
                </tr>
              </thead>
              <tbody>
                {INVESTORS.map((inv) => (
                  <tr key={inv.id} className="row-hover border-b border-ink-800">
                    <td className="px-3 py-2 font-medium text-ink-100">{inv.name}</td>
                    <td className="px-3 py-2">
                      <span className={inv.status === 'verified' ? 'pill-ok' : 'pill-warn'}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={inv.kyc === 'approved' ? 'pill-ok' : 'pill-warn'}>
                        {inv.kyc}
                      </span>
                    </td>
                    <td className="px-3 py-2 num">{inv.tokens.toLocaleString()}</td>
                    <td className="px-3 py-2 num text-ink-400">{inv.wallet ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </main>
    </>
  );
}
