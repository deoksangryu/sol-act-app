package com.solact.academy.plugins.nativeupload;

import android.net.Uri;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONObject;

/**
 * Native video upload plugin for Capacitor.
 * Compresses video using Android MediaCodec, then uploads via chunked HTTP.
 * Runs in background thread — survives app backgrounding.
 */
@CapacitorPlugin(name = "NativeUpload")
public class NativeUploadPlugin extends Plugin {
    private static final String TAG = "NativeUpload";
    private static final int CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod()
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
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

        call.setKeepAlive(true);

        executor.execute(() -> {
            try {
                // 1. Resolve file path — handles content://, file://, blob:
                Uri uri = Uri.parse(fileUri);
                String filePath = FileUtil.getPath(getContext(), uri);
                if (filePath == null) {
                    call.reject("Cannot resolve file path from URI: " + fileUri);
                    return;
                }

                File inputFile = new File(filePath);
                if (!inputFile.exists()) {
                    call.reject("File not found: " + filePath);
                    return;
                }

                String fileName = inputFile.getName();
                long originalSize = inputFile.length();
                Log.i(TAG, "Starting: " + fileName + " (" + (originalSize / 1024) + "KB)");
                notifyProgress("compressing", 0);

                // 2. Compress video using hardware encoder
                File compressedFile = VideoCompressor.compress(
                    getContext(), inputFile,
                    (progress) -> notifyProgress("compressing", progress)
                );

                long compressedSize = compressedFile.length();
                String uploadFileName = fileName.replaceAll("\\.[^.]+$", ".mp4");
                Log.i(TAG, "Compressed: " + (originalSize / 1024) + "KB -> " + (compressedSize / 1024) + "KB");

                // 3. Init chunked upload
                notifyProgress("uploading", 0);
                String uploadId = initUpload(apiUrl, token, uploadFileName, compressedSize, subfolder, targetType, targetId);
                if (uploadId == null) {
                    cleanup(compressedFile, inputFile);
                    call.reject("Failed to init upload session");
                    return;
                }

                // 4. Upload chunks
                boolean uploadOk = uploadChunks(apiUrl, token, uploadId, compressedFile);
                if (!uploadOk) {
                    cleanup(compressedFile, inputFile);
                    call.reject("Chunk upload failed");
                    return;
                }

                // 5. Complete
                JSONObject result = completeUpload(apiUrl, token, uploadId);
                cleanup(compressedFile, inputFile);

                if (result == null) {
                    call.reject("Failed to complete upload");
                    return;
                }

                // 6. Return
                JSObject ret = new JSObject();
                ret.put("url", result.optString("url", ""));
                ret.put("filename", result.optString("filename", ""));
                ret.put("thumbnailUrl", result.optString("thumbnail_url", ""));
                ret.put("originalSize", originalSize);
                ret.put("compressedSize", compressedSize);
                call.resolve(ret);

            } catch (Exception e) {
                Log.e(TAG, "Upload failed", e);
                call.reject("Upload failed: " + e.getMessage());
            }
        });
    }

    // --- Progress ---

    private void notifyProgress(String phase, int progress) {
        JSObject data = new JSObject();
        data.put("phase", phase);
        data.put("progress", progress);
        notifyListeners("uploadProgress", data);
    }

    // --- Chunked Upload ---

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
            body.put("subfolder", subfolder);
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
            notifyProgress("uploading", (int) (bytesSent * 100 / totalSize));
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

    // --- Util ---

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
}
