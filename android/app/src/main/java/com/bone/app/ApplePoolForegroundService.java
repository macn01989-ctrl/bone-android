package com.bone.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorCompletionService;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

public class ApplePoolForegroundService extends Service {
    public static final String ACTION_START = "com.bone.app.apple_pool.START";
    public static final String ACTION_STOP = "com.bone.app.apple_pool.STOP";

    private static final int NOTIFICATION_ID = 7419;
    private static final String CHANNEL_ID = "bone_apple_pool";
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String SETTINGS_KEY = "bone.settings.v1";
    private static final String POOL_KEY = "bone.apple-album-pool.v1";
    private static final String READY_KEY = "bone.apple-album-pool.ready.v1";
    private static final String USED_KEY = "bone.apple-album-pool.used.v1";
    private static final String PAUSE_UNTIL_KEY = "bone.apple-album-pool.pause-until.v1";
    private static final String RUNNING_KEY = "bone.apple-album-pool.running.v1";
    private static final String COVER_DIR = "apple-album-pool";
    private static final String CANDIDATES_ASSET = "public/recommendations/album-live-candidates.json";
    private static final String ITUNES_SEARCH_URL = "https://itunes.apple.com/search";
    private static final String ARK_CHAT_COMPLETIONS_URL = "https://ark.cn-beijing.volces.com/api/v3/bots/chat/completions";
    private static final String FALLBACK_ALBUM_INTRO_MODEL = "bot-20250612194641-hvrdt";
    private static final String SILICONFLOW_URL = "https://api.siliconflow.cn/v1/chat/completions";
    private static final int POOL_TARGET = 1;
    private static final int APPLE_BATCH_SIZE = 1;
    private static final int METADATA_QUEUE_LIMIT = 1;

    private final AtomicBoolean workerActive = new AtomicBoolean(false);
    private ExecutorService workerExecutor;
    private ExecutorService appleExecutor;
    private volatile boolean stopRequested = false;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;
        if (ACTION_STOP.equals(action)) {
            stopRequested = true;
            getPrefs().edit().remove(RUNNING_KEY).apply();
            shutdownExecutors();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        stopRequested = false;
        getPrefs().edit().putString(RUNNING_KEY, "1").apply();
        ensureNotificationChannel();
        startForeground(NOTIFICATION_ID, buildNotification("苹果专辑准备中"));
        startWorkerIfNeeded();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopRequested = true;
        getPrefs().edit().remove(RUNNING_KEY).apply();
        shutdownExecutors();
        super.onDestroy();
    }

    private void startWorkerIfNeeded() {
        if (!workerActive.compareAndSet(false, true)) return;
        workerExecutor = Executors.newSingleThreadExecutor();
        appleExecutor = Executors.newSingleThreadExecutor();
        workerExecutor.execute(() -> {
            try {
                runWorkerLoop();
            } finally {
                workerActive.set(false);
                getPrefs().edit().remove(RUNNING_KEY).apply();
                shutdownExecutors();
                if (!stopRequested) {
                    stopForeground(true);
                    stopSelf();
                }
            }
        });
    }

    private void runWorkerLoop() {
        List<QueuedMetadata> queue = new ArrayList<>();
        int emptyMetadataRounds = 0;
        int failedBuilds = 0;
        while (!stopRequested) {
            if (sleepIfPaused()) continue;
            Config config = readConfig();
            if (!config.isReady()) return;

            JSONArray pool = readArray(POOL_KEY);
            int count = pool.length();
            updateNotification(count);
            if (count >= POOL_TARGET) {
                getPrefs().edit().putString(READY_KEY, "1").apply();
                return;
            } else {
                getPrefs().edit().remove(READY_KEY).apply();
            }

            if (queue.isEmpty()) {
                collectAppleMetadataBatch(queue);
                if (queue.isEmpty()) {
                    emptyMetadataRounds += 1;
                    if (emptyMetadataRounds >= 6) updateNotification("Apple album preparing");
                    sleep(Math.min(30000, 5000L + emptyMetadataRounds * 1000L));
                    continue;
                }
                emptyMetadataRounds = 0;
            }

            QueuedMetadata metadata = queue.remove(0);
            if (isCandidateAlreadyInPool(metadata.candidate.id)) continue;
            if (sleepIfPaused()) continue;

            try {
                JSONObject item = createStoredApplePoolAlbum(metadata, config);
                if (item == null) {
                    failedBuilds += 1;
                    updateNotification("Apple album detail pending");
                    sleep(Math.min(30000, 2000L * Math.min(failedBuilds, 10)));
                    continue;
                }

                failedBuilds = 0;
                JSONArray latestPool = readArray(POOL_KEY);
                if (latestPool.length() >= POOL_TARGET) {
                    deleteCover(item.optString("applePoolCoverPath", ""));
                    return;
                }
                if (!poolContainsCandidate(latestPool, metadata.candidate.id)) {
                    latestPool.put(item);
                    writePool(latestPool);
                    updateNotification(latestPool.length());
                } else {
                    deleteCover(item.optString("applePoolCoverPath", ""));
                }
            } catch (Exception ignored) {
                failedBuilds += 1;
                updateNotification("Apple album detail pending");
                sleep(Math.min(30000, 2000L * Math.min(failedBuilds, 10)));
            }
        }
    }

    private boolean sleepIfPaused() {
        long until = readPauseUntil();
        long remaining = until - System.currentTimeMillis();
        if (remaining <= 0) return false;
        updateNotification("苹果专辑暂停中");
        sleep(Math.min(remaining, 5000));
        return true;
    }

    private long readPauseUntil() {
        try {
            return Long.parseLong(getPrefs().getString(PAUSE_UNTIL_KEY, "0"));
        } catch (Exception ignored) {
            return 0;
        }
    }

    private void collectAppleMetadataBatch(List<QueuedMetadata> queue) {
        try {
            List<Candidate> candidates = loadCandidates();
            if (candidates.isEmpty()) return;

            JSONArray pool = readArray(POOL_KEY);
            Set<String> blocked = new HashSet<>(readUsed());
            for (int i = 0; i < pool.length(); i++) blocked.add(pool.optJSONObject(i).optString("applePoolCandidateId"));
            for (QueuedMetadata item : queue) blocked.add(item.candidate.id);

            List<Candidate> batch = new ArrayList<>();
            for (Candidate candidate : candidates) {
                if (!blocked.contains(candidate.id)) batch.add(candidate);
            }
            if (batch.size() < APPLE_BATCH_SIZE) {
                batch.clear();
                for (Candidate candidate : candidates) {
                    if (!poolContainsCandidate(pool, candidate.id)) batch.add(candidate);
                }
            }
            Collections.shuffle(batch);
            if (batch.size() > APPLE_BATCH_SIZE) batch = new ArrayList<>(batch.subList(0, APPLE_BATCH_SIZE));
            if (batch.isEmpty()) return;

            ExecutorCompletionService<QueuedMetadata> completion = new ExecutorCompletionService<>(appleExecutor);
            List<Future<QueuedMetadata>> futures = new ArrayList<>();
            for (Candidate candidate : batch) {
                futures.add(completion.submit(() -> {
                    ITunesAlbum apple = searchAlbumITunes(candidate, 6000);
                    if (apple == null || !apple.hasCover()) throw new Exception("apple metadata incomplete");
                    return new QueuedMetadata(candidate, apple);
                }));
            }

            long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(7);
            Set<String> seen = new HashSet<>();
            for (QueuedMetadata item : queue) seen.add(item.candidate.id);
            for (int i = 0; i < futures.size(); i++) {
                long remaining = deadline - System.nanoTime();
                if (remaining <= 0) break;
                Future<QueuedMetadata> future = completion.poll(remaining, TimeUnit.NANOSECONDS);
                if (future == null) break;
                try {
                    QueuedMetadata metadata = future.get();
                    if (!seen.contains(metadata.candidate.id)) {
                        queue.add(metadata);
                        seen.add(metadata.candidate.id);
                        if (queue.size() >= METADATA_QUEUE_LIMIT) break;
                    }
                } catch (Exception ignored) {
                    // Match podcast bursts for Apple metadata; model generation is still serialized.
                }
            }
            for (Future<QueuedMetadata> future : futures) future.cancel(true);
        } catch (Exception ignored) {
            // Background pool is opportunistic; the UI still has local albums.
        }
    }

    @Nullable
    private JSONObject createStoredApplePoolAlbum(QueuedMetadata metadata, Config config) throws Exception {
        GeneratedIntro generated = null;
        try {
            generated = buildIntro(metadata, config);
        } catch (Exception ignored) {
            generated = null;
        }
        if (generated == null || generated.fullIntro.isEmpty()) return null;

        String poolItemId = "apple-pool-" + metadata.candidate.id + "-" + System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);
        String coverPath = cacheCover(poolItemId, metadata.apple.artworkUrl);
        long now = System.currentTimeMillis();
        int releaseYear = parseYear(metadata.apple.releaseDate);
        JSONArray styleTags = new JSONArray();
        for (String tag : generated.styleTags) styleTags.put(tag);

        JSONObject detail = new JSONObject();
        detail.put("introTitle", generated.introTitle.isEmpty() ? metadata.apple.albumTitle : generated.introTitle);
        detail.put("shortIntro", generated.shortIntro);
        detail.put("fullIntro", generated.fullIntro);
        detail.put("listeningMoment", "");
        detail.put("whyKeep", generated.whyKeep);
        detail.put("basicFacts", metadata.apple.artist + "《" + metadata.apple.albumTitle + "》，Apple Music 提供发行与封面信息。");
        detail.put("soundCharacteristics", styleTags);
        detail.put("artistContext", "");
        detail.put("receptionContext", "");

        JSONObject item = new JSONObject();
        item.put("id", poolItemId);
        item.put("albumTitle", metadata.apple.albumTitle);
        item.put("albumArtist", metadata.apple.artist);
        item.put("artworkUrl", metadata.apple.artworkUrl);
        item.put("originalArtworkUrl", metadata.apple.artworkUrl);
        item.put("albumIntro", generated.shortIntro);
        item.put("collection", "apple-music");
        item.put("styleTags", styleTags);
        item.put("releaseDate", metadata.apple.releaseDate);
        item.put("releaseYear", releaseYear > 0 ? releaseYear : JSONObject.NULL);
        item.put("label", "");
        item.put("trackCount", metadata.apple.trackCount > 0 ? metadata.apple.trackCount : JSONObject.NULL);
        item.put("notableTracks", new JSONArray());
        item.put("detail", detail);
        item.put("timestamp", now);
        item.put("applePoolItemId", poolItemId);
        item.put("applePoolCandidateId", metadata.candidate.id);
        if (!coverPath.isEmpty()) item.put("applePoolCoverPath", coverPath);
        item.put("poolCreatedAt", now);
        return item;
    }

    @Nullable
    private GeneratedIntro buildIntro(QueuedMetadata metadata, Config config) throws Exception {
        JSONObject facts = new JSONObject();
        facts.put("albumTitle", metadata.apple.albumTitle);
        facts.put("artist", metadata.apple.artist);
        facts.put("releaseDate", metadata.apple.releaseDate);
        facts.put("releaseYear", parseYear(metadata.apple.releaseDate));
        facts.put("primaryGenre", metadata.apple.primaryGenre);
        facts.put("trackCount", metadata.apple.trackCount > 0 ? metadata.apple.trackCount : JSONObject.NULL);

        if (config != null) {
            JSONObject body = new JSONObject();
            body.put("model", config.model);
            body.put("stream", true);
            body.put("stream_options", new JSONObject().put("include_usage", true));
            body.put("temperature", 0.25);

            JSONArray messages = new JSONArray();
            messages.put(new JSONObject().put("role", "user").put("content", buildArkPrompt(metadata, facts)));
            body.put("messages", messages);

            HttpURLConnection connection = (HttpURLConnection) new URL(ARK_CHAT_COMPLETIONS_URL).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(0);
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/json,text/plain,*/*");
            connection.setRequestProperty("Authorization", "Bearer " + normalizeApiKey(config.apiKey));
            try (OutputStream output = connection.getOutputStream()) {
                output.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }

            int code = connection.getResponseCode();
            String text = readString(code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream());
            if (code < 200 || code >= 300) throw new Exception("intro api " + code);
            return parseGeneratedIntro(extractModelContent(text));
        }

        JSONObject body = new JSONObject();
        body.put("model", config.model);
        body.put("temperature", 0.25);
        body.put("response_format", new JSONObject().put("type", "json_object"));

        JSONArray messages = new JSONArray();
        messages.put(new JSONObject()
                .put("role", "system")
                .put("content", "你是严谨的中文音乐编辑。只能根据用户提供的 Apple Music 元数据写专辑推荐卡片资料，不要联网猜测，不要编造奖项、制作人、曲目或评价。所有说明使用自然中文，专名可保留原文。只输出 JSON 对象：{\"introTitle\":\"不超过8字\",\"shortIntro\":\"40-70字\",\"fullIntro\":\"120-220字，分2段\",\"whyKeep\":\"25-45字\",\"styleTags\":[\"中文风格1\",\"中文风格2\"]}。styleTags 只给 2 到 4 个纯中文风格词；信息不足时少写事实、保持克制。"));
        messages.put(new JSONObject().put("role", "user").put("content", facts.toString()));
        body.put("messages", messages);

        HttpURLConnection connection = (HttpURLConnection) new URL(SILICONFLOW_URL).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(45000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Authorization", "Bearer " + config.apiKey);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(body.toString().getBytes(StandardCharsets.UTF_8));
        }

        int code = connection.getResponseCode();
        String text = readString(code >= 200 && code < 300 ? connection.getInputStream() : connection.getErrorStream());
        if (code < 200 || code >= 300) throw new Exception("intro api " + code);
        JSONObject payload = new JSONObject(text);
        JSONArray choices = payload.optJSONArray("choices");
        JSONObject firstChoice = choices != null ? choices.optJSONObject(0) : null;
        JSONObject message = firstChoice != null ? firstChoice.optJSONObject("message") : null;
        String content = message != null ? message.optString("content", "") : "";
        return parseGeneratedIntro(content);
    }

    private String buildArkPrompt(QueuedMetadata metadata, JSONObject facts) {
        String albumTitle = !metadata.apple.albumTitle.isEmpty() ? metadata.apple.albumTitle : metadata.candidate.name;
        String artist = !metadata.apple.artist.isEmpty() ? metadata.apple.artist : metadata.candidate.artist;
        String releaseDate = metadata.apple.releaseDate == null ? "" : metadata.apple.releaseDate;
        String releaseYear = String.valueOf(parseYear(releaseDate));
        String genre = metadata.apple.primaryGenre == null ? "" : metadata.apple.primaryGenre;
        String trackCount = metadata.apple.trackCount > 0 ? String.valueOf(metadata.apple.trackCount) : "";
        return "搜索目标：\n"
                + "专辑名：" + albumTitle + "\n"
                + "音乐人：" + artist + "\n\n"
                + "你唯一需要搜索的关键词是：" + artist + " " + albumTitle + "。\n"
                + "禁止搜索本提示词中的规则、字段名、输出格式或其他文字。\n\n"
                + "任务：你是一个非常严谨的世界级音乐评论家。请联网核对这张专辑，介绍中必须有专辑专业介绍，并整理成安卓软件可直接使用的 JSON。\n\n"
                + "参考 Apple Music 元数据（只用于核对，不要原样输出）：发行时间 " + releaseDate + "；年份 " + releaseYear + "；流派 " + genre + "；曲目数量 " + trackCount + "。\n\n"
                + "只允许输出下面 2 个字段：\n"
                + "{\n"
                + "  \"风格\": [\"中文音乐风格1\", \"中文音乐风格2\", \"中文音乐风格3\"],\n"
                + "  \"介绍\": \"一段中文专辑介绍\"\n"
                + "}\n\n"
                + "严格要求：\n"
                + "1. 只输出 JSON，不要输出任何 JSON 之外的文字。\n"
                + "2. 不要 Markdown，不要列表，不要标题。\n"
                + "3. 不要输出专辑名、音乐人、发行时间、曲目、唱片公司、制作人、语种、歌曲数量等资料字段。\n"
                + "4. “风格”只能填写音乐术语里面的风格，例如：后朋克、另类摇滚、独立摇滚、实验摇滚、噪音摇滚、艺术摇滚、迷幻摇滚、民谣摇滚、硬摇滚、朋克摇滚、电子摇滚、华语摇滚。\n"
                + "5. “风格”最多 4 个，必须全部是中文，不能出现英文。\n"
                + "6. “介绍”写 520 字，使用自然中文，适合专辑推荐卡片阅读，介绍中必须有对专辑中歌曲的短评或者介绍。\n"
                + "7. 介绍可以参考联网资料，但必须改写，不要照抄。\n"
                + "8. 介绍不要写成百科资料堆叠，不要写曲目表。\n"
                + "9. 信息不确定就少写，不要编造。\n"
                + "10. 第一个字符必须是 {。\n"
                + "11. 最后一个字符必须是 }。";
    }

    private String extractModelContent(String text) {
        if (text == null) return "";
        StringBuilder content = new StringBuilder();
        if (text.contains("data:")) {
            String[] lines = text.split("\\r?\\n");
            for (String line : lines) {
                String trimmed = line.trim();
                if (!trimmed.startsWith("data:")) continue;
                String payloadText = trimmed.substring(5).trim();
                if (payloadText.isEmpty() || "[DONE]".equals(payloadText)) continue;
                try {
                    appendChoiceContent(new JSONObject(payloadText), content);
                } catch (Exception ignored) {
                    // Ignore SSE keepalive or usage-only chunks.
                }
            }
            if (content.length() > 0) return content.toString();
        }

        try {
            appendChoiceContent(new JSONObject(text), content);
            if (content.length() > 0) return content.toString();
        } catch (Exception ignored) {
        }
        return text.trim();
    }

    private void appendChoiceContent(JSONObject payload, StringBuilder content) {
        JSONArray choices = payload.optJSONArray("choices");
        JSONObject choice = choices != null ? choices.optJSONObject(0) : null;
        if (choice == null) return;

        JSONObject delta = choice.optJSONObject("delta");
        if (delta != null) content.append(delta.optString("content", ""));

        JSONObject message = choice.optJSONObject("message");
        if (message != null) content.append(message.optString("content", ""));

        content.append(choice.optString("content", ""));
        content.append(choice.optString("text", ""));
    }

    private String normalizeApiKey(String apiKey) {
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

    @Nullable
    private GeneratedIntro parseGeneratedIntro(String content) {
        try {
            String cleaned = content.trim();
            if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7).trim();
            if (cleaned.startsWith("```")) cleaned = cleaned.substring(3).trim();
            if (cleaned.endsWith("```")) cleaned = cleaned.substring(0, cleaned.length() - 3).trim();
            int start = cleaned.indexOf('{');
            int end = cleaned.lastIndexOf('}');
            if (start >= 0 && end > start) cleaned = cleaned.substring(start, end + 1);
            JSONObject json = new JSONObject(cleaned);
            GeneratedIntro intro = new GeneratedIntro();

            String arkIntro = json.optString("\u4ecb\u7ecd", "").trim();
            if (!arkIntro.isEmpty()) {
                intro.shortIntro = "";
                intro.fullIntro = arkIntro;
                JSONArray arkTags = json.optJSONArray("\u98ce\u683c");
                if (arkTags != null) {
                    Set<String> seen = new HashSet<>();
                    for (int i = 0; i < arkTags.length() && intro.styleTags.size() < 4; i++) {
                        String tag = arkTags.optString(i, "").trim();
                        if (tag.isEmpty() || tag.matches(".*[A-Za-z].*") || seen.contains(tag)) continue;
                        intro.styleTags.add(tag);
                        seen.add(tag);
                    }
                }
                return intro;
            }

            intro.introTitle = json.optString("introTitle", "").trim();
            intro.shortIntro = json.optString("shortIntro", "").trim();
            intro.fullIntro = json.optString("fullIntro", "").trim();
            intro.whyKeep = json.optString("whyKeep", "").trim();
            JSONArray tags = json.optJSONArray("styleTags");
            if (tags != null) {
                Set<String> seen = new HashSet<>();
                for (int i = 0; i < tags.length() && intro.styleTags.size() < 4; i++) {
                    String tag = tags.optString(i, "").trim();
                    if (tag.isEmpty() || tag.matches(".*[A-Za-z].*") || seen.contains(tag)) continue;
                    intro.styleTags.add(tag);
                    seen.add(tag);
                }
            }
            return intro;
        } catch (Exception ignored) {
            return null;
        }
    }

    @Nullable
    private ITunesAlbum searchAlbumITunes(Candidate candidate, int timeoutMs) throws Exception {
        String term = (candidate.artist + " " + candidate.name).trim();
        String url = ITUNES_SEARCH_URL
                + "?term=" + URLEncoder.encode(term, "UTF-8")
                + "&entity=album&limit=5&country=cn";
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(timeoutMs);
        connection.setReadTimeout(timeoutMs);
        int code = connection.getResponseCode();
        if (code < 200 || code >= 300) return null;
        JSONObject payload = new JSONObject(readString(connection.getInputStream()));
        JSONArray results = payload.optJSONArray("results");
        if (results == null || results.length() == 0) return null;

        JSONObject best = null;
        double bestScore = 0;
        double bestAlbumScore = 0;
        for (int i = 0; i < results.length(); i++) {
            JSONObject item = results.optJSONObject(i);
            if (item == null) continue;
            String collectionName = item.optString("collectionName", item.optString("trackName", ""));
            String artistName = item.optString("artistName", "");
            double albumScore = similarity(candidate.name, collectionName);
            double artistScore = 0;
            String normalizedCandidateArtist = normalize(candidate.artist);
            String normalizedAppleArtist = normalize(artistName);
            if (!normalizedCandidateArtist.isEmpty() && !normalizedAppleArtist.isEmpty()) {
                if (normalizedCandidateArtist.contains(normalizedAppleArtist) || normalizedAppleArtist.contains(normalizedCandidateArtist)) {
                    artistScore = 0.18;
                } else {
                    artistScore = similarity(candidate.artist, artistName) * 0.14;
                }
            }
            double score = albumScore + artistScore;
            if (score > bestScore) {
                bestScore = score;
                bestAlbumScore = albumScore;
                best = item;
            }
        }
        if (best == null || bestAlbumScore < 0.62) return null;
        ITunesAlbum album = new ITunesAlbum();
        album.collectionId = best.optLong("collectionId", 0);
        album.albumTitle = best.optString("collectionName", "");
        album.artist = best.optString("artistName", "");
        album.artworkUrl = hdArtwork(best);
        album.releaseDate = best.optString("releaseDate", "");
        album.primaryGenre = best.optString("primaryGenreName", "");
        album.trackCount = best.optInt("trackCount", 0);
        return album.collectionId > 0 && album.hasCover() ? album : null;
    }

    private String cacheCover(String poolItemId, String artworkUrl) {
        if (artworkUrl == null || artworkUrl.isEmpty()) return "";
        String extension = artworkUrl.toLowerCase(Locale.ROOT).contains(".png") ? "png" : "jpg";
        String relativePath = COVER_DIR + "/" + poolItemId + "." + extension;
        File dir = new File(getFilesDir(), COVER_DIR);
        if (!dir.exists() && !dir.mkdirs()) return "";
        File target = new File(getFilesDir(), relativePath);

        try {
            HttpURLConnection connection = (HttpURLConnection) new URL(artworkUrl).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) return "";
            try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(target)) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
            }
            return relativePath;
        } catch (Exception ignored) {
            return "";
        }
    }

    private Config readConfig() {
        Config config = new Config();
        try {
            String raw = getPrefs().getString(SETTINGS_KEY, null);
            if (raw == null || raw.isEmpty()) return config;
            JSONObject settings = new JSONObject(raw);
            JSONObject api = settings.optJSONObject("api");
            JSONObject albumIntro = api != null ? api.optJSONObject("albumIntro") : null;
            if (albumIntro != null) {
                config.apiKey = normalizeApiKey(albumIntro.optString("apiKey", ""));
                config.model = albumIntro.optString("model", "").trim();
                int requestedTimeout = albumIntro.optInt("timeoutMs", config.timeoutMs);
                config.timeoutMs = requestedTimeout <= 0 ? 0 : Math.max(60000, requestedTimeout);
            }
            if (config.model.isEmpty()) {
                config.model = settings.optString("albumIntroModel", "").trim();
            }
            if (!config.model.startsWith("bot-")) {
                config.model = FALLBACK_ALBUM_INTRO_MODEL;
            }
            JSONObject speechToText = api != null ? api.optJSONObject("speechToText") : null;
            if (config.apiKey.isEmpty() && speechToText != null) {
                config.apiKey = normalizeApiKey(speechToText.optString("apiKey", ""));
            }
        } catch (Exception ignored) {
            // Missing settings means the service should quietly stop.
        }
        return config;
    }

    private List<Candidate> loadCandidates() throws Exception {
        JSONArray raw = new JSONArray(readString(getAssets().open(CANDIDATES_ASSET)));
        List<Candidate> candidates = new ArrayList<>();
        for (int i = 0; i < raw.length(); i++) {
            JSONObject item = raw.optJSONObject(i);
            if (item == null) continue;
            Candidate candidate = new Candidate();
            candidate.id = item.optString("id", "");
            candidate.name = item.optString("name", "");
            candidate.artist = item.optString("artist", "");
            if (!candidate.id.isEmpty() && !candidate.name.isEmpty() && !candidate.artist.isEmpty()) {
                candidates.add(candidate);
            }
        }
        return candidates;
    }

    private SharedPreferences getPrefs() {
        return getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private JSONArray readArray(String key) {
        try {
            String raw = getPrefs().getString(key, "[]");
            return new JSONArray(raw == null || raw.isEmpty() ? "[]" : raw);
        } catch (Exception ignored) {
            return new JSONArray();
        }
    }

    private void writePool(JSONArray pool) {
        JSONArray next = new JSONArray();
        int limit = Math.min(pool.length(), POOL_TARGET);
        for (int i = 0; i < limit; i++) next.put(pool.opt(i));
        SharedPreferences.Editor editor = getPrefs().edit().putString(POOL_KEY, next.toString());
        if (next.length() >= POOL_TARGET) {
            editor.putString(READY_KEY, "1");
        } else {
            editor.remove(READY_KEY);
        }
        editor.apply();
    }

    private List<String> readUsed() {
        JSONArray used = readArray(USED_KEY);
        List<String> values = new ArrayList<>();
        for (int i = 0; i < used.length(); i++) {
            String id = used.optString(i, "");
            if (!id.isEmpty()) values.add(id);
        }
        return values;
    }

    private void markUsed(String candidateId) {
        if (candidateId == null || candidateId.isEmpty()) return;
        List<String> used = readUsed();
        used.remove(candidateId);
        used.add(0, candidateId);
        JSONArray next = new JSONArray();
        for (int i = 0; i < used.size() && i < 1200; i++) next.put(used.get(i));
        getPrefs().edit().putString(USED_KEY, next.toString()).apply();
    }

    private boolean isCandidateAlreadyInPool(String candidateId) {
        return poolContainsCandidate(readArray(POOL_KEY), candidateId);
    }

    private boolean poolContainsCandidate(JSONArray pool, String candidateId) {
        for (int i = 0; i < pool.length(); i++) {
            JSONObject item = pool.optJSONObject(i);
            if (item != null && candidateId.equals(item.optString("applePoolCandidateId"))) return true;
        }
        return false;
    }

    private void deleteCover(String relativePath) {
        if (relativePath == null || relativePath.isEmpty()) return;
        try {
            File file = new File(getFilesDir(), relativePath);
            if (file.exists()) file.delete();
        } catch (Exception ignored) {
            // Best effort cleanup.
        }
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Bone 苹果池",
                NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("后台准备 Apple Music 专辑推荐池");
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private Notification buildNotification(String text) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("Bone 正在准备专辑")
                .setContentText(text)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private void updateNotification(int count) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification("苹果专辑 " + count + "/1"));
    }

    private void updateNotification(String text) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification(text));
    }

    private void shutdownExecutors() {
        if (appleExecutor != null) {
            appleExecutor.shutdownNow();
            appleExecutor = null;
        }
        if (workerExecutor != null) {
            workerExecutor.shutdownNow();
            workerExecutor = null;
        }
    }

    private void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    private static String hdArtwork(JSONObject item) {
        String source = item.optString("artworkUrl1000", "");
        if (source.isEmpty()) source = item.optString("artworkUrl600", "");
        if (source.isEmpty()) source = item.optString("artworkUrl100", "");
        return source.replaceAll("/\\d+x\\d+(?:bb)?\\.jpg$", "/800x800bb.jpg");
    }

    private static int parseYear(String releaseDate) {
        try {
            if (releaseDate != null && releaseDate.length() >= 4) {
                return Integer.parseInt(releaseDate.substring(0, 4));
            }
        } catch (Exception ignored) {
        }
        return 0;
    }

    private static String normalize(String value) {
        if (value == null) return "";
        return value.toLowerCase(Locale.ROOT).replaceAll("[\\s\\-—–_'\"“”‘’《》()（）.,，。:：!！?？/\\\\]", "");
    }

    private static double similarity(String left, String right) {
        String a = normalize(left);
        String b = normalize(right);
        if (a.isEmpty() || b.isEmpty()) return 0;
        int[] rows = new int[b.length() + 1];
        for (int i = 0; i <= b.length(); i++) rows[i] = i;
        for (int i = 1; i <= a.length(); i++) {
            int previous = rows[0];
            rows[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int current = rows[j];
                int replace = previous + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1);
                rows[j] = Math.min(Math.min(rows[j] + 1, rows[j - 1] + 1), replace);
                previous = current;
            }
        }
        int max = Math.max(a.length(), b.length());
        return (max - rows[b.length()]) / (double) max;
    }

    private static String readString(InputStream input) throws Exception {
        if (input == null) return "";
        try (InputStream stream = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = stream.read(buffer)) != -1) output.write(buffer, 0, read);
            return output.toString("UTF-8");
        }
    }

    private static class Config {
        String apiKey = "";
        String model = "";
        int timeoutMs = 0;

        boolean isReady() {
            return !apiKey.isEmpty() && !model.isEmpty();
        }
    }

    private static class Candidate {
        String id;
        String name;
        String artist;
    }

    private static class ITunesAlbum {
        long collectionId;
        String albumTitle = "";
        String artist = "";
        String artworkUrl = "";
        String releaseDate = "";
        String primaryGenre = "";
        int trackCount = 0;

        boolean hasCover() {
            return artworkUrl != null && !artworkUrl.isEmpty();
        }
    }

    private static class QueuedMetadata {
        final Candidate candidate;
        final ITunesAlbum apple;

        QueuedMetadata(Candidate candidate, ITunesAlbum apple) {
            this.candidate = candidate;
            this.apple = apple;
        }
    }

    private static class GeneratedIntro {
        String introTitle = "";
        String shortIntro = "";
        String fullIntro = "";
        String whyKeep = "";
        List<String> styleTags = new ArrayList<>();
    }
}
