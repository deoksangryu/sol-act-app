package com.solact.academy.plugins.nativeupload;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/**
 * Native video upload plugin for Capacitor.
 * Delegates compression + upload to UploadForegroundService
 * which survives app backgrounding/closing.
 */
@CapacitorPlugin(
    name = "NativeUpload",
    permissions = {
        @Permission(strings = { "android.permission.POST_NOTIFICATIONS" }, alias = "notifications")
    }
)
public class NativeUploadPlugin extends Plugin {
    private static final String TAG = "NativeUpload";
    private PluginCall activeCall = null;
    private BroadcastReceiver uploadReceiver;

    @Override
    public void load() {
        registerReceiver();
    }

    @PluginMethod()
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        call.resolve(ret);
    }

    @PluginMethod()
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33) {
            if (getContext().checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                    == PackageManager.PERMISSION_GRANTED) {
                JSObject ret = new JSObject();
                ret.put("granted", true);
                call.resolve(ret);
            } else {
                requestPermissionForAlias("notifications", call, "notifPermCallback");
            }
        } else {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        }
    }

    @com.getcapacitor.annotation.ActivityCallback
    private void notifPermCallback(PluginCall call) {
        boolean granted = getPermissionState("notifications") ==
            com.getcapacitor.PermissionState.GRANTED;
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod()
    public void compressAndUpload(PluginCall call) {
        String fileUri = call.getString("fileUri");
        String apiUrl = call.getString("apiUrl");
        String token = call.getString("token");
        String subfolder = call.getString("subfolder", "portfolios");
        String targetType = call.getString("targetType");
        String targetId = call.getString("targetId");

        if (fileUri == null || apiUrl == null || token == null) {
            call.reject("Missing required parameters");
            return;
        }

        // Resolve file path
        Uri uri = Uri.parse(fileUri);
        String filePath = FileUtil.getPath(getContext(), uri);
        if (filePath == null) {
            call.reject("Cannot resolve file path");
            return;
        }

        // Keep call alive for async result
        call.setKeepAlive(true);
        activeCall = call;

        // Start foreground service
        Intent intent = new Intent(getContext(), UploadForegroundService.class);
        intent.setAction(UploadForegroundService.ACTION_START);
        intent.putExtra("filePath", filePath);
        intent.putExtra("fileName", new java.io.File(filePath).getName());
        intent.putExtra("apiUrl", apiUrl);
        intent.putExtra("token", token);
        intent.putExtra("subfolder", subfolder);
        intent.putExtra("targetType", targetType);
        intent.putExtra("targetId", targetId);

        if (Build.VERSION.SDK_INT >= 26) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }

        Log.i(TAG, "Foreground service started for upload");
    }

    // --- Receive broadcasts from service ---

    private void registerReceiver() {
        uploadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (action == null) return;

                switch (action) {
                    case UploadForegroundService.ACTION_PROGRESS: {
                        String phase = intent.getStringExtra("phase");
                        int progress = intent.getIntExtra("progress", 0);

                        // Notify JS listeners
                        JSObject data = new JSObject();
                        data.put("phase", phase);
                        data.put("progress", progress);
                        notifyListeners("uploadProgress", data);
                        break;
                    }
                    case UploadForegroundService.ACTION_COMPLETE: {
                        if (activeCall != null) {
                            JSObject ret = new JSObject();
                            ret.put("url", intent.getStringExtra("url"));
                            ret.put("filename", intent.getStringExtra("filename"));
                            ret.put("thumbnailUrl", intent.getStringExtra("thumbnailUrl"));
                            ret.put("originalSize", intent.getLongExtra("originalSize", 0));
                            ret.put("compressedSize", intent.getLongExtra("compressedSize", 0));
                            activeCall.resolve(ret);
                            activeCall = null;
                        }
                        break;
                    }
                    case UploadForegroundService.ACTION_ERROR: {
                        if (activeCall != null) {
                            String message = intent.getStringExtra("message");
                            activeCall.reject(message != null ? message : "Upload failed");
                            activeCall = null;
                        }
                        break;
                    }
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(UploadForegroundService.ACTION_PROGRESS);
        filter.addAction(UploadForegroundService.ACTION_COMPLETE);
        filter.addAction(UploadForegroundService.ACTION_ERROR);

        if (Build.VERSION.SDK_INT >= 33) {
            getContext().registerReceiver(uploadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(uploadReceiver, filter);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (uploadReceiver != null) {
            try {
                getContext().unregisterReceiver(uploadReceiver);
            } catch (Exception ignored) {}
        }
    }
}
