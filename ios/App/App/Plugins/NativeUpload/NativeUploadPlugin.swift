import Foundation
import Capacitor
import UserNotifications

@objc(NativeUploadPlugin)
public class NativeUploadPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeUploadPlugin"
    public let jsName = "NativeUpload"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "compressAndUpload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotificationPermission", returnType: CAPPluginReturnPromise),
    ]

    private var backgroundTaskId: UIBackgroundTaskIdentifier = .invalid

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": true])
    }

    @objc func requestNotificationPermission(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            call.resolve(["granted": granted])
        }
    }

    @objc func compressAndUpload(_ call: CAPPluginCall) {
        guard let fileUri = call.getString("fileUri"),
              let apiUrl = call.getString("apiUrl"),
              let token = call.getString("token") else {
            call.reject("Missing required parameters")
            return
        }

        let subfolder = call.getString("subfolder") ?? "portfolios"
        let targetType = call.getString("targetType")
        let targetId = call.getString("targetId")

        // Resolve file path
        guard let filePath = resolveFilePath(fileUri) else {
            call.reject("Cannot resolve file path")
            return
        }

        let inputURL = URL(fileURLWithPath: filePath)
        guard FileManager.default.fileExists(atPath: filePath) else {
            call.reject("File not found")
            return
        }

        call.keepAlive = true

        // Begin background task for extended processing
        backgroundTaskId = UIApplication.shared.beginBackgroundTask { [weak self] in
            self?.endBackgroundTask()
        }

        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }

            let originalSize = (try? FileManager.default.attributesOfItem(atPath: filePath)[.size] as? Int64) ?? 0
            let fileName = inputURL.lastPathComponent

            // 1. Compress
            self.notifyProgress("compressing", progress: 0)

            VideoCompressor.compress(inputURL: inputURL) { progress in
                self.notifyProgress("compressing", progress: progress)
            } completion: { compressedURL in
                let compressedPath = compressedURL ?? inputURL
                let compressedSize = (try? FileManager.default.attributesOfItem(atPath: compressedPath.path)[.size] as? Int64) ?? originalSize
                let uploadFileName = (fileName as NSString).deletingPathExtension + ".mp4"

                // 2. Upload
                self.notifyProgress("uploading", progress: 0)

                ChunkedUploader.upload(
                    fileURL: compressedPath,
                    apiUrl: apiUrl,
                    token: token,
                    fileName: uploadFileName,
                    subfolder: subfolder,
                    targetType: targetType,
                    targetId: targetId,
                    onProgress: { progress in
                        self.notifyProgress("uploading", progress: progress)
                    }
                ) { result in
                    // Cleanup compressed file
                    if compressedPath != inputURL {
                        try? FileManager.default.removeItem(at: compressedPath)
                    }

                    self.endBackgroundTask()

                    switch result {
                    case .success(let response):
                        self.showCompletionNotification(fileName: uploadFileName)
                        call.resolve([
                            "url": response.url,
                            "filename": response.filename,
                            "thumbnailUrl": response.thumbnailUrl ?? "",
                            "originalSize": originalSize,
                            "compressedSize": compressedSize,
                        ])
                    case .failure(let error):
                        self.showFailureNotification()
                        call.reject(error.localizedDescription)
                    }
                }
            }
        }
    }

    // MARK: - Helpers

    private func resolveFilePath(_ uri: String) -> String? {
        if uri.hasPrefix("file://") {
            return URL(string: uri)?.path
        }
        if uri.hasPrefix("/") {
            return uri
        }
        // Capacitor filesystem URI
        if let url = URL(string: uri) {
            return url.path
        }
        return nil
    }

    private func notifyProgress(_ phase: String, progress: Int) {
        notifyListeners("uploadProgress", data: [
            "phase": phase,
            "progress": progress,
        ])
    }

    private func endBackgroundTask() {
        if backgroundTaskId != .invalid {
            UIApplication.shared.endBackgroundTask(backgroundTaskId)
            backgroundTaskId = .invalid
        }
    }

    private func showCompletionNotification(fileName: String) {
        let content = UNMutableNotificationContent()
        content.title = "업로드 완료"
        content.body = "\(fileName) 업로드가 완료되었습니다."
        content.sound = .default

        let request = UNNotificationRequest(identifier: "upload_complete_\(Date().timeIntervalSince1970)",
                                             content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }

    private func showFailureNotification() {
        let content = UNMutableNotificationContent()
        content.title = "업로드 실패"
        content.body = "다시 시도해주세요."
        content.sound = .default

        let request = UNNotificationRequest(identifier: "upload_failed_\(Date().timeIntervalSince1970)",
                                             content: content, trigger: nil)
        UNUserNotificationCenter.current().add(request)
    }
}
