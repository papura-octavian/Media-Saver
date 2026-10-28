## Binaries (not committed)

This folder is intentionally kept out of git for license and repository hygiene reasons.

### For local development (Windows)
Place these files here:
- `yt-dlp.exe`
- `ffmpeg.exe`
- `ffprobe.exe` (recommended)

You can also download them with:
- `npm run prepare:bin` (latest yt-dlp + BtbN LGPL FFmpeg by default)
  - Override with `YTDLP_URL` and either `FFMPEG_ZIP_URL` or `FFMPEG_URL` (+ optional `FFPROBE_URL`).

### For releases
Packaged builds copy `resources/bin/*` into `${process.resourcesPath}/bin/*` via `electron-builder` `extraResources`.

Do not commit binaries into this repository. Instead:
- download them during your release build process, or
- attach them as part of GitHub Release artifacts, or
- bundle them into the installer at build time.


