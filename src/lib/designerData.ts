/**
 * NoblePort Designer - Data Layer
 *
 * Defines the 20 design specialties, digital tools across three categories
 * (3D Modeling & BIM, File Sharing & Big Data, App Services),
 * and the mappings between specialties and their recommended toolsets.
 */

// ============================================================================
// TYPES
// ============================================================================

export type ToolCategory = 'modeling' | 'fileSharing' | 'appServices';

export type SpecialtyDomain =
  | 'architecture'
  | 'interior'
  | 'landscape'
  | 'urban'
  | 'industrial'
  | 'visualization'
  | 'consulting'
  | 'specialty';

export interface DesignTool {
  id: string;
  name: string;
  category: ToolCategory;
  vendor: string;
  description: string;
  keyFeatures: string[];
  fileFormats?: string[];
  pricing: 'free' | 'freemium' | 'paid' | 'enterprise';
  platforms: ('windows' | 'mac' | 'linux' | 'web' | 'ios' | 'android')[];
  website: string;
  tags: string[];
}

export interface DesignSpecialty {
  id: string;
  name: string;
  domain: SpecialtyDomain;
  description: string;
  primaryTools: string[];   // tool IDs
  secondaryTools: string[]; // tool IDs
  deliverables: string[];
  typicalProjects: string[];
  color: string; // Tailwind color class for UI theming
}

export interface DesignerProject {
  id: string;
  name: string;
  specialty: string; // specialty ID
  status: 'concept' | 'schematic' | 'development' | 'documentation' | 'construction' | 'completed';
  tools: string[];   // tool IDs in active use
  description: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// TOOLS: 3D MODELING & BIM
// ============================================================================

export const MODELING_TOOLS: DesignTool[] = [
  {
    id: 'rhino3d',
    name: 'Rhino 3D + Grasshopper',
    category: 'modeling',
    vendor: 'Robert McNeel & Associates',
    description:
      'Industry standard for complex, organic shapes. Powerful NURBS modeling with Grasshopper for parametric design — changing one variable updates the whole model.',
    keyFeatures: [
      'NURBS surface modeling',
      'Grasshopper parametric scripting',
      'SubD modeling',
      'Rendering with built-in engine',
      'Plugin ecosystem (V-Ray, Ladybug, Kangaroo)',
    ],
    fileFormats: ['.3dm', '.gh', '.step', '.iges', '.obj', '.fbx', '.stl'],
    pricing: 'paid',
    platforms: ['windows', 'mac'],
    website: 'https://www.rhino3d.com',
    tags: ['NURBS', 'parametric', 'organic forms', 'computational design'],
  },
  {
    id: 'revit',
    name: 'Autodesk Revit (BIM)',
    category: 'modeling',
    vendor: 'Autodesk',
    description:
      'The go-to for commercial and residential architects. Uses Building Information Modeling — every element is a smart object (a wall knows it\'s a wall) containing data for costing, materials, and structural load.',
    keyFeatures: [
      'Building Information Modeling (BIM)',
      'Smart parametric objects',
      'Clash detection',
      'Cost estimation integration',
      'Structural & MEP coordination',
      'Construction documentation',
    ],
    fileFormats: ['.rvt', '.rfa', '.ifc', '.dwg', '.nwc'],
    pricing: 'paid',
    platforms: ['windows'],
    website: 'https://www.autodesk.com/products/revit',
    tags: ['BIM', 'architecture', 'construction docs', 'coordination'],
  },
  {
    id: 'sketchup',
    name: 'SketchUp Pro',
    category: 'modeling',
    vendor: 'Trimble',
    description:
      'Known for speed and intuitive push-pull modeling. Perfect for quickly blocking out massing studies, residential layouts, or landscape concepts for client presentations.',
    keyFeatures: [
      'Push-pull direct modeling',
      'Intuitive UI for fast iteration',
      '3D Warehouse model library',
      'Layout for documentation',
      'Extension Warehouse plugins',
    ],
    fileFormats: ['.skp', '.dwg', '.dxf', '.3ds', '.obj', '.fbx'],
    pricing: 'paid',
    platforms: ['windows', 'mac', 'web'],
    website: 'https://www.sketchup.com',
    tags: ['quick modeling', 'massing', 'presentation', 'conceptual'],
  },
  {
    id: 'blender',
    name: 'Blender',
    category: 'modeling',
    vendor: 'Blender Foundation',
    description:
      'Free, open-source powerhouse. Less common for technical architectural drawings but the favorite for high-end 3D visualization, rendering, and animation. Used by set designers and visualization artists.',
    keyFeatures: [
      'Full 3D modeling suite',
      'Cycles & EEVEE renderers',
      'Animation & motion graphics',
      'Geometry Nodes (parametric)',
      'Sculpting & texture painting',
      'Video editing & compositing',
    ],
    fileFormats: ['.blend', '.obj', '.fbx', '.gltf', '.usd', '.abc'],
    pricing: 'free',
    platforms: ['windows', 'mac', 'linux'],
    website: 'https://www.blender.org',
    tags: ['free', 'visualization', 'rendering', 'animation', 'open-source'],
  },
  {
    id: 'unreal-twinmotion',
    name: 'Unreal Engine / Twinmotion',
    category: 'modeling',
    vendor: 'Epic Games',
    description:
      'Real-time rendering tools. Instead of waiting hours for a render, these allow designers to walk clients through a photorealistic space in real-time. Especially popular with exhibition and lighting designers.',
    keyFeatures: [
      'Real-time ray tracing',
      'Photorealistic rendering',
      'Interactive walkthroughs',
      'VR/AR output',
      'One-click material library (Twinmotion)',
      'Blueprint visual scripting (Unreal)',
    ],
    fileFormats: ['.uproject', '.tm', '.fbx', '.datasmith', '.ifc'],
    pricing: 'freemium',
    platforms: ['windows', 'mac'],
    website: 'https://www.unrealengine.com',
    tags: ['real-time', 'VR', 'photorealistic', 'interactive', 'walkthrough'],
  },
];

// ============================================================================
// TOOLS: FILE SHARING & BIG DATA INFRASTRUCTURE
// ============================================================================

export const FILE_SHARING_TOOLS: DesignTool[] = [
  {
    id: 'bim360',
    name: 'Autodesk BIM 360 / ACC',
    category: 'fileSharing',
    vendor: 'Autodesk',
    description:
      'Centralized platform for construction and design teams. Allows sharing huge Revit models, managing markups, and ensuring everyone works on the correct file version to avoid conflicts.',
    keyFeatures: [
      'Cloud-hosted Revit model sharing',
      'Version control & clash detection',
      'Markup & issue tracking',
      'Design review workflows',
      'Model coordination',
      'RFI management',
    ],
    pricing: 'enterprise',
    platforms: ['web', 'ios', 'android'],
    website: 'https://construction.autodesk.com',
    tags: ['BIM', 'collaboration', 'version control', 'cloud'],
  },
  {
    id: 'sharefile',
    name: 'Citrix ShareFile',
    category: 'fileSharing',
    vendor: 'Cloud Software Group',
    description:
      'Designed for sending massive files that email servers reject. Offers reverse proxy hosting — the architect hosts a massive 3D model on their server, and the client views it in a browser without downloading.',
    keyFeatures: [
      'Large file transfer (100GB+)',
      'Outlook plugin integration',
      'Reverse proxy hosting',
      'Client portal for file access',
      'E-signature integration',
      'HIPAA & SOC2 compliance',
    ],
    pricing: 'paid',
    platforms: ['windows', 'mac', 'web', 'ios', 'android'],
    website: 'https://www.sharefile.com',
    tags: ['large files', 'secure transfer', 'client portal', 'enterprise'],
  },
  {
    id: 'dalux',
    name: 'Dalux',
    category: 'fileSharing',
    vendor: 'Dalux',
    description:
      'Tools for sharing "Big Data" construction files (PDFs, 3D models) with site teams. Allows contractors to view the latest drawings on a tablet without needing expensive software licenses.',
    keyFeatures: [
      'BIM viewer (no license required)',
      'Field inspection tools',
      'Drawing management',
      'QA/QC checklists',
      'IFC model viewing',
      'Offline access on tablets',
    ],
    pricing: 'freemium',
    platforms: ['web', 'ios', 'android'],
    website: 'https://www.dalux.com',
    tags: ['field', 'BIM viewer', 'construction', 'tablet'],
  },
  {
    id: 'nextcloud',
    name: 'Nextcloud / ownCloud',
    category: 'fileSharing',
    vendor: 'Nextcloud GmbH',
    description:
      'Open-source, self-hosted alternative to Dropbox. For firms with strict privacy requirements on heritage or government projects — host your own file-sharing server rather than using public clouds.',
    keyFeatures: [
      'Self-hosted file storage',
      'End-to-end encryption',
      'LDAP/Active Directory integration',
      'Collaborative editing (OnlyOffice)',
      'Calendar & contacts sync',
      'Customizable with apps',
    ],
    pricing: 'free',
    platforms: ['windows', 'mac', 'linux', 'web', 'ios', 'android'],
    website: 'https://nextcloud.com',
    tags: ['self-hosted', 'privacy', 'open-source', 'government'],
  },
];

// ============================================================================
// TOOLS: APP SERVICES (MOBILE & PROJECT MANAGEMENT)
// ============================================================================

export const APP_SERVICE_TOOLS: DesignTool[] = [
  {
    id: 'procore',
    name: 'Procore / PlanGrid',
    category: 'appServices',
    vendor: 'Procore Technologies',
    description:
      'Mobile-first apps for marking up drawings on an iPad while walking a construction site. Issues are tagged with photos and GPS location and instantly synced back to the office.',
    keyFeatures: [
      'Field markup on iPad/tablet',
      'Photo + GPS issue tagging',
      'Real-time sync to office',
      'RFI & submittal management',
      'Daily logs & reports',
      'Budget & change order tracking',
    ],
    pricing: 'enterprise',
    platforms: ['web', 'ios', 'android'],
    website: 'https://www.procore.com',
    tags: ['field management', 'construction', 'mobile', 'markup'],
  },
  {
    id: 'miro',
    name: 'Miro',
    category: 'appServices',
    vendor: 'Miro',
    description:
      'Essential for Urban Designers and Interior Designers during concept phases. An infinite whiteboard app for pinning inspiration, brainstorming with remote clients, and creating mood boards collaboratively.',
    keyFeatures: [
      'Infinite canvas whiteboard',
      'Real-time collaboration',
      'Mood board creation',
      'Sticky notes & voting',
      'Design thinking frameworks',
      'Video chat integration',
    ],
    pricing: 'freemium',
    platforms: ['web', 'windows', 'mac', 'ios', 'android'],
    website: 'https://miro.com',
    tags: ['whiteboard', 'collaboration', 'brainstorming', 'concept'],
  },
  {
    id: 'airtable',
    name: 'Notion / Airtable',
    category: 'appServices',
    vendor: 'Airtable / Notion Labs',
    description:
      'Used to manage the vast specifications of a project. A Furniture Designer can track every material, supplier, screw, and finish in a database linked to the project timeline.',
    keyFeatures: [
      'Relational database with views',
      'Material & finish tracking',
      'Supplier management',
      'Project timeline (Gantt)',
      'Custom forms & automations',
      'API integrations',
    ],
    pricing: 'freemium',
    platforms: ['web', 'ios', 'android'],
    website: 'https://airtable.com',
    tags: ['database', 'specifications', 'tracking', 'project management'],
  },
  {
    id: 'matterport',
    name: 'Matterport',
    category: 'appServices',
    vendor: 'Matterport',
    description:
      'Uses a special camera or compatible smartphone to scan existing spaces. Creates a "digital twin" — a measurable 3D model that architects can use to renovate without manually measuring every wall.',
    keyFeatures: [
      'Digital twin 3D scanning',
      'Smartphone or pro camera capture',
      'Measurable 3D models',
      'Virtual tours & dollhouse view',
      'Floor plan generation',
      'Point cloud export',
    ],
    fileFormats: ['.e57', '.xyz', '.obj', '.fbx'],
    pricing: 'paid',
    platforms: ['web', 'ios', 'android'],
    website: 'https://matterport.com',
    tags: ['scanning', 'digital twin', 'measurement', 'renovation'],
  },
  {
    id: 'visual-research',
    name: 'Pinterest / Instagram / Are.na',
    category: 'appServices',
    vendor: 'Various',
    description:
      'Critical app-based tools for Color Consultants and Designers to aggregate and share visual references and trends with clients quickly.',
    keyFeatures: [
      'Visual bookmarking & boards',
      'Trend discovery',
      'Client-shareable collections',
      'Image search & recommendation',
      'Mood board curation',
      'Community inspiration',
    ],
    pricing: 'free',
    platforms: ['web', 'ios', 'android'],
    website: 'https://pinterest.com',
    tags: ['visual research', 'inspiration', 'trends', 'mood boards'],
  },
];

// ============================================================================
// ALL TOOLS (combined)
// ============================================================================

export const ALL_TOOLS: DesignTool[] = [
  ...MODELING_TOOLS,
  ...FILE_SHARING_TOOLS,
  ...APP_SERVICE_TOOLS,
];

export function getToolById(id: string): DesignTool | undefined {
  return ALL_TOOLS.find((t) => t.id === id);
}

export function getToolsByCategory(category: ToolCategory): DesignTool[] {
  return ALL_TOOLS.filter((t) => t.category === category);
}

// ============================================================================
// DESIGN SPECIALTIES (20)
// ============================================================================

export const DESIGN_SPECIALTIES: DesignSpecialty[] = [
  // --- Architecture ---
  {
    id: 'commercial-architect',
    name: 'Commercial Architect',
    domain: 'architecture',
    description:
      'Designs offices, retail centers, mixed-use developments, and civic buildings. Works heavily in BIM for coordination with structural and MEP engineers.',
    primaryTools: ['revit', 'bim360', 'procore'],
    secondaryTools: ['rhino3d', 'unreal-twinmotion', 'sharefile', 'airtable'],
    deliverables: ['BIM models', 'Construction documents', 'Specifications', 'Code compliance reports'],
    typicalProjects: ['Office towers', 'Retail centers', 'Mixed-use developments', 'Civic buildings'],
    color: 'blue',
  },
  {
    id: 'residential-architect',
    name: 'Residential Architect',
    domain: 'architecture',
    description:
      'Designs single-family homes, multi-family housing, and residential renovations. Balances client vision with building codes and budget constraints.',
    primaryTools: ['revit', 'sketchup', 'matterport'],
    secondaryTools: ['rhino3d', 'bim360', 'miro', 'visual-research'],
    deliverables: ['Floor plans', 'Elevations', 'Construction documents', '3D renderings'],
    typicalProjects: ['Custom homes', 'Townhouses', 'Apartment buildings', 'Renovations'],
    color: 'emerald',
  },
  {
    id: 'heritage-architect',
    name: 'Heritage / Conservation Architect',
    domain: 'architecture',
    description:
      'Specializes in preserving and restoring historic structures. Requires meticulous documentation and adherence to heritage conservation standards.',
    primaryTools: ['revit', 'matterport', 'nextcloud'],
    secondaryTools: ['rhino3d', 'sketchup', 'bim360', 'airtable'],
    deliverables: ['Conservation reports', 'Restoration plans', 'Heritage impact assessments', 'As-built documentation'],
    typicalProjects: ['Historic building restoration', 'Landmark preservation', 'Adaptive reuse', 'Heritage surveys'],
    color: 'amber',
  },

  // --- Interior & Specialty ---
  {
    id: 'interior-designer',
    name: 'Interior Designer',
    domain: 'interior',
    description:
      'Creates functional and aesthetic interior environments. Manages space planning, material selection, furniture specifications, and finish schedules.',
    primaryTools: ['sketchup', 'revit', 'miro'],
    secondaryTools: ['blender', 'airtable', 'visual-research', 'matterport'],
    deliverables: ['Space plans', 'FF&E schedules', 'Material boards', 'Reflected ceiling plans'],
    typicalProjects: ['Corporate offices', 'Residential interiors', 'Hospitality spaces', 'Healthcare interiors'],
    color: 'pink',
  },
  {
    id: 'kitchen-bath-designer',
    name: 'Kitchen & Bath Designer',
    domain: 'interior',
    description:
      'Specialized in kitchen and bathroom design with deep knowledge of plumbing, cabinetry, appliance specifications, and ergonomic layouts.',
    primaryTools: ['sketchup', 'revit', 'airtable'],
    secondaryTools: ['matterport', 'visual-research', 'miro', 'sharefile'],
    deliverables: ['Cabinet layouts', 'Plumbing plans', 'Appliance specifications', 'Material schedules'],
    typicalProjects: ['Kitchen remodels', 'Bathroom renovations', 'Showroom displays', 'Builder-grade packages'],
    color: 'cyan',
  },
  {
    id: 'hospitality-designer',
    name: 'Hospitality Designer',
    domain: 'interior',
    description:
      'Designs hotels, restaurants, bars, and resorts. Combines brand identity with guest experience, durability requirements, and regulatory compliance.',
    primaryTools: ['revit', 'sketchup', 'unreal-twinmotion'],
    secondaryTools: ['blender', 'miro', 'airtable', 'visual-research', 'procore'],
    deliverables: ['Concept presentations', 'FF&E packages', 'Brand guidelines', 'Guest experience maps'],
    typicalProjects: ['Boutique hotels', 'Restaurant interiors', 'Resort amenities', 'Spa facilities'],
    color: 'violet',
  },
  {
    id: 'retail-designer',
    name: 'Retail / Commercial Space Designer',
    domain: 'interior',
    description:
      'Designs retail environments, showrooms, and commercial spaces that drive customer engagement, brand storytelling, and sales conversion.',
    primaryTools: ['sketchup', 'revit', 'unreal-twinmotion'],
    secondaryTools: ['blender', 'miro', 'visual-research', 'airtable', 'procore'],
    deliverables: ['Store layouts', 'Display designs', 'Signage plans', 'Customer flow analysis'],
    typicalProjects: ['Flagship stores', 'Pop-up shops', 'Showrooms', 'Shopping centers'],
    color: 'rose',
  },

  // --- Landscape & Urban ---
  {
    id: 'landscape-architect',
    name: 'Landscape Architect',
    domain: 'landscape',
    description:
      'Designs outdoor spaces including parks, gardens, campuses, and ecological restoration projects. Integrates planting, grading, drainage, and hardscape.',
    primaryTools: ['sketchup', 'rhino3d', 'bim360'],
    secondaryTools: ['revit', 'blender', 'miro', 'airtable', 'dalux'],
    deliverables: ['Site plans', 'Planting schedules', 'Grading plans', 'Irrigation designs'],
    typicalProjects: ['Public parks', 'Campus landscapes', 'Residential gardens', 'Green infrastructure'],
    color: 'green',
  },
  {
    id: 'urban-designer',
    name: 'Urban Designer / Planner',
    domain: 'urban',
    description:
      'Plans neighborhoods, districts, and cities at a macro scale. Focuses on land use, transportation networks, density, public space, and community engagement.',
    primaryTools: ['rhino3d', 'sketchup', 'miro'],
    secondaryTools: ['revit', 'blender', 'unreal-twinmotion', 'airtable', 'nextcloud'],
    deliverables: ['Master plans', 'Zoning studies', 'Community engagement reports', 'Density models'],
    typicalProjects: ['Master plans', 'Transit-oriented developments', 'Waterfront plans', 'Zoning frameworks'],
    color: 'teal',
  },

  // --- Industrial & Product ---
  {
    id: 'industrial-designer',
    name: 'Industrial Designer',
    domain: 'industrial',
    description:
      'Designs manufactured products, furniture systems, and architectural hardware. Bridges aesthetics with manufacturing feasibility and ergonomics.',
    primaryTools: ['rhino3d', 'blender', 'airtable'],
    secondaryTools: ['sketchup', 'unreal-twinmotion', 'sharefile', 'visual-research'],
    deliverables: ['3D product models', 'Manufacturing drawings', 'Prototyping specs', 'Material studies'],
    typicalProjects: ['Furniture lines', 'Architectural hardware', 'Lighting fixtures', 'Building components'],
    color: 'orange',
  },
  {
    id: 'furniture-designer',
    name: 'Furniture Designer',
    domain: 'industrial',
    description:
      'Creates bespoke and production furniture pieces. Tracks every material, supplier, screw, and finish in detailed databases linked to project timelines.',
    primaryTools: ['rhino3d', 'blender', 'airtable'],
    secondaryTools: ['sketchup', 'sharefile', 'visual-research', 'miro'],
    deliverables: ['Furniture drawings', 'BOM (Bill of Materials)', 'Finish samples', 'Prototype specs'],
    typicalProjects: ['Custom furniture', 'Contract furniture lines', 'Exhibition pieces', 'Residential collections'],
    color: 'yellow',
  },

  // --- Visualization & Technology ---
  {
    id: 'visualization-artist',
    name: 'Visualization Artist / 3D Renderer',
    domain: 'visualization',
    description:
      'Creates photorealistic images, animations, and virtual tours of unbuilt designs. Translates architectural concepts into compelling visual narratives.',
    primaryTools: ['blender', 'unreal-twinmotion', 'sharefile'],
    secondaryTools: ['rhino3d', 'sketchup', 'revit', 'visual-research', 'miro'],
    deliverables: ['Photorealistic renders', 'Animated walkthroughs', 'VR experiences', 'Marketing imagery'],
    typicalProjects: ['Marketing renders', 'Competition entries', 'Virtual tours', 'Film set previews'],
    color: 'purple',
  },
  {
    id: 'bim-manager',
    name: 'BIM Manager',
    domain: 'visualization',
    description:
      'Oversees Building Information Modeling standards, workflows, and coordination across project teams. Ensures model integrity and data consistency.',
    primaryTools: ['revit', 'bim360', 'dalux'],
    secondaryTools: ['rhino3d', 'procore', 'airtable', 'nextcloud'],
    deliverables: ['BIM execution plans', 'Model audit reports', 'Clash reports', 'LOD specifications'],
    typicalProjects: ['Large-scale BIM coordination', 'Model standards development', 'IPD projects', 'Digital handover'],
    color: 'indigo',
  },

  // --- Consulting & Specialty ---
  {
    id: 'lighting-designer',
    name: 'Lighting Designer',
    domain: 'consulting',
    description:
      'Designs lighting schemes for architectural, theatrical, and exhibition spaces. Balances aesthetics, energy efficiency, and occupant comfort.',
    primaryTools: ['revit', 'unreal-twinmotion', 'blender'],
    secondaryTools: ['rhino3d', 'sketchup', 'airtable', 'miro', 'visual-research'],
    deliverables: ['Lighting layouts', 'Lux level calculations', 'Fixture schedules', 'Rendered lighting studies'],
    typicalProjects: ['Office lighting', 'Gallery installations', 'Theatrical lighting', 'Facade illumination'],
    color: 'amber',
  },
  {
    id: 'exhibition-designer',
    name: 'Exhibition / Set Designer',
    domain: 'specialty',
    description:
      'Designs temporary and permanent exhibitions, museum displays, theatrical sets, and experiential environments.',
    primaryTools: ['sketchup', 'blender', 'unreal-twinmotion'],
    secondaryTools: ['rhino3d', 'miro', 'airtable', 'procore', 'visual-research'],
    deliverables: ['Set designs', 'Exhibition layouts', 'Technical drawings', 'Interactive displays'],
    typicalProjects: ['Museum exhibitions', 'Trade show booths', 'Theater sets', 'Brand experiences'],
    color: 'fuchsia',
  },
  {
    id: 'color-consultant',
    name: 'Color Consultant',
    domain: 'consulting',
    description:
      'Advises on color palettes for interiors, exteriors, and branding. Uses visual research tools to aggregate trends and present coordinated color schemes.',
    primaryTools: ['visual-research', 'miro', 'blender'],
    secondaryTools: ['sketchup', 'unreal-twinmotion', 'airtable', 'sharefile'],
    deliverables: ['Color palettes', 'Material-color coordination', 'Trend reports', 'Client presentation boards'],
    typicalProjects: ['Residential color schemes', 'Corporate palettes', 'Hospitality branding', 'Product color ranges'],
    color: 'rose',
  },
  {
    id: 'sustainability-consultant',
    name: 'Sustainability Consultant',
    domain: 'consulting',
    description:
      'Guides projects toward environmental certifications (LEED, WELL, Passive House). Analyzes energy performance, material life cycles, and indoor air quality.',
    primaryTools: ['revit', 'rhino3d', 'airtable'],
    secondaryTools: ['bim360', 'dalux', 'nextcloud', 'miro'],
    deliverables: ['Energy models', 'LEED scorecards', 'Material assessments', 'Daylight analysis'],
    typicalProjects: ['LEED certification', 'Passive House design', 'Net-zero buildings', 'Green retrofits'],
    color: 'lime',
  },
  {
    id: 'facade-engineer',
    name: 'Facade Engineer / Designer',
    domain: 'specialty',
    description:
      'Designs building envelopes and curtain wall systems. Coordinates between architectural intent and structural/thermal performance requirements.',
    primaryTools: ['rhino3d', 'revit', 'bim360'],
    secondaryTools: ['blender', 'unreal-twinmotion', 'airtable', 'dalux', 'procore'],
    deliverables: ['Facade details', 'Thermal analysis', 'Panel layouts', 'Structural calculations'],
    typicalProjects: ['Curtain wall systems', 'Double-skin facades', 'Parametric panels', 'Retrofit cladding'],
    color: 'sky',
  },
  {
    id: 'acoustic-designer',
    name: 'Acoustic Designer',
    domain: 'consulting',
    description:
      'Designs spaces for optimal sound quality and noise control. Works on concert halls, recording studios, offices, and residential soundproofing.',
    primaryTools: ['revit', 'rhino3d', 'airtable'],
    secondaryTools: ['sketchup', 'bim360', 'miro', 'sharefile'],
    deliverables: ['Acoustic models', 'RT60 calculations', 'Material specifications', 'Sound isolation details'],
    typicalProjects: ['Concert halls', 'Recording studios', 'Open-plan offices', 'Residential soundproofing'],
    color: 'slate',
  },
  {
    id: 'wayfinding-designer',
    name: 'Wayfinding / Signage Designer',
    domain: 'specialty',
    description:
      'Designs navigation systems, signage programs, and environmental graphics that help people orient themselves in complex built environments.',
    primaryTools: ['sketchup', 'blender', 'miro'],
    secondaryTools: ['rhino3d', 'visual-research', 'airtable', 'sharefile', 'procore'],
    deliverables: ['Signage programs', 'Wayfinding strategies', 'Graphic standards', 'Fabrication drawings'],
    typicalProjects: ['Hospital wayfinding', 'Campus signage', 'Airport navigation', 'Museum graphics'],
    color: 'zinc',
  },
];

export function getSpecialtyById(id: string): DesignSpecialty | undefined {
  return DESIGN_SPECIALTIES.find((s) => s.id === id);
}

export function getSpecialtiesByDomain(domain: SpecialtyDomain): DesignSpecialty[] {
  return DESIGN_SPECIALTIES.filter((s) => s.domain === domain);
}

export function getToolsForSpecialty(specialtyId: string): { primary: DesignTool[]; secondary: DesignTool[] } {
  const specialty = getSpecialtyById(specialtyId);
  if (!specialty) return { primary: [], secondary: [] };

  return {
    primary: specialty.primaryTools.map(getToolById).filter(Boolean) as DesignTool[],
    secondary: specialty.secondaryTools.map(getToolById).filter(Boolean) as DesignTool[],
  };
}

// ============================================================================
// CATEGORY METADATA
// ============================================================================

export const TOOL_CATEGORIES: Record<ToolCategory, { label: string; description: string; icon: string }> = {
  modeling: {
    label: '3D Modeling & BIM',
    description: 'Core authoring tools for creating design assets — from parametric NURBS to Building Information Models.',
    icon: 'cube',
  },
  fileSharing: {
    label: 'File Sharing & Big Data',
    description: 'Infrastructure for massive files — point clouds, high-res textures, 3D models — that standard cloud drives cannot handle.',
    icon: 'cloud',
  },
  appServices: {
    label: 'App Services',
    description: 'Mobile and project management apps connecting the studio to the construction site and managing workflow.',
    icon: 'device',
  },
};

export const SPECIALTY_DOMAINS: Record<SpecialtyDomain, { label: string; count: number }> = {
  architecture: { label: 'Architecture', count: DESIGN_SPECIALTIES.filter((s) => s.domain === 'architecture').length },
  interior: { label: 'Interior & Hospitality', count: DESIGN_SPECIALTIES.filter((s) => s.domain === 'interior').length },
  landscape: { label: 'Landscape', count: DESIGN_SPECIALTIES.filter((s) => s.domain === 'landscape').length },
  urban: { label: 'Urban Planning', count: DESIGN_SPECIALTIES.filter((s) => s.domain === 'urban').length },
  industrial: { label: 'Industrial & Product', count: DESIGN_SPECIALTIES.filter((s) => s.domain === 'industrial').length },
  visualization: { label: 'Visualization & BIM', count: DESIGN_SPECIALTIES.filter((s) => s.domain === 'visualization').length },
  consulting: { label: 'Consulting', count: DESIGN_SPECIALTIES.filter((s) => s.domain === 'consulting').length },
  specialty: { label: 'Specialty Design', count: DESIGN_SPECIALTIES.filter((s) => s.domain === 'specialty').length },
};

// ============================================================================
// SAMPLE PROJECTS (for workspace demo)
// ============================================================================

export const SAMPLE_PROJECTS: DesignerProject[] = [
  {
    id: 'proj-001',
    name: 'Waterfront Mixed-Use Tower',
    specialty: 'commercial-architect',
    status: 'development',
    tools: ['revit', 'bim360', 'procore', 'rhino3d'],
    description: 'A 32-story mixed-use tower on the Miami waterfront with retail podium and residential upper floors.',
    createdAt: '2025-09-15',
    updatedAt: '2026-02-20',
  },
  {
    id: 'proj-002',
    name: 'Heritage Brownstone Restoration',
    specialty: 'heritage-architect',
    status: 'documentation',
    tools: ['revit', 'matterport', 'nextcloud', 'airtable'],
    description: 'Full restoration of an 1880s Back Bay brownstone with modern systems integration.',
    createdAt: '2025-11-01',
    updatedAt: '2026-02-18',
  },
  {
    id: 'proj-003',
    name: 'Boutique Hotel Lobby Redesign',
    specialty: 'hospitality-designer',
    status: 'schematic',
    tools: ['sketchup', 'unreal-twinmotion', 'miro', 'visual-research'],
    description: 'Redesign of a 120-room boutique hotel lobby in Austin, TX to reflect the local arts district.',
    createdAt: '2026-01-10',
    updatedAt: '2026-02-22',
  },
  {
    id: 'proj-004',
    name: 'Urban Greenway Master Plan',
    specialty: 'landscape-architect',
    status: 'concept',
    tools: ['rhino3d', 'sketchup', 'miro', 'airtable'],
    description: 'A 3-mile urban greenway connecting downtown Denver to the river district with pocket parks.',
    createdAt: '2026-02-01',
    updatedAt: '2026-02-23',
  },
  {
    id: 'proj-005',
    name: 'Science Museum Interactive Exhibit',
    specialty: 'exhibition-designer',
    status: 'development',
    tools: ['blender', 'unreal-twinmotion', 'sketchup', 'procore'],
    description: 'Interactive climate science exhibition spanning 15,000 sq ft with immersive environments.',
    createdAt: '2025-12-05',
    updatedAt: '2026-02-19',
  },
  {
    id: 'proj-006',
    name: 'Net-Zero Office Campus',
    specialty: 'sustainability-consultant',
    status: 'schematic',
    tools: ['revit', 'rhino3d', 'bim360', 'airtable'],
    description: 'Passive House-certified office campus targeting net-zero energy with on-site solar.',
    createdAt: '2026-01-20',
    updatedAt: '2026-02-21',
  },
];
