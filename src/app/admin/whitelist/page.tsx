import { Topbar } from '@/components/dashboard/Topbar';
import { Panel } from '@/components/dashboard/Panel';

export const dynamic = 'force-dynamic';

const WHITELIST_ENTRIES = [
  { address: '0x4a91...8c2f', entity: 'Highland Holdings LLC', credential: 'ACCREDITED_INVESTOR', added: '2026-03-12', transfersAllowed: true },
  { address: '0x7b3e...1d4a', entity: 'Coastline Capital', credential: 'ACCREDITED_INVESTOR', added: '2026-02-28', transfersAllowed: true },
  { address: '0x9c5f...6e8b', entity: 'Tannery Mills LP', credential: 'ACCREDITED_INVESTOR', added: '2026-04-05', transfersAllowed: true },
  { address: '0x2d7a...4f9c', entity: 'Merrimack Valley Trust', credential: 'QUALIFIED_PURCHASER', added: '2026-01-15', transfersAllowed: true },
  { address: '0xb72c...3a1d', entity: '(blocked)', credential: 'NONE', added: '—', transfersAllowed: false },
];

export default function WhitelistPage() {
  return (
    <>
      <Topbar pageTitle="Whitelist Administration" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <Panel
          title="Transfer Hook Whitelist"
          subtitle="Solana Token-2022 · addresses authorized for NBPT transfers"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700 text-left text-xs uppercase tracking-wider text-ink-400">
                  <th className="px-3 py-2">Address</th>
                  <th className="px-3 py-2">Entity</th>
                  <th className="px-3 py-2">Credential</th>
                  <th className="px-3 py-2">Added</th>
                  <th className="px-3 py-2">Transfers</th>
                </tr>
              </thead>
              <tbody>
                {WHITELIST_ENTRIES.map((entry) => (
                  <tr key={entry.address} className="row-hover border-b border-ink-800">
                    <td className="px-3 py-2 num text-ink-200">{entry.address}</td>
                    <td className="px-3 py-2 font-medium text-ink-100">{entry.entity}</td>
                    <td className="px-3 py-2">
                      <span className={entry.credential === 'NONE' ? 'pill-err' : 'pill-ai'}>
                        {entry.credential}
                      </span>
                    </td>
                    <td className="px-3 py-2 num text-ink-300">{entry.added}</td>
                    <td className="px-3 py-2">
                      <span className={entry.transfersAllowed ? 'pill-ok' : 'pill-err'}>
                        {entry.transfersAllowed ? 'allowed' : 'blocked'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Transfer Hook Config" subtitle="On-chain enforcement parameters">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-ink-300">Program</span>
              <span className="num text-ink-100">Solana Token-2022 Transfer Hook</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-ink-300">Network</span>
              <span className="num text-ink-100">Mainnet-Beta</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-ink-300">Token Mint</span>
              <span className="num text-ink-200">NBPT...xxxx</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-ink-300">Total Supply</span>
              <span className="num font-semibold text-violet-300">100,000,000</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-ink-300">Whitelisted Addresses</span>
              <span className="num text-emerald-300">{WHITELIST_ENTRIES.filter((e) => e.transfersAllowed).length}</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-ink-300">Blocked Addresses</span>
              <span className="num text-red-300">{WHITELIST_ENTRIES.filter((e) => !e.transfersAllowed).length}</span>
            </li>
          </ul>
        </Panel>
      </main>
    </>
  );
}
