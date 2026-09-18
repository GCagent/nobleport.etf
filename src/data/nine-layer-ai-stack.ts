/**
 * 9-Layer Autonomous Intelligence Stack
 *
 * Extends the 7-layer model with two additional layers that emerge
 * when AI systems transition from tools to autonomous economic systems.
 * This is the full operating architecture for AI-driven ecosystems.
 */

export interface LayerComponent {
  name: string;
  description: string;
}

export interface StackLayer {
  id: number;
  name: string;
  subtitle: string;
  purpose: string;
  components: LayerComponent[];
  flow?: string[];
}

export interface StephanieMapping {
  layer: string;
  role: string;
}

export interface CompanyProfile {
  type: string;
  layers: string[];
}

export const NINE_LAYER_STACK: StackLayer[] = [
  {
    id: 1,
    name: "Compute Layer",
    subtitle: "Raw processing power",
    purpose: "Provide the hardware backbone for training and inference.",
    components: [
      { name: "GPUs / AI accelerators", description: "Specialized hardware for parallel AI workloads" },
      { name: "Distributed compute clusters", description: "Scalable multi-node training and inference" },
      { name: "Edge inference nodes", description: "Low-latency local processing at the network edge" },
      { name: "High-speed interconnects", description: "Fast data transfer between compute nodes" },
    ],
  },
  {
    id: 2,
    name: "Model Layer",
    subtitle: "Foundation AI models",
    purpose: "Provide general intelligence capabilities.",
    components: [
      { name: "Language models", description: "Text understanding and generation" },
      { name: "Vision models", description: "Image and video understanding" },
      { name: "Multimodal systems", description: "Cross-modal reasoning and generation" },
      { name: "Speech models", description: "Audio understanding and synthesis" },
    ],
  },
  {
    id: 3,
    name: "Data Layer",
    subtitle: "Knowledge and memory",
    purpose: "Provide context, memory, and learning material.",
    components: [
      { name: "Data lakes", description: "Large-scale raw data storage" },
      { name: "Vector databases", description: "Semantic similarity search and retrieval" },
      { name: "Training datasets", description: "Curated data for model improvement" },
      { name: "Real-time streams", description: "Live data feeds for dynamic context" },
    ],
    flow: ["Data ingestion", "Processing", "Training / Retrieval", "Model usage"],
  },
  {
    id: 4,
    name: "Tool Layer",
    subtitle: "External capabilities",
    purpose: "Enable real-world execution.",
    components: [
      { name: "APIs", description: "Programmatic access to external services" },
      { name: "Cloud services", description: "Managed infrastructure and platforms" },
      { name: "Financial systems", description: "Banking, payments, and trading interfaces" },
      { name: "Blockchain networks", description: "Decentralized ledgers and smart contracts" },
      { name: "Robotics controllers", description: "Physical-world actuation and sensing" },
    ],
  },
  {
    id: 5,
    name: "Agent Layer",
    subtitle: "Autonomous workers",
    purpose: "Execute complex workflows autonomously.",
    components: [
      { name: "Research agents", description: "Information gathering and analysis" },
      { name: "Coding agents", description: "Software development and maintenance" },
      { name: "Automation agents", description: "Business process automation" },
      { name: "Trading agents", description: "Financial market participation" },
    ],
    flow: ["Observe", "Plan", "Act", "Evaluate"],
  },
  {
    id: 6,
    name: "Orchestration Layer",
    subtitle: "AI coordinating other AI",
    purpose: "Turn many agents into a coherent operating system.",
    components: [
      { name: "Task routing", description: "Direct work to the right agent" },
      { name: "Agent coordination", description: "Manage inter-agent collaboration" },
      { name: "Workflow governance", description: "Enforce rules and approval chains" },
      { name: "System monitoring", description: "Track health and performance" },
    ],
    flow: ["Executive AI", "Agent network", "Task execution"],
  },
  {
    id: 7,
    name: "Interface Layer",
    subtitle: "Human-AI interaction",
    purpose: "Provide visibility and control for humans.",
    components: [
      { name: "Voice interfaces", description: "Natural language speech interaction" },
      { name: "Avatars", description: "Visual AI representations" },
      { name: "Dashboards", description: "Data visualization and control panels" },
      { name: "Conversational agents", description: "Text-based dialogue systems" },
      { name: "AR / VR environments", description: "Immersive spatial interfaces" },
    ],
  },
  {
    id: 8,
    name: "Economic Layer",
    subtitle: "Autonomous value exchange",
    purpose: "Allow AI systems to participate in economic networks.",
    components: [
      { name: "Token economies", description: "Digital asset creation and management" },
      { name: "Payment systems", description: "Automated financial transactions" },
      { name: "Smart contracts", description: "Self-executing economic agreements" },
      { name: "Automated trading", description: "Algorithmic market participation" },
      { name: "Incentive structures", description: "Reward mechanisms for desired behaviors" },
    ],
    flow: ["AI agent", "Economic decision", "Smart contract", "Value transfer"],
  },
  {
    id: 9,
    name: "Civilization Layer",
    subtitle: "AI managing large-scale systems",
    purpose: "Operate large-scale human systems with AI assistance.",
    components: [
      { name: "Cities", description: "Urban planning and management" },
      { name: "Infrastructure", description: "Physical systems and utilities" },
      { name: "Logistics networks", description: "Supply chain and transportation" },
      { name: "Financial markets", description: "Economic system coordination" },
      { name: "Governance systems", description: "Policy and regulatory frameworks" },
    ],
    flow: ["AI coordination", "Public infrastructure", "Economic systems", "Societal operations"],
  },
];

/**
 * Stephanie.ai coverage across the 9-layer stack.
 * Unusually broad for an early system — touching all 9 layers.
 */
export const STEPHANIE_LAYER_MAPPING: StephanieMapping[] = [
  { layer: "Compute", role: "Cloud infrastructure" },
  { layer: "Model", role: "Foundation models" },
  { layer: "Data", role: "Construction + municipal datasets" },
  { layer: "Tool", role: "APIs / blockchain / automation" },
  { layer: "Agent", role: "GCagent / PermitStream / trading agents" },
  { layer: "Orchestration", role: "Stephanie executive AI" },
  { layer: "Interface", role: "Voice / avatar / dashboards" },
  { layer: "Economic", role: "Tokenization / DeFi" },
  { layer: "Civilization", role: "Infrastructure workflows" },
];

/**
 * Industry comparison: most AI companies operate in only 1-3 layers.
 * The most powerful future platforms operate across 5-9 layers simultaneously.
 */
export const INDUSTRY_LAYER_COVERAGE: CompanyProfile[] = [
  { type: "Model labs", layers: ["Model", "Compute"] },
  { type: "Robotics firms", layers: ["Model", "Tool"] },
  { type: "Enterprise AI", layers: ["Tool", "Agent"] },
  { type: "Platform ecosystems", layers: ["Agent", "Orchestration"] },
  { type: "NoblePort / Stephanie.ai", layers: [
    "Compute", "Model", "Data", "Tool", "Agent",
    "Orchestration", "Interface", "Economic", "Civilization",
  ]},
];

/**
 * The dominant AI ecosystems of the future combine:
 * - Foundation models
 * - Agent networks
 * - Economic systems
 * - Real-world infrastructure
 *
 * When all nine layers operate together, you have an AI-driven
 * operating system for society-scale systems.
 */
export function getLayerById(id: number): StackLayer | undefined {
  return NINE_LAYER_STACK.find((layer) => layer.id === id);
}

export function getStephanieCoverage(): number {
  return STEPHANIE_LAYER_MAPPING.length;
}

export function getLayerNames(): string[] {
  return NINE_LAYER_STACK.map((layer) => layer.name);
}
