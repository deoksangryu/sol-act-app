package expo.modules.nativeupload

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * 진짜 백그라운드 업로드용 dataSync 포그라운드 서비스.
 * 앱이 백그라운드/종료돼도 압축(Media3) + 청크 업로드를 끝까지 수행. 완료는 서버 record-first-patch로 반영.
 */
class UploadForegroundService : Service() {
  private val activeJobs = AtomicInteger(0)
  private val executor = Executors.newSingleThreadExecutor()
  private var wakeLock: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val id = intent?.getStringExtra("id")
    if (id == null) { stopIfIdle(); return START_NOT_STICKY }
    ensureForeground()
    ensureWakeLock()
    activeJobs.incrementAndGet()

    val fileUri = intent.getStringExtra("fileUri") ?: ""
    val apiUrl = intent.getStringExtra("apiUrl") ?: ""
    val token = intent.getStringExtra("token") ?: ""
    val subfolder = intent.getStringExtra("subfolder") ?: "portfolios"
    val targetType = intent.getStringExtra("targetType")
    val targetId = intent.getStringExtra("targetId")
    val displayName = intent.getStringExtra("displayName") ?: "영상"
    val compress = intent.getBooleanExtra("compress", true)

    executor.execute {
      var tempCompressed: File? = null
      try {
        val path = fileUri.removePrefix("file://")
        var uploadFile = File(path)
        val ext = path.substringAfterLast('.', "").lowercase()
        val isVideo = ext in listOf("mp4", "mov", "m4v", "3gp", "avi", "mkv", "webm", "hevc")
        val uploadName = if (isVideo) File(path).nameWithoutExtension + ".mp4" else File(path).name

        if (compress && isVideo) {
          NativeUploadModule.emit("uploadProgress", mapOf("id" to id, "phase" to "compressing", "progress" to 0))
          val out = VideoCompressor.compress(applicationContext, uploadFile) { p ->
            NativeUploadModule.emit("uploadProgress", mapOf("id" to id, "phase" to "compressing", "progress" to p))
            updateNotification("$displayName · 압축 중 $p%")
          }
          if (out != null) { uploadFile = out; tempCompressed = out }
        }

        val result = ChunkedUploader.upload(apiUrl, token, uploadFile, uploadName, subfolder, targetType, targetId) { p ->
          NativeUploadModule.emit("uploadProgress", mapOf("id" to id, "phase" to "uploading", "progress" to p))
          updateNotification("$displayName · 업로드 중 $p%")
        }
        NativeUploadModule.emit("uploadComplete", mapOf("id" to id, "ok" to true, "url" to result.url))
        notifyDone("$displayName 업로드 완료")
      } catch (e: Exception) {
        NativeUploadModule.emit("uploadComplete", mapOf("id" to id, "ok" to false, "error" to (e.message ?: "실패")))
        notifyDone("$displayName 업로드 실패 — 앱에서 다시 시도해주세요")
      } finally {
        tempCompressed?.delete()
        if (activeJobs.decrementAndGet() <= 0) stopIfIdle()
      }
    }
    return START_REDELIVER_INTENT
  }

  private fun ensureForeground() {
    val notif = buildNotification("업로드 준비 중…", ongoing = true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ServiceCompat.startForeground(this, NOTIF_ID, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIF_ID, notif)
    }
  }

  private fun ensureWakeLock() {
    if (wakeLock == null) {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "solact:upload").apply {
        setReferenceCounted(false)
        acquire(30 * 60 * 1000L)
      }
    }
  }

  private fun updateNotification(text: String) {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.notify(NOTIF_ID, buildNotification(text, ongoing = true))
  }

  private fun notifyDone(text: String) {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.notify((System.currentTimeMillis() and 0xFFFFFF).toInt(), buildNotification(text, ongoing = false))
  }

  private fun buildNotification(text: String, ongoing: Boolean): Notification {
    createChannel()
    return NotificationCompat.Builder(this, CHANNEL)
      .setContentTitle("SOL-ACT")
      .setContentText(text)
      .setSmallIcon(android.R.drawable.stat_sys_upload)
      .setOngoing(ongoing)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(CHANNEL) == null) {
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "업로드", NotificationManager.IMPORTANCE_LOW))
      }
    }
  }

  private fun stopIfIdle() {
    try { wakeLock?.let { if (it.isHeld) it.release() } } catch (_: Exception) {}
    wakeLock = null
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  override fun onDestroy() {
    executor.shutdown()
    super.onDestroy()
  }

  companion object {
    private const val NOTIF_ID = 4711
    private const val CHANNEL = "solact_upload"
  }
}
