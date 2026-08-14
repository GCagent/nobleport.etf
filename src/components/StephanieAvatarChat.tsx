'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StephanieAvatar,
  createStephanieAvatar,
  EmotionalState,
  AvatarExpression,
  ConversationMessage,
  ConversationIntent,
  EmotionType,
  STEPHANIE_PERSONALITY
} from '../lib/stephanieAvatar';

/**
 * Stephanie.ai Live Avatar Chat Component
 *
 * Interactive conversational interface with emotionally intelligent avatar
 * CEO of NoblePort Systems - blockchain-enabled real estate ETF
 *
 * Features:
 * - Live avatar with dynamic emotional expressions
 * - Real-time sentiment analysis and empathetic responses
 * - Contextual conversation with topic awareness
 * - Emotional state visualization
 * - Conversation history with expression indicators
 * - Rapport and engagement tracking
 */

// ============================================================================
// TYPES
// ============================================================================

interface ChatState {
  sessionId: string | null;
  messages: ConversationMessage[];
  isTyping: boolean;
  currentExpression: AvatarExpression;
  currentEmotion: EmotionalState;
  rapport: number;
  engagement: number;
  currentTopics: string[];
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const EmotionIndicator: React.FC<{ emotion: EmotionType; intensity: string }> = ({ emotion, intensity }) => {
  const emotionConfig: Record<EmotionType, { color: string; label: string }> = {
    neutral: { color: 'bg-gray-400', label: 'Neutral' },
    warm: { color: 'bg-amber-400', label: 'Warm' },
    enthusiastic: { color: 'bg-yellow-400', label: 'Enthusiastic' },
    empathetic: { color: 'bg-pink-400', label: 'Empathetic' },
    concerned: { color: 'bg-orange-400', label: 'Concerned' },
    confident: { color: 'bg-blue-400', label: 'Confident' },
    thoughtful: { color: 'bg-indigo-400', label: 'Thoughtful' },
    encouraging: { color: 'bg-green-400', label: 'Encouraging' },
    celebratory: { color: 'bg-yellow-300', label: 'Celebratory' },
    serious: { color: 'bg-slate-500', label: 'Serious' },
    curious: { color: 'bg-cyan-400', label: 'Curious' },
    reassuring: { color: 'bg-teal-400', label: 'Reassuring' }
  };

  const config = emotionConfig[emotion] || emotionConfig.neutral;
  const intensitySize = intensity === 'strong' ? 'w-3 h-3' : intensity === 'moderate' ? 'w-2.5 h-2.5' : 'w-2 h-2';

  return (
    <div className="flex items-center gap-1.5">
      <span className={`${config.color} ${intensitySize} rounded-full inline-block animate-pulse`} />
      <span className="text-xs text-gray-400">{config.label}</span>
    </div>
  );
};

const ExpressionVisualizer: React.FC<{ expression: AvatarExpression }> = ({ expression }) => {
  const smileMap = { none: '--', slight: '~', warm: ')', broad: 'D' };
  const gestureLabels: Record<string, string> = {
    'none': '',
    'open-hands': 'Open Hands',
    'pointing': 'Pointing',
    'thinking': 'Thinking',
    'welcoming': 'Welcoming',
    'nodding': 'Nodding'
  };

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="flex items-center gap-1">
        <span className="text-gray-500">Eye Contact:</span>
        <span className={expression.eyeContact ? 'text-green-400' : 'text-gray-500'}>
          {expression.eyeContact ? 'Yes' : 'No'}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-gray-500">Smile:</span>
        <span className="text-white">{expression.smile}</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-gray-500">Posture:</span>
        <span className="text-white">{expression.posture}</span>
      </div>
      {gestureLabels[expression.gesture] && (
        <div className="flex items-center gap-1">
          <span className="text-gray-500">Gesture:</span>
          <span className="text-white">{gestureLabels[expression.gesture]}</span>
        </div>
      )}
    </div>
  );
};

const RapportMeter: React.FC<{ rapport: number; engagement: number }> = ({ rapport, engagement }) => {
  return (
    <div className="space-y-2">
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-400">Rapport</span>
          <span className="text-xs text-gray-300">{Math.round(rapport * 100)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-gradient-to-r from-purple-500 to-pink-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${rapport * 100}%` }}
          />
        </div>
      </div>
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-400">Engagement</span>
          <span className="text-xs text-gray-300">{Math.round(engagement * 100)}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-gradient-to-r from-blue-500 to-cyan-500 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${engagement * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

const TopicBadges: React.FC<{ topics: string[] }> = ({ topics }) => {
  const topicColors: Record<string, string> = {
    'blockchain': 'bg-blue-500/20 text-blue-300',
    'real-estate': 'bg-green-500/20 text-green-300',
    'investment': 'bg-amber-500/20 text-amber-300',
    'etf': 'bg-purple-500/20 text-purple-300',
    'compliance': 'bg-red-500/20 text-red-300',
    'identity': 'bg-cyan-500/20 text-cyan-300',
    'ai-technology': 'bg-indigo-500/20 text-indigo-300',
    'smart-contracts': 'bg-orange-500/20 text-orange-300',
    'nobleport': 'bg-violet-500/20 text-violet-300',
    'medicine': 'bg-pink-500/20 text-pink-300',
    'general': 'bg-gray-500/20 text-gray-300'
  };

  return (
    <div className="flex flex-wrap gap-1">
      {topics.map((topic, idx) => (
        <span
          key={idx}
          className={`text-xs px-2 py-0.5 rounded-full ${topicColors[topic] || topicColors.general}`}
        >
          {topic.replace(/-/g, ' ')}
        </span>
      ))}
    </div>
  );
};

const IntentBadge: React.FC<{ intent: ConversationIntent }> = ({ intent }) => {
  const intentConfig: Record<ConversationIntent, { color: string; label: string }> = {
    greeting: { color: 'text-green-400', label: 'Greeting' },
    inquiry: { color: 'text-blue-400', label: 'Inquiry' },
    'investment-interest': { color: 'text-amber-400', label: 'Investment' },
    'technical-question': { color: 'text-indigo-400', label: 'Technical' },
    'compliance-concern': { color: 'text-red-400', label: 'Compliance' },
    'portfolio-discussion': { color: 'text-purple-400', label: 'Portfolio' },
    feedback: { color: 'text-teal-400', label: 'Feedback' },
    farewell: { color: 'text-gray-400', label: 'Farewell' },
    'small-talk': { color: 'text-cyan-400', label: 'Chat' },
    'problem-report': { color: 'text-orange-400', label: 'Issue' },
    'feature-request': { color: 'text-lime-400', label: 'Feature Req' },
    'identity-verification': { color: 'text-violet-400', label: 'Identity' },
    'emotional-support': { color: 'text-pink-400', label: 'Support' },
    education: { color: 'text-sky-400', label: 'Education' },
    negotiation: { color: 'text-yellow-400', label: 'Negotiation' }
  };

  const config = intentConfig[intent] || intentConfig.inquiry;
  return <span className={`text-xs ${config.color}`}>{config.label}</span>;
};

const AvatarDisplay: React.FC<{
  expression: AvatarExpression;
  emotion: EmotionalState;
  isTyping: boolean;
}> = ({ expression, emotion, isTyping }) => {
  const getAvatarGlow = (): string => {
    const glowMap: Record<EmotionType, string> = {
      neutral: 'shadow-gray-500/20',
      warm: 'shadow-amber-500/30',
      enthusiastic: 'shadow-yellow-500/40',
      empathetic: 'shadow-pink-500/30',
      concerned: 'shadow-orange-500/30',
      confident: 'shadow-blue-500/30',
      thoughtful: 'shadow-indigo-500/30',
      encouraging: 'shadow-green-500/30',
      celebratory: 'shadow-yellow-400/50',
      serious: 'shadow-slate-500/20',
      curious: 'shadow-cyan-500/30',
      reassuring: 'shadow-teal-500/30'
    };
    return glowMap[emotion.primary] || glowMap.neutral;
  };

  const getPostureClass = (): string => {
    switch (expression.posture) {
      case 'leaning-in': return 'scale-105';
      case 'relaxed': return 'scale-100';
      case 'formal': return 'scale-100';
      default: return 'scale-100';
    }
  };

  const getTiltClass = (): string => {
    switch (expression.headTilt) {
      case 'slight-left': return '-rotate-2';
      case 'slight-right': return 'rotate-2';
      default: return 'rotate-0';
    }
  };

  return (
    <div className="flex flex-col items-center">
      {/* Avatar Container */}
      <div className={`relative transition-all duration-700 ${getPostureClass()}`}>
        {/* Emotional Glow Ring */}
        <div className={`absolute -inset-2 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 blur-lg ${isTyping ? 'animate-pulse' : ''}`} />

        {/* Avatar Image */}
        <div className={`relative w-32 h-32 rounded-full overflow-hidden border-3 border-purple-400/60 shadow-2xl ${getAvatarGlow()} transition-transform duration-500 ${getTiltClass()}`}>
          <div className="w-full h-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <div className="text-center">
              <span className="text-4xl font-bold text-white">S</span>
              <span className="text-lg text-purple-200">.ai</span>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-gray-900 ${isTyping ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
      </div>

      {/* Name & Title */}
      <div className="mt-3 text-center">
        <h3 className="text-white font-semibold text-lg">
          Stephanie<span className="text-purple-400">.ai</span>
        </h3>
        <p className="text-gray-400 text-xs">CEO, NoblePort Systems</p>
      </div>

      {/* Current Emotion */}
      <div className="mt-2">
        <EmotionIndicator emotion={emotion.primary} intensity={emotion.intensity} />
      </div>
    </div>
  );
};

const MessageBubble: React.FC<{
  message: ConversationMessage;
  showMeta?: boolean;
}> = ({ message, showMeta = false }) => {
  const isStephanie = message.role === 'stephanie';

  return (
    <div className={`flex ${isStephanie ? 'justify-start' : 'justify-end'} mb-4`}>
      <div className={`max-w-[80%] ${isStephanie ? 'order-1' : 'order-1'}`}>
        {/* Message Header */}
        <div className={`flex items-center gap-2 mb-1 ${isStephanie ? '' : 'justify-end'}`}>
          <span className="text-xs font-medium text-gray-400">
            {isStephanie ? 'Stephanie' : 'You'}
          </span>
          <span className="text-xs text-gray-600">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isStephanie && message.emotionalState && (
            <EmotionIndicator
              emotion={message.emotionalState.primary}
              intensity={message.emotionalState.intensity}
            />
          )}
        </div>

        {/* Message Content */}
        <div className={`rounded-2xl px-4 py-3 ${
          isStephanie
            ? 'bg-gradient-to-br from-purple-900/60 to-blue-900/40 border border-purple-500/20 text-gray-100'
            : 'bg-gray-700/60 border border-gray-600/30 text-gray-100'
        }`}>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>

        {/* Message Meta */}
        {showMeta && message.intent && (
          <div className={`flex items-center gap-2 mt-1 ${isStephanie ? '' : 'justify-end'}`}>
            <IntentBadge intent={message.intent} />
            {message.topics && message.topics.length > 0 && (
              <TopicBadges topics={message.topics} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const TypingIndicator: React.FC = () => (
  <div className="flex justify-start mb-4">
    <div className="bg-purple-900/40 border border-purple-500/20 rounded-2xl px-4 py-3">
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400 mr-2">Stephanie is composing</span>
        <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

const QuickActionChips: React.FC<{ onSelect: (text: string) => void }> = ({ onSelect }) => {
  const actions = [
    { label: 'Tell me about NBPT', text: 'Tell me about the NoblePort ETF and how it works.' },
    { label: 'Investment options', text: 'What investment opportunities are available with NoblePort?' },
    { label: 'How blockchain works', text: 'Can you explain how blockchain technology powers your platform?' },
    { label: 'Compliance & security', text: 'How does NoblePort handle regulatory compliance and security?' },
    { label: 'Portfolio details', text: 'What properties are in the current NBPT portfolio?' },
    { label: 'Identity system', text: 'How does the self-sovereign identity system work?' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(action.text)}
          className="text-xs px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50 transition-all"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const StephanieAvatarChat: React.FC = () => {
  const [avatar] = useState<StephanieAvatar>(() => createStephanieAvatar());
  const [chatState, setChatState] = useState<ChatState>({
    sessionId: null,
    messages: [],
    isTyping: false,
    currentExpression: {
      emotion: 'warm',
      intensity: 'moderate',
      eyeContact: true,
      smile: 'warm',
      headTilt: 'none',
      gesture: 'welcoming',
      posture: 'upright'
    },
    currentEmotion: {
      primary: 'warm',
      intensity: 'moderate',
      valence: 0.6,
      arousal: 0.4,
      timestamp: new Date()
    },
    rapport: 0.3,
    engagement: 0.5,
    currentTopics: []
  });
  const [inputValue, setInputValue] = useState('');
  const [showExpressionPanel, setShowExpressionPanel] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize session
  useEffect(() => {
    const sessionId = avatar.startSession('web-user', undefined);
    setChatState(prev => ({ ...prev, sessionId }));

    // Show welcome message after a brief delay
    const timer = setTimeout(() => {
      const welcomeResult = avatar.chat('Hello!', sessionId);
      setChatState(prev => ({
        ...prev,
        messages: avatar.getSessionHistory(sessionId),
        currentExpression: welcomeResult.expression,
        currentEmotion: welcomeResult.emotionalState,
        currentTopics: welcomeResult.topics
      }));
    }, 800);

    return () => clearTimeout(timer);
  }, [avatar]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatState.messages]);

  const sendMessage = useCallback((text: string) => {
    if (!text.trim() || !chatState.sessionId) return;

    setChatState(prev => ({ ...prev, isTyping: true }));

    // Simulate typing delay for natural feel
    const typingDelay = Math.min(1500, 400 + text.length * 10);

    setTimeout(() => {
      const result = avatar.chat(text, chatState.sessionId!);
      const context = avatar.getSessionContext(chatState.sessionId!);

      setChatState(prev => ({
        ...prev,
        messages: avatar.getSessionHistory(chatState.sessionId!),
        isTyping: false,
        currentExpression: result.expression,
        currentEmotion: result.emotionalState,
        currentTopics: result.topics,
        rapport: context?.rapport || prev.rapport,
        engagement: context?.engagementLevel || prev.engagement
      }));
    }, typingDelay);

    setInputValue('');
  }, [avatar, chatState.sessionId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleQuickAction = (text: string) => {
    sendMessage(text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-950 to-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-black/40 backdrop-blur-md border-b border-purple-500/20 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Mini Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center border-2 border-purple-400/40">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">
                  Stephanie<span className="text-purple-400">.ai</span>
                  <span className="text-xs font-normal text-gray-400 ml-2">Live Avatar</span>
                </h1>
                <p className="text-xs text-gray-400">
                  CEO, NoblePort Systems &middot; did:ens:stephanie.nobleport.eth
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMetadata(!showMetadata)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                  showMetadata ? 'bg-purple-500/30 text-purple-300' : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                Intent Analysis
              </button>
              <button
                onClick={() => setShowExpressionPanel(!showExpressionPanel)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                  showExpressionPanel ? 'bg-purple-500/30 text-purple-300' : 'bg-white/5 text-gray-400 hover:text-white'
                }`}
              >
                EQ Panel
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex max-w-6xl mx-auto w-full">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
            {/* Avatar Welcome */}
            {chatState.messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-6">
                <AvatarDisplay
                  expression={chatState.currentExpression}
                  emotion={chatState.currentEmotion}
                  isTyping={false}
                />
                <div className="text-center max-w-md">
                  <p className="text-gray-300 text-sm mb-4">
                    {STEPHANIE_PERSONALITY.communicationStyle.preferredGreeting}
                  </p>
                  <QuickActionChips onSelect={handleQuickAction} />
                </div>
              </div>
            )}

            {/* Message History */}
            {chatState.messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                showMeta={showMetadata}
              />
            ))}

            {/* Typing Indicator */}
            {chatState.isTyping && <TypingIndicator />}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Actions (show after first exchange) */}
          {chatState.messages.length > 0 && chatState.messages.length < 6 && !chatState.isTyping && (
            <div className="px-4 pb-2">
              <QuickActionChips onSelect={handleQuickAction} />
            </div>
          )}

          {/* Input Area */}
          <div className="bg-black/30 border-t border-purple-500/20 p-4">
            <form onSubmit={handleSubmit} className="flex gap-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Message Stephanie..."
                disabled={chatState.isTyping}
                className="flex-1 bg-white/5 border border-purple-500/20 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/30 disabled:opacity-50 transition-all"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || chatState.isTyping}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl font-medium text-sm hover:from-purple-500 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Send
              </button>
            </form>
            <p className="text-xs text-gray-600 mt-2 text-center">
              Powered by Stephanie.ai Emotional Intelligence Engine &middot; NoblePort.eth
            </p>
          </div>
        </div>

        {/* EQ Side Panel */}
        {showExpressionPanel && (
          <div className="w-72 bg-black/30 border-l border-purple-500/20 p-4 overflow-y-auto">
            <h3 className="text-sm font-semibold text-white mb-4">Emotional Intelligence</h3>

            {/* Avatar */}
            <div className="mb-6">
              <AvatarDisplay
                expression={chatState.currentExpression}
                emotion={chatState.currentEmotion}
                isTyping={chatState.isTyping}
              />
            </div>

            {/* Expression Details */}
            <div className="mb-6">
              <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Expression</h4>
              <ExpressionVisualizer expression={chatState.currentExpression} />
            </div>

            {/* Emotional Metrics */}
            <div className="mb-6">
              <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Emotional State</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Valence</span>
                  <span className="text-white">{chatState.currentEmotion.valence.toFixed(2)}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1">
                  <div
                    className="bg-gradient-to-r from-red-500 via-gray-400 to-green-500 h-1 rounded-full"
                    style={{ width: `${(chatState.currentEmotion.valence + 1) * 50}%` }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Arousal</span>
                  <span className="text-white">{chatState.currentEmotion.arousal.toFixed(2)}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-yellow-500 h-1 rounded-full"
                    style={{ width: `${chatState.currentEmotion.arousal * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Rapport & Engagement */}
            <div className="mb-6">
              <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Connection</h4>
              <RapportMeter rapport={chatState.rapport} engagement={chatState.engagement} />
            </div>

            {/* Current Topics */}
            {chatState.currentTopics.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Active Topics</h4>
                <TopicBadges topics={chatState.currentTopics} />
              </div>
            )}

            {/* Personality Traits */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-gray-400 mb-2">Personality Profile</h4>
              <div className="space-y-1.5">
                {Object.entries(STEPHANIE_PERSONALITY.traits).map(([trait, value]) => (
                  <div key={trait}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs text-gray-500 capitalize">{trait}</span>
                      <span className="text-xs text-gray-400">{Math.round(value * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-1">
                      <div
                        className="bg-purple-500 h-1 rounded-full"
                        style={{ width: `${value * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StephanieAvatarChat;
