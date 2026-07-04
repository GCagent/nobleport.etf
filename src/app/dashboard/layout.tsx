import { Sidebar } from '@/components/dashboard/Sidebar';
import { WalletProvider } from '@/components/wallet/WalletProvider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </WalletProvider>
  );
}
