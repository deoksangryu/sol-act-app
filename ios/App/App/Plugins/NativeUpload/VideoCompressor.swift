import Foundation
import AVFoundation

class VideoCompressor {

    /// 영상을 720p H.264로 다운스케일 압축.
    /// 해상도를 강제로 줄이므로 HEVC(H.265) 원본이라도 실제로 크게 작아짐.
    /// 반환: 압축 파일 URL, 또는 nil(압축 불필요/실패 → 원본 사용).
    static func compress(
        inputURL: URL,
        onProgress: @escaping (Int) -> Void,
        completion: @escaping (URL?) -> Void
    ) {
        let asset = AVURLAsset(url: inputURL)

        guard let videoTrack = asset.tracks(withMediaType: .video).first else {
            onProgress(100)
            completion(nil) // 비디오 트랙 없음 → 스킵
            return
        }

        let fileSize = (try? FileManager.default.attributesOfItem(atPath: inputURL.path)[.size] as? Int64) ?? 0
        // 회전(transform) 반영한 실제 표시 크기
        let displaySize = videoTrack.naturalSize.applying(videoTrack.preferredTransform)
        let maxDim = max(abs(displaySize.width), abs(displaySize.height))

        // 이미 720p 이하이고 충분히 작으면(<50MB) 그대로 업로드 — 빠르게 통과
        if maxDim <= 1280 && fileSize < 50 * 1024 * 1024 {
            onProgress(100)
            completion(nil)
            return
        }

        // 720p 강제 다운스케일 프리셋(미지원 시 medium). 해상도 축소라 코덱 무관하게 실제로 줄어듦.
        let presets = AVAssetExportSession.exportPresets(compatibleWith: asset)
        let presetName = presets.contains(AVAssetExportPreset1280x720)
            ? AVAssetExportPreset1280x720
            : AVAssetExportPresetMediumQuality

        guard let exportSession = AVAssetExportSession(asset: asset, presetName: presetName) else {
            onProgress(100)
            completion(nil)
            return
        }

        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("compressed_\(Int(Date().timeIntervalSince1970)).mp4")
        try? FileManager.default.removeItem(at: outputURL)

        exportSession.outputURL = outputURL
        exportSession.outputFileType = .mp4
        exportSession.shouldOptimizeForNetworkUse = true // faststart

        let timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
            onProgress(min(Int(exportSession.progress * 100), 99))
        }
        RunLoop.current.add(timer, forMode: .common)

        exportSession.exportAsynchronously {
            timer.invalidate()

            switch exportSession.status {
            case .completed:
                let compressedSize = (try? FileManager.default.attributesOfItem(atPath: outputURL.path)[.size] as? Int64) ?? 0
                // 조금이라도 작아졌으면 압축본 사용(예전엔 90% 미만일 때만 써서 대용량 원본을 그대로 올리던 버그를 제거).
                if compressedSize > 0 && compressedSize < fileSize {
                    let saved = 100 - Int(compressedSize * 100 / max(fileSize, 1))
                    print("[VideoCompressor] \(fileSize / 1024 / 1024)MB -> \(compressedSize / 1024 / 1024)MB (\(saved)% 감소)")
                    onProgress(100)
                    completion(outputURL)
                } else {
                    // 압축본이 더 크면(드묾) 원본 사용
                    try? FileManager.default.removeItem(at: outputURL)
                    onProgress(100)
                    completion(nil)
                }

            case .failed, .cancelled:
                print("[VideoCompressor] 실패: \(exportSession.error?.localizedDescription ?? "unknown")")
                try? FileManager.default.removeItem(at: outputURL)
                onProgress(100)
                completion(nil)

            default:
                onProgress(100)
                completion(nil)
            }
        }
    }
}
