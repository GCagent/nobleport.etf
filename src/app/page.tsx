import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">
            Noble<span className="text-cyan-400">Port</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Blockchain-Enabled Real Estate ETF &middot; did:ens:nobleport.eth
          </p>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Designer App */}
          <Link
            href="/designer"
            className="group p-6 rounded-xl border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10 transition-all hover:shadow-lg hover:shadow-cyan-500/5"
          >
            <h2 className="text-xl font-bold text-cyan-400 mb-2 group-hover:text-cyan-300 transition-colors">
              Designer Studio
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Digital design tools for 20 architecture and built environment specialties.
              3D modeling, BIM, file sharing, and project management.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                20 Specialties
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                14 Tools
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300">
                3D / BIM
              </span>
            </div>
          </Link>

          {/* SSI Architecture */}
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60">
            <h2 className="text-xl font-bold text-slate-300 mb-2">SSI Architecture</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Self-Sovereign Identity infrastructure with ENS DID resolution
              for the NoblePort ecosystem.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                did:ens
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                ENS
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                Ethereum
              </span>
            </div>
          </div>

          {/* Stephanie.ai */}
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60">
            <h2 className="text-xl font-bold text-slate-300 mb-2">Stephanie.ai Hub</h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              AI orchestration network connecting 13 AI platforms via MCP protocol
              to NoblePort modules.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                13 AI Platforms
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                MCP
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                12 Modules
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/40 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-slate-600">
            NoblePort ETF &middot; nobleport.eth &middot; did:ens:nobleport.eth
          </p>
        </div>
      </footer>
    </div>
  );
}
