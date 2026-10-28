## Media Saver (SkipIt)

Media Saver is a Windows-first desktop app (Electron + React) that downloads YouTube content using **yt-dlp** and **FFmpeg**.

- No Python. Click-and-go.
- Modern dark UI with progress, logs, and cancel.
- Supports single URLs, batch TXT, and playlists.

> Disclaimer: You are responsible for complying with YouTube Terms of Service and all applicable copyright laws. Use this tool only for content you are allowed to download.

### Key features
- **Download modes**
  - Single URL (video or playlist)
  - Batch from TXT (one URL per line; ignores empty lines and lines starting with `#`)
  - Playlist support: creates `destination/<playlist title>/` automatically; unavailable entries are skipped
  - Batch keeps going when one link fails and reports which ones did
- **Formats**
  - MP3 (128 / 192 / 256 / 320 kbps)
  - MP4 (prefers best quality and 1080p when available)
- **Advanced**
  - YouTube client selection: automatic (recommended) / web / tv / ios / android
  - Optional cookies from browser: chrome / edge / firefox / brave
  - Optional User-Agent override
  - Verbose logs toggle
- **UX**
  - Progress: percent, title, speed, ETA, batch indicator
  - Console logs with copy/clear
  - Cancel current job (removes the half-downloaded files); closing the app also stops yt-dlp
- **Stays working**
  - yt-dlp updates itself in the background (at most once a day), since YouTube changes often
  - Uses the bundled Electron runtime as the JavaScript runtime yt-dlp now needs for YouTube
- **Local-only settings**
  - Remembers destination and options (format, bitrate, client, cookies, UA, verbose)

### Screenshots
Add screenshots here:
- `docs/screenshots/main.png`
- `docs/screenshots/progress.png`
- `docs/screenshots/logs.png`

### Requirements
- Node.js 20+ for development
- Windows 11 recommended (Windows-first)
- Binaries for local dev:
  - `resources/bin/yt-dlp.exe`
  - `resources/bin/ffmpeg.exe`
  - `resources/bin/ffprobe.exe` (recommended)
  - Helper: `npm run prepare:bin` downloads the latest yt-dlp and the BtbN LGPL FFmpeg build (override with `YTDLP_URL`, `FFMPEG_ZIP_URL` or `FFMPEG_URL`).

Note: binaries are **not committed** to this repo. See `resources/bin/README.md`.

Cross-platform note: the UI is cross-platform, but this repo is primarily tested on Windows. macOS/Linux may work with the correct `yt-dlp`/`ffmpeg` binaries available on PATH or in the expected locations.

### Install / Run (dev)
```bash
npm install
npm run prepare:bin
npm run dev
```

### Build / Release (Windows installer)
This repo uses `electron-builder` (see `electron-builder.yml`).

```bash
npm install
npm run dist
```

Artifacts are created in `dist/` (NSIS installer by default).

### Settings persistence
Settings are stored locally in your OS user data folder as `settings.json`:
- Destination folder
- Last selected format/bitrate/client/cookies/browser/verbose/user-agent

The app does not upload or sync settings anywhere.
Typical locations:
- Windows: `%APPDATA%/Media Saver/settings.json` (exact path depends on Electron userData)

### Packaging policy (binaries)
This project is designed for **Option 1: bundle binaries in releases** (recommended for click-and-go):
- Repo: do not commit binaries.
- Releases: bundle `yt-dlp` and an **LGPL-compatible** `ffmpeg` build inside the installer via `electron-builder` `extraResources`.
- Version pinning: maintainers should pin versions and publish checksums in release notes.
- Integrity verification (recommended): publish SHA256 checksums and verify them during the release build.

### Known limitations
- Some videos may fail due to:
  - age restrictions, geo-blocking, login requirements
  - throttling or network issues
  - upstream changes in YouTube
- MP4 quality depends on what YouTube provides for that video.
- Cookies-from-browser depends on your browser profile and local permissions.

### Troubleshooting
**FFmpeg not found**
- Ensure `resources/bin/ffmpeg.exe` exists for dev, or the packaged build includes it under `${process.resourcesPath}/bin/ffmpeg.exe`.

**yt-dlp not found**
- Ensure `resources/bin/yt-dlp.exe` exists for dev, or the packaged build includes it under `${process.resourcesPath}/bin/yt-dlp.exe`.

**Cookies issues**
- Try a different browser selection.
- Make sure the browser is installed and you are signed in (when appropriate/allowed).
- Disable cookies if not needed.

**Extraction/client issues**
- Try switching the YouTube client (android/web/ios/tv).

### Legal / Notices
See:
- `THIRD-PARTY-NOTICES.md`
- `LICENSE`

