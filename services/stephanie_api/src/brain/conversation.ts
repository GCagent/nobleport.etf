import { classifyDomain, DomainConfig, Domain } from './domains';
import { SYSTEM_PROMPT, getDomainPrompt } from './prompts';

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  domain?: string;
  timestamp: number;
}

export interface ConversationResponse {
  text: string;
  domain: string;
  requiresApproval: boolean;
  disclaimer?: string;
}

export class ConversationEngine {
  private history: ConversationTurn[] = [];
  private maxHistory = 20;

  async respond(userInput: string, _sessionId: string): Promise<ConversationResponse> {
    const domainConfig = classifyDomain(userInput);

    this.history.push({
      role: 'user',
      content: userInput,
      domain: domainConfig.domain,
      timestamp: Date.now(),
    });

    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    const response = await this.generateResponse(userInput, domainConfig);

    let text = response;
    if (domainConfig.disclaimer) {
      text = `${domainConfig.disclaimer}\n\n${response}`;
    }
    if (domainConfig.requiresHumanApproval) {
      text += '\n\n⚠️ This response has been flagged for human review before any action is taken.';
    }

    this.history.push({
      role: 'assistant',
      content: text,
      domain: domainConfig.domain,
      timestamp: Date.now(),
    });

    return {
      text,
      domain: domainConfig.domain,
      requiresApproval: domainConfig.requiresHumanApproval,
      disclaimer: domainConfig.disclaimer,
    };
  }

  private async generateResponse(userInput: string, domainConfig: DomainConfig): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.OPENAI_API_KEY;

    if (apiKey && apiKey !== 'placeholder') {
      return this.callLLM(userInput, domainConfig, apiKey);
    }

    return this.localResponse(userInput, domainConfig);
  }

  private async callLLM(userInput: string, domainConfig: DomainConfig, apiKey: string): Promise<string> {
    const domainPrompt = getDomainPrompt(domainConfig.domain);
    const messages = [
      ...this.history.slice(-10).map(t => ({ role: t.role, content: t.content })),
      { role: 'user' as const, content: userInput },
    ];

    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'placeholder') {
      return this.callAnthropic(messages, domainPrompt, apiKey);
    }

    return this.callOpenAI(messages, domainPrompt, apiKey);
  }

  private async callAnthropic(
    messages: Array<{ role: string; content: string }>,
    domainPrompt: string,
    apiKey: string,
  ): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: `${SYSTEM_PROMPT}\n\nCurrent domain context: ${domainPrompt}`,
        messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${err}`);
    }

    const data = await res.json() as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? 'I apologize, I had trouble generating a response. Could you rephrase that?';
  }

  private async callOpenAI(
    messages: Array<{ role: string; content: string }>,
    domainPrompt: string,
    apiKey: string,
  ): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 300,
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT}\n\nCurrent domain context: ${domainPrompt}` },
          ...messages,
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${err}`);
    }

    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? 'I apologize, I had trouble generating a response. Could you rephrase that?';
  }

  private localResponse(_userInput: string, domainConfig: DomainConfig): string {
    switch (domainConfig.domain) {
      case Domain.Greeting:
        return "Hi! I'm Stephanie with NoblePort. What project can I help you with today?";
      case Domain.Construction:
        return "I'd be happy to help with your construction project. Could you tell me the property address and what type of work you're planning?";
      case Domain.Permits:
        return "I can help guide you through the permit process. What's the property address and what work are you looking to do?";
      case Domain.DeFi:
        return "I can provide general information about the NoblePort platform. What would you like to know?";
      case Domain.Investment:
        return "I can share general information, but any investment-related guidance will need to be reviewed by a licensed advisor on our team.";
      case Domain.Compliance:
        return "I'll flag this for our compliance team to review. They'll provide guidance specific to your situation.";
      case Domain.General:
        return "I'm here to help. Could you tell me more about what you're looking for? I specialize in construction projects, permits, and the NoblePort platform.";
    }
  }

  getHistory(): ConversationTurn[] {
    return [...this.history];
  }
}
