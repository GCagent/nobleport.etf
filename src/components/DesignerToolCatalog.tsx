'use client';

import React, { useState, useMemo } from 'react';
import {
  ALL_TOOLS,
  TOOL_CATEGORIES,
  DESIGN_SPECIALTIES,
  type DesignTool,
  type ToolCategory,
} from '../lib/designerData';

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const CATEGORY_COLORS: Record<ToolCategory, { accent: string; bg: string; border: string; badge: string }> = {
  modeling: {
    accent: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    badge: 'bg-cyan-500/20 text-cyan-300',
  },
  fileSharing: {
    accent: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/30',
    badge: 'bg-violet-500/20 text-violet-300',
  },
  appServices: {
    accent: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    badge: 'bg-amber-500/20 text-amber-300',
  },
};

const PricingBadge: React.FC<{ pricing: DesignTool['pricing'] }> = ({ pricing }) => {
  const styles: Record<string, string> = {
    free: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    freemium: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    paid: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    enterprise: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  };
  return (
    <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full font-medium border ${styles[pricing]}`}>
      {pricing}
    </span>
  );
};

const PlatformPills: React.FC<{ platforms: DesignTool['platforms'] }> = ({ platforms }) => (
  <div className="flex flex-wrap gap-1">
    {platforms.map((p) => (
      <span key={p} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
        {p}
      </span>
    ))}
  </div>
);

// ============================================================================
// TOOL CARD (expanded)
// ============================================================================

const ToolCard: React.FC<{
  tool: DesignTool;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ tool, isExpanded, onToggle }) => {
  const catColors = CATEGORY_COLORS[tool.category];

  const usedBySpecialties = DESIGN_SPECIALTIES.filter(
    (s) => s.primaryTools.includes(tool.id) || s.secondaryTools.includes(tool.id),
  );

  const primaryUseCount = DESIGN_SPECIALTIES.filter((s) => s.primaryTools.includes(tool.id)).length;

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${catColors.bg} ${catColors.border} ${
        isExpanded ? 'ring-1 ring-white/10' : ''
      }`}
    >
      {/* Header (always visible) */}
      <div
        onClick={onToggle}
        className="p-4 cursor-pointer"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h3 className={`font-semibold text-sm ${catColors.accent}`}>{tool.name}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">{tool.vendor}</p>
          </div>
          <div className="flex items-center gap-2">
            <PricingBadge pricing={tool.pricing} />
            <span className="text-slate-500 text-xs">{isExpanded ? '\u25B2' : '\u25BC'}</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{tool.description}</p>
        <div className="flex items-center justify-between mt-3">
          <div className="flex flex-wrap gap-1">
            {tool.tags.slice(0, 4).map((tag) => (
              <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full ${catColors.badge}`}>
                {tag}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-slate-500">
            Used by {usedBySpecialties.length} specialties ({primaryUseCount} primary)
          </span>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50 pt-4 space-y-4">
          {/* Description (full) */}
          <p className="text-xs text-slate-300 leading-relaxed">{tool.description}</p>

          {/* Key Features */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-2">Key Features</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {tool.keyFeatures.map((feature) => (
                <div key={feature} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className={`w-1 h-1 rounded-full mt-1.5 flex-shrink-0 ${catColors.accent.replace('text-', 'bg-')}`} />
                  {feature}
                </div>
              ))}
            </div>
          </div>

          {/* File Formats */}
          {tool.fileFormats && tool.fileFormats.length > 0 && (
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-2">File Formats</h4>
              <div className="flex flex-wrap gap-1.5">
                {tool.fileFormats.map((fmt) => (
                  <span key={fmt} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {fmt}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Platforms */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-2">Platforms</h4>
            <PlatformPills platforms={tool.platforms} />
          </div>

          {/* Used by Specialties */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-2">
              Used by Specialties ({usedBySpecialties.length})
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {usedBySpecialties.map((spec) => {
                const isPrimary = spec.primaryTools.includes(tool.id);
                return (
                  <span
                    key={spec.id}
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                      isPrimary
                        ? 'bg-white/10 text-white border-white/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {spec.name}
                    {isPrimary && <span className="ml-1 text-cyan-400">*</span>}
                  </span>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-600 mt-1">* = primary tool</p>
          </div>

          {/* Tags */}
          <div>
            <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-medium mb-2">Tags</h4>
            <div className="flex flex-wrap gap-1.5">
              {tool.tags.map((tag) => (
                <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full ${catColors.badge}`}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const DesignerToolCatalog: React.FC = () => {
  const [categoryFilter, setCategoryFilter] = useState<ToolCategory | 'all'>('all');
  const [pricingFilter, setPricingFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTool, setExpandedTool] = useState<string | null>(null);

  const filteredTools = useMemo(() => {
    return ALL_TOOLS.filter((tool) => {
      if (categoryFilter !== 'all' && tool.category !== categoryFilter) return false;
      if (pricingFilter !== 'all' && tool.pricing !== pricingFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          tool.name.toLowerCase().includes(q) ||
          tool.vendor.toLowerCase().includes(q) ||
          tool.description.toLowerCase().includes(q) ||
          tool.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [categoryFilter, pricingFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(Object.entries(TOOL_CATEGORIES) as [ToolCategory, typeof TOOL_CATEGORIES[ToolCategory]][]).map(
          ([catKey, cat]) => {
            const catColors = CATEGORY_COLORS[catKey];
            const toolCount = ALL_TOOLS.filter((t) => t.category === catKey).length;
            const isActive = categoryFilter === catKey;
            return (
              <button
                key={catKey}
                onClick={() => setCategoryFilter(isActive ? 'all' : catKey)}
                className={`text-left p-4 rounded-xl border transition-all ${catColors.bg} ${catColors.border} ${
                  isActive ? 'ring-2 ring-white/20 scale-[1.02]' : 'hover:scale-[1.01]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className={`text-sm font-semibold ${catColors.accent}`}>{cat.label}</h3>
                  <span className="text-xs text-slate-500">{toolCount} tools</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{cat.description}</p>
              </button>
            );
          },
        )}
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Search tools by name, vendor, or tag..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <div className="flex gap-1.5">
          {['all', 'free', 'freemium', 'paid', 'enterprise'].map((pricing) => (
            <button
              key={pricing}
              onClick={() => setPricingFilter(pricing)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors capitalize ${
                pricingFilter === pricing
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'text-slate-400 border border-slate-700 hover:bg-slate-800'
              }`}
            >
              {pricing}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Showing {filteredTools.length} of {ALL_TOOLS.length} tools
          {categoryFilter !== 'all' && ` in ${TOOL_CATEGORIES[categoryFilter].label}`}
        </p>
        {(categoryFilter !== 'all' || pricingFilter !== 'all' || searchQuery) && (
          <button
            onClick={() => {
              setCategoryFilter('all');
              setPricingFilter('all');
              setSearchQuery('');
            }}
            className="text-xs text-cyan-400 hover:text-cyan-300"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Tool Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTools.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            isExpanded={expandedTool === tool.id}
            onToggle={() => setExpandedTool(expandedTool === tool.id ? null : tool.id)}
          />
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p className="text-sm">No tools match your filters.</p>
        </div>
      )}

      {/* Legend */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
        <h4 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3">Category Legend</h4>
        <div className="flex flex-wrap gap-4">
          {(Object.entries(TOOL_CATEGORIES) as [ToolCategory, typeof TOOL_CATEGORIES[ToolCategory]][]).map(
            ([catKey, cat]) => {
              const catColors = CATEGORY_COLORS[catKey];
              return (
                <div key={catKey} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded ${catColors.bg} border ${catColors.border}`} />
                  <span className="text-xs text-slate-400">{cat.label}</span>
                </div>
              );
            },
          )}
          <div className="border-l border-slate-700 pl-4 flex flex-wrap gap-3">
            {['free', 'freemium', 'paid', 'enterprise'].map((p) => (
              <div key={p} className="flex items-center gap-1.5">
                <PricingBadge pricing={p as DesignTool['pricing']} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DesignerToolCatalog;
