package expo.modules.nativeupload

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.Handler
import android.os.HandlerThread
import androidx.media3.common.Effect
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * 영상 압축 — androidx.media3 Transformer.
 * 수제 MediaCodec/MediaMuxer(오디오 트랙 pass-through 실패로 non-720p 무음 버그)를 대체.
 * Transformer는 비디오를 H.264 720p로 재인코딩하고 오디오는 기본 passthrough(csd/컨테이너 처리 내장).
 * 가드: 이미 720p 이하·소형이면 스킵(원본), 결과가 오디오 소실/실패/더 크면 원본 폴백 → 절대 깨진 파일 안 올림.
 */
@UnstableApi
object VideoCompressor {

  /** 압축 성공 시 압축 File, 아니면 null(=원본 그대로 업로드). */
  fun compress(context: Context, input: File, onProgress: (Int) -> Unit): File? {
    val dims = videoDimensions(input) ?: return null
    val maxDim = maxOf(dims.first, dims.second)
    if (maxDim <= 1280 && input.length() < 50L * 1024 * 1024) return null
    val srcHasAudio = hasAudio(input)

    val output = File(context.cacheDir, "compressed_${System.currentTimeMillis()}.mp4")
    val thread = HandlerThread("media3-transformer").apply { start() }
    val handler = Handler(thread.looper)
    val latch = CountDownLatch(1)
    val ok = AtomicBoolean(false)

    handler.post {
      try {
        val transformer = Transformer.Builder(context)
          .setVideoMimeType(MimeTypes.VIDEO_H264)
          .addListener(object : Transformer.Listener {
            override fun onCompleted(composition: Composition, result: ExportResult) {
              ok.set(true); latch.countDown()
            }
            override fun onError(composition: Composition, result: ExportResult, exception: ExportException) {
              latch.countDown()
            }
          })
          .build()

        val effects = Effects(emptyList<AudioProcessor>(), listOf<Effect>(Presentation.createForHeight(720)))
        val edited = EditedMediaItem.Builder(MediaItem.fromUri(Uri.fromFile(input)))
          .setEffects(effects)
          .build()

        val progressHolder = ProgressHolder()
        val poll = object : Runnable {
          override fun run() {
            val state = transformer.getProgress(progressHolder)
            if (state != Transformer.PROGRESS_STATE_NOT_STARTED) onProgress(minOf(progressHolder.progress, 99))
            if (latch.count > 0L) handler.postDelayed(this, 400)
          }
        }
        transformer.start(edited, output.absolutePath)
        handler.postDelayed(poll, 400)
      } catch (e: Exception) {
        latch.countDown()
      }
    }

    val finished = latch.await(10, TimeUnit.MINUTES)
    thread.quitSafely()

    if (!finished || !ok.get() || !output.exists() || output.length() == 0L) {
      output.delete(); return null
    }
    // 오디오 보존 + 크기 검증
    val outHasAudio = hasAudio(output)
    if ((srcHasAudio && !outHasAudio) || output.length() >= input.length()) {
      output.delete(); return null
    }
    onProgress(100)
    return output
  }

  private fun videoDimensions(file: File): Pair<Int, Int>? {
    val ex = MediaExtractor()
    return try {
      ex.setDataSource(file.absolutePath)
      var result: Pair<Int, Int>? = null
      for (i in 0 until ex.trackCount) {
        val f = ex.getTrackFormat(i)
        val mime = f.getString(MediaFormat.KEY_MIME) ?: continue
        if (mime.startsWith("video/")) {
          val w = if (f.containsKey(MediaFormat.KEY_WIDTH)) f.getInteger(MediaFormat.KEY_WIDTH) else 0
          val h = if (f.containsKey(MediaFormat.KEY_HEIGHT)) f.getInteger(MediaFormat.KEY_HEIGHT) else 0
          result = Pair(w, h); break
        }
      }
      result
    } catch (e: Exception) { null } finally { ex.release() }
  }

  private fun hasAudio(file: File): Boolean {
    val ex = MediaExtractor()
    return try {
      ex.setDataSource(file.absolutePath)
      (0 until ex.trackCount).any {
        ex.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true
      }
    } catch (e: Exception) { false } finally { ex.release() }
  }
}
