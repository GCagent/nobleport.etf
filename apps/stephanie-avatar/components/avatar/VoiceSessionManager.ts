export interface LatencyContract {
  perceivedTargetMs: number;
  asrProcessingMaxMs: number;
  agentThoughtMaxMs: number;
  ttsGenerationMaxMs: number;
  allowableAudioVisualDriftMs: number;
}

export const MIL_SPEC_LATENCY_CONTRACT: LatencyContract = {
  perceivedTargetMs: 250,
  asrProcessingMaxMs: 80,
  agentThoughtMaxMs: 80,
  ttsGenerationMaxMs: 60,
  allowableAudioVisualDriftMs: 20,
};

export interface VoiceSessionOptions {
  /** wss endpoint of the orchestrator voice ingress. */
  endpoint?: string;
  onProsodyUpdate?: (emotionVector: number[]) => void;
}

const DEFAULT_ENDPOINT = "wss://api.nobleport.systems/v1/voice/stream";

export class VoiceSessionManager {
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private socket: WebSocket | null = null;

  constructor(
    private readonly sessionId: string,
    private readonly options: VoiceSessionOptions = {}
  ) {}

  public async initializeVoiceSession(stream: MediaStream): Promise<void> {
    const endpoint = this.options.endpoint ?? DEFAULT_ENDPOINT;
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.socket = new WebSocket(
      `${endpoint}?session=${encodeURIComponent(this.sessionId)}`
    );
    this.socket.binaryType = "arraybuffer";

    this.source = this.audioContext.createMediaStreamSource(stream);
    // ScriptProcessorNode is deprecated but universally supported; the
    // AudioWorklet migration is tracked with the LiveKit transport swap.
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const int16Buffer = this.convertTo16BitPCM(inputData);
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(int16Buffer);
      }
    };
  }

  public async close(): Promise<void> {
    this.processor?.disconnect();
    this.source?.disconnect();
    this.socket?.close();
    if (this.audioContext && this.audioContext.state !== "closed") {
      await this.audioContext.close();
    }
    this.processor = null;
    this.source = null;
    this.socket = null;
    this.audioContext = null;
  }

  private convertTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }
}
