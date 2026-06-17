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
                // 조금이라도 작아졌으면 압축본 사용(예전엔 90% 미만일 때만 써서 대용량 원본을 그대로 올림)
                if (outputFile.length() < inputFile.length()) {
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
            int muxerAudioTrack = -1;
            boolean muxerStarted = false;

            MediaCodec.BufferInfo decInfo = new MediaCodec.BufferInfo();
            MediaCodec.BufferInfo encInfo = new MediaCodec.BufferInfo();
            boolean decoderDone = false;
            boolean encoderDone = false;
            boolean inputDone = false;
            int framesWritten = 0; // 실제 muxer에 기록된 인코딩 프레임 수

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
                        // 오디오 트랙은 재인코딩 없이 원본 포맷 그대로 추가(muxer.start 전에 추가해야 함).
                        if (audioTrack >= 0 && srcAudioFormat != null) {
                            try {
                                muxerAudioTrack = muxer.addTrack(srcAudioFormat);
                            } catch (Exception ae) {
                                Log.w(TAG, "오디오 트랙 추가 실패 — 오디오 없이 진행", ae);
                                muxerAudioTrack = -1;
                            }
                        }
                        muxer.start();
                        muxerStarted = true;
                    }
                } else if (encIdx >= 0) {
                    ByteBuffer encBuf = encoder.getOutputBuffer(encIdx);
                    // 코덱 설정(CSD) 버퍼는 실제 프레임이 아니므로 카운트에서 제외
                    boolean isConfig = (encInfo.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0;
                    if (encInfo.size > 0 && muxerStarted && !isConfig) {
                        encBuf.position(encInfo.offset);
                        encBuf.limit(encInfo.offset + encInfo.size);
                        muxer.writeSampleData(muxerVideoTrack, encBuf, encInfo);
                        framesWritten++;
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

            // 오디오 패스스루: 비디오만 재인코딩하고 오디오는 원본 샘플 그대로 복사(음질 손실·부하 없음).
            // muxer.stop() 전에 수행해야 한다. 실패해도 영상(무음)은 살리고 계속 진행.
            if (muxerStarted && muxerAudioTrack >= 0) {
                MediaExtractor audioExtractor = null;
                try {
                    audioExtractor = new MediaExtractor();
                    audioExtractor.setDataSource(input.getAbsolutePath());
                    audioExtractor.selectTrack(audioTrack);
                    audioExtractor.seekTo(0, MediaExtractor.SEEK_TO_CLOSEST_SYNC);

                    int maxInput = srcAudioFormat.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)
                        ? srcAudioFormat.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE) : 256 * 1024;
                    ByteBuffer audioBuf = ByteBuffer.allocate(Math.max(maxInput, 64 * 1024));
                    MediaCodec.BufferInfo audioInfo = new MediaCodec.BufferInfo();

                    while (true) {
                        int sz = audioExtractor.readSampleData(audioBuf, 0);
                        if (sz < 0) break;
                        audioInfo.offset = 0;
                        audioInfo.size = sz;
                        audioInfo.presentationTimeUs = audioExtractor.getSampleTime();
                        audioInfo.flags = (audioExtractor.getSampleFlags()
                            & MediaExtractor.SAMPLE_FLAG_SYNC) != 0
                            ? MediaCodec.BUFFER_FLAG_KEY_FRAME : 0;
                        muxer.writeSampleData(muxerAudioTrack, audioBuf, audioInfo);
                        audioExtractor.advance();
                    }
                } catch (Exception ae) {
                    Log.w(TAG, "오디오 복사 실패 — 무음으로 진행", ae);
                } finally {
                    if (audioExtractor != null) audioExtractor.release();
                }
            }

            if (muxerStarted) {
                muxer.stop();
                muxer.release();
            }

            // 헤더만 있고 실제 프레임이 0개인 깨진 출력(예: 갤럭시 S25 등 일부 기기에서
            // decoder→Surface→encoder 파이프라인이 무음 실패) → 압축 실패로 처리해 원본 폴백.
            if (framesWritten == 0) {
                Log.w(TAG, "Transcode produced 0 frames — treating as failure (will use original)");
                return false;
            }

            return true;
        } catch (Exception e) {
            Log.e(TAG, "Transcode error", e);
            return false;
        }
    }
}
