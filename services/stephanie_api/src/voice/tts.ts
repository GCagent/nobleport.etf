export interface TTSResult {
  audio: Buffer;
  durationMs: number;
  format: string;
  visemes?: VisemeEvent[];
}

export interface VisemeEvent {
  time: number;
  viseme: string;
}

export interface TTSProvider {
  synthesize(text: string, opts?: TTSOptions): Promise<TTSResult>;
}

export interface TTSOptions {
  voiceId?: string;
  speed?: number;
  format?: 'mp3' | 'pcm' | 'opus';
}

export class ElevenLabsTTS implements TTSProvider {
  private apiKey: string;
  private defaultVoice: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor(apiKey: string, defaultVoice?: string) {
    this.apiKey = apiKey;
    this.defaultVoice = defaultVoice ?? 'EXAVITQu4vr4xnSDxMaL'; // Bella
  }

  async synthesize(text: string, opts?: TTSOptions): Promise<TTSResult> {
    const start = Date.now();
    const voiceId = opts?.voiceId ?? this.defaultVoice;
    const res = await fetch(
      `${this.baseUrl}/text-to-speech/${voiceId}?output_format=${opts?.format ?? 'mp3_44100_128'}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.8, speed: opts?.speed ?? 1.0 },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ElevenLabs TTS failed (${res.status}): ${err}`);
    }

    const audio = Buffer.from(await res.arrayBuffer());
    return {
      audio,
      durationMs: Date.now() - start,
      format: opts?.format ?? 'mp3',
    };
  }
}

export class FallbackTTS implements TTSProvider {
  async synthesize(text: string): Promise<TTSResult> {
    return {
      audio: Buffer.from(text, 'utf-8'),
      durationMs: 0,
      format: 'text',
    };
  }
}

export function createTTSProvider(): TTSProvider {
  const key = process.env.ELEVENLABS_API_KEY;
  if (key && key !== 'placeholder') {
    return new ElevenLabsTTS(key, process.env.ELEVENLABS_VOICE_ID);
  }
  console.warn('[TTS] No ElevenLabs key configured — using fallback (text-only mode)');
  return new FallbackTTS();
}
