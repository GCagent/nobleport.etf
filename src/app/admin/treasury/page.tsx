import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';

export const dynamic = 'force-dynamic';

const PENDING_APPROVALS = [
  { id: 'ta-1', type: 'Disbursement', amount: 84_500, recipient: 'Apex Electrical LLC', signers: '1/3', status: 'pending' },
  { id: 'ta-2', type: 'Disbursement', amount: 127_200, recipient: 'Northeast Concrete', signers: '2/3', status: 'ready' },
  { id: 'ta-3', type: 'Distribution', amount: 250_000, recipient: 'Investor Pool Q2', signers: '0/4', status: 'pending' },
  { id: 'ta-4', type: 'Transfer', amount: 50_000, recipient: 'Operating → Reserve', signers: '2/2', status: 'executed' },
];

const SAFE_CONFIG = {
  address: '0x7a4B...9f2E',
  network: 'Ethereum Mainnet',
  threshold: '3/5',
  balance: '$2,142,300',
  pendingTxs: 3,
};

export default function TreasuryPage() {
  return (
    <>
      <Topbar pageTitle="Treasury Controls" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel title="Safe Multisig" subtitle={`${SAFE_CONFIG.network} · ${SAFE_CONFIG.threshold} threshold`}>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-ink-300">Address</span>
                <span className="num text-ink-100">{SAFE_CONFIG.address}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-ink-300">Balance</span>
                <span className="num font-semibold text-emerald-300">{SAFE_CONFIG.balance}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-ink-300">Pending Txs</span>
                <span className="num text-yellow-300">{SAFE_CONFIG.pendingTxs}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-ink-300">Threshold</span>
                <span className="num text-ink-100">{SAFE_CONFIG.threshold}</span>
              </li>
            </ul>
          </Panel>

          <div className="xl:col-span-2">
            <Panel title="Pending Approvals" subtitle="HITL gate — requires human signature">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-ink-400">
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Recipient</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Signers</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PENDING_APPROVALS.map((tx) => (
                      <tr key={tx.id} className="row-hover border-b border-ink-800">
                        <td className="px-3 py-2 text-ink-200">{tx.type}</td>
                        <td className="px-3 py-2 font-medium text-ink-100">{tx.recipient}</td>
                        <td className="px-3 py-2 num">${tx.amount.toLocaleString()}</td>
                        <td className="px-3 py-2 num text-ink-300">{tx.signers}</td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              tx.status === 'executed'
                                ? 'pill-ok'
                                : tx.status === 'ready'
                                  ? 'pill-info'
                                  : 'pill-warn'
                            }
                          >
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </div>
      </main>
    </>
  );
}
