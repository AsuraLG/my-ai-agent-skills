---
name: yt-dlp-video-downloader
description: |
  Download videos and extract audio from YouTube, Bilibili, and 1000+ other video platforms using yt-dlp.
  TRIGGER this skill when the user says ANY of the following (in ANY language):
  - "download this video" or "save this video" or "get this video"
  - "download from YouTube/Bilibili/TikTok/Instagram/Twitter/Vimeo/etc"
  - "extract audio" or "download as MP3" or "get the audio"
  - mentions a video URL and wants to keep/save it
  - mentions downloading playlists, channels, or multiple videos
  - mentions download quality (4K, 720p, best quality, etc)
  - mentions cookies, login, or authenticated downloads
  - mentions subtitles or closed captions
  Examples that SHOULD trigger: "帮我下载这个 YouTube 视频", "把这个视频保存到本地", "下载B站视频", "extract audio from this", "download Instagram reel".
  Examples that should NOT trigger: "upload video", "edit video", "compress video", "convert video format", "analyze video content".
---

# yt-dlp Video Downloader

This skill helps download videos from various streaming platforms using yt-dlp.

## Supported Platforms

- YouTube
- Bilibili
- Vimeo
- Dailymotion
- And many other platforms supported by yt-dlp

## Workflow

### Step 1: Check yt-dlp Installation

Before downloading, verify that yt-dlp is installed:

```bash
yt-dlp --version
```

If yt-dlp is not installed, guide the user through installation:

**macOS (with Homebrew):**
```bash
brew install yt-dlp
```

**Linux:**
```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

**Windows (with winget):**
```bash
winget install yt-dlp.yt-dlp
```

Or refer to https://github.com/yt-dlp/yt-dlp#installation for more options.

### Step 2: Parse User Request

Extract from the user's request:
- Video URL (required)
- Output directory (optional, default: current directory)
- Quality preference (optional: best, worst, or specific resolution like 720p)
- Format preference (optional: mp4, webm, mkv, or audio-only like mp3)

### Step 3: Download the Video

Use the helper script to download the video:

```bash
python scripts/download_video.py <URL> [options]
```

Options:
- `--output-dir <path>`: Directory to save the video (default: current directory)
- `--quality <quality>`: Video quality - "best", "worst", or resolution like "720" (default: "best")
- `--format <format>`: Output format - "mp4", "webm", "mkv", or "audio" for audio-only (default: mp4)
- `--cookies <browser>`: Use cookies from browser (chrome, firefox, safari, edge, etc.) for authenticated downloads
- `--cookies-file <path>`: Path to a cookies file (Netscape format)
- `--subtitles <langs>`: Download subtitles, e.g., "en,zh" for English and Chinese
- `--continue`: Resume partially downloaded files (useful for large files or unstable connections)
- `--progress <level>`: Progress display level - "detailed" (full output), "simple" (progress bar), "minimal" (quiet)

Or use yt-dlp directly for simple downloads:

```bash
yt-dlp "<URL>"
```

### Step 4: Provide Feedback

After download completes:
1. Confirm the video was downloaded successfully
2. Report the file path where it was saved
3. Mention the video title if available
4. If there were any issues, explain what happened and suggest solutions

## Common yt-dlp Options

- `-o <template>`: Output filename template (e.g., `%(title)s.%(ext)s`)
- `-f <format>`: Select video format (e.g., `best`, `worst`, `best[height<=720]`)
- `--merge-output-format <format>`: Merge to specific format (mp4, mkv, etc.)
- `-x`: Extract audio only
- `--audio-format <format>`: Convert audio to specific format (mp3, m4a, etc.)
- `--audio-quality <quality>`: Audio quality (0-10, lower is better)
- `--list-formats`: List available formats without downloading
- `--write-subtitles`: Download subtitles
- `--sub-langs <langs>`: Subtitle languages (e.g., `en,zh`)

## Examples

**Download a YouTube video:**
```bash
yt-dlp "https://www.youtube.com/watch?v=xxxxx"
```

**Download with specific quality:**
```bash
yt-dlp -f "best[height<=720]" "https://www.youtube.com/watch?v=xxxxx"
```

**Download audio only:**
```bash
yt-dlp -x --audio-format mp3 "https://www.youtube.com/watch?v=xxxxx"
```

**Download from Bilibili:**
```bash
yt-dlp "https://www.bilibili.com/video/BVxxxxx"
```

**Download with cookies (for authenticated/premium content):**
```bash
python scripts/download_video.py "https://www.youtube.com/watch?v=xxxxx" --cookies chrome
# or with a cookies file:
python scripts/download_video.py "https://www.youtube.com/watch?v=xxxxx" --cookies-file ~/cookies.txt
```

**Download with subtitles:**
```bash
python scripts/download_video.py "https://www.youtube.com/watch?v=xxxxx" --subtitles en,zh
```

**Resume interrupted download:**
```bash
python scripts/download_video.py "https://www.youtube.com/watch?v=xxxxx" --continue
```

**Minimal progress display (quiet mode):**
```bash
python scripts/download_video.py "https://www.youtube.com/watch?v=xxxxx" --progress minimal
```

## Error Handling

Common issues and solutions:

1. **"yt-dlp: command not found"** - yt-dlp is not installed; provide installation instructions
2. **"Video unavailable"** - The video might be region-restricted, private, or removed
3. **"Sign in to confirm you're not a bot"** - YouTube is rate-limiting; try using cookies or wait
4. **HTTP 403 errors** - May need to update yt-dlp: `yt-dlp -U`
5. **"FFmpeg not found"** - Some features require FFmpeg; suggest installing it
6. **"This video requires login"** - Use `--cookies` with your browser or `--cookies-file` with exported cookies
7. **"Incomplete download"** - Use `--continue` flag to resume interrupted downloads
8. **"No subtitles available"** - The requested subtitle languages may not be available for this video

## Dependencies

- yt-dlp (required)
- FFmpeg (optional, for format conversion and merging)
- Python 3 (for the helper script)
