import Foundation
import AVFoundation

class VideoCompressor {

    /// Compress video to 720p H.264, ~2Mbps.
    /// Returns compressed file URL, or nil if compression fails/not needed.
    static func compress(
        inputURL: URL,
        onProgress: @escaping (Int) -> Void,
        completion: @escaping (URL?) -> Void
    ) {
        let asset = AVURLAsset(url: inputURL)

        // Check if compression is needed
        guard let videoTrack = asset.tracks(withMediaType: .video).first else {
            onProgress(100)
            completion(nil) // no video track, skip
            return
        }

        let naturalSize = videoTrack.naturalSize
        let maxDim = max(naturalSize.width, naturalSize.height)

        // Skip if already 720p or smaller and file is small
        let fileSize = (try? FileManager.default.attributesOfItem(atPath: inputURL.path)[.size] as? Int64) ?? 0
        if maxDim <= 1280 && fileSize < 50 * 1024 * 1024 {
            onProgress(100)
            completion(nil) // already optimized
            return
        }

        // Output file
        let outputURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("compressed_\(Int(Date().timeIntervalSince1970)).mp4")

        // Remove if exists
        try? FileManager.default.removeItem(at: outputURL)

        // Use AVAssetExportSession for hardware-accelerated compression
        guard let exportSession = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetMediumQuality) else {
            onProgress(100)
            completion(nil)
            return
        }

        exportSession.outputURL = outputURL
        exportSession.outputFileType = .mp4
        exportSession.shouldOptimizeForNetworkUse = true // faststart equivalent

        // Progress timer
        let duration = CMTimeGetSeconds(asset.duration)
        let timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
            let progress = Int(exportSession.progress * 100)
            onProgress(min(progress, 99))
        }
        RunLoop.current.add(timer, forMode: .common)

        exportSession.exportAsynchronously {
            timer.invalidate()

            switch exportSession.status {
            case .completed:
                // Check if compression actually helped
                let compressedSize = (try? FileManager.default.attributesOfItem(atPath: outputURL.path)[.size] as? Int64) ?? 0
                if compressedSize > 0 && compressedSize < Int64(Double(fileSize) * 0.9) {
                    let saved = 100 - Int(compressedSize * 100 / max(fileSize, 1))
                    print("[VideoCompressor] \(fileSize/1024)KB -> \(compressedSize/1024)KB (\(saved)% reduction)")
                    onProgress(100)
                    completion(outputURL)
                } else {
                    // Compression didn't help, use original
                    try? FileManager.default.removeItem(at: outputURL)
                    onProgress(100)
                    completion(nil)
                }

            case .failed, .cancelled:
                print("[VideoCompressor] Failed: \(exportSession.error?.localizedDescription ?? "unknown")")
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
