'use client';

import React, { useState } from 'react';
import {
  SAMPLE_PROJECTS,
  DESIGN_SPECIALTIES,
  ALL_TOOLS,
  getToolById,
  getSpecialtyById,
  type DesignerProject,
  type DesignSpecialty,
} from '../lib/designerData';

// ============================================================================
// TYPES
// ============================================================================

type ProjectStatus = DesignerProject['status'];

const STATUS_CONFIG: Record<ProjectStatus, { label: string; color: string; dotColor: string; order: number }> = {
  concept:       { label: 'Concept',       color: 'bg-slate-500/20 text-slate-300 border-slate-500/30',   dotColor: 'bg-slate-400',   order: 0 },
  schematic:     { label: 'Schematic',     color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',      dotColor: 'bg-blue-400',    order: 1 },
  development:   { label: 'Development',   color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',   dotColor: 'bg-amber-400',   order: 2 },
  documentation: { label: 'Documentation', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30', dotColor: 'bg-purple-400',  order: 3 },
  construction:  { label: 'Construction',  color: 'bg-orange-500/20 text-orange-300 border-orange-500/30', dotColor: 'bg-orange-400',  order: 4 },
  completed:     { label: 'Completed',     color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dotColor: 'bg-emerald-400', order: 5 },
};

const PHASES: ProjectStatus[] = ['concept', 'schematic', 'development', 'documentation', 'construction', 'completed'];

// ============================================================================
// PROJECT CARD
// ============================================================================

const ProjectCard: React.FC<{
  project: DesignerProject;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ project, isSelected, onSelect }) => {
  const statusConf = STATUS_CONFIG[project.status];
  const specialty = getSpecialtyById(project.specialty);

  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 bg-slate-900/60 ${
        isSelected
          ? 'border-cyan-500/50 ring-1 ring-cyan-500/20 shadow-lg shadow-cyan-500/5'
          : 'border-slate-800 hover:border-slate-700 hover:shadow-md'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-sm text-white">{project.name}</h3>
        <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full border ${statusConf.color}`}>
          {statusConf.label}
        </span>
      </div>

      {specialty && (
        <p className="text-[11px] text-slate-500 mb-2">{specialty.name}</p>
      )}

      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-3">
        {project.description}
      </p>

      {/* Tools in use */}
      <div className="flex flex-wrap gap-1 mb-3">
        {project.tools.map((toolId) => {
          const tool = getToolById(toolId);
          return tool ? (
            <span key={toolId} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              {tool.name.split(' ')[0]}
            </span>
          ) : null;
        })}
      </div>

      {/* Timeline */}
      <div className="flex items-center justify-between text-[10px] text-slate-600">
        <span>Created {project.createdAt}</span>
        <span>Updated {project.updatedAt}</span>
      </div>
    </div>
  );
};

// ============================================================================
// PROJECT DETAIL
// ============================================================================

const ProjectDetail: React.FC<{ project: DesignerProject }> = ({ project }) => {
  const specialty = getSpecialtyById(project.specialty);
  const statusConf = STATUS_CONFIG[project.status];
  const currentPhaseIndex = PHASES.indexOf(project.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-lg font-bold text-white">{project.name}</h2>
          <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-full border ${statusConf.color}`}>
            {statusConf.label}
          </span>
        </div>
        {specialty && (
          <p className="text-xs text-slate-400">{specialty.name}</p>
        )}
        <p className="text-sm text-slate-300 mt-2 leading-relaxed">{project.description}</p>
      </div>

      {/* Phase Timeline */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3">Project Phase</h3>
        <div className="flex items-center gap-1">
          {PHASES.map((phase, idx) => {
            const phaseConf = STATUS_CONFIG[phase];
            const isActive = idx === currentPhaseIndex;
            const isCompleted = idx < currentPhaseIndex;
            return (
              <React.Fragment key={phase}>
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-full h-2 rounded-full ${
                      isCompleted
                        ? 'bg-emerald-500'
                        : isActive
                        ? phaseConf.dotColor
                        : 'bg-slate-700'
                    }`}
                  />
                  <span className={`text-[9px] mt-1 ${isActive ? 'text-white font-medium' : 'text-slate-600'}`}>
                    {phaseConf.label}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Active Tools */}
      <div>
        <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3">Active Tools</h3>
        <div className="space-y-2">
          {project.tools.map((toolId) => {
            const tool = getToolById(toolId);
            if (!tool) return null;
            return (
              <div key={toolId} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div>
                  <p className="text-sm font-medium text-white">{tool.name}</p>
                  <p className="text-[10px] text-slate-500">{tool.vendor}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  tool.category === 'modeling'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : tool.category === 'fileSharing'
                    ? 'bg-violet-500/20 text-violet-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {tool.category === 'modeling' ? '3D/BIM' : tool.category === 'fileSharing' ? 'Files' : 'App'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Specialty Info */}
      {specialty && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3">Specialty Profile</h3>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 space-y-3">
            <div>
              <p className="text-xs text-slate-500">Specialty</p>
              <p className="text-sm text-white">{specialty.name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Domain</p>
              <p className="text-sm text-slate-300 capitalize">{specialty.domain}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-1">Deliverables</p>
              <div className="flex flex-wrap gap-1">
                {specialty.deliverables.map((d) => (
                  <span key={d} className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                    {d}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Created</p>
          <p className="text-sm text-white">{project.createdAt}</p>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Last Updated</p>
          <p className="text-sm text-white">{project.updatedAt}</p>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// NEW PROJECT FORM
// ============================================================================

const NewProjectForm: React.FC<{
  onSubmit: (project: DesignerProject) => void;
  onCancel: () => void;
}> = ({ onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTools, setSelectedTools] = useState<string[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !specialtyId) return;

    const now = new Date().toISOString().split('T')[0];
    const project: DesignerProject = {
      id: `proj-${Date.now()}`,
      name: name.trim(),
      specialty: specialtyId,
      status: 'concept',
      tools: selectedTools,
      description: description.trim(),
      createdAt: now,
      updatedAt: now,
    };
    onSubmit(project);
  };

  const toggleTool = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId) ? prev.filter((t) => t !== toolId) : [...prev, toolId],
    );
  };

  // Auto-suggest tools when specialty is selected
  const handleSpecialtyChange = (id: string) => {
    setSpecialtyId(id);
    const spec = getSpecialtyById(id);
    if (spec) {
      setSelectedTools([...spec.primaryTools]);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h3 className="text-lg font-bold text-white">New Project</h3>

      <div>
        <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Project Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Waterfront Mixed-Use Tower"
          className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          required
        />
      </div>

      <div>
        <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Design Specialty</label>
        <select
          value={specialtyId}
          onChange={(e) => handleSpecialtyChange(e.target.value)}
          className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
          required
        >
          <option value="">Select a specialty...</option>
          {DESIGN_SPECIALTIES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief project description..."
          rows={3}
          className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">Tools</label>
        <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
          {ALL_TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => toggleTool(tool.id)}
              className={`text-left px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                selectedTools.includes(tool.id)
                  ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
              }`}
            >
              {tool.name.split(' /')[0].split(' +')[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!name.trim() || !specialtyId}
          className="flex-1 px-4 py-2 text-sm rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          Create Project
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const DesignerWorkspace: React.FC = () => {
  const [projects, setProjects] = useState<DesignerProject[]>(SAMPLE_PROJECTS);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list');

  const filteredProjects =
    statusFilter === 'all' ? projects : projects.filter((p) => p.status === statusFilter);

  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null;

  const handleNewProject = (project: DesignerProject) => {
    setProjects((prev) => [project, ...prev]);
    setSelectedProjectId(project.id);
    setShowNewForm(false);
  };

  const statusCounts = PHASES.reduce<Record<string, number>>((acc, phase) => {
    acc[phase] = projects.filter((p) => p.status === phase).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Project Workspace</h2>
          <p className="text-xs text-slate-400">
            {projects.length} projects &middot; {projects.filter((p) => p.status !== 'completed').length} active
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex border border-slate-700 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs transition-colors ${
                viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('board')}
              className={`px-3 py-1.5 text-xs transition-colors ${
                viewMode === 'board' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              Board
            </button>
          </div>
          <button
            onClick={() => {
              setShowNewForm(true);
              setSelectedProjectId(null);
            }}
            className="px-4 py-2 text-sm rounded-lg bg-cyan-600 hover:bg-cyan-500 transition-colors font-medium"
          >
            + New Project
          </button>
        </div>
      </div>

      {/* Phase Summary Bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setStatusFilter('all')}
          className={`flex-shrink-0 px-3 py-1.5 text-xs rounded-lg transition-colors ${
            statusFilter === 'all'
              ? 'bg-white/10 text-white border border-white/20'
              : 'text-slate-400 border border-slate-700 hover:bg-slate-800'
          }`}
        >
          All ({projects.length})
        </button>
        {PHASES.map((phase) => {
          const conf = STATUS_CONFIG[phase];
          return (
            <button
              key={phase}
              onClick={() => setStatusFilter(statusFilter === phase ? 'all' : phase)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                statusFilter === phase
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'text-slate-400 border border-slate-700 hover:bg-slate-800'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${conf.dotColor}`} />
              {conf.label} ({statusCounts[phase] || 0})
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      {viewMode === 'list' ? (
        /* List View */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  isSelected={selectedProjectId === project.id}
                  onSelect={() => {
                    setSelectedProjectId(selectedProjectId === project.id ? null : project.id);
                    setShowNewForm(false);
                  }}
                />
              ))}
            </div>
            {filteredProjects.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <p className="text-sm">No projects in this phase.</p>
              </div>
            )}
          </div>

          {/* Detail / New Form Panel */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 h-fit lg:sticky lg:top-24">
            {showNewForm ? (
              <NewProjectForm onSubmit={handleNewProject} onCancel={() => setShowNewForm(false)} />
            ) : selectedProject ? (
              <ProjectDetail project={selectedProject} />
            ) : (
              <div className="text-center py-12">
                <p className="text-sm text-slate-500">Select a project or create a new one</p>
                <p className="text-xs text-slate-600 mt-2">
                  {projects.length} projects across {new Set(projects.map((p) => p.specialty)).size} specialties
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Board View */
        <div className="overflow-x-auto">
          <div className="flex gap-4 min-w-max pb-4">
            {PHASES.map((phase) => {
              const conf = STATUS_CONFIG[phase];
              const phaseProjects = projects.filter((p) => p.status === phase);
              return (
                <div key={phase} className="w-72 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className={`w-2 h-2 rounded-full ${conf.dotColor}`} />
                    <h3 className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                      {conf.label}
                    </h3>
                    <span className="text-xs text-slate-600">({phaseProjects.length})</span>
                  </div>
                  <div className="space-y-3">
                    {phaseProjects.map((project) => {
                      const specialty = getSpecialtyById(project.specialty);
                      return (
                        <div
                          key={project.id}
                          onClick={() => {
                            setSelectedProjectId(project.id);
                            setViewMode('list');
                            setShowNewForm(false);
                          }}
                          className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors"
                        >
                          <h4 className="text-sm font-medium text-white mb-1">{project.name}</h4>
                          {specialty && (
                            <p className="text-[10px] text-slate-500 mb-2">{specialty.name}</p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {project.tools.slice(0, 2).map((toolId) => {
                              const tool = getToolById(toolId);
                              return tool ? (
                                <span key={toolId} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                  {tool.name.split(' ')[0]}
                                </span>
                              ) : null;
                            })}
                            {project.tools.length > 2 && (
                              <span className="text-[10px] text-slate-600">+{project.tools.length - 2}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {phaseProjects.length === 0 && (
                      <div className="p-4 rounded-lg border border-dashed border-slate-800 text-center">
                        <p className="text-[10px] text-slate-600">No projects</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignerWorkspace;
