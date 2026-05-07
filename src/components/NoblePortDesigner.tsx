'use client';

import React, { useState, useMemo } from 'react';
import {
  DESIGN_SPECIALTIES,
  SPECIALTY_DOMAINS,
  ALL_TOOLS,
  TOOL_CATEGORIES,
  SAMPLE_PROJECTS,
  getToolsForSpecialty,
  getToolById,
  type DesignSpecialty,
  type DesignTool,
  type SpecialtyDomain,
  type ToolCategory,
} from '../lib/designerData';
import DesignerToolCatalog from './DesignerToolCatalog';
import DesignerWorkspace from './DesignerWorkspace';

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  blue:    { bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    badge: 'bg-blue-500/20 text-blue-300' },
  emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300' },
  amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400',   badge: 'bg-amber-500/20 text-amber-300' },
  pink:    { bg: 'bg-pink-500/10',    border: 'border-pink-500/30',    text: 'text-pink-400',    badge: 'bg-pink-500/20 text-pink-300' },
  cyan:    { bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-400',    badge: 'bg-cyan-500/20 text-cyan-300' },
  violet:  { bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  text: 'text-violet-400',  badge: 'bg-violet-500/20 text-violet-300' },
  rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400',    badge: 'bg-rose-500/20 text-rose-300' },
  green:   { bg: 'bg-green-500/10',   border: 'border-green-500/30',   text: 'text-green-400',   badge: 'bg-green-500/20 text-green-300' },
  teal:    { bg: 'bg-teal-500/10',    border: 'border-teal-500/30',    text: 'text-teal-400',    badge: 'bg-teal-500/20 text-teal-300' },
  orange:  { bg: 'bg-orange-500/10',  border: 'border-orange-500/30',  text: 'text-orange-400',  badge: 'bg-orange-500/20 text-orange-300' },
  yellow:  { bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30',  text: 'text-yellow-400',  badge: 'bg-yellow-500/20 text-yellow-300' },
  purple:  { bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  text: 'text-purple-400',  badge: 'bg-purple-500/20 text-purple-300' },
  indigo:  { bg: 'bg-indigo-500/10',  border: 'border-indigo-500/30',  text: 'text-indigo-400',  badge: 'bg-indigo-500/20 text-indigo-300' },
  fuchsia: { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/30', text: 'text-fuchsia-400', badge: 'bg-fuchsia-500/20 text-fuchsia-300' },
  lime:    { bg: 'bg-lime-500/10',    border: 'border-lime-500/30',    text: 'text-lime-400',    badge: 'bg-lime-500/20 text-lime-300' },
  sky:     { bg: 'bg-sky-500/10',     border: 'border-sky-500/30',     text: 'text-sky-400',     badge: 'bg-sky-500/20 text-sky-300' },
  slate:   { bg: 'bg-slate-500/10',   border: 'border-slate-500/30',   text: 'text-slate-400',   badge: 'bg-slate-500/20 text-slate-300' },
  zinc:    { bg: 'bg-zinc-500/10',    border: 'border-zinc-500/30',    text: 'text-zinc-400',    badge: 'bg-zinc-500/20 text-zinc-300' },
};

function getColors(color: string) {
  return COLOR_MAP[color] || COLOR_MAP.blue;
}

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const colorMap: Record<string, string> = {
    concept: 'bg-slate-400',
    schematic: 'bg-blue-400',
    development: 'bg-amber-400',
    documentation: 'bg-purple-400',
    construction: 'bg-orange-400',
    completed: 'bg-emerald-400',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colorMap[status] || 'bg-gray-400'}`} />;
};

const PricingBadge: React.FC<{ pricing: DesignTool['pricing'] }> = ({ pricing }) => {
  const styles: Record<string, string> = {
    free: 'bg-emerald-500/20 text-emerald-300',
    freemium: 'bg-blue-500/20 text-blue-300',
    paid: 'bg-amber-500/20 text-amber-300',
    enterprise: 'bg-purple-500/20 text-purple-300',
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full font-medium ${styles[pricing]}`}>
      {pricing}
    </span>
  );
};

// ============================================================================
// SPECIALTY CARD
// ============================================================================

const SpecialtyCard: React.FC<{
  specialty: DesignSpecialty;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ specialty, isSelected, onSelect }) => {
  const colors = getColors(specialty.color);
  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 ${colors.bg} ${colors.border} ${
        isSelected
          ? 'ring-2 ring-white/30 shadow-lg shadow-white/5 scale-[1.02]'
          : 'hover:scale-[1.01] hover:shadow-md hover:shadow-white/5'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className={`font-semibold text-sm ${colors.text}`}>{specialty.name}</h3>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">
          {SPECIALTY_DOMAINS[specialty.domain]?.label}
        </span>
      </div>
      <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-2">
        {specialty.description}
      </p>
      <div className="flex flex-wrap gap-1">
        {specialty.primaryTools.slice(0, 3).map((toolId) => {
          const tool = getToolById(toolId);
          return tool ? (
            <span key={toolId} className={`text-[10px] px-2 py-0.5 rounded-full ${colors.badge}`}>
              {tool.name.split(' ')[0]}
            </span>
          ) : null;
        })}
        {specialty.primaryTools.length + specialty.secondaryTools.length > 3 && (
          <span className="text-[10px] text-slate-500">
            +{specialty.primaryTools.length + specialty.secondaryTools.length - 3} tools
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SPECIALTY DETAIL PANEL
// ============================================================================

const SpecialtyDetail: React.FC<{ specialty: DesignSpecialty }> = ({ specialty }) => {
  const colors = getColors(specialty.color);
  const { primary, secondary } = getToolsForSpecialty(specialty.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className={`text-xl font-bold ${colors.text}`}>{specialty.name}</h2>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-medium px-2 py-0.5 bg-slate-800 rounded-full">
            {SPECIALTY_DOMAINS[specialty.domain]?.label}
          </span>
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">{specialty.description}</p>
      </div>

      {/* Primary Tools */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3">Primary Tools</h3>
        <div className="space-y-2">
          {primary.map((tool) => (
            <div key={tool.id} className={`p-3 rounded-lg border ${colors.bg} ${colors.border}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white">{tool.name}</span>
                <PricingBadge pricing={tool.pricing} />
              </div>
              <p className="text-[11px] text-slate-400">{tool.vendor}</p>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                {TOOL_CATEGORIES[tool.category].label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary Tools */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3">Secondary Tools</h3>
        <div className="flex flex-wrap gap-2">
          {secondary.map((tool) => (
            <span
              key={tool.id}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300"
            >
              {tool.name}
            </span>
          ))}
        </div>
      </div>

      {/* Deliverables */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3">Deliverables</h3>
        <div className="grid grid-cols-2 gap-2">
          {specialty.deliverables.map((d) => (
            <div key={d} className="flex items-center gap-2 text-xs text-slate-300">
              <span className={`w-1 h-1 rounded-full ${colors.text.replace('text-', 'bg-')}`} />
              {d}
            </div>
          ))}
        </div>
      </div>

      {/* Typical Projects */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3">Typical Projects</h3>
        <div className="flex flex-wrap gap-2">
          {specialty.typicalProjects.map((p) => (
            <span key={p} className="text-[11px] px-2 py-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// DASHBOARD TAB
// ============================================================================

const DashboardTab: React.FC = () => {
  const modelingCount = ALL_TOOLS.filter((t) => t.category === 'modeling').length;
  const fileSharingCount = ALL_TOOLS.filter((t) => t.category === 'fileSharing').length;
  const appServicesCount = ALL_TOOLS.filter((t) => t.category === 'appServices').length;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Specialties</p>
          <p className="text-3xl font-bold text-white mt-1">{DESIGN_SPECIALTIES.length}</p>
          <p className="text-xs text-slate-400 mt-1">across {Object.keys(SPECIALTY_DOMAINS).length} domains</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Digital Tools</p>
          <p className="text-3xl font-bold text-white mt-1">{ALL_TOOLS.length}</p>
          <p className="text-xs text-slate-400 mt-1">across 3 categories</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Active Projects</p>
          <p className="text-3xl font-bold text-white mt-1">{SAMPLE_PROJECTS.length}</p>
          <p className="text-xs text-slate-400 mt-1">in progress</p>
        </div>
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">ENS Identity</p>
          <p className="text-lg font-mono text-cyan-400 mt-2">designer.nobleport.eth</p>
        </div>
      </div>

      {/* Tool Categories Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-cyan-500/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-cyan-400">3D Modeling & BIM</h3>
            <span className="text-xs text-slate-500">{modelingCount} tools</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {TOOL_CATEGORIES.modeling.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ALL_TOOLS.filter((t) => t.category === 'modeling').map((t) => (
              <span key={t.id} className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                {t.name.split(' /')[0].split(' +')[0]}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-violet-500/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-violet-400">File Sharing & Big Data</h3>
            <span className="text-xs text-slate-500">{fileSharingCount} tools</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {TOOL_CATEGORIES.fileSharing.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ALL_TOOLS.filter((t) => t.category === 'fileSharing').map((t) => (
              <span key={t.id} className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
                {t.name.split(' /')[0].split(' (')[0]}
              </span>
            ))}
          </div>
        </div>

        <div className="bg-slate-900/60 border border-amber-500/20 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-amber-400">App Services</h3>
            <span className="text-xs text-slate-500">{appServicesCount} tools</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            {TOOL_CATEGORIES.appServices.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ALL_TOOLS.filter((t) => t.category === 'appServices').map((t) => (
              <span key={t.id} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {t.name.split(' /')[0].split(' (')[0]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Domain Overview */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Specialties by Domain</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.entries(SPECIALTY_DOMAINS) as [SpecialtyDomain, { label: string; count: number }][]).map(
            ([domain, info]) => (
              <div key={domain} className="bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-500 uppercase tracking-wider">{info.label}</p>
                <p className="text-lg font-bold text-white">{info.count}</p>
                <p className="text-[10px] text-slate-500">
                  {DESIGN_SPECIALTIES.filter((s) => s.domain === domain)
                    .map((s) => s.name.split(' ')[0])
                    .join(', ')}
                </p>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Active Projects */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Active Projects</h3>
        <div className="space-y-3">
          {SAMPLE_PROJECTS.map((project) => {
            const specialty = DESIGN_SPECIALTIES.find((s) => s.id === project.specialty);
            return (
              <div key={project.id} className="flex items-center gap-4 bg-slate-800/50 rounded-lg p-3">
                <StatusDot status={project.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{project.name}</p>
                  <p className="text-[11px] text-slate-400">{specialty?.name || project.specialty}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 px-2 py-0.5 bg-slate-700 rounded-full whitespace-nowrap">
                  {project.status}
                </span>
                <div className="hidden md:flex gap-1">
                  {project.tools.slice(0, 3).map((toolId) => {
                    const tool = getToolById(toolId);
                    return tool ? (
                      <span key={toolId} className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                        {tool.name.split(' ')[0]}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SPECIALTIES TAB
// ============================================================================

const SpecialtiesTab: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState<SpecialtyDomain | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSpecialties = useMemo(() => {
    return DESIGN_SPECIALTIES.filter((s) => {
      if (domainFilter !== 'all' && s.domain !== domainFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.typicalProjects.some((p) => p.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [domainFilter, searchQuery]);

  const selectedSpecialty = selectedId ? DESIGN_SPECIALTIES.find((s) => s.id === selectedId) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: Specialty List */}
      <div className="lg:col-span-2 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search specialties..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setDomainFilter('all')}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                domainFilter === 'all'
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'text-slate-400 border border-slate-700 hover:bg-slate-800'
              }`}
            >
              All ({DESIGN_SPECIALTIES.length})
            </button>
            {(Object.entries(SPECIALTY_DOMAINS) as [SpecialtyDomain, { label: string; count: number }][]).map(
              ([domain, info]) => (
                <button
                  key={domain}
                  onClick={() => setDomainFilter(domain)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                    domainFilter === domain
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-slate-400 border border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {info.label} ({info.count})
                </button>
              ),
            )}
          </div>
        </div>

        {/* Specialty Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredSpecialties.map((specialty) => (
            <SpecialtyCard
              key={specialty.id}
              specialty={specialty}
              isSelected={selectedId === specialty.id}
              onSelect={() => setSelectedId(selectedId === specialty.id ? null : specialty.id)}
            />
          ))}
        </div>

        {filteredSpecialties.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <p className="text-sm">No specialties match your search.</p>
          </div>
        )}
      </div>

      {/* Right: Detail Panel */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 h-fit lg:sticky lg:top-6">
        <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-4">Specialty Details</h3>
        {selectedSpecialty ? (
          <SpecialtyDetail specialty={selectedSpecialty} />
        ) : (
          <div className="text-center py-12">
            <p className="text-sm text-slate-500">Select a specialty to view details</p>
            <p className="text-xs text-slate-600 mt-2">
              Browse {DESIGN_SPECIALTIES.length} design specialties across {Object.keys(SPECIALTY_DOMAINS).length} domains
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

type AppTab = 'dashboard' | 'specialties' | 'tools' | 'workspace';

const NoblePortDesigner: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');

  const tabs: { id: AppTab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'specialties', label: 'Specialties' },
    { id: 'tools', label: 'Tool Catalog' },
    { id: 'workspace', label: 'Workspace' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                NoblePort <span className="text-cyan-400">Designer</span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Digital Design Studio for Architecture & Built Environment
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:block text-right">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">ENS Identity</p>
                <p className="text-sm font-mono text-cyan-400">designer.nobleport.eth</p>
              </div>
              <div className="hidden md:block text-right">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">DID</p>
                <p className="text-sm font-mono text-slate-400">did:ens:designer.nobleport.eth</p>
              </div>
              <span className="px-2 py-0.5 text-xs rounded-full border bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                active
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-slate-900/40 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-medium transition-all border-b-2 ${
                  activeTab === tab.id
                    ? 'text-cyan-400 border-cyan-400 bg-cyan-500/5'
                    : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'specialties' && <SpecialtiesTab />}
        {activeTab === 'tools' && <DesignerToolCatalog />}
        {activeTab === 'workspace' && <DesignerWorkspace />}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900/40 border-t border-slate-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <p className="text-sm text-slate-400">
                NoblePort Designer — Digital Design Studio for the Built Environment
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {DESIGN_SPECIALTIES.length} Specialties &middot; {ALL_TOOLS.length} Tools &middot; ENS Identity &middot; did:ens
              </p>
            </div>
            <div className="flex gap-4 text-xs text-slate-500">
              <span className="font-mono">designer.nobleport.eth</span>
              <span>&middot;</span>
              <span className="font-mono">nobleport.eth</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default NoblePortDesigner;
