export interface STTResult {
  text: string;
  confidence: number;
  durationMs: number;
  language: string;
  isFinal: boolean;
}

export interface STTProvider {
  transcribe(audio: Buffer, opts?: STTOptions): Promise<STTResult>;
  streamStart(onPartial: (r: STTResult) => void, onFinal: (r: STTResult) => void): STTStream;
}

export interface STTOptions {
  language?: string;
  model?: string;
}

export interface STTStream {
  feed(chunk: Buffer): void;
  end(): Promise<STTResult>;
  abort(): void;
}

export class DeepgramSTT implements STTProvider {
  private apiKey: string;
  private baseUrl = 'https://api.deepgram.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(audio: Buffer, opts?: STTOptions): Promise<STTResult> {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}/listen?model=${opts?.model ?? 'nova-2'}&language=${opts?.language ?? 'en'}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${this.apiKey}`,
        'Content-Type': 'audio/wav',
      },
      body: audio as unknown as BodyInit,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Deepgram STT failed (${res.status}): ${err}`);
    }

    const data = await res.json() as {
      results?: { channels?: Array<{ alternatives?: Array<{ transcript?: string; confidence?: number }> }> };
    };
    const alt = data.results?.channels?.[0]?.alternatives?.[0];

    return {
      text: alt?.transcript ?? '',
      confidence: alt?.confidence ?? 0,
      durationMs: Date.now() - start,
      language: opts?.language ?? 'en',
      isFinal: true,
    };
  }

  streamStart(onPartial: (r: STTResult) => void, onFinal: (r: STTResult) => void): STTStream {
    const chunks: Buffer[] = [];
    let aborted = false;

    return {
      feed(chunk: Buffer) {
        if (!aborted) chunks.push(chunk);
      },
      end: async () => {
        const full = Buffer.concat(chunks);
        const result = await this.transcribe(full);
        onFinal(result);
        return result;
      },
      abort() {
        aborted = true;
        onPartial({ text: '', confidence: 0, durationMs: 0, language: 'en', isFinal: false });
      },
    };
  }
}

export class FallbackSTT implements STTProvider {
  async transcribe(): Promise<STTResult> {
    return { text: '', confidence: 0, durationMs: 0, language: 'en', isFinal: true };
  }
  streamStart(_onPartial: (r: STTResult) => void, onFinal: (r: STTResult) => void): STTStream {
    return {
      feed() {},
      end: async () => {
        const r: STTResult = { text: '[text-mode-fallback]', confidence: 1, durationMs: 0, language: 'en', isFinal: true };
        onFinal(r);
        return r;
      },
      abort() {},
    };
  }
}

export function createSTTProvider(): STTProvider {
  const key = process.env.DEEPGRAM_API_KEY;
  if (key && key !== 'placeholder') {
    return new DeepgramSTT(key);
  }
  console.warn('[STT] No Deepgram key configured — using fallback (text-only mode)');
  return new FallbackSTT();
}
