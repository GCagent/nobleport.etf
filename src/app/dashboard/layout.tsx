import { Sidebar } from '@/components/dashboard/Sidebar';
import { AIGuardrailsBanner } from '@/components/AIGuardrailsBanner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="px-4 pt-3 sm:px-6">
          <AIGuardrailsBanner surface="NoblePort Mission Control" compact />
        </div>
        {children}
      </div>
    </div>
  );
}
