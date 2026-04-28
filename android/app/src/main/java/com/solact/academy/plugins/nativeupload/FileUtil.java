package com.solact.academy.plugins.nativeupload;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;
import android.util.Log;

import java.io.*;

/**
 * Resolve content:// URIs to actual file paths.
 */
public class FileUtil {
    private static final String TAG = "FileUtil";

    public static String getPath(Context context, Uri uri) {
        // Try content resolver first
        if ("content".equalsIgnoreCase(uri.getScheme())) {
            String[] projection = { MediaStore.MediaColumns.DATA };
            try (Cursor cursor = context.getContentResolver().query(uri, projection, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) {
                    int idx = cursor.getColumnIndexOrThrow(MediaStore.MediaColumns.DATA);
                    String path = cursor.getString(idx);
                    if (path != null && new File(path).exists()) return path;
                }
            } catch (Exception e) {
                Log.w(TAG, "Cursor query failed", e);
            }

            // Fallback: copy to cache
            try {
                return copyToCache(context, uri);
            } catch (IOException e) {
                Log.e(TAG, "Copy to cache failed", e);
            }
        }

        // File URI
        if ("file".equalsIgnoreCase(uri.getScheme())) {
            return uri.getPath();
        }

        return null;
    }

    private static String copyToCache(Context context, Uri uri) throws IOException {
        InputStream is = context.getContentResolver().openInputStream(uri);
        if (is == null) throw new IOException("Cannot open input stream");

        String fileName = "upload_" + System.currentTimeMillis();
        // Try to get original extension
        String type = context.getContentResolver().getType(uri);
        if (type != null && type.contains("mp4")) fileName += ".mp4";
        else if (type != null && type.contains("quicktime")) fileName += ".mov";
        else fileName += ".mp4";

        File outFile = new File(context.getCacheDir(), fileName);
        OutputStream os = new FileOutputStream(outFile);
        byte[] buf = new byte[8192];
        int n;
        while ((n = is.read(buf)) > 0) os.write(buf, 0, n);
        os.close();
        is.close();

        return outFile.getAbsolutePath();
    }
}
