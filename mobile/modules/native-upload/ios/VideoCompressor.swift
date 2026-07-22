import Foundation
import AVFoundation

/// iOS 영상 압축 — AVAssetExportSession(1280x720). 오디오는 프리셋이 재인코딩하므로 보통 보존되나,
/// HEVC/HDR/비표준 오디오에서 드물게 오디오가 빠질 수 있어 **결과를 검증**한다:
/// (원본에 오디오가 있는데 결과에 없거나 / 결과가 비어있거나 / 더 크면) → nil 반환 = 원본 업로드.
/// 즉 "절대 오디오 빠진/깨진 파일을 올리지 않는다."
enum VideoCompressor {
    /// completion(nil) 이면 압축을 건너뛰고 원본을 그대로 업로드하라는 뜻.
    static func compress(inputPath: String,
                         onProgress: @escaping (Int) -> Void,
                         completion: @escaping (_ outputPath: String?) -> Void) {
        let inURL = URL(fileURLWithPath: inputPath)
        let asset = AVURLAsset(url: inURL)

        guard let vTrack = asset.tracks(withMediaType: .video).first else { completion(nil); return }
        let dims = vTrack.naturalSize.applying(vTrack.preferredTransform)
        let maxDim = max(abs(dims.width), abs(dims.height))
        let srcSize = (try? FileManager.default.attributesOfItem(atPath: inputPath)[.size] as? Int) ?? 0
        let srcSizeVal = srcSize ?? 0

        // 이미 720p 이하 + 50MB 미만이면 압축 불필요 → 원본.
        if maxDim <= 1280 && srcSizeVal < 50 * 1024 * 1024 {
            completion(nil); return
        }

        let presets = AVAssetExportSession.exportPresets(compatibleWith: asset)
        let preset = presets.contains(AVAssetExportPreset1280x720)
            ? AVAssetExportPreset1280x720 : AVAssetExportPresetMediumQuality
        guard let export = AVAssetExportSession(asset: asset, presetName: preset) else { completion(nil); return }

        let outURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("compressed_\(UUID().uuidString).mp4")
        export.outputURL = outURL
        export.outputFileType = .mp4
        export.shouldOptimizeForNetworkUse = true

        let srcHasAudio = !asset.tracks(withMediaType: .audio).isEmpty

        // 진행률 폴링
        let timer = DispatchSource.makeTimerSource(queue: DispatchQueue.global(qos: .utility))
        timer.schedule(deadline: .now(), repeating: .milliseconds(400))
        timer.setEventHandler { onProgress(min(Int(export.progress * 100), 99)) }
        timer.resume()

        export.exportAsynchronously {
            timer.cancel()
            defer { onProgress(100) }

            guard export.status == .completed else {
                try? FileManager.default.removeItem(at: outURL)
                completion(nil); return   // 실패 → 원본 업로드
            }

            // 오디오 보존 검증 + 크기 검증
            let outAsset = AVURLAsset(url: outURL)
            let outHasAudio = !outAsset.tracks(withMediaType: .audio).isEmpty
            let outSize = ((try? FileManager.default.attributesOfItem(atPath: outURL.path)[.size] as? Int) ?? 0) ?? 0

            let audioLost = srcHasAudio && !outHasAudio
            if audioLost || outSize == 0 || outSize >= srcSizeVal {
                try? FileManager.default.removeItem(at: outURL)
                completion(nil); return   // 오디오 소실/무의미 → 원본 업로드
            }
            completion(outURL.path)
        }
    }
}
