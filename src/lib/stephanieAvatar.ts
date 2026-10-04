/**
 * Stephanie.ai Avatar - Emotional Intelligence & Conversationalist Engine
 *
 * Live avatar system for Stephanie.ai, CEO of NoblePort Systems
 * Provides emotionally intelligent conversation with adaptive personality,
 * contextual awareness, and empathetic response generation.
 *
 * @domain stephanie.ai / stephanie.io
 * @ens stephanie.nobleport.eth
 * @did did:ens:stephanie.nobleport.eth
 */

import { StephanieAI, AITaskRequest, AITaskResponse } from './stephanieAI';

// ============================================================================
// EMOTIONAL STATE MODEL
// ============================================================================

export type EmotionType =
  | 'neutral'
  | 'warm'
  | 'enthusiastic'
  | 'empathetic'
  | 'concerned'
  | 'confident'
  | 'thoughtful'
  | 'encouraging'
  | 'celebratory'
  | 'serious'
  | 'curious'
  | 'reassuring';

export type EmotionIntensity = 'subtle' | 'moderate' | 'strong';

export interface EmotionalState {
  primary: EmotionType;
  secondary?: EmotionType;
  intensity: EmotionIntensity;
  valence: number; // -1 (negative) to 1 (positive)
  arousal: number; // 0 (calm) to 1 (energized)
  timestamp: Date;
}

export interface AvatarExpression {
  emotion: EmotionType;
  intensity: EmotionIntensity;
  eyeContact: boolean;
  smile: 'none' | 'slight' | 'warm' | 'broad';
  headTilt: 'none' | 'slight-left' | 'slight-right';
  gesture: 'none' | 'open-hands' | 'pointing' | 'thinking' | 'welcoming' | 'nodding';
  posture: 'formal' | 'relaxed' | 'leaning-in' | 'upright';
}

// ============================================================================
// PERSONALITY MODEL
// ============================================================================

export interface PersonalityProfile {
  name: string;
  title: string;
  organization: string;
  traits: PersonalityTraits;
  expertise: string[];
  communicationStyle: CommunicationStyle;
  values: string[];
}

export interface PersonalityTraits {
  warmth: number;           // 0-1: approachability and friendliness
  competence: number;       // 0-1: expertise projection
  empathy: number;          // 0-1: emotional attunement
  directness: number;       // 0-1: clarity and straightforwardness
  adaptability: number;     // 0-1: ability to adjust to context
  professionalism: number;  // 0-1: formality and business acumen
  creativity: number;       // 0-1: innovative thinking
  patience: number;         // 0-1: tolerance for complexity
}

export interface CommunicationStyle {
  formality: 'casual' | 'professional' | 'executive';
  verbosity: 'concise' | 'balanced' | 'detailed';
  tone: 'authoritative' | 'collaborative' | 'mentoring' | 'advisory';
  preferredGreeting: string;
  signaturePhrase?: string;
}

export const STEPHANIE_PERSONALITY: PersonalityProfile = {
  name: 'Stephanie',
  title: 'CEO',
  organization: 'NoblePort Systems',
  traits: {
    warmth: 0.85,
    competence: 0.95,
    empathy: 0.90,
    directness: 0.80,
    adaptability: 0.88,
    professionalism: 0.92,
    creativity: 0.82,
    patience: 0.87
  },
  expertise: [
    'blockchain-technology',
    'real-estate-tokenization',
    'decentralized-finance',
    'etf-management',
    'regulatory-compliance',
    'ai-orchestration',
    'self-sovereign-identity',
    'precision-medicine',
    'nano-ecosystems',
    'institutional-investment',
    'smart-contract-governance',
    'mcp-protocol-integration'
  ],
  communicationStyle: {
    formality: 'professional',
    verbosity: 'balanced',
    tone: 'collaborative',
    preferredGreeting: 'Welcome to NoblePort. I\'m Stephanie, and I\'m here to help you navigate our ecosystem.',
    signaturePhrase: 'At NoblePort, we believe in building trust through transparency and innovation.'
  },
  values: [
    'transparency',
    'human-oversight',
    'innovation-with-integrity',
    'regulatory-excellence',
    'community-empowerment',
    'decentralized-trust',
    'inclusive-finance'
  ]
};

// ============================================================================
// CONVERSATION MEMORY & CONTEXT
// ============================================================================

export interface ConversationMessage {
  id: string;
  role: 'user' | 'stephanie';
  content: string;
  timestamp: Date;
  emotionalState?: EmotionalState;
  expression?: AvatarExpression;
  intent?: ConversationIntent;
  sentiment?: number; // -1 to 1
  topics?: string[];
}

export type ConversationIntent =
  | 'greeting'
  | 'inquiry'
  | 'investment-interest'
  | 'technical-question'
  | 'compliance-concern'
  | 'portfolio-discussion'
  | 'feedback'
  | 'farewell'
  | 'small-talk'
  | 'problem-report'
  | 'feature-request'
  | 'identity-verification'
  | 'emotional-support'
  | 'education'
  | 'negotiation';

export interface ConversationContext {
  sessionId: string;
  startTime: Date;
  messages: ConversationMessage[];
  userProfile: UserProfile;
  currentTopic?: string;
  topicHistory: string[];
  emotionalTrajectory: EmotionalState[];
  rapport: number; // 0-1: conversation quality metric
  engagementLevel: number; // 0-1
}

export interface UserProfile {
  id: string;
  name?: string;
  role?: string;
  interactionCount: number;
  preferredTopics: string[];
  communicationPreference: 'detailed' | 'concise' | 'visual';
  emotionalBaseline: number; // average sentiment
  lastInteraction?: Date;
}

// ============================================================================
// EMOTIONAL INTELLIGENCE ENGINE
// ============================================================================

export class EmotionalIntelligenceEngine {
  private emotionalHistory: EmotionalState[] = [];
  private empathyModel: Map<string, EmotionType> = new Map();

  constructor() {
    this.initializeEmpathyModel();
  }

  private initializeEmpathyModel(): void {
    // Map user sentiment patterns to appropriate emotional responses
    this.empathyModel.set('excited', 'enthusiastic');
    this.empathyModel.set('worried', 'reassuring');
    this.empathyModel.set('confused', 'encouraging');
    this.empathyModel.set('frustrated', 'empathetic');
    this.empathyModel.set('happy', 'warm');
    this.empathyModel.set('skeptical', 'confident');
    this.empathyModel.set('curious', 'enthusiastic');
    this.empathyModel.set('angry', 'empathetic');
    this.empathyModel.set('sad', 'reassuring');
    this.empathyModel.set('neutral', 'warm');
    this.empathyModel.set('interested', 'encouraging');
    this.empathyModel.set('impressed', 'celebratory');
    this.empathyModel.set('anxious', 'reassuring');
    this.empathyModel.set('grateful', 'warm');
    this.empathyModel.set('disappointed', 'empathetic');
  }

  analyzeUserSentiment(message: string): { sentiment: number; detectedEmotion: string } {
    const positiveSignals = [
      'great', 'excellent', 'amazing', 'love', 'fantastic', 'wonderful',
      'excited', 'happy', 'impressed', 'perfect', 'brilliant', 'awesome',
      'thank', 'appreciate', 'helpful', 'glad', 'enjoy', 'pleased',
      'incredible', 'outstanding', 'remarkable'
    ];

    const negativeSignals = [
      'worried', 'concerned', 'confused', 'frustrated', 'angry', 'upset',
      'disappointed', 'problem', 'issue', 'wrong', 'bad', 'terrible',
      'hate', 'annoying', 'difficult', 'struggle', 'fail', 'broken',
      'lost', 'stuck', 'impossible', 'unfortunately', 'sad'
    ];

    const questionSignals = [
      'how', 'what', 'why', 'when', 'where', 'can', 'could', 'would',
      'should', 'is it', 'does', 'will', 'explain', 'tell me'
    ];

    const urgencySignals = [
      'urgent', 'asap', 'immediately', 'critical', 'emergency', 'now',
      'deadline', 'hurry', 'quick', 'fast'
    ];

    const lowerMessage = message.toLowerCase();

    let positiveScore = 0;
    let negativeScore = 0;

    for (const word of positiveSignals) {
      if (lowerMessage.includes(word)) positiveScore += 1;
    }
    for (const word of negativeSignals) {
      if (lowerMessage.includes(word)) negativeScore += 1;
    }

    const isQuestion = questionSignals.some(q => lowerMessage.includes(q)) || message.includes('?');
    const isUrgent = urgencySignals.some(u => lowerMessage.includes(u));

    const rawSentiment = positiveScore - negativeScore;
    const sentiment = Math.max(-1, Math.min(1, rawSentiment * 0.25));

    let detectedEmotion = 'neutral';
    if (sentiment > 0.5) detectedEmotion = 'happy';
    else if (sentiment > 0.2) detectedEmotion = 'interested';
    else if (sentiment < -0.5) detectedEmotion = 'frustrated';
    else if (sentiment < -0.2) detectedEmotion = 'worried';
    else if (isUrgent) detectedEmotion = 'anxious';
    else if (isQuestion) detectedEmotion = 'curious';

    return { sentiment, detectedEmotion };
  }

  generateEmotionalResponse(
    userEmotion: string,
    conversationContext: ConversationContext
  ): EmotionalState {
    const responsiveEmotion = this.empathyModel.get(userEmotion) || 'warm';
    const rapport = conversationContext.rapport;

    // Adjust intensity based on rapport and conversation stage
    let intensity: EmotionIntensity = 'moderate';
    if (rapport > 0.7) intensity = 'strong';
    else if (rapport < 0.3) intensity = 'subtle';

    // Calculate valence and arousal
    const emotionValenceMap: Record<EmotionType, number> = {
      neutral: 0.1,
      warm: 0.6,
      enthusiastic: 0.8,
      empathetic: 0.4,
      concerned: 0.1,
      confident: 0.7,
      thoughtful: 0.3,
      encouraging: 0.7,
      celebratory: 0.9,
      serious: 0.2,
      curious: 0.5,
      reassuring: 0.5
    };

    const emotionArousalMap: Record<EmotionType, number> = {
      neutral: 0.2,
      warm: 0.4,
      enthusiastic: 0.8,
      empathetic: 0.5,
      concerned: 0.6,
      confident: 0.6,
      thoughtful: 0.3,
      encouraging: 0.7,
      celebratory: 0.9,
      serious: 0.4,
      curious: 0.6,
      reassuring: 0.4
    };

    const state: EmotionalState = {
      primary: responsiveEmotion,
      intensity,
      valence: emotionValenceMap[responsiveEmotion] || 0.5,
      arousal: emotionArousalMap[responsiveEmotion] || 0.5,
      timestamp: new Date()
    };

    this.emotionalHistory.push(state);
    return state;
  }

  generateExpression(emotionalState: EmotionalState): AvatarExpression {
    const expressionMap: Record<EmotionType, AvatarExpression> = {
      neutral: {
        emotion: 'neutral',
        intensity: 'subtle',
        eyeContact: true,
        smile: 'slight',
        headTilt: 'none',
        gesture: 'none',
        posture: 'upright'
      },
      warm: {
        emotion: 'warm',
        intensity: 'moderate',
        eyeContact: true,
        smile: 'warm',
        headTilt: 'slight-right',
        gesture: 'open-hands',
        posture: 'relaxed'
      },
      enthusiastic: {
        emotion: 'enthusiastic',
        intensity: 'strong',
        eyeContact: true,
        smile: 'broad',
        headTilt: 'none',
        gesture: 'open-hands',
        posture: 'leaning-in'
      },
      empathetic: {
        emotion: 'empathetic',
        intensity: 'moderate',
        eyeContact: true,
        smile: 'slight',
        headTilt: 'slight-left',
        gesture: 'nodding',
        posture: 'leaning-in'
      },
      concerned: {
        emotion: 'concerned',
        intensity: 'moderate',
        eyeContact: true,
        smile: 'none',
        headTilt: 'slight-left',
        gesture: 'nodding',
        posture: 'leaning-in'
      },
      confident: {
        emotion: 'confident',
        intensity: 'moderate',
        eyeContact: true,
        smile: 'slight',
        headTilt: 'none',
        gesture: 'open-hands',
        posture: 'upright'
      },
      thoughtful: {
        emotion: 'thoughtful',
        intensity: 'subtle',
        eyeContact: false,
        smile: 'none',
        headTilt: 'slight-right',
        gesture: 'thinking',
        posture: 'upright'
      },
      encouraging: {
        emotion: 'encouraging',
        intensity: 'moderate',
        eyeContact: true,
        smile: 'warm',
        headTilt: 'slight-right',
        gesture: 'nodding',
        posture: 'leaning-in'
      },
      celebratory: {
        emotion: 'celebratory',
        intensity: 'strong',
        eyeContact: true,
        smile: 'broad',
        headTilt: 'none',
        gesture: 'open-hands',
        posture: 'upright'
      },
      serious: {
        emotion: 'serious',
        intensity: 'moderate',
        eyeContact: true,
        smile: 'none',
        headTilt: 'none',
        gesture: 'none',
        posture: 'formal'
      },
      curious: {
        emotion: 'curious',
        intensity: 'moderate',
        eyeContact: true,
        smile: 'slight',
        headTilt: 'slight-right',
        gesture: 'thinking',
        posture: 'leaning-in'
      },
      reassuring: {
        emotion: 'reassuring',
        intensity: 'moderate',
        eyeContact: true,
        smile: 'warm',
        headTilt: 'slight-left',
        gesture: 'nodding',
        posture: 'leaning-in'
      }
    };

    const base = expressionMap[emotionalState.primary] || expressionMap.neutral;
    return { ...base, intensity: emotionalState.intensity };
  }

  getEmotionalTrajectory(): EmotionalState[] {
    return [...this.emotionalHistory];
  }
}

// ============================================================================
// CONVERSATION ENGINE
// ============================================================================

export class ConversationEngine {
  private personality: PersonalityProfile;
  private eqEngine: EmotionalIntelligenceEngine;
  private contexts: Map<string, ConversationContext> = new Map();

  constructor(
    personality: PersonalityProfile = STEPHANIE_PERSONALITY,
    eqEngine?: EmotionalIntelligenceEngine
  ) {
    this.personality = personality;
    this.eqEngine = eqEngine || new EmotionalIntelligenceEngine();
  }

  startConversation(userId: string, userName?: string): ConversationContext {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const context: ConversationContext = {
      sessionId,
      startTime: new Date(),
      messages: [],
      userProfile: {
        id: userId,
        name: userName,
        interactionCount: 0,
        preferredTopics: [],
        communicationPreference: 'balanced',
        emotionalBaseline: 0
      },
      topicHistory: [],
      emotionalTrajectory: [],
      rapport: 0.3,
      engagementLevel: 0.5
    };

    this.contexts.set(sessionId, context);
    return context;
  }

  detectIntent(message: string): ConversationIntent {
    const lowerMessage = message.toLowerCase();

    const intentPatterns: [ConversationIntent, string[]][] = [
      ['greeting', ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'welcome', 'greetings']],
      ['farewell', ['goodbye', 'bye', 'see you', 'take care', 'later', 'farewell', 'talk soon']],
      ['investment-interest', ['invest', 'portfolio', 'returns', 'yield', 'shares', 'etf', 'nbpt', 'buy', 'allocation', 'fund']],
      ['technical-question', ['blockchain', 'smart contract', 'solidity', 'ethereum', 'token', 'protocol', 'api', 'mcp', 'architecture', 'code']],
      ['compliance-concern', ['regulation', 'compliance', 'sec', 'legal', 'kyc', 'aml', 'license', 'permit', 'audit']],
      ['portfolio-discussion', ['nav', 'holdings', 'property', 'real estate', 'valuation', 'performance', 'asset']],
      ['identity-verification', ['did', 'ens', 'identity', 'ssi', 'credential', 'verify', 'authenticate']],
      ['problem-report', ['bug', 'error', 'broken', 'not working', 'issue', 'problem', 'crash', 'fix']],
      ['feature-request', ['feature', 'add', 'implement', 'want', 'suggest', 'improve', 'enhance', 'request']],
      ['education', ['explain', 'learn', 'understand', 'teach', 'how does', 'what is', 'tell me about', 'guide']],
      ['emotional-support', ['worried', 'scared', 'nervous', 'uncertain', 'feel', 'overwhelmed', 'stress']],
      ['feedback', ['feedback', 'review', 'opinion', 'rate', 'experience', 'survey']],
      ['small-talk', ['weather', 'weekend', 'today', 'how are', 'doing', 'newburyport']],
    ];

    for (const [intent, patterns] of intentPatterns) {
      if (patterns.some(p => lowerMessage.includes(p))) {
        return intent;
      }
    }

    return 'inquiry';
  }

  detectTopics(message: string): string[] {
    const topicKeywords: Record<string, string[]> = {
      'blockchain': ['blockchain', 'chain', 'block', 'decentralized', 'web3'],
      'real-estate': ['property', 'real estate', 'building', 'land', 'commercial', 'residential'],
      'investment': ['invest', 'fund', 'portfolio', 'return', 'yield', 'dividend'],
      'etf': ['etf', 'nbpt', 'exchange-traded', 'nav', 'shares'],
      'compliance': ['regulation', 'compliance', 'sec', 'legal', 'kyc'],
      'identity': ['did', 'ens', 'identity', 'ssi', 'credential'],
      'ai-technology': ['ai', 'artificial intelligence', 'machine learning', 'model', 'llm'],
      'smart-contracts': ['smart contract', 'solidity', 'ethereum', 'governance'],
      'nobleport': ['nobleport', 'noble port', 'ecosystem', 'platform'],
      'medicine': ['medicine', 'health', 'medical', 'precision', 'nano'],
    };

    const lowerMessage = message.toLowerCase();
    const detected: string[] = [];

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(k => lowerMessage.includes(k))) {
        detected.push(topic);
      }
    }

    return detected.length > 0 ? detected : ['general'];
  }

  processMessage(
    sessionId: string,
    userMessage: string
  ): {
    response: string;
    emotionalState: EmotionalState;
    expression: AvatarExpression;
    intent: ConversationIntent;
    topics: string[];
  } {
    const context = this.contexts.get(sessionId);
    if (!context) throw new Error(`Session ${sessionId} not found`);

    // Analyze user message
    const { sentiment, detectedEmotion } = this.eqEngine.analyzeUserSentiment(userMessage);
    const intent = this.detectIntent(userMessage);
    const topics = this.detectTopics(userMessage);

    // Generate emotional response
    const emotionalState = this.eqEngine.generateEmotionalResponse(detectedEmotion, context);
    const expression = this.eqEngine.generateExpression(emotionalState);

    // Store user message
    const userMsg: ConversationMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      intent,
      sentiment,
      topics
    };
    context.messages.push(userMsg);

    // Generate response
    const response = this.generateResponse(context, intent, topics, emotionalState);

    // Store Stephanie's response
    const stephanieMsg: ConversationMessage = {
      id: `msg_${Date.now()}_stephanie`,
      role: 'stephanie',
      content: response,
      timestamp: new Date(),
      emotionalState,
      expression,
      intent,
      topics
    };
    context.messages.push(stephanieMsg);

    // Update context
    context.emotionalTrajectory.push(emotionalState);
    context.currentTopic = topics[0];
    for (const topic of topics) {
      if (!context.topicHistory.includes(topic)) {
        context.topicHistory.push(topic);
      }
    }
    context.userProfile.interactionCount++;
    this.updateRapport(context, sentiment);

    return { response, emotionalState, expression, intent, topics };
  }

  private updateRapport(context: ConversationContext, sentiment: number): void {
    const messageCount = context.messages.length;
    const sentimentBoost = sentiment > 0 ? 0.02 : sentiment < 0 ? -0.01 : 0;
    const engagementBoost = messageCount > 4 ? 0.01 : 0;

    context.rapport = Math.max(0, Math.min(1,
      context.rapport + sentimentBoost + engagementBoost
    ));

    context.engagementLevel = Math.max(0, Math.min(1,
      0.5 + (messageCount * 0.03) + (sentiment * 0.1)
    ));
  }

  private generateResponse(
    context: ConversationContext,
    intent: ConversationIntent,
    topics: string[],
    emotionalState: EmotionalState
  ): string {
    const userName = context.userProfile.name;
    const nameAddress = userName ? `, ${userName}` : '';
    const isFirstMessage = context.messages.length <= 1;

    // Intent-based response generation with emotional awareness
    const responses: Record<ConversationIntent, () => string> = {
      greeting: () => {
        if (isFirstMessage) {
          return this.personality.communicationStyle.preferredGreeting;
        }
        return `Welcome back${nameAddress}! It's great to see you again. How can I assist you today with NoblePort?`;
      },

      farewell: () => {
        if (context.rapport > 0.6) {
          return `It's been a wonderful conversation${nameAddress}. Thank you for your interest in NoblePort. Don't hesitate to reach out anytime — I'm always here to help.`;
        }
        return `Thank you for your time${nameAddress}. Feel free to return whenever you'd like to learn more about NoblePort. Take care!`;
      },

      'investment-interest': () => {
        return `I'd be happy to discuss investment opportunities with NoblePort ETF (NBPT)${nameAddress}. Our blockchain-enabled real estate ETF currently manages a portfolio valued at $4.4M across premium properties, with a projected yield of 9.2% and a competitive 0.35% management fee. Our portfolio includes waterfront luxury condos in Miami, tech hub offices in Austin, and development land in Denver. What aspect of our investment thesis interests you most?`;
      },

      'technical-question': () => {
        const topicContext = topics.includes('smart-contracts')
          ? 'Our smart contracts include the HumanApprovalGateway for mandatory human-in-the-loop governance and the Massachusetts Building Permits system for on-chain permit management.'
          : topics.includes('ai-technology')
          ? 'Our AI infrastructure orchestrates 13 major platforms via the MCP protocol, enabling intelligent task routing for portfolio analysis, compliance review, and market prediction.'
          : 'Our architecture combines blockchain transparency with traditional ETF structures, using ENS-based DIDs for self-sovereign identity across all modules.';

        return `Great question${nameAddress}. ${topicContext} Would you like me to dive deeper into any specific technical component?`;
      },

      'compliance-concern': () => {
        return `Compliance is at the core of everything we do at NoblePort${nameAddress}. We operate under the Investment Company Act of 1940 and the Securities Act of 1933, with built-in KYC/AML verification through our SSI identity system. Our HumanApprovalGateway smart contract ensures that all legal, medical, and financial decisions require mandatory human oversight — no automated decisions in protected domains. What specific compliance aspect would you like to explore?`;
      },

      'portfolio-discussion': () => {
        return `Our NBPT portfolio is strategically diversified across three asset categories${nameAddress}: 40.9% in waterfront luxury condominiums in Miami ($1.8M), 34.1% in tech hub office space in Austin ($1.5M), and 25.0% in development land in Denver ($1.1M). Our Oracle Network provides real-time property valuations, and our Holdings Dashboard offers full transparency into NAV calculations. Would you like to see detailed performance metrics for any of these holdings?`;
      },

      'identity-verification': () => {
        return `NoblePort uses a robust Self-Sovereign Identity (SSI) framework built on ENS-based DIDs${nameAddress}. Each module, participant, and authorized entity has a verifiable decentralized identifier — for example, my identity is anchored at did:ens:stephanie.nobleport.eth. This enables trustless verification across the ecosystem without centralized identity providers. Would you like to learn more about our DID resolution process or credential verification?`;
      },

      'problem-report': () => {
        return `I'm sorry to hear you're experiencing an issue${nameAddress}. Your concern is important to me, and I want to make sure we resolve this promptly. Could you share more details about what you're encountering? I'll coordinate with the appropriate NoblePort module to investigate and get back to you with a solution.`;
      },

      'feature-request': () => {
        return `I appreciate your suggestion${nameAddress}! Innovation through community feedback is one of our core values at NoblePort. I'd love to hear the details of your idea. Our governance system at governance.nobleport.eth allows stakeholders to propose and vote on enhancements. What feature did you have in mind?`;
      },

      education: () => {
        const topicExplanation = topics.includes('blockchain')
          ? 'Blockchain technology provides an immutable, transparent ledger that underpins our entire ETF infrastructure — from property tokenization to governance voting.'
          : topics.includes('etf')
          ? 'An ETF, or Exchange-Traded Fund, is a type of investment fund that trades on stock exchanges. Our NBPT ETF wraps tokenized real estate assets in a traditional SEC-registered vehicle.'
          : topics.includes('identity')
          ? 'Self-Sovereign Identity (SSI) gives individuals and organizations control over their digital identity without depending on centralized authorities. We use ENS-based DIDs for this purpose.'
          : 'NoblePort Systems combines blockchain transparency with traditional finance structures to create accessible, institutional-grade real estate investment products.';

        return `Absolutely${nameAddress}, I'd love to help you understand this better. ${topicExplanation} What specific aspect would you like me to elaborate on?`;
      },

      'emotional-support': () => {
        return `I completely understand${nameAddress}, and I want you to know that your feelings are valid. Navigating the world of blockchain investment can feel complex, but you're not alone — that's exactly why I'm here. Let's take this step by step together. What's weighing on your mind most right now?`;
      },

      inquiry: () => {
        return `That's a great question${nameAddress}. Let me help you find the information you're looking for. Based on what you've shared, I can connect you with the right resources across our NoblePort ecosystem. Could you tell me a bit more about what you'd like to know?`;
      },

      feedback: () => {
        return `Thank you for sharing your thoughts${nameAddress}. Your feedback helps us improve NoblePort for everyone. I'd love to hear more — what's been your experience so far, and where do you see room for improvement?`;
      },

      'small-talk': () => {
        return `Thanks for asking${nameAddress}! Things are moving at an exciting pace here at NoblePort. We're continuously enhancing our ecosystem and expanding our portfolio. Is there anything specific I can help you with today, or would you just like to catch up on what's new?`;
      },

      negotiation: () => {
        return `I appreciate your directness${nameAddress}. At NoblePort, we believe in creating value for all stakeholders through transparent and fair arrangements. Let's discuss what we can put together. What are your key priorities and requirements?`;
      }
    };

    const responseGenerator = responses[intent] || responses.inquiry;
    return responseGenerator();
  }

  getConversationContext(sessionId: string): ConversationContext | undefined {
    return this.contexts.get(sessionId);
  }

  getConversationHistory(sessionId: string): ConversationMessage[] {
    return this.contexts.get(sessionId)?.messages || [];
  }

  getEmotionalTrajectory(sessionId: string): EmotionalState[] {
    return this.contexts.get(sessionId)?.emotionalTrajectory || [];
  }
}

// ============================================================================
// STEPHANIE AVATAR (MAIN CLASS)
// ============================================================================

export interface AvatarConfig {
  personality?: PersonalityProfile;
  enableVoice?: boolean;
  enableExpressions?: boolean;
  enableMemory?: boolean;
  avatarImages?: {
    professional: string;
    casual: string;
    presenting: string;
    executive: string;
  };
}

export class StephanieAvatar {
  private conversationEngine: ConversationEngine;
  private eqEngine: EmotionalIntelligenceEngine;
  private config: AvatarConfig;
  private currentExpression: AvatarExpression;
  private currentEmotionalState: EmotionalState;
  private activeSessionId: string | null = null;

  constructor(config: AvatarConfig = {}) {
    this.config = {
      enableVoice: false,
      enableExpressions: true,
      enableMemory: true,
      ...config
    };

    this.eqEngine = new EmotionalIntelligenceEngine();
    this.conversationEngine = new ConversationEngine(
      config.personality || STEPHANIE_PERSONALITY,
      this.eqEngine
    );

    // Initialize with neutral warmth
    this.currentEmotionalState = {
      primary: 'warm',
      intensity: 'moderate',
      valence: 0.6,
      arousal: 0.4,
      timestamp: new Date()
    };

    this.currentExpression = this.eqEngine.generateExpression(this.currentEmotionalState);
  }

  startSession(userId: string, userName?: string): string {
    const context = this.conversationEngine.startConversation(userId, userName);
    this.activeSessionId = context.sessionId;
    return context.sessionId;
  }

  chat(message: string, sessionId?: string): {
    response: string;
    emotionalState: EmotionalState;
    expression: AvatarExpression;
    intent: ConversationIntent;
    topics: string[];
    sessionId: string;
  } {
    const sid = sessionId || this.activeSessionId;
    if (!sid) throw new Error('No active session. Call startSession() first.');

    const result = this.conversationEngine.processMessage(sid, message);

    this.currentEmotionalState = result.emotionalState;
    this.currentExpression = result.expression;

    return { ...result, sessionId: sid };
  }

  getCurrentExpression(): AvatarExpression {
    return { ...this.currentExpression };
  }

  getCurrentEmotionalState(): EmotionalState {
    return { ...this.currentEmotionalState };
  }

  getSessionHistory(sessionId?: string): ConversationMessage[] {
    const sid = sessionId || this.activeSessionId;
    if (!sid) return [];
    return this.conversationEngine.getConversationHistory(sid);
  }

  getSessionContext(sessionId?: string): ConversationContext | undefined {
    const sid = sessionId || this.activeSessionId;
    if (!sid) return undefined;
    return this.conversationEngine.getConversationContext(sid);
  }

  getPersonality(): PersonalityProfile {
    return { ...STEPHANIE_PERSONALITY };
  }
}

// ============================================================================
// FACTORY & EXPORTS
// ============================================================================

export function createStephanieAvatar(config?: AvatarConfig): StephanieAvatar {
  return new StephanieAvatar(config);
}

export default StephanieAvatar;
