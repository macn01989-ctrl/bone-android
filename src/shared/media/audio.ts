export function formatRecorderTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function chooseAudioMimeType() {
  const candidates = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export function audioExtension(type: string) {
  if (type.includes('mp4')) return 'm4a';
  if (type.includes('ogg')) return 'ogg';
  if (type.includes('wav')) return 'wav';
  return 'webm';
}

export function recommendedAsrTimeout(durationSeconds: number, configuredTimeout = 0) {
  const minimum = 90_000;
  const estimated = minimum + Math.max(0, durationSeconds) * 1500;
  return Math.min(12 * 60_000, Math.max(minimum, configuredTimeout || 0, estimated));
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function buildWavBlob(samples: Float32Array, sampleRate = 16000) {
  const byteLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + byteLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + byteLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, byteLength, true);

  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

export function createSilentWav(durationSeconds = 1.2) {
  const sampleRate = 16000;
  const length = Math.max(1, Math.floor(sampleRate * durationSeconds));
  return buildWavBlob(new Float32Array(length), sampleRate);
}

export async function normalizeAudioToWav(blob: Blob) {
  if (blob.type.includes('wav')) return blob;

  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return blob;

    const context = new AudioContextCtor();
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const targetRate = 16000;
    const targetLength = Math.max(1, Math.floor(decoded.duration * targetRate));
    const samples = new Float32Array(targetLength);
    const sourceToTargetRatio = decoded.sampleRate / targetRate;

    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const data = decoded.getChannelData(channel);
      for (let index = 0; index < targetLength; index += 1) {
        const sourceIndex = index * sourceToTargetRatio;
        const leftIndex = Math.floor(sourceIndex);
        const rightIndex = Math.min(leftIndex + 1, data.length - 1);
        const mix = sourceIndex - leftIndex;
        samples[index] += (data[leftIndex] || 0) * (1 - mix) + (data[rightIndex] || 0) * mix;
      }
    }

    for (let index = 0; index < targetLength; index += 1) {
      samples[index] /= Math.max(1, decoded.numberOfChannels);
    }

    void context.close();
    return buildWavBlob(samples, targetRate);
  } catch {
    return blob;
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('audio read failed'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(blob);
  });
}

export function extractTranscriptionText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.transcription === 'string') return record.transcription;
  if (typeof record.result === 'string') return record.result;

  const data = record.data;
  if (data && typeof data === 'object') {
    const dataRecord = data as Record<string, unknown>;
    if (typeof dataRecord.text === 'string') return dataRecord.text;
  }

  return extractChatText(value);
}

export function extractChatText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const choices = record.choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';

  const first = choices[0] as Record<string, unknown>;
  if (typeof first.text === 'string') return first.text;

  const message = first.message;
  if (message && typeof message === 'object') {
    const content = (message as Record<string, unknown>).content;
    if (typeof content === 'string') return content;
  }

  return '';
}
