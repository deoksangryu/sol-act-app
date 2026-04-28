package com.solact.academy.plugins.nativeupload;

import android.content.Context;
import android.media.*;
import android.util.Log;

import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;

/**
 * Compress video using Android MediaCodec hardware encoder.
 * Targets 720p H.264 at ~2Mbps — similar to server-side ffmpeg output.
 */
public class VideoCompressor {
    private static final String TAG = "VideoCompressor";
    private static final int TARGET_WIDTH = 1280;
    private static final int TARGET_HEIGHT = 720;
    private static final int TARGET_BITRATE = 2_000_000; // 2 Mbps
    private static final int TARGET_FRAMERATE = 30;
    private static final int I_FRAME_INTERVAL = 2;

    public interface ProgressCallback {
        void onProgress(int percent);
    }

    /**
     * Compress video file. Returns compressed file, or original if compression fails/not needed.
     */
    public static File compress(Context context, File inputFile, ProgressCallback callback) {
        try {
            // Check if compression is needed
            MediaExtractor extractor = new MediaExtractor();
            extractor.setDataSource(inputFile.getAbsolutePath());

            int videoTrackIdx = -1;
            int audioTrackIdx = -1;
            MediaFormat videoFormat = null;
            MediaFormat audioFormat = null;

            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat format = extractor.getTrackFormat(i);
                String mime = format.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("video/") && videoTrackIdx < 0) {
                    videoTrackIdx = i;
                    videoFormat = format;
                } else if (mime != null && mime.startsWith("audio/") && audioTrackIdx < 0) {
                    audioTrackIdx = i;
                    audioFormat = format;
                }
            }

            if (videoTrackIdx < 0 || videoFormat == null) {
                Log.w(TAG, "No video track found, skipping compression");
                extractor.release();
                return inputFile;
            }

            int width = videoFormat.getInteger(MediaFormat.KEY_WIDTH);
            int height = videoFormat.getInteger(MediaFormat.KEY_HEIGHT);
            long duration = videoFormat.containsKey(MediaFormat.KEY_DURATION) ?
                videoFormat.getLong(MediaFormat.KEY_DURATION) : 0;

            // Skip if already small enough
            int maxDim = Math.max(width, height);
            if (maxDim <= TARGET_WIDTH && inputFile.length() < 50 * 1024 * 1024) {
                Log.i(TAG, "Video already optimized (" + width + "x" + height + "), skipping");
                extractor.release();
                callback.onProgress(100);
                return inputFile;
            }

            extractor.release();

            // Use MediaTranscoder approach with MediaCodec
            File outputFile = new File(context.getCacheDir(), "compressed_" + System.currentTimeMillis() + ".mp4");

            boolean success = transcodeVideo(inputFile, outputFile, duration, callback);

            if (success && outputFile.exists() && outputFile.length() > 0) {
                // Only use compressed if smaller
                if (outputFile.length() < inputFile.length() * 0.9) {
                    long saved = 100 - (outputFile.length() * 100 / inputFile.length());
                    Log.i(TAG, "Compressed: " + (inputFile.length() / 1024) + "KB -> "
                        + (outputFile.length() / 1024) + "KB (" + saved + "% reduction)");
                    callback.onProgress(100);
                    return outputFile;
                } else {
                    Log.i(TAG, "Compression did not reduce size, using original");
                    outputFile.delete();
                }
            } else {
                Log.w(TAG, "Compression failed, using original");
                if (outputFile.exists()) outputFile.delete();
            }
        } catch (Exception e) {
            Log.e(TAG, "Compression error", e);
        }

        callback.onProgress(100);
        return inputFile;
    }

    private static boolean transcodeVideo(File input, File output, long durationUs,
                                           ProgressCallback callback) {
        try {
            // Simple approach: use MediaExtractor + MediaMuxer + MediaCodec
            MediaExtractor extractor = new MediaExtractor();
            extractor.setDataSource(input.getAbsolutePath());

            int videoTrack = -1;
            int audioTrack = -1;
            MediaFormat srcVideoFormat = null;
            MediaFormat srcAudioFormat = null;

            for (int i = 0; i < extractor.getTrackCount(); i++) {
                MediaFormat fmt = extractor.getTrackFormat(i);
                String mime = fmt.getString(MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("video/") && videoTrack < 0) {
                    videoTrack = i;
                    srcVideoFormat = fmt;
                } else if (mime != null && mime.startsWith("audio/") && audioTrack < 0) {
                    audioTrack = i;
                    srcAudioFormat = fmt;
                }
            }

            if (videoTrack < 0) {
                extractor.release();
                return false;
            }

            int srcWidth = srcVideoFormat.getInteger(MediaFormat.KEY_WIDTH);
            int srcHeight = srcVideoFormat.getInteger(MediaFormat.KEY_HEIGHT);

            // Calculate target dimensions maintaining aspect ratio
            int outWidth, outHeight;
            if (srcWidth >= srcHeight) {
                outWidth = Math.min(srcWidth, TARGET_WIDTH);
                outHeight = (int) (outWidth * (float) srcHeight / srcWidth);
            } else {
                outHeight = Math.min(srcHeight, TARGET_WIDTH);
                outWidth = (int) (outHeight * (float) srcWidth / srcHeight);
            }
            // Ensure even dimensions
            outWidth = (outWidth / 2) * 2;
            outHeight = (outHeight / 2) * 2;

            if (durationUs <= 0 && srcVideoFormat.containsKey(MediaFormat.KEY_DURATION)) {
                durationUs = srcVideoFormat.getLong(MediaFormat.KEY_DURATION);
            }

            // Create decoder
            extractor.selectTrack(videoTrack);
            MediaCodec decoder = MediaCodec.createDecoderByType(
                srcVideoFormat.getString(MediaFormat.KEY_MIME));

            // Create encoder
            MediaFormat encFormat = MediaFormat.createVideoFormat(
                MediaFormat.MIMETYPE_VIDEO_AVC, outWidth, outHeight);
            encFormat.setInteger(MediaFormat.KEY_BIT_RATE, TARGET_BITRATE);
            encFormat.setInteger(MediaFormat.KEY_FRAME_RATE, TARGET_FRAMERATE);
            encFormat.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, I_FRAME_INTERVAL);
            encFormat.setInteger(MediaFormat.KEY_COLOR_FORMAT,
                MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface);

            MediaCodec encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC);
            encoder.configure(encFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);

            // Use Surface for decoder -> encoder pipeline
            android.view.Surface inputSurface = encoder.createInputSurface();
            encoder.start();

            decoder.configure(srcVideoFormat, inputSurface, null, 0);
            decoder.start();

            // Muxer
            MediaMuxer muxer = new MediaMuxer(output.getAbsolutePath(),
                MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
            int muxerVideoTrack = -1;
            boolean muxerStarted = false;

            MediaCodec.BufferInfo decInfo = new MediaCodec.BufferInfo();
            MediaCodec.BufferInfo encInfo = new MediaCodec.BufferInfo();
            boolean decoderDone = false;
            boolean encoderDone = false;
            boolean inputDone = false;

            long lastProgressTime = 0;

            while (!encoderDone) {
                // Feed decoder
                if (!inputDone) {
                    int inIdx = decoder.dequeueInputBuffer(10000);
                    if (inIdx >= 0) {
                        ByteBuffer buf = decoder.getInputBuffer(inIdx);
                        int sampleSize = extractor.readSampleData(buf, 0);
                        if (sampleSize < 0) {
                            decoder.queueInputBuffer(inIdx, 0, 0, 0,
                                MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                            inputDone = true;
                        } else {
                            decoder.queueInputBuffer(inIdx, 0, sampleSize,
                                extractor.getSampleTime(), 0);
                            extractor.advance();
                        }
                    }
                }

                // Drain decoder output (renders to encoder's input surface)
                if (!decoderDone) {
                    int outIdx = decoder.dequeueOutputBuffer(decInfo, 10000);
                    if (outIdx >= 0) {
                        boolean eos = (decInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0;
                        decoder.releaseOutputBuffer(outIdx, !eos); // render to surface
                        if (eos) {
                            encoder.signalEndOfInputStream();
                            decoderDone = true;
                        }

                        // Progress
                        if (durationUs > 0 && decInfo.presentationTimeUs > 0) {
                            long now = System.currentTimeMillis();
                            if (now - lastProgressTime > 500) {
                                int pct = (int) (decInfo.presentationTimeUs * 100 / durationUs);
                                callback.onProgress(Math.min(pct, 99));
                                lastProgressTime = now;
                            }
                        }
                    }
                }

                // Drain encoder output
                int encIdx = encoder.dequeueOutputBuffer(encInfo, 10000);
                if (encIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    if (!muxerStarted) {
                        muxerVideoTrack = muxer.addTrack(encoder.getOutputFormat());
                        muxer.start();
                        muxerStarted = true;
                    }
                } else if (encIdx >= 0) {
                    ByteBuffer encBuf = encoder.getOutputBuffer(encIdx);
                    if (encInfo.size > 0 && muxerStarted) {
                        encBuf.position(encInfo.offset);
                        encBuf.limit(encInfo.offset + encInfo.size);
                        muxer.writeSampleData(muxerVideoTrack, encBuf, encInfo);
                    }
                    encoder.releaseOutputBuffer(encIdx, false);
                    if ((encInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                        encoderDone = true;
                    }
                }
            }

            // Cleanup
            decoder.stop();
            decoder.release();
            encoder.stop();
            encoder.release();
            inputSurface.release();
            extractor.release();
            if (muxerStarted) {
                muxer.stop();
                muxer.release();
            }

            return true;
        } catch (Exception e) {
            Log.e(TAG, "Transcode error", e);
            return false;
        }
    }
}
