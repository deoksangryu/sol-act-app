import ExpoModulesCore
import Foundation
import UserNotifications

public class NativeUploadModule: Module {
    public func definition() -> ModuleDefinition {
        Name("NativeUpload")

        Events("uploadProgress", "uploadComplete")

        OnCreate {
            BackgroundUploader.shared.activate()
            BackgroundUploader.shared.onProgress = { [weak self] id, p in
                self?.sendEvent("uploadProgress", ["id": id, "phase": "uploading", "progress": p])
            }
            BackgroundUploader.shared.onComplete = { [weak self] id, ok, url, err in
                var payload: [String: Any] = ["id": id, "ok": ok]
                if let u = url { payload["url"] = u }
                if let e = err { payload["error"] = e }
                self?.sendEvent("uploadComplete", payload)
            }
        }

        Function("isAvailable") { () -> Bool in true }

        AsyncFunction("requestPermissions") { (promise: Promise) in
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
                promise.resolve(["notifications": granted])
            }
        }

        AsyncFunction("enqueueUpload") { [weak self] (options: [String: Any], promise: Promise) in
            guard let fileUri = options["fileUri"] as? String,
                  let apiUrl = options["apiUrl"] as? String,
                  let token = options["token"] as? String else {
                promise.reject("E_ARGS", "fileUri/apiUrl/token 필수"); return
            }
            let subfolder = options["subfolder"] as? String ?? "portfolios"
            let targetType = options["targetType"] as? String
            let targetId = options["targetId"] as? String
            let displayName = options["displayName"] as? String ?? "영상"
            let compress = options["compress"] as? Bool ?? true

            let id = UUID().uuidString
            let origPath = fileUri.hasPrefix("file://") ? (URL(string: fileUri)?.path ?? fileUri) : fileUri
            let origExt = (origPath as NSString).pathExtension.lowercased()
            let videoExts = ["mp4", "mov", "m4v", "3gp", "avi", "mkv", "webm", "hevc"]
            let isVideo = videoExts.contains(origExt)

            func mimeAndName(for uploadPath: String) -> (String, String) {
                let base = ((origPath as NSString).lastPathComponent as NSString).deletingPathExtension
                if isVideo { return ("video/mp4", base.isEmpty ? "video.mp4" : base + ".mp4") }
                let imageExts = ["jpg", "jpeg", "png", "heic", "heif", "webp", "gif"]
                let ext = (uploadPath as NSString).pathExtension.lowercased()
                if imageExts.contains(ext) {
                    return ("image/\(ext == "jpg" ? "jpeg" : ext)", (origPath as NSString).lastPathComponent)
                }
                return ("application/octet-stream", (origPath as NSString).lastPathComponent)
            }

            func finishEnqueue(_ uploadPath: String) {
                let (mime, name) = mimeAndName(for: uploadPath)
                let ok = BackgroundUploader.shared.enqueue(
                    id: id, filePath: uploadPath, apiUrl: apiUrl, token: token,
                    subfolder: subfolder, targetType: targetType, targetId: targetId,
                    mimeType: mime, uploadFileName: name, displayName: displayName)
                if ok { promise.resolve(["enqueued": true, "id": id]) }
                else { promise.reject("E_ENQUEUE", "업로드 큐 등록 실패") }
            }

            if compress && isVideo {
                self?.sendEvent("uploadProgress", ["id": id, "phase": "compressing", "progress": 0])
                VideoCompressor.compress(inputPath: origPath, onProgress: { p in
                    self?.sendEvent("uploadProgress", ["id": id, "phase": "compressing", "progress": p])
                }, completion: { outPath in
                    finishEnqueue(outPath ?? origPath)  // nil → 오디오소실/실패 → 원본
                })
            } else {
                finishEnqueue(origPath)
            }
        }
    }
}
