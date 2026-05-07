package com.solact.academy.plugins.nativeupload;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.solact.academy.MainActivity;
import com.solact.academy.R;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONObject;

/**
 * Foreground Service for video compression + upload.
 * Survives app close/backgrounding. Shows progress in notification.
 */
public class UploadForegroundService extends Service {
    private static final String TAG = "UploadService";
    private static final String CHANNEL_ID = "upload_channel";
    private static final int NOTIFICATION_ID = 9001;
    private static final int COMPLETE_NOTIFICATION_ID = 9002;
    private static final int CHUNK_SIZE = 5 * 1024 * 1024;

    public static final String ACTION_START = "com.solact.academy.UPLOAD_START";
    public static final String ACTION_PROGRESS = "com.solact.academy.UPLOAD_PROGRESS";
    public static final String ACTION_COMPLETE = "com.solact.academy.UPLOAD_COMPLETE";
    public static final String ACTION_ERROR = "com.solact.academy.UPLOAD_ERROR";

    private ExecutorService executor;
    private PowerManager.WakeLock wakeLock;
    private NotificationManager notificationManager;

    @Override
    public void onCreate() {
        super.onCreate();
        executor = Executors.newSingleThreadExecutor();
        notificationManager = getSystemService(NotificationManager.class);
        createNotificationChannel();
        acquireWakeLock();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || !ACTION_START.equals(intent.getAction())) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String filePath = intent.getStringExtra("filePath");
        String apiUrl = intent.getStringExtra("apiUrl");
        String token = intent.getStringExtra("token");
        String subfolder = intent.getStringExtra("subfolder");
        String targetType = intent.getStringExtra("targetType");
        String targetId = intent.getStringExtra("targetId");
        String fileName = intent.getStringExtra("fileName");

        // Start as foreground immediately
        startForeground(NOTIFICATION_ID, buildProgressNotification("영상 준비 중...", 0));

        executor.execute(() -> {
            try {
                doWork(filePath, fileName, apiUrl, token, subfolder, targetType, targetId);
            } catch (Exception e) {
                Log.e(TAG, "Upload failed", e);
                broadcastError(e.getMessage());
                showCompleteNotification("업로드 실패", "다시 시도해주세요.");
            } finally {
                stopForeground(STOP_FOREGROUND_REMOVE);
                stopSelf();
            }
        });

        return START_REDELIVER_INTENT;
    }

    private void doWork(String filePath, String fileName, String apiUrl, String token,
                         String subfolder, String targetType, String targetId) {
        File inputFile = new File(filePath);
        if (!inputFile.exists()) {
            broadcastError("File not found: " + filePath);
            return;
        }

        long originalSize = inputFile.length();
        if (fileName == null) fileName = inputFile.getName();

        // 1. Compress
        updateNotification("영상 압축 중...", 0);
        broadcastProgress("compressing", 0);

        File compressedFile = VideoCompressor.compress(
            this, inputFile,
            (pct) -> {
                updateNotification("영상 압축 중... " + pct + "%", pct);
                broadcastProgress("compressing", pct);
            }
        );

        long compressedSize = compressedFile.length();
        String uploadFileName = fileName.replaceAll("\\.[^.]+$", ".mp4");
        Log.i(TAG, "Compressed: " + (originalSize / 1024) + "KB -> " + (compressedSize / 1024) + "KB");

        // 2. Init upload
        updateNotification("업로드 시작...", 0);
        broadcastProgress("uploading", 0);

        String uploadId = initUpload(apiUrl, token, uploadFileName, compressedSize, subfolder, targetType, targetId);
        if (uploadId == null) {
            cleanup(compressedFile, inputFile);
            broadcastError("업로드 세션 생성 실패");
            return;
        }

        // 3. Upload chunks
        try {
            boolean ok = uploadChunks(apiUrl, token, uploadId, compressedFile);
            if (!ok) {
                cleanup(compressedFile, inputFile);
                broadcastError("청크 업로드 실패");
                return;
            }
        } catch (IOException e) {
            cleanup(compressedFile, inputFile);
            broadcastError("업로드 오류: " + e.getMessage());
            return;
        }

        // 4. Complete
        JSONObject result = completeUpload(apiUrl, token, uploadId);
        cleanup(compressedFile, inputFile);

        if (result == null) {
            broadcastError("업로드 완료 처리 실패");
            return;
        }

        // 5. Success
        String resultUrl = result.optString("url", "");
        String resultFilename = result.optString("filename", "");
        String thumbnailUrl = result.optString("thumbnail_url", "");

        broadcastComplete(resultUrl, resultFilename, thumbnailUrl, originalSize, compressedSize);
        showCompleteNotification("업로드 완료", uploadFileName + " 업로드가 완료되었습니다.");
    }

    // --- Notification ---

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "영상 업로드", NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("영상 압축 및 업로드 진행 상태");
        channel.setShowBadge(false);
        notificationManager.createNotificationChannel(channel);
    }

    private Notification buildProgressNotification(String text, int progress) {
        PendingIntent pi = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_upload)
            .setContentTitle("SOL-ACT")
            .setContentText(text)
            .setProgress(100, progress, progress == 0)
            .setOngoing(true)
            .setContentIntent(pi)
            .setSilent(true)
            .build();
    }

    private void updateNotification(String text, int progress) {
        notificationManager.notify(NOTIFICATION_ID, buildProgressNotification(text, progress));
    }

    private void showCompleteNotification(String title, String body) {
        PendingIntent pi = PendingIntent.getActivity(this, 0,
            new Intent(this, MainActivity.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_upload_done)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .build();

        notificationManager.notify(COMPLETE_NOTIFICATION_ID, notification);
    }

    // --- Broadcast to Plugin ---

    private void broadcastProgress(String phase, int progress) {
        Intent intent = new Intent(ACTION_PROGRESS);
        intent.putExtra("phase", phase);
        intent.putExtra("progress", progress);
        sendBroadcast(intent);
    }

    private void broadcastComplete(String url, String filename, String thumbnailUrl,
                                    long originalSize, long compressedSize) {
        Intent intent = new Intent(ACTION_COMPLETE);
        intent.putExtra("url", url);
        intent.putExtra("filename", filename);
        intent.putExtra("thumbnailUrl", thumbnailUrl);
        intent.putExtra("originalSize", originalSize);
        intent.putExtra("compressedSize", compressedSize);
        sendBroadcast(intent);
    }

    private void broadcastError(String message) {
        Intent intent = new Intent(ACTION_ERROR);
        intent.putExtra("message", message);
        sendBroadcast(intent);
    }

    // --- WakeLock ---

    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "solact:upload");
        wakeLock.acquire(60 * 60 * 1000L); // 1 hour max
    }

    // --- Chunked Upload (same logic as plugin) ---

    private String initUpload(String apiUrl, String token, String filename, long totalSize,
                               String subfolder, String targetType, String targetId) {
        try {
            URL url = new URL(apiUrl + "/api/upload/chunked/init");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setDoOutput(true);

            JSONObject body = new JSONObject();
            body.put("filename", filename);
            body.put("total_size", totalSize);
            body.put("subfolder", subfolder != null ? subfolder : "portfolios");
            if (targetType != null) body.put("target_type", targetType);
            if (targetId != null) body.put("target_id", targetId);

            OutputStream os = conn.getOutputStream();
            os.write(body.toString().getBytes());
            os.close();

            if (conn.getResponseCode() == 200) {
                String resp = readStream(conn.getInputStream());
                return new JSONObject(resp).optString("upload_id", null);
            }
            Log.e(TAG, "Init failed: " + conn.getResponseCode());
        } catch (Exception e) {
            Log.e(TAG, "Init error", e);
        }
        return null;
    }

    private boolean uploadChunks(String apiUrl, String token, String uploadId, File file) throws IOException {
        long totalSize = file.length();
        long bytesSent = 0;
        int chunkIdx = 0;
        FileInputStream fis = new FileInputStream(file);
        byte[] buffer = new byte[CHUNK_SIZE];
        int bytesRead;

        while ((bytesRead = fis.read(buffer)) > 0) {
            byte[] chunk = (bytesRead < CHUNK_SIZE) ? java.util.Arrays.copyOf(buffer, bytesRead) : buffer;

            boolean ok = sendChunk(apiUrl, token, uploadId, chunkIdx, chunk, bytesRead);
            if (!ok) {
                fis.close();
                return false;
            }

            bytesSent += bytesRead;
            chunkIdx++;
            int pct = (int) (bytesSent * 100 / totalSize);
            updateNotification("업로드 중... " + pct + "%", pct);
            broadcastProgress("uploading", pct);
        }
        fis.close();
        return true;
    }

    private boolean sendChunk(String apiUrl, String token, String uploadId, int idx,
                               byte[] data, int length) {
        for (int retry = 0; retry < 5; retry++) {
            try {
                String boundary = "----Chunk" + System.currentTimeMillis();
                URL url = new URL(apiUrl + "/api/upload/chunked/" + uploadId);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
                conn.setDoOutput(true);
                conn.setConnectTimeout(30000);
                conn.setReadTimeout(60000);

                OutputStream os = conn.getOutputStream();
                String header = "--" + boundary + "\r\n"
                    + "Content-Disposition: form-data; name=\"file\"; filename=\"chunk_" + idx + "\"\r\n"
                    + "Content-Type: application/octet-stream\r\n\r\n";
                os.write(header.getBytes());
                os.write(data, 0, length);
                os.write(("\r\n--" + boundary + "--\r\n").getBytes());
                os.close();

                if (conn.getResponseCode() == 200) return true;
                Log.w(TAG, "Chunk " + idx + " status " + conn.getResponseCode());
            } catch (Exception e) {
                Log.w(TAG, "Chunk " + idx + " retry " + retry, e);
            }
            try { Thread.sleep((retry + 1) * 1000L); } catch (InterruptedException ignored) {}
        }
        return false;
    }

    private JSONObject completeUpload(String apiUrl, String token, String uploadId) {
        try {
            URL url = new URL(apiUrl + "/api/upload/chunked/" + uploadId + "/complete");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "application/json");

            if (conn.getResponseCode() == 200) {
                return new JSONObject(readStream(conn.getInputStream()));
            }
            Log.e(TAG, "Complete failed: " + conn.getResponseCode());
        } catch (Exception e) {
            Log.e(TAG, "Complete error", e);
        }
        return null;
    }

    private String readStream(InputStream is) throws IOException {
        StringBuilder sb = new StringBuilder();
        byte[] buf = new byte[4096];
        int n;
        while ((n = is.read(buf)) > 0) sb.append(new String(buf, 0, n));
        return sb.toString();
    }

    private void cleanup(File compressed, File original) {
        if (!compressed.getAbsolutePath().equals(original.getAbsolutePath())) {
            compressed.delete();
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (executor != null) executor.shutdownNow();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
