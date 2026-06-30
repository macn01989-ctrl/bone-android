import { Capacitor, registerPlugin } from '@capacitor/core';

type NativeHttpPlugin = {
  get(options: { url: string; timeoutMs?: number }): Promise<{ status: number; body: string; url?: string }>;
  postJson(options: {
    url: string;
    apiKey: string;
    body: string;
    timeoutMs?: number;
  }): Promise<{ status: number; body: string; url?: string }>;
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

export const NativeHttp = registerPlugin<NativeHttpPlugin>('NativeHttp');

export function shouldUseNativeHttp(url: string) {
  return Capacitor.isNativePlatform() && /^https?:\/\//i.test(url);
}

export async function nativeHttpGet(url: string, timeoutMs: number): Promise<string> {
  const response = await NativeHttp.get({ url, timeoutMs });
  if (response.status < 200 || response.status >= 300) throw new Error(`请求失败（${response.status}）`);
  return response.body;
}
