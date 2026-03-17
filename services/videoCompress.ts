/**
 * Client-side video compression using FFmpeg.wasm (single-threaded).
 *
 * Lazy-loads FFmpeg only when compression is requested (~3MB core + ~25MB wasm).
 * Compresses to 720p H.264 with reasonable quality for upload.
 * Falls back gracefully: if compression fails, returns the original file.
 */

type ProgressCallback = (phase: 'loading' | 'compressing', pct: number) => void;

let _ffmpegInstance: any = null;
let _loadingPromise: Promise<any> | null = null;

async function getFFmpeg(onProgress?: ProgressCallback): Promise<any> {
  if (_ffmpegInstance) return _ffmpegInstance;
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = (async () => {
    onProgress?.('loading', 0);
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const ffmpeg = new FFmpeg();

    ffmpeg.on('progress', ({ progress }: { progress: number }) => {
      onProgress?.('compressing', Math.round(progress * 100));
    });

    onProgress?.('loading', 50);
    await ffmpeg.load();
    onProgress?.('loading', 100);

    _ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await _loadingPromise;
  } catch (e) {
    _loadingPromise = null;
    throw e;
  }
}

/**
 * Compress a video file in the browser.
 *
 * @returns Compressed File, or the original file if compression fails/isn't worth it.
 */
export async function compressVideo(
  file: File,
  onProgress?: ProgressCallback,
): Promise<File> {
  // Skip if not a video
  const ext = file.name.toLowerCase().split('.').pop();
  if (!ext || !['mp4', 'mov', 'webm'].includes(ext)) return file;

  // Skip small videos (< 30MB) — not worth compressing
  if (file.size < 30 * 1024 * 1024) return file;

  try {
    const ffmpeg = await getFFmpeg(onProgress);
    const { fetchFile } = await import('@ffmpeg/util');

    const inputName = `input.${ext}`;
    const outputName = 'output.mp4';

    onProgress?.('compressing', 0);
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Compress: 720p, CRF 28, fast preset, AAC audio
    // -map 0:v:0 -map 0:a:0? handles iPhone videos with multiple streams
    await ffmpeg.exec([
      '-i', inputName,
      '-map', '0:v:0', '-map', '0:a:0?',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '28',
      '-vf', "scale='if(gte(iw,ih),min(720,iw),-2)':'if(gte(iw,ih),-2,min(720,ih))'",
      '-c:a', 'aac', '-b:a', '96k',
      '-movflags', '+faststart',
      '-y', outputName,
    ]);

    const data = await ffmpeg.readFile(outputName);

    // Clean up memory
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});

    const compressed = new File(
      [data],
      file.name.replace(/\.[^.]+$/, '.mp4'),
      { type: 'video/mp4' },
    );

    // Only use compressed if it's actually smaller
    if (compressed.size >= file.size * 0.9) {
      console.log('Compression did not reduce size significantly, using original');
      return file;
    }

    const pctSaved = Math.round((1 - compressed.size / file.size) * 100);
    console.log(
      `Video compressed: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressed.size / 1024 / 1024).toFixed(1)}MB (${pctSaved}% smaller)`,
    );

    onProgress?.('compressing', 100);
    return compressed;
  } catch (e) {
    console.warn('Client-side video compression failed, using original file:', e);
    return file;
  }
}

/**
 * Check if FFmpeg.wasm is likely supported in this browser.
 * Returns false for environments where it will definitely fail.
 */
export function isCompressionSupported(): boolean {
  // FFmpeg.wasm requires WebAssembly
  if (typeof WebAssembly === 'undefined') return false;
  // Needs SharedArrayBuffer for multi-threaded; single-threaded works without it
  // Check basic requirements
  if (typeof File === 'undefined' || typeof Blob === 'undefined') return false;
  return true;
}

/**
 * Format file size for display.
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
