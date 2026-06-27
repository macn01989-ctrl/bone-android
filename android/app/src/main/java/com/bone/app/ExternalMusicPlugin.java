package com.bone.app;

import android.app.SearchManager;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ExternalMusic")
public class ExternalMusicPlugin extends Plugin {
    private static final String NETEASE_PACKAGE = "com.netease.cloudmusic";
    private static final String SPOTIFY_PACKAGE = "com.spotify.music";
    private static final String APPLE_MUSIC_PACKAGE = "com.apple.android.music";
    private static final String QQ_MUSIC_PACKAGE = "com.tencent.qqmusic";

    @PluginMethod
    public void openSearch(PluginCall call) {
        String platform = call.getString("platform", "netease");
        String query = call.getString("query", "");
        boolean opened;

        switch (platform) {
            case "xiaoyuzhou":
                opened = openUri("cosmos://page.cos/discover");
                if (!opened) opened = openUri("https://www.xiaoyuzhoufm.com/download?utm_source=bone");
                break;
            case "apple-podcasts":
                opened = openUri("podcasts://search?term=" + Uri.encode(query));
                if (!opened) opened = openUri("https://podcasts.apple.com/search?term=" + Uri.encode(query));
                break;
            case "spotify":
                opened = openPackageSearch(SPOTIFY_PACKAGE, query);
                if (!opened) opened = openUri("spotify:search:" + Uri.encode(query));
                if (!opened) opened = openUri("https://open.spotify.com/search/" + Uri.encode(query));
                break;
            case "apple-music":
                opened = openPackageSearch(APPLE_MUSIC_PACKAGE, query);
                if (!opened) opened = openUri("music://music.apple.com/search?term=" + Uri.encode(query));
                if (!opened) opened = openUri("https://music.apple.com/search?term=" + Uri.encode(query));
                break;
            case "qq-music":
                opened = openPackageSearch(QQ_MUSIC_PACKAGE, query);
                if (!opened) opened = openUri("qqmusic://qq.com/ui/search?p=%7B%22key%22%3A%22" + Uri.encode(query) + "%22%7D");
                if (!opened) opened = openUri("https://y.qq.com/n/ryqq/search?w=" + Uri.encode(query));
                break;
            case "netease":
            default:
                opened = openPackageSearch(NETEASE_PACKAGE, query);
                if (!opened) opened = openUri("orpheus://");
                break;
        }

        call.resolve(new JSObject().put("opened", opened));
    }

    private boolean openPackageSearch(String packageName, String query) {
        try {
            Intent searchIntent = new Intent(Intent.ACTION_SEARCH);
            searchIntent.setPackage(packageName);
            searchIntent.putExtra(SearchManager.QUERY, query);
            searchIntent.putExtra("query", query);
            searchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(searchIntent);
            return true;
        } catch (ActivityNotFoundException ignored) {
            return false;
        } catch (Exception ignored) {
            return false;
        }
    }

    private boolean openUri(String uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(uri));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }
}
