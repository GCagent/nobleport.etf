import { Topbar } from '@/components/dashboard/Topbar';
import {
  ModulesPanel,
  NetworksPanel,
  SessionPanel,
  TreasuryPanel,
} from '@/components/wallet/WalletPanels';

export const dynamic = 'force-dynamic';

export default function WalletPage() {
  return (
    <>
      <Topbar pageTitle="Wallet" />
      <main className="flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SessionPanel />
          <TreasuryPanel />
          <NetworksPanel />
          <ModulesPanel />
        </div>
      </main>
    </>
  );
}
