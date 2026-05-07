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

                // 1. Init
                guard let uploadId = initUpload(apiUrl: apiUrl, token: token, fileName: fileName,
                                                 totalSize: fileSize, subfolder: subfolder,
                                                 targetType: targetType, targetId: targetId) else {
                    completion(.failure(NSError(domain: "Upload", code: -1,
                        userInfo: [NSLocalizedDescriptionKey: "Failed to init upload session"])))
                    return
                }

                // 2. Upload chunks
                let fileHandle = try FileHandle(forReadingFrom: fileURL)
                defer { fileHandle.closeFile() }

                var bytesSent: Int64 = 0
                var chunkIdx = 0

                while bytesSent < fileSize {
                    let data = fileHandle.readData(ofLength: chunkSize)
                    if data.isEmpty { break }

                    let success = sendChunk(apiUrl: apiUrl, token: token, uploadId: uploadId,
                                             chunkIdx: chunkIdx, data: data)
                    if !success {
                        completion(.failure(NSError(domain: "Upload", code: -2,
                            userInfo: [NSLocalizedDescriptionKey: "Chunk \(chunkIdx) upload failed"])))
                        return
                    }

                    bytesSent += Int64(data.count)
                    chunkIdx += 1
                    let pct = Int(bytesSent * 100 / fileSize)
                    onProgress(pct)
                }

                // 3. Complete
                guard let result = completeUpload(apiUrl: apiUrl, token: token, uploadId: uploadId) else {
                    completion(.failure(NSError(domain: "Upload", code: -3,
                        userInfo: [NSLocalizedDescriptionKey: "Failed to complete upload"])))
                    return
                }

                completion(.success(result))

            } catch {
                completion(.failure(error))
            }
        }
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
