package com.bone.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "ImageActions")
public class ImageActionsPlugin extends Plugin {
    @PluginMethod
    public void saveImage(PluginCall call) {
        String dataUrl = call.getString("dataUrl", "");
        String fileName = safeFileName(call.getString("fileName", "bone-note.png"));

        try {
            byte[] bytes = decodeDataUrl(dataUrl);
            Uri uri = saveToGallery(fileName, bytes);
            JSObject result = new JSObject();
            result.put("saved", true);
            result.put("uri", uri != null ? uri.toString() : "");
            call.resolve(result);
        } catch (Exception error) {
            call.reject("save failed", error);
        }
    }

    @PluginMethod
    public void shareImage(PluginCall call) {
        String dataUrl = call.getString("dataUrl", "");
        String fileName = safeFileName(call.getString("fileName", "bone-note.png"));

        try {
            byte[] bytes = decodeDataUrl(dataUrl);
            File dir = new File(getContext().getCacheDir(), "shared-images");
            if (!dir.exists() && !dir.mkdirs()) {
                throw new IllegalStateException("cache dir unavailable");
            }
            File file = new File(dir, fileName);
            try (FileOutputStream output = new FileOutputStream(file)) {
                output.write(bytes);
            }

            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );
            Intent share = new Intent(Intent.ACTION_SEND);
            share.setType("image/png");
            share.putExtra(Intent.EXTRA_STREAM, uri);
            share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(share, "分享 Bone 笔记");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(chooser);

            JSObject result = new JSObject();
            result.put("shared", true);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("share failed", error);
        }
    }

    private byte[] decodeDataUrl(String dataUrl) {
        String payload = dataUrl == null ? "" : dataUrl;
        int comma = payload.indexOf(',');
        if (comma >= 0) payload = payload.substring(comma + 1);
        return Base64.decode(payload, Base64.DEFAULT);
    }

    private Uri saveToGallery(String fileName, byte[] bytes) throws Exception {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Bone");
            values.put(MediaStore.Images.Media.IS_PENDING, 1);
            Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IllegalStateException("gallery insert failed");
            try (OutputStream output = resolver.openOutputStream(uri)) {
                if (output == null) throw new IllegalStateException("gallery stream unavailable");
                output.write(bytes);
            }
            values.clear();
            values.put(MediaStore.Images.Media.IS_PENDING, 0);
            resolver.update(uri, values, null, null);
            return uri;
        }

        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Bone");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("gallery dir unavailable");
        }
        File file = new File(dir, fileName);
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(bytes);
        }
        MediaScannerConnection.scanFile(getContext(), new String[]{file.getAbsolutePath()}, new String[]{"image/png"}, null);
        return Uri.fromFile(file);
    }

    private String safeFileName(String fileName) {
        String value = fileName == null ? "" : fileName.trim();
        if (value.isEmpty()) value = "bone-note.png";
        value = value.replaceAll("[\\\\/:*?\"<>|]", "_");
        return value.toLowerCase().endsWith(".png") ? value : value + ".png";
    }
}
