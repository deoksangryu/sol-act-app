package expo.modules.nativeupload

import okhttp3.Headers
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.io.RandomAccessFile
import java.util.concurrent.TimeUnit

/**
 * 청크 업로드 + 이어받기 — 백엔드 /api/upload/chunked 계약(init·chunk·status·complete)을 그대로 구현.
 * init → per-chunk(멀티파트 filename=chunk_<idx>) → 실패 시 /status로 next_chunk 이어받기 → complete.
 * 5MB 청크, 청크당 5회 재시도(선형 백오프) + 세션 resume. 서버가 record-first-patch로 URL을 레코드에 반영.
 */
object ChunkedUploader {
  private const val CHUNK = 5 * 1024 * 1024

  data class Result(val url: String, val filename: String, val thumbnailUrl: String?)

  private val client = OkHttpClient.Builder()
    .connectTimeout(30, TimeUnit.SECONDS)
    .writeTimeout(120, TimeUnit.SECONDS)
    .readTimeout(60, TimeUnit.SECONDS)
    .build()

  fun upload(
    apiUrl: String, token: String, file: File, filename: String, subfolder: String,
    targetType: String?, targetId: String?, onProgress: (Int) -> Unit,
  ): Result {
    val total = file.length()
    val base = "$apiUrl/api/upload/chunked"

    val initBody = JSONObject().apply {
      put("filename", filename); put("total_size", total); put("subfolder", subfolder)
      targetType?.let { put("target_type", it) }
      targetId?.let { put("target_id", it) }
    }
    val uploadId = postJson("$base/init", token, initBody).getString("upload_id")

    val totalChunks = if (total == 0L) 1 else ((total + CHUNK - 1) / CHUNK).toInt()
    val raf = RandomAccessFile(file, "r")
    try {
      var idx = 0
      var resumeAttempts = 0
      while (idx < totalChunks) {
        val offset = idx.toLong() * CHUNK
        val size = minOf(CHUNK.toLong(), total - offset).toInt().coerceAtLeast(0)
        val buf = ByteArray(size)
        if (size > 0) { raf.seek(offset); raf.readFully(buf) }

        var sent = false
        for (attempt in 0 until 5) {
          try { sendChunk("$base/$uploadId", token, idx, buf); sent = true; break }
          catch (e: Exception) { Thread.sleep((attempt + 1) * 1000L) }
        }
        if (!sent) {
          if (resumeAttempts++ >= 8) throw RuntimeException("업로드 반복 실패")
          val next = status("$base/$uploadId", token)
          if (next < 0) throw RuntimeException("업로드 세션 만료 — 다시 시도해주세요")
          idx = next
          continue
        }
        idx++
        onProgress(minOf(idx * 100 / totalChunks, 99))
      }
    } finally {
      raf.close()
    }

    val done = postEmpty("$base/$uploadId/complete", token)
    onProgress(100)
    val thumb = if (done.isNull("thumbnail_url")) null else done.optString("thumbnail_url", null)
    return Result(done.getString("url"), done.optString("filename", filename), thumb)
  }

  private fun headers(token: String): Headers = Headers.Builder()
    .add("Authorization", "Bearer $token")
    .add("ngrok-skip-browser-warning", "true")
    .build()

  private fun postJson(url: String, token: String, body: JSONObject): JSONObject {
    val req = Request.Builder().url(url).headers(headers(token))
      .post(body.toString().toRequestBody("application/json".toMediaType())).build()
    client.newCall(req).execute().use { r ->
      if (!r.isSuccessful) throw RuntimeException("init 실패 ${r.code}")
      return JSONObject(r.body!!.string())
    }
  }

  private fun sendChunk(url: String, token: String, idx: Int, data: ByteArray) {
    val body = MultipartBody.Builder().setType(MultipartBody.FORM)
      .addFormDataPart("file", "chunk_$idx", data.toRequestBody("application/octet-stream".toMediaType()))
      .build()
    val req = Request.Builder().url(url).headers(headers(token)).post(body).build()
    client.newCall(req).execute().use { r -> if (!r.isSuccessful) throw RuntimeException("chunk 실패 ${r.code}") }
  }

  private fun status(url: String, token: String): Int {
    val req = Request.Builder().url("$url/status").headers(headers(token)).get().build()
    client.newCall(req).execute().use { r ->
      if (!r.isSuccessful) return -1
      return JSONObject(r.body!!.string()).optInt("next_chunk", -1)
    }
  }

  private fun postEmpty(url: String, token: String): JSONObject {
    val req = Request.Builder().url(url).headers(headers(token))
      .post(ByteArray(0).toRequestBody(null)).build()
    client.newCall(req).execute().use { r ->
      if (!r.isSuccessful) throw RuntimeException("complete 실패 ${r.code}")
      return JSONObject(r.body!!.string())
    }
  }
}
