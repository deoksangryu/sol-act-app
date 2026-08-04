package expo.modules.nativeupload

import android.content.Intent
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID

/**
 * 진짜 백그라운드 업로드 — 포그라운드 서비스에 위임(앱 닫혀도 dataSync 서비스가 완료).
 * 압축은 Media3 Transformer(오디오 passthrough), 업로드는 청크+resume. 완료 durability는
 * 서버 record-first-patch(target_type/target_id) + 알림. 이벤트는 앱이 살아있을 때 best-effort.
 */
class NativeUploadModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeUpload")

    Events("uploadProgress", "uploadComplete")

    OnCreate {
      sink = { name, body -> this@NativeUploadModule.sendEvent(name, body) }
    }
    OnDestroy {
      sink = null
    }

    Function("isAvailable") { true }

    AsyncFunction("requestPermissions") { promise: Promise ->
      // POST_NOTIFICATIONS는 매니페스트 선언 + 런타임 요청은 JS(expo-notifications)나 최초 실행에 위임.
      // 서비스 자체는 알림 없이도 동작하므로 여기선 선언 상태를 반환.
      promise.resolve(mapOf("notifications" to true))
    }

    AsyncFunction("enqueueUpload") { options: Map<String, Any?>, promise: Promise ->
      val ctx = appContext.reactContext
      if (ctx == null) { promise.reject("E_CTX", "no android context", null); return@AsyncFunction }
      val id = UUID.randomUUID().toString()
      val intent = Intent(ctx, UploadForegroundService::class.java).apply {
        putExtra("id", id)
        putExtra("fileUri", options["fileUri"] as? String)
        putExtra("apiUrl", options["apiUrl"] as? String)
        putExtra("token", options["token"] as? String)
        putExtra("subfolder", (options["subfolder"] as? String) ?: "portfolios")
        putExtra("targetType", options["targetType"] as? String)
        putExtra("targetId", options["targetId"] as? String)
        putExtra("displayName", (options["displayName"] as? String) ?: "영상")
        putExtra("compress", (options["compress"] as? Boolean) ?: true)
      }
      ContextCompat.startForegroundService(ctx, intent)
      promise.resolve(mapOf("enqueued" to true, "id" to id))
    }
  }

  companion object {
    @Volatile
    private var sink: ((String, Map<String, Any?>) -> Unit)? = null

    /** 서비스에서 JS로 이벤트 전달(앱 살아있을 때만). */
    fun emit(name: String, body: Map<String, Any?>) {
      sink?.invoke(name, body)
    }
  }
}
