import Foundation
import UserNotifications

/// 진짜 백그라운드 업로더 — URLSessionConfiguration.background.
/// 앱이 백그라운드/종료돼도 OS가 업로드를 완료하고 앱을 깨워 콜백을 전달한다.
/// (Capacitor 판 이식 + 개선: task 메타를 UserDefaults에 영속화 → 프로세스 종료 후 재실행돼도
///  displayName/bodyPath 복원, 임시파일 누수·알림 라벨 소실 방지.)
final class BackgroundUploader: NSObject {
    static let shared = BackgroundUploader()

    static let sessionIdentifier = "com.solact.academy.bgupload"
    private static let metaKey = "com.solact.academy.bgupload.meta"

    /// 백그라운드 세션 이벤트 처리 완료 후 호출할 OS 콜백 (AppDelegate에서 저장)
    var backgroundCompletionHandler: (() -> Void)?

    /// 진행/완료를 JS(Expo 모듈)로 전달하는 콜백 — 살아있을 때만 best-effort.
    var onProgress: ((_ id: String, _ progress: Int) -> Void)?
    var onComplete: ((_ id: String, _ ok: Bool, _ url: String?, _ error: String?) -> Void)?

    private let lock = NSLock()

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.background(withIdentifier: BackgroundUploader.sessionIdentifier)
        config.isDiscretionary = false
        config.sessionSendsLaunchEvents = true
        config.allowsCellularAccess = true
        config.httpMaximumConnectionsPerHost = 4
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    /// 앱 시작/재시작 시 세션 재부착 → 백그라운드 완료 이벤트 흐름 복원.
    func activate() { _ = session }

    // MARK: - 영속 메타 (프로세스 종료 후에도 복원)
    private func loadMeta() -> [String: [String: String]] {
        (UserDefaults.standard.dictionary(forKey: BackgroundUploader.metaKey) as? [String: [String: String]]) ?? [:]
    }
    private func saveMeta(_ m: [String: [String: String]]) {
        UserDefaults.standard.set(m, forKey: BackgroundUploader.metaKey)
    }
    private func putMeta(_ taskId: Int, _ info: [String: String]) {
        lock.lock(); defer { lock.unlock() }
        var m = loadMeta(); m[String(taskId)] = info; saveMeta(m)
    }
    private func takeMeta(_ taskId: Int) -> [String: String]? {
        lock.lock(); defer { lock.unlock() }
        var m = loadMeta(); let info = m[String(taskId)]; m[String(taskId)] = nil; saveMeta(m)
        return info
    }

    /// 단일 파일 업로드 큐 등록. 즉시 반환하며, 이후는 OS가 백그라운드에서 처리.
    @discardableResult
    func enqueue(id: String, filePath: String, apiUrl: String, token: String,
                 subfolder: String, targetType: String?, targetId: String?,
                 mimeType: String, uploadFileName: String, displayName: String) -> Bool {
        let fileURL = URL(fileURLWithPath: filePath)
        guard FileManager.default.fileExists(atPath: filePath) else { return false }

        var comps = URLComponents(string: "\(apiUrl)/api/upload")
        var qs = [URLQueryItem(name: "subfolder", value: subfolder)]
        if let t = targetType { qs.append(URLQueryItem(name: "target_type", value: t)) }
        if let t = targetId { qs.append(URLQueryItem(name: "target_id", value: t)) }
        comps?.queryItems = qs
        guard let url = comps?.url else { return false }

        let boundary = "----SolActBoundary\(UUID().uuidString)"
        guard let bodyURL = buildMultipartBody(fileURL: fileURL, fileName: uploadFileName,
                                               mimeType: mimeType, boundary: boundary) else { return false }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.setValue("true", forHTTPHeaderField: "ngrok-skip-browser-warning")

        // 배경 세션은 fromFile 업로드만 지원.
        let task = session.uploadTask(with: request, fromFile: bodyURL)
        putMeta(task.taskIdentifier, ["id": id, "displayName": displayName, "bodyPath": bodyURL.path])
        task.taskDescription = id
        task.resume()
        return true
    }

    /// 멀티파트 본문을 임시 파일로 스트리밍 작성 (대용량도 메모리에 안 올림)
    private func buildMultipartBody(fileURL: URL, fileName: String, mimeType: String, boundary: String) -> URL? {
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent("bgbody_\(UUID().uuidString).tmp")
        guard FileManager.default.createFile(atPath: tmp.path, contents: nil),
              let out = try? FileHandle(forWritingTo: tmp) else { return nil }
        func write(_ s: String) { if let d = s.data(using: .utf8) { out.write(d) } }
        write("--\(boundary)\r\n")
        write("Content-Disposition: form-data; name=\"file\"; filename=\"\(fileName)\"\r\n")
        write("Content-Type: \(mimeType)\r\n\r\n")
        if let inHandle = try? FileHandle(forReadingFrom: fileURL) {
            while true {
                let chunk = inHandle.readData(ofLength: 1024 * 1024)
                if chunk.isEmpty { break }
                out.write(chunk)
            }
            try? inHandle.close()
        }
        write("\r\n--\(boundary)--\r\n")
        try? out.close()
        return tmp
    }

    private func notify(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        let req = UNNotificationRequest(identifier: "bgupload_\(UUID().uuidString)", content: content, trigger: nil)
        UNUserNotificationCenter.current().add(req)
    }
}

extension BackgroundUploader: URLSessionDataDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    didSendBodyData bytesSent: Int64, totalBytesSent: Int64, totalBytesExpectedToSend: Int64) {
        guard totalBytesExpectedToSend > 0 else { return }
        let pct = Int(Double(totalBytesSent) / Double(totalBytesExpectedToSend) * 100)
        let id = task.taskDescription ?? String(task.taskIdentifier)
        onProgress?(id, min(pct, 99))
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        let info = takeMeta(task.taskIdentifier)
        let id = info?["id"] ?? task.taskDescription ?? String(task.taskIdentifier)
        let name = info?["displayName"] ?? "영상"
        if let p = info?["bodyPath"] { try? FileManager.default.removeItem(atPath: p) }

        let httpOK = (task.response as? HTTPURLResponse).map { (200...299).contains($0.statusCode) } ?? false
        if error == nil && httpOK {
            onProgress?(id, 100)
            onComplete?(id, true, nil, nil)
            notify(title: "업로드 완료", body: "\(name) 업로드가 완료됐어요.")
        } else {
            onComplete?(id, false, nil, error?.localizedDescription ?? "업로드 실패")
            notify(title: "업로드 실패", body: "\(name) 업로드에 실패했어요. 앱에서 다시 시도해주세요.")
        }
    }

    /// 백그라운드 세션 이벤트 처리 완료 → OS 콜백 호출(앱 재수면 허용).
    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async {
            self.backgroundCompletionHandler?()
            self.backgroundCompletionHandler = nil
        }
    }
}
