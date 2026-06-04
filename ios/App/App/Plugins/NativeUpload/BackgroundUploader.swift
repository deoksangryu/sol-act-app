import Foundation
import UserNotifications

/// 진짜 백그라운드 업로더 — URLSessionConfiguration.background 사용.
/// 앱이 백그라운드/종료돼도 OS가 업로드를 이어서 완료하고, 완료 시 앱을 백그라운드로 깨워 콜백을 전달한다.
/// 여러 파일을 동시에(작업당 1개씩) 큐에 넣을 수 있고, OS가 동시성/스케줄링을 관리한다.
final class BackgroundUploader: NSObject {
    static let shared = BackgroundUploader()

    /// AppDelegate 의 handleEventsForBackgroundURLSession 과 매칭되는 세션 식별자
    static let sessionIdentifier = "com.solact.academy.bgupload"

    /// 백그라운드 세션 이벤트 처리 완료 후 호출할 OS 콜백 (AppDelegate에서 저장)
    var backgroundCompletionHandler: (() -> Void)?

    private var meta: [Int: [String: String]] = [:]   // taskIdentifier -> {displayName, bodyPath}
    private let lock = NSLock()

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.background(withIdentifier: BackgroundUploader.sessionIdentifier)
        config.isDiscretionary = false            // 사용자 시작 업로드 → 즉시 시작
        config.sessionSendsLaunchEvents = true     // 완료 시 앱을 백그라운드로 깨움
        config.allowsCellularAccess = true
        config.httpMaximumConnectionsPerHost = 4   // 멀티 업로드 동시성(OS가 관리)
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    /// 앱 시작/재시작 시 세션을 다시 붙여 백그라운드 완료 이벤트가 흐르게 한다.
    func activate() { _ = session }

    /// 단일 파일 업로드를 큐에 등록. 즉시 반환하며, 이후는 OS가 백그라운드에서 처리.
    /// 여러 번 호출하면 여러 작업이 큐에 쌓이고 OS가 동시에/스케줄링하여 처리한다.
    @discardableResult
    func enqueue(filePath: String, apiUrl: String, token: String,
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

        // 배경 세션은 fromFile 업로드만 지원 (httpBody/data 불가)
        let task = session.uploadTask(with: request, fromFile: bodyURL)
        lock.lock()
        meta[task.taskIdentifier] = ["displayName": displayName, "bodyPath": bodyURL.path]
        lock.unlock()
        task.resume()
        return true
    }

    /// 멀티파트 본문을 임시 파일로 스트리밍 작성 (대용량도 메모리에 올리지 않음)
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
    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        lock.lock()
        let info = meta[task.taskIdentifier]
        let name = info?["displayName"] ?? "영상"
        let bodyPath = info?["bodyPath"]
        meta[task.taskIdentifier] = nil
        lock.unlock()

        if let p = bodyPath { try? FileManager.default.removeItem(atPath: p) }

        let httpOK = (task.response as? HTTPURLResponse).map { (200...299).contains($0.statusCode) } ?? false
        if error == nil && httpOK {
            notify(title: "업로드 완료", body: "\(name) 업로드가 완료됐어요.")
        } else {
            notify(title: "업로드 실패", body: "\(name) 업로드에 실패했어요. 앱에서 다시 시도해주세요.")
        }
    }

    /// 백그라운드 세션의 모든 이벤트 처리 완료 → OS 콜백 호출 (앱이 다시 잠들 수 있게)
    func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
        DispatchQueue.main.async {
            self.backgroundCompletionHandler?()
            self.backgroundCompletionHandler = nil
        }
    }
}
