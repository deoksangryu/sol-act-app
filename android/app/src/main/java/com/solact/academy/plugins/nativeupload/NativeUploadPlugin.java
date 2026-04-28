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
    private static final int CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod()
    public void compressAndUpload(PluginCall call) {
        String fileUri = call.getString("fileUri");
        String apiUrl = call.getString("apiUrl");
        String token = call.getString("token");
        String subfolder = call.getString("subfolder", "portfolios");
        String targetType = call.getString("targetType");
        String targetId = call.getString("targetId");

        if (fileUri == null || apiUrl == null || token == null) {
            call.reject("Missing required parameters: fileUri, apiUrl, token");
            return;
        }

        // Keep the call alive for async processing
        call.setKeepAlive(true);

        executor.execute(() -> {
            try {
                // 1. Resolve file path from URI
                Uri uri = Uri.parse(fileUri);
                String filePath = FileUtil.getPath(getContext(), uri);
                if (filePath == null) {
                    call.reject("Cannot resolve file path");
                    return;
                }

                File inputFile = new File(filePath);
                String fileName = inputFile.getName();
                long originalSize = inputFile.length();

                Log.i(TAG, "Starting: " + fileName + " (" + (originalSize / 1024) + "KB)");
                notifyProgress(call, "compressing", 0, originalSize, 0);

                // 2. Compress video
                File compressedFile = VideoCompressor.compress(
                    getContext(), inputFile,
                    (progress) -> notifyProgress(call, "compressing", progress, originalSize, 0)
                );

                long compressedSize = compressedFile.length();
                String uploadFileName = fileName.replaceAll("\\.[^.]+$", ".mp4");
                Log.i(TAG, "Compressed: " + (originalSize / 1024) + "KB -> " + (compressedSize / 1024) + "KB");

                // 3. Init chunked upload
                notifyProgress(call, "uploading", 0, compressedSize, 0);

                String uploadId = initChunkedUpload(
                    apiUrl, token, uploadFileName, compressedSize, subfolder, targetType, targetId
                );
                if (uploadId == null) {
                    call.reject("Failed to init upload session");
                    cleanupFile(compressedFile, inputFile);
                    return;
                }

                // 4. Upload chunks
                long bytesSent = 0;
                int chunkIdx = 0;
                FileInputStream fis = new FileInputStream(compressedFile);
                byte[] buffer = new byte[CHUNK_SIZE];
                int bytesRead;

                while ((bytesRead = fis.read(buffer)) > 0) {
                    byte[] chunk = bytesRead < CHUNK_SIZE ? java.util.Arrays.copyOf(buffer, bytesRead) : buffer;

                    boolean success = uploadChunk(apiUrl, token, uploadId, chunkIdx, chunk, bytesRead);
                    if (!success) {
                        fis.close();
                        call.reject("Chunk upload failed at index " + chunkIdx);
                        cleanupFile(compressedFile, inputFile);
                        return;
                    }

                    bytesSent += bytesRead;
                    chunkIdx++;
                    int pct = (int) (bytesSent * 100 / compressedSize);
                    notifyProgress(call, "uploading", pct, compressedSize, bytesSent);
                }
                fis.close();

                // 5. Complete upload
                JSONObject result = completeChunkedUpload(apiUrl, token, uploadId);
                if (result == null) {
                    call.reject("Failed to complete upload");
                    cleanupFile(compressedFile, inputFile);
                    return;
                }

                // 6. Cleanup compressed file
                cleanupFile(compressedFile, inputFile);

                // 7. Return result
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

    @PluginMethod()
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", true);
        call.resolve(ret);
    }

    private void notifyProgress(PluginCall call, String phase, int progress, long totalSize, long bytesSent) {
        JSObject data = new JSObject();
        data.put("phase", phase);
        data.put("progress", progress);
        data.put("totalSize", totalSize);
        data.put("bytesSent", bytesSent);
        notifyListeners("uploadProgress", data);
    }

    private String initChunkedUpload(String apiUrl, String token, String filename, long totalSize,
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
                String response = readStream(conn.getInputStream());
                JSONObject json = new JSONObject(response);
                return json.optString("upload_id", null);
            }
            Log.e(TAG, "Init failed: " + conn.getResponseCode());
        } catch (Exception e) {
            Log.e(TAG, "Init error", e);
        }
        return null;
    }

    private boolean uploadChunk(String apiUrl, String token, String uploadId, int chunkIdx,
                                 byte[] data, int length) {
        int retries = 0;
        while (retries < 5) {
            try {
                String boundary = "----ChunkBoundary" + System.currentTimeMillis();
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
                    + "Content-Disposition: form-data; name=\"file\"; filename=\"chunk_" + chunkIdx + "\"\r\n"
                    + "Content-Type: application/octet-stream\r\n\r\n";
                os.write(header.getBytes());
                os.write(data, 0, length);
                os.write(("\r\n--" + boundary + "--\r\n").getBytes());
                os.close();

                int code = conn.getResponseCode();
                if (code == 200) return true;
                Log.w(TAG, "Chunk " + chunkIdx + " returned " + code);
            } catch (Exception e) {
                Log.w(TAG, "Chunk " + chunkIdx + " retry " + retries, e);
            }
            retries++;
            try { Thread.sleep(retries * 1000L); } catch (InterruptedException ignored) {}
        }
        return false;
    }

    private JSONObject completeChunkedUpload(String apiUrl, String token, String uploadId) {
        try {
            URL url = new URL(apiUrl + "/api/upload/chunked/" + uploadId + "/complete");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setRequestProperty("Content-Type", "application/json");

            if (conn.getResponseCode() == 200) {
                String response = readStream(conn.getInputStream());
                return new JSONObject(response);
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

    private void cleanupFile(File compressed, File original) {
        if (!compressed.getAbsolutePath().equals(original.getAbsolutePath())) {
            compressed.delete();
        }
    }
}
