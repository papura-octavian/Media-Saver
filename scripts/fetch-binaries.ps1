param(
  [switch]$Force,
  [string]$YtDlpUrl = $env:YTDLP_URL,
  [string]$FfmpegUrl = $env:FFMPEG_URL,
  [string]$FfprobeUrl = $env:FFPROBE_URL,
  [string]$FfmpegZipUrl = $env:FFMPEG_ZIP_URL
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue" # Invoke-WebRequest is many times slower with the progress bar on

# Defaults: official yt-dlp release and the BtbN LGPL FFmpeg build. The "shared" variant keeps the codecs in DLLs
# used by both ffmpeg.exe and ffprobe.exe, about 115 MB smaller than two static executables. Override with the env vars above.
if (-not $YtDlpUrl) { $YtDlpUrl = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe" }
if (-not $FfmpegZipUrl -and -not $FfmpegUrl) {
  $FfmpegZipUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/latest/download/ffmpeg-master-latest-win64-lgpl-shared.zip"
}

function Write-Step($msg) {
  Write-Host "[media-saver] $msg"
}

function Download-File($url, $dest) {
  Write-Step "Downloading $url"
  Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$resourcesDir = Join-Path $repoRoot "resources"
$binDir = Join-Path $resourcesDir "bin"
New-Item -ItemType Directory -Force -Path $binDir | Out-Null

$ytDlpPath = Join-Path $binDir "yt-dlp.exe"
$ffmpegPath = Join-Path $binDir "ffmpeg.exe"
$ffprobePath = Join-Path $binDir "ffprobe.exe"

if (-not (Test-Path $ytDlpPath) -or $Force) {
  Download-File $YtDlpUrl $ytDlpPath
} else {
  Write-Step "yt-dlp.exe already exists, skipping."
}

if ((Test-Path $ffmpegPath) -and -not $Force) {
  Write-Step "ffmpeg.exe already exists, skipping."
} elseif ($FfmpegZipUrl) {
  $tmpDir = Join-Path $env:TEMP ("media-saver-ffmpeg-" + [Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null
  try {
    $zipPath = Join-Path $tmpDir "ffmpeg.zip"
    Download-File $FfmpegZipUrl $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $tmpDir -Force

    $ffmpegFound = Get-ChildItem -Path $tmpDir -Recurse -Filter "ffmpeg.exe" | Select-Object -First 1
    $ffprobeFound = Get-ChildItem -Path $tmpDir -Recurse -Filter "ffprobe.exe" | Select-Object -First 1

    if (-not $ffmpegFound) { throw "ffmpeg.exe not found inside zip." }
    Copy-Item -Force -Path $ffmpegFound.FullName -Destination $ffmpegPath

    if ($ffprobeFound) {
      Copy-Item -Force -Path $ffprobeFound.FullName -Destination $ffprobePath
    } else {
      Write-Step "ffprobe.exe not found inside zip; continuing."
    }

    # Shared builds: the executables need the DLLs next to them.
    Get-ChildItem -Path $ffmpegFound.DirectoryName -Filter "*.dll" | ForEach-Object {
      Copy-Item -Force -Path $_.FullName -Destination $binDir
    }
  } finally {
    Remove-Item -Recurse -Force $tmpDir
  }
} else {
  Download-File $FfmpegUrl $ffmpegPath
  if ($FfprobeUrl) {
    Download-File $FfprobeUrl $ffprobePath
  }
}

Write-Step "Done. Binaries are in resources/bin."
