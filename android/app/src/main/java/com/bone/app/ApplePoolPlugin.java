package com.bone.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ApplePool")
public class ApplePoolPlugin extends Plugin {
    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String POOL_KEY = "bone.apple-album-pool.v1";
    private static final String READY_KEY = "bone.apple-album-pool.ready.v1";
    private static final String USED_KEY = "bone.apple-album-pool.used.v1";
    private static final String PAUSE_UNTIL_KEY = "bone.apple-album-pool.pause-until.v1";
    private static final String RUNNING_KEY = "bone.apple-album-pool.running.v1";

    @PluginMethod
    public void start(PluginCall call) {
        Intent intent = new Intent(getContext(), ApplePoolForegroundService.class);
        intent.setAction(ApplePoolForegroundService.ACTION_START);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve(new JSObject().put("running", true));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), ApplePoolForegroundService.class);
        intent.setAction(ApplePoolForegroundService.ACTION_STOP);
        getContext().startService(intent);
        call.resolve(new JSObject().put("running", false));
    }

    @PluginMethod
    public void pause(PluginCall call) {
        long until = 0;
        Object value = call.getData().opt("until");
        if (value instanceof Number) {
            until = ((Number) value).longValue();
        } else if (value instanceof String) {
            try {
                until = Long.parseLong((String) value);
            } catch (Exception ignored) {
                until = 0;
            }
        }
        getContext()
                .getSharedPreferences(PREFS_NAME, android.app.Activity.MODE_PRIVATE)
                .edit()
                .putString(PAUSE_UNTIL_KEY, String.valueOf(until))
                .apply();
        call.resolve(new JSObject().put("pausedUntil", until));
    }

    @PluginMethod
    public void getState(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, android.app.Activity.MODE_PRIVATE);
        JSObject result = new JSObject();
        result.put("pool", prefs.getString(POOL_KEY, "[]"));
        result.put("used", prefs.getString(USED_KEY, "[]"));
        result.put("ready", prefs.getString(READY_KEY, ""));
        result.put("running", prefs.getString(RUNNING_KEY, ""));
        call.resolve(result);
    }

    @PluginMethod
    public void setState(PluginCall call) {
        String pool = call.getString("pool", "[]");
        String used = call.getString("used", "[]");
        String ready = call.getString("ready", "");
        SharedPreferences.Editor editor = getContext()
                .getSharedPreferences(PREFS_NAME, android.app.Activity.MODE_PRIVATE)
                .edit()
                .putString(POOL_KEY, pool)
                .putString(USED_KEY, used);
        if (ready == null || ready.isEmpty()) {
            editor.remove(READY_KEY);
        } else {
            editor.putString(READY_KEY, ready);
        }
        editor.apply();
        call.resolve(new JSObject().put("ok", true));
    }
}
