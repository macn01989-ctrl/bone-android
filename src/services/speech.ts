import { Capacitor, registerPlugin } from '@capacitor/core';
import { SILICONFLOW_AUDIO_TRANSCRIPTIONS_URL } from '../shared/apiMeta';
import { blobToDataUrl, createSilentWav, extractTranscriptionText } from '../shared/media/audio';

type NativeHttpPlugin = {
  postMultipartAudio(options: {
    url: string;
    apiKey: string;
    model: string;
    dataUrl: string;
    fileName: string;
    mimeType: string;
    timeoutMs: number;
  }): Promise<{ status: number; body: string; text?: string; url?: string }>;
};

type SpeechUploadOptions = {
  apiKey: string;
  model: string;
  blob: Blob;
  fileName: string;
  mimeType?: string;
  timeoutMs: number;
  url?: string;
};

const NativeHttp = registerPlugin<NativeHttpPlugin>('NativeHttp');

function normalizeBearerToken(apiKey: string) {
  return apiKey.trim().replace(/^['"]|['"]$/g, '').replace(/^Bearer\s+/i, '').trim();
}

function formatSpeechError(status: number, body: string, options: SpeechUploadOptions) {
  return `speech api ${status} | model=${options.model} | file=${options.fileName} | mime=${options.mimeType || options.blob.type || 'audio/webm'} | bytes=${options.blob.size || 0} | body=${body || '(empty)'}`;
}

function parseSpeechPayload(body: string) {
  try {
    return JSON.parse(body || '{}') as unknown;
  } catch {
    return { text: body };
  }
}

async function postSpeechWithFetch(options: SpeechUploadOptions) {
  const formData = new FormData();
  const mimeType = options.mimeType || options.blob.type || 'audio/webm';
  formData.append('file', new File([options.blob], options.fileName, { type: mimeType }));
  formData.append('model', options.model);

  const response = await fetch(options.url || SILICONFLOW_AUDIO_TRANSCRIPTIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${normalizeBearerToken(options.apiKey)}`,
    },
    body: formData,
    signal: AbortSignal.timeout(options.timeoutMs),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(formatSpeechError(response.status, body, options));
  return parseSpeechPayload(body);
}

async function postSpeechWithNative(options: SpeechUploadOptions) {
  const mimeType = options.mimeType || options.blob.type || 'audio/webm';
  const response = await NativeHttp.postMultipartAudio({
    url: options.url || SILICONFLOW_AUDIO_TRANSCRIPTIONS_URL,
    apiKey: normalizeBearerToken(options.apiKey),
    model: options.model,
    dataUrl: await blobToDataUrl(options.blob),
    fileName: options.fileName,
    mimeType,
    timeoutMs: options.timeoutMs,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(formatSpeechError(response.status, response.body, options));
  }

  return response.text ? { text: response.text } : parseSpeechPayload(response.body);
}

export async function transcribeSpeechAudio(options: SpeechUploadOptions) {
  const payload = Capacitor.isNativePlatform()
    ? await postSpeechWithNative(options)
    : await postSpeechWithFetch(options);
  return extractTranscriptionText(payload);
}

export async function checkSpeechConnectivity(apiKey: string, model: string) {
  const testBlob = await fetch('/assets/asr-connectivity-test.wav')
    .then((response) => {
      if (!response.ok) throw new Error(`test audio ${response.status}`);
      return response.blob();
    })
    .catch(() => createSilentWav(1.2));

  await transcribeSpeechAudio({
    apiKey,
    model,
    blob: testBlob,
    fileName: 'bone-connectivity-test.wav',
    mimeType: 'audio/wav',
    timeoutMs: 90_000,
  });
}
