package com.bone.app;

import android.util.Base64;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

@CapacitorPlugin(name = "NativeHttp")
public class NativeHttpPlugin extends Plugin {
    @PluginMethod
    public void get(PluginCall call) {
        String url = call.getString("url", "");
        String apiKey = call.getString("apiKey", "");
        Integer timeoutValue = call.getInt("timeoutMs", 8000);
        int timeoutMs = timeoutValue == null ? 8000 : timeoutValue;

        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
            call.reject("invalid url");
            return;
        }

        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL requestUrl = new URL(url);
                connection = (HttpURLConnection) requestUrl.openConnection();
                connection.setRequestMethod("GET");
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(timeoutMs);
                connection.setReadTimeout(timeoutMs);
                connection.setRequestProperty("Accept", "application/json,text/xml,application/xml,text/plain,*/*");
                connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 Chrome Mobile Safari/537.36 Bone/1.0");
                String safeApiKey = normalizeBearerToken(apiKey);
                if (safeApiKey != null && !safeApiKey.isEmpty()) {
                    connection.setRequestProperty("Authorization", "Bearer " + safeApiKey);
                }

                int status = connection.getResponseCode();
                InputStream stream = status >= 200 && status < 400
                        ? connection.getInputStream()
                        : connection.getErrorStream();
                String body = stream == null ? "" : readToString(stream);

                JSObject result = new JSObject();
                result.put("status", status);
                result.put("body", body);
                result.put("url", connection.getURL().toString());
                getActivity().runOnUiThread(() -> call.resolve(result));
            } catch (Exception error) {
                getActivity().runOnUiThread(() -> call.reject(error.getMessage() == null ? "native http failed" : error.getMessage()));
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }).start();
    }

    @PluginMethod
    public void postJson(PluginCall call) {
        String url = call.getString("url", "");
        String apiKey = call.getString("apiKey", "");
        String body = call.getString("body", "{}");
        Integer timeoutValue = call.getInt("timeoutMs", 30000);
        int timeoutMs = timeoutValue == null ? 30000 : timeoutValue;

        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
            call.reject("invalid url");
            return;
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            call.reject("missing api key");
            return;
        }

        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL requestUrl = new URL(url);
                connection = (HttpURLConnection) requestUrl.openConnection();
                connection.setRequestMethod("POST");
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(timeoutMs <= 0 ? 15000 : Math.min(timeoutMs, 120000));
                connection.setReadTimeout(Math.max(timeoutMs, 0));
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setRequestProperty("Accept", "application/json,text/plain,*/*");
                connection.setRequestProperty("Authorization", "Bearer " + normalizeBearerToken(apiKey));
                connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 Chrome Mobile Safari/537.36 Bone/1.0");

                try (OutputStream output = connection.getOutputStream()) {
                    output.write((body == null ? "{}" : body).getBytes(StandardCharsets.UTF_8));
                    output.flush();
                }

                int status = connection.getResponseCode();
                InputStream stream = status >= 200 && status < 400
                        ? connection.getInputStream()
                        : connection.getErrorStream();
                String responseBody = stream == null ? "" : readToString(stream);

                JSObject result = new JSObject();
                result.put("status", status);
                result.put("body", responseBody);
                result.put("url", connection.getURL().toString());
                getActivity().runOnUiThread(() -> call.resolve(result));
            } catch (Exception error) {
                getActivity().runOnUiThread(() -> call.reject(error.getMessage() == null ? "native json post failed" : error.getMessage()));
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }).start();
    }

    @PluginMethod
    public void postMultipartAudio(PluginCall call) {
        final int maxAudioBytes = 50 * 1024 * 1024;
        String url = call.getString("url", "");
        String apiKey = call.getString("apiKey", "");
        String model = call.getString("model", "");
        String dataUrl = call.getString("dataUrl", "");
        String fileName = call.getString("fileName", "bone-recording.webm");
        String mimeType = call.getString("mimeType", "audio/webm");
        Integer timeoutValue = call.getInt("timeoutMs", 600000);
        int timeoutMs = timeoutValue == null ? 600000 : timeoutValue;
        final String requestedFileName = fileName;
        final String requestedMimeType = mimeType;

        if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
            call.reject("invalid url");
            return;
        }
        if (apiKey == null || apiKey.trim().isEmpty()) {
            call.reject("missing api key");
            return;
        }
        if (model == null || model.trim().isEmpty()) {
            call.reject("missing model");
            return;
        }
        if (dataUrl == null || dataUrl.trim().isEmpty()) {
            call.reject("missing audio data");
            return;
        }

        new Thread(() -> {
            HttpURLConnection connection = null;
            File tempFile = null;
            try {
                String uploadFileName = requestedFileName;
                String uploadMimeType = requestedMimeType;
                byte[] audioBytes = decodeDataUrl(dataUrl);
                if (audioBytes.length == 0) throw new Exception("empty audio");
                if (!looksLikeWav(audioBytes)) {
                    audioBytes = transcodeToWav16kMono(audioBytes);
                    uploadFileName = "bone-recording.wav";
                    uploadMimeType = "audio/wav";
                }
                if (audioBytes.length > maxAudioBytes) {
                    throw new Exception("ASR file too large: " + audioBytes.length + " bytes, SiliconFlow limit is 50MB");
                }

                tempFile = File.createTempFile("bone-transcription-", sanitizeExtension(uploadFileName), getContext().getCacheDir());
                try (FileOutputStream output = new FileOutputStream(tempFile)) {
                    output.write(audioBytes);
                }

                String boundary = "BoneBoundary" + UUID.randomUUID().toString().replace("-", "");
                byte[] multipartBody = buildMultipartAudioBody(boundary, model.trim(), uploadFileName, uploadMimeType, tempFile);
                URL requestUrl = new URL(url);
                connection = (HttpURLConnection) requestUrl.openConnection();
                connection.setRequestMethod("POST");
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(timeoutMs <= 0 ? 15000 : Math.min(timeoutMs, 120000));
                connection.setReadTimeout(Math.max(timeoutMs, 0));
                connection.setDoOutput(true);
                connection.setUseCaches(false);
                connection.setFixedLengthStreamingMode(multipartBody.length);
                connection.setRequestProperty("Authorization", "Bearer " + normalizeBearerToken(apiKey));
                connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
                connection.setRequestProperty("Content-Length", String.valueOf(multipartBody.length));
                connection.setRequestProperty("Accept", "application/json,text/plain,*/*");
                connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36 Chrome Mobile Safari/537.36 Bone/1.0");

                try (OutputStream output = connection.getOutputStream()) {
                    output.write(multipartBody);
                    output.flush();
                }

                int status = connection.getResponseCode();
                InputStream stream = status >= 200 && status < 400
                        ? connection.getInputStream()
                        : connection.getErrorStream();
                String body = stream == null ? "" : readToString(stream);

                JSObject result = new JSObject();
                result.put("status", status);
                result.put("body", body);
                result.put("url", connection.getURL().toString());
                if (status >= 200 && status < 400) {
                    result.put("text", extractTranscriptionText(body));
                }
                getActivity().runOnUiThread(() -> call.resolve(result));
            } catch (Exception error) {
                getActivity().runOnUiThread(() -> call.reject(error.getMessage() == null ? "native audio upload failed" : error.getMessage()));
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
                if (tempFile != null && tempFile.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    tempFile.delete();
                }
            }
        }).start();
    }

    private String readToString(InputStream stream) throws Exception {
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int length;
            while ((length = input.read(buffer)) != -1) {
                output.write(buffer, 0, length);
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    private String normalizeBearerToken(String apiKey) {
        if (apiKey == null) return "";
        String token = apiKey.trim();
        if ((token.startsWith("\"") && token.endsWith("\"")) || (token.startsWith("'") && token.endsWith("'"))) {
            token = token.substring(1, token.length() - 1).trim();
        }
        if (token.regionMatches(true, 0, "Bearer ", 0, 7)) {
            token = token.substring(7).trim();
        }
        return token;
    }

    private String extractTranscriptionText(String body) {
        if (body == null || body.trim().isEmpty()) return "";
        try {
            org.json.JSONObject json = new org.json.JSONObject(body);
            if (json.has("text") && !json.isNull("text")) {
                return json.optString("text", "").trim();
            }
            // Fallback: some providers wrap the result under a nested key.
            if (json.has("result") && !json.isNull("result")) {
                return json.optString("result", "").trim();
            }
        } catch (Exception ignored) {
        }
        return body.trim();
    }

    private byte[] decodeDataUrl(String dataUrl) {
        int commaIndex = dataUrl.indexOf(',');
        String base64 = commaIndex >= 0 ? dataUrl.substring(commaIndex + 1) : dataUrl;
        return Base64.decode(base64, Base64.DEFAULT);
    }

    private boolean looksLikeWav(byte[] bytes) {
        return bytes != null
                && bytes.length > 12
                && bytes[0] == 'R'
                && bytes[1] == 'I'
                && bytes[2] == 'F'
                && bytes[3] == 'F'
                && bytes[8] == 'W'
                && bytes[9] == 'A'
                && bytes[10] == 'V'
                && bytes[11] == 'E';
    }

    private byte[] transcodeToWav16kMono(byte[] inputBytes) throws Exception {
        File sourceFile = File.createTempFile("bone-asr-source-", ".audio", getContext().getCacheDir());
        MediaExtractor extractor = new MediaExtractor();
        MediaCodec decoder = null;
        try {
            try (FileOutputStream output = new FileOutputStream(sourceFile)) {
                output.write(inputBytes);
            }

            extractor.setDataSource(sourceFile.getAbsolutePath());
            int audioTrack = -1;
            MediaFormat inputFormat = null;
            for (int index = 0; index < extractor.getTrackCount(); index++) {
                MediaFormat format = extractor.getTrackFormat(index);
                String mime = format.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("audio/")) {
                    audioTrack = index;
                    inputFormat = format;
                    break;
                }
            }
            if (audioTrack < 0 || inputFormat == null) {
                throw new Exception("Native WAV convert failed: no audio track");
            }

            extractor.selectTrack(audioTrack);
            String mime = inputFormat.getString(MediaFormat.KEY_MIME);
            if (mime == null || mime.trim().isEmpty()) {
                throw new Exception("Native WAV convert failed: missing audio mime");
            }

            decoder = MediaCodec.createDecoderByType(mime);
            decoder.configure(inputFormat, null, null, 0);
            decoder.start();

            MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
            ByteArrayOutputStream pcmOutput = new ByteArrayOutputStream();
            ResampleState state = new ResampleState();
            MediaFormat outputFormat = inputFormat;
            boolean inputDone = false;
            boolean outputDone = false;

            while (!outputDone) {
                if (!inputDone) {
                    int inputIndex = decoder.dequeueInputBuffer(10000);
                    if (inputIndex >= 0) {
                        ByteBuffer inputBuffer = decoder.getInputBuffer(inputIndex);
                        if (inputBuffer == null) {
                            throw new Exception("Native WAV convert failed: decoder input buffer missing");
                        }
                        inputBuffer.clear();
                        int sampleSize = extractor.readSampleData(inputBuffer, 0);
                        if (sampleSize < 0) {
                            decoder.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            inputDone = true;
                        } else {
                            long sampleTime = extractor.getSampleTime();
                            decoder.queueInputBuffer(inputIndex, 0, sampleSize, Math.max(sampleTime, 0), 0);
                            extractor.advance();
                        }
                    }
                }

                int outputIndex = decoder.dequeueOutputBuffer(info, 10000);
                if (outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    outputFormat = decoder.getOutputFormat();
                } else if (outputIndex >= 0) {
                    ByteBuffer outputBuffer = decoder.getOutputBuffer(outputIndex);
                    if (outputBuffer != null && info.size > 0) {
                        outputBuffer.position(info.offset);
                        outputBuffer.limit(info.offset + info.size);
                        byte[] pcmChunk = new byte[info.size];
                        outputBuffer.get(pcmChunk);
                        int sampleRate = getFormatInt(outputFormat, MediaFormat.KEY_SAMPLE_RATE, getFormatInt(inputFormat, MediaFormat.KEY_SAMPLE_RATE, 48000));
                        int channels = getFormatInt(outputFormat, MediaFormat.KEY_CHANNEL_COUNT, getFormatInt(inputFormat, MediaFormat.KEY_CHANNEL_COUNT, 1));
                        appendPcm16As16kMono(pcmChunk, sampleRate, Math.max(1, channels), pcmOutput, state);
                    }
                    outputDone = (info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0;
                    decoder.releaseOutputBuffer(outputIndex, false);
                }
            }

            byte[] pcm = pcmOutput.toByteArray();
            if (pcm.length == 0) {
                throw new Exception("Native WAV convert failed: empty decoded pcm");
            }
            return buildWav(pcm, 16000, 1);
        } finally {
            try {
                extractor.release();
            } catch (Exception ignored) {
            }
            if (decoder != null) {
                try {
                    decoder.stop();
                } catch (Exception ignored) {
                }
                try {
                    decoder.release();
                } catch (Exception ignored) {
                }
            }
            if (sourceFile.exists()) {
                //noinspection ResultOfMethodCallIgnored
                sourceFile.delete();
            }
        }
    }

    private int getFormatInt(MediaFormat format, String key, int fallback) {
        try {
            return format != null && format.containsKey(key) ? format.getInteger(key) : fallback;
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private static class ResampleState {
        long sourceFrameIndex = 0;
        double nextOutputFrame = 0;
    }

    private void appendPcm16As16kMono(byte[] pcm, int sampleRate, int channels, ByteArrayOutputStream output, ResampleState state) {
        int sourceRate = sampleRate <= 0 ? 48000 : sampleRate;
        int channelCount = Math.max(1, channels);
        int bytesPerFrame = channelCount * 2;
        double sourceFramesPerOutputFrame = sourceRate / 16000.0;

        for (int offset = 0; offset + bytesPerFrame <= pcm.length; offset += bytesPerFrame) {
            int mixed = 0;
            for (int channel = 0; channel < channelCount; channel++) {
                int sampleOffset = offset + channel * 2;
                int low = pcm[sampleOffset] & 0xff;
                int high = pcm[sampleOffset + 1];
                mixed += (short) ((high << 8) | low);
            }
            short mono = (short) (mixed / channelCount);
            if (state.sourceFrameIndex + 1e-9 >= state.nextOutputFrame) {
                output.write(mono & 0xff);
                output.write((mono >> 8) & 0xff);
                state.nextOutputFrame += sourceFramesPerOutputFrame;
            }
            state.sourceFrameIndex += 1;
        }
    }

    private byte[] buildWav(byte[] pcm, int sampleRate, int channels) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream(44 + pcm.length);
        int byteRate = sampleRate * channels * 2;
        writeAscii(output, "RIFF");
        writeLittleEndianInt(output, 36 + pcm.length);
        writeAscii(output, "WAVE");
        writeAscii(output, "fmt ");
        writeLittleEndianInt(output, 16);
        writeLittleEndianShort(output, 1);
        writeLittleEndianShort(output, channels);
        writeLittleEndianInt(output, sampleRate);
        writeLittleEndianInt(output, byteRate);
        writeLittleEndianShort(output, channels * 2);
        writeLittleEndianShort(output, 16);
        writeAscii(output, "data");
        writeLittleEndianInt(output, pcm.length);
        output.write(pcm);
        return output.toByteArray();
    }

    private void writeAscii(OutputStream output, String value) throws Exception {
        output.write(value.getBytes(StandardCharsets.US_ASCII));
    }

    private void writeLittleEndianInt(OutputStream output, int value) throws Exception {
        output.write(value & 0xff);
        output.write((value >> 8) & 0xff);
        output.write((value >> 16) & 0xff);
        output.write((value >> 24) & 0xff);
    }

    private void writeLittleEndianShort(OutputStream output, int value) throws Exception {
        output.write(value & 0xff);
        output.write((value >> 8) & 0xff);
    }

    private String sanitizeExtension(String fileName) {
        String safeName = fileName == null ? "" : fileName.toLowerCase();
        if (safeName.endsWith(".m4a")) return ".m4a";
        if (safeName.endsWith(".mp4")) return ".mp4";
        if (safeName.endsWith(".ogg")) return ".ogg";
        if (safeName.endsWith(".wav")) return ".wav";
        if (safeName.endsWith(".mp3")) return ".mp3";
        return ".webm";
    }

    private void writeFormField(OutputStream output, String boundary, String name, String value) throws Exception {
        output.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Disposition: form-data; name=\"" + name + "\"\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        output.write((value == null ? "" : value).getBytes(StandardCharsets.UTF_8));
        output.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private void writeFileField(OutputStream output, String boundary, String name, String fileName, String mimeType, File file) throws Exception {
        String safeFileName = fileName == null || fileName.trim().isEmpty() ? "bone-recording.webm" : fileName.trim().replace("\"", "");
        String safeMimeType = normalizeAudioMimeType(safeFileName, mimeType);
        output.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Disposition: form-data; name=\"" + name + "\"; filename=\"" + safeFileName + "\"\r\n").getBytes(StandardCharsets.UTF_8));
        output.write(("Content-Type: " + safeMimeType + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[8192];
            int length;
            while ((length = input.read(buffer)) != -1) {
                output.write(buffer, 0, length);
            }
        }
        output.write("\r\n".getBytes(StandardCharsets.UTF_8));
    }

    private byte[] buildMultipartAudioBody(String boundary, String model, String fileName, String mimeType, File file) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        // Keep the order close to SiliconFlow's curl example: file first, then model.
        writeFileField(output, boundary, "file", fileName, mimeType, file);
        writeFormField(output, boundary, "model", model);
        output.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        return output.toByteArray();
    }

    private String normalizeAudioMimeType(String fileName, String mimeType) {
        String safeFileName = fileName == null ? "" : fileName.toLowerCase();
        String safeMimeType = mimeType == null ? "" : mimeType.trim().toLowerCase();
        if (safeFileName.endsWith(".wav")) return "audio/wav";
        if (safeFileName.endsWith(".mp3")) return "audio/mpeg";
        if (safeFileName.endsWith(".m4a") || safeFileName.endsWith(".mp4")) return "audio/mp4";
        if (safeFileName.endsWith(".ogg")) return "audio/ogg";
        if (!safeMimeType.isEmpty()) return safeMimeType;
        return "audio/webm";
    }
}
