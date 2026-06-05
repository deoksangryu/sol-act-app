import Foundation

struct UploadResponse {
    let url: String
    let filename: String
    let thumbnailUrl: String?
}

class ChunkedUploader {
    private static let chunkSize = 5 * 1024 * 1024 // 5MB

    static func upload(
        fileURL: URL,
        apiUrl: String,
        token: String,
        fileName: String,
        subfolder: String,
        targetType: String?,
        targetId: String?,
        onProgress: @escaping (Int) -> Void,
        completion: @escaping (Result<UploadResponse, Error>) -> Void
    ) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let fileSize = try FileManager.default.attributesOfItem(atPath: fileURL.path)[.size] as! Int64
                let totalChunks = fileSize == 0 ? 0 : Int((fileSize + Int64(chunkSize) - 1) / Int64(chunkSize))

                // 1. Init
                guard let uploadId = initUpload(apiUrl: apiUrl, token: token, fileName: fileName,
                                                 totalSize: fileSize, subfolder: subfolder,
                                                 targetType: targetType, targetId: targetId) else {
                    completion(.failure(NSError(domain: "Upload", code: -1,
                        userInfo: [NSLocalizedDescriptionKey: "Failed to init upload session"])))
                    return
                }

                let fileHandle = try FileHandle(forReadingFrom: fileURL)
                defer { fileHandle.closeFile() }

                // 2. Upload chunks with attempt-level RESUME.
                //    청크 전송이 끊기면 /status로 서버가 받은 지점을 물어 그 다음부터 이어 보낸다.
                //    (연결이 회복될 때까지 최대 maxResume회 재개 시도)
                let maxResume = 8
                var attempt = 0
                var done = false

                while !done {
                    var startChunk = 0
                    if attempt > 0 {
                        let next = getNextChunk(apiUrl: apiUrl, token: token, uploadId: uploadId)
                        if next < 0 {
                            // 세션 없음/연결 불가 → 회복 대기 후 재시도
                            attempt += 1
                            if attempt > maxResume {
                                completion(.failure(NSError(domain: "Upload", code: -2,
                                    userInfo: [NSLocalizedDescriptionKey: "Upload failed after resume attempts"])))
                                return
                            }
                            Thread.sleep(forTimeInterval: Double(min(attempt, 5)))
                            continue
                        }
                        startChunk = next
                    }

                    if totalChunks == 0 || startChunk >= totalChunks {
                        done = true
                        break
                    }

                    fileHandle.seek(toFileOffset: UInt64(startChunk) * UInt64(chunkSize))
                    var idx = startChunk
                    var failed = false
                    while idx < totalChunks {
                        let data = fileHandle.readData(ofLength: chunkSize)
                        if data.isEmpty { break }
                        if sendChunk(apiUrl: apiUrl, token: token, uploadId: uploadId, chunkIdx: idx, data: data) {
                            idx += 1
                            onProgress(min(99, Int(Int64(idx) * 100 / Int64(max(totalChunks, 1)))))
                        } else {
                            failed = true
                            break
                        }
                    }

                    if !failed && idx >= totalChunks {
                        done = true
                    } else {
                        attempt += 1
                        if attempt > maxResume {
                            completion(.failure(NSError(domain: "Upload", code: -2,
                                userInfo: [NSLocalizedDescriptionKey: "Upload failed after resume attempts"])))
                            return
                        }
                        Thread.sleep(forTimeInterval: Double(min(attempt, 5)))  // 재개 전 백오프
                    }
                }

                // 3. Complete
                guard let result = completeUpload(apiUrl: apiUrl, token: token, uploadId: uploadId) else {
                    completion(.failure(NSError(domain: "Upload", code: -3,
                        userInfo: [NSLocalizedDescriptionKey: "Failed to complete upload"])))
                    return
                }

                onProgress(100)
                completion(.success(result))

            } catch {
                completion(.failure(error))
            }
        }
    }

    /// 이어받기용 — 서버가 다음에 기대하는 청크 인덱스. 실패(세션없음/연결불가) 시 -1.
    private static func getNextChunk(apiUrl: String, token: String, uploadId: String) -> Int {
        guard let url = URL(string: "\(apiUrl)/api/upload/chunked/\(uploadId)/status") else { return -1 }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 30
        let (data, response) = syncRequest(request)
        guard let httpResp = response as? HTTPURLResponse, httpResp.statusCode == 200,
              let data = data,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let next = json["next_chunk"] as? Int else {
            return -1
        }
        return next
    }

    // MARK: - HTTP

    private static func initUpload(apiUrl: String, token: String, fileName: String, totalSize: Int64,
                                     subfolder: String, targetType: String?, targetId: String?) -> String? {
        guard let url = URL(string: "\(apiUrl)/api/upload/chunked/init") else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var body: [String: Any] = [
            "filename": fileName,
            "total_size": totalSize,
            "subfolder": subfolder,
        ]
        if let t = targetType { body["target_type"] = t }
        if let t = targetId { body["target_id"] = t }

        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        let (data, response) = syncRequest(request)
        guard let httpResp = response as? HTTPURLResponse, httpResp.statusCode == 200,
              let data = data,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }
        return json["upload_id"] as? String
    }

    private static func sendChunk(apiUrl: String, token: String, uploadId: String,
                                    chunkIdx: Int, data: Data) -> Bool {
        for retry in 0..<5 {
            guard let url = URL(string: "\(apiUrl)/api/upload/chunked/\(uploadId)") else { return false }

            let boundary = "----Chunk\(Int(Date().timeIntervalSince1970))"
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = 60

            var body = Data()
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"file\"; filename=\"chunk_\(chunkIdx)\"\r\n".data(using: .utf8)!)
            body.append("Content-Type: application/octet-stream\r\n\r\n".data(using: .utf8)!)
            body.append(data)
            body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
            request.httpBody = body

            let (_, response) = syncRequest(request)
            if let httpResp = response as? HTTPURLResponse, httpResp.statusCode == 200 {
                return true
            }

            Thread.sleep(forTimeInterval: Double(retry + 1))
        }
        return false
    }

    private static func completeUpload(apiUrl: String, token: String, uploadId: String) -> UploadResponse? {
        guard let url = URL(string: "\(apiUrl)/api/upload/chunked/\(uploadId)/complete") else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let (data, response) = syncRequest(request)
        guard let httpResp = response as? HTTPURLResponse, httpResp.statusCode == 200,
              let data = data,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return nil
        }

        return UploadResponse(
            url: json["url"] as? String ?? "",
            filename: json["filename"] as? String ?? "",
            thumbnailUrl: json["thumbnail_url"] as? String
        )
    }

    // MARK: - Sync HTTP helper

    private static func syncRequest(_ request: URLRequest) -> (Data?, URLResponse?) {
        let semaphore = DispatchSemaphore(value: 0)
        var resultData: Data?
        var resultResponse: URLResponse?

        URLSession.shared.dataTask(with: request) { data, response, _ in
            resultData = data
            resultResponse = response
            semaphore.signal()
        }.resume()

        semaphore.wait()
        return (resultData, resultResponse)
    }
}
