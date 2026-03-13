#!/usr/bin/python3
# -*- coding: utf-8 -*-

"""
Helper script for downloading videos using yt-dlp.

Usage:
    python download_video.py <URL> [options]

Options:
    --output-dir <path>     Directory to save the video (default: current directory)
    --quality <quality>     Video quality - "best", "worst", or resolution (default: "best")
    --format <format>       Output format - "mp4", "webm", "mkv", "audio" (default: mp4)
    --list-formats          List available formats without downloading
    --cookies <browser>     Use cookies from browser (chrome, firefox, safari, edge, etc.)
    --cookies-file <path>   Path to cookies file
    --subtitles <langs>     Download subtitles (e.g., "en,zh")
    --continue              Resume partially downloaded files
    --progress <level>      Progress display level: "detailed", "simple", "minimal" (default: simple)
"

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional


def check_yt_dlp() -> bool:
    """Check if yt-dlp is installed and available."""
    try:
        result = subprocess.run(
            ["yt-dlp", "--version"],
            capture_output=True,
            text=True,
            check=True
        )
        print(f"yt-dlp version: {result.stdout.strip()}")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def install_instructions() -> str:
    """Return installation instructions for yt-dlp."""
    return """
yt-dlp is not installed. Please install it using one of the following methods:

macOS (with Homebrew):
    brew install yt-dlp

Linux:
    sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
    sudo chmod a+rx /usr/local/bin/yt-dlp

Windows (with winget):
    winget install yt-dlp.yt-dlp

Or visit https://github.com/yt-dlp/yt-dlp#installation for more options.
"""


def build_format_string(quality: str, output_format: str) -> str:
    """
    Build the format string for yt-dlp based on quality and format preferences.

    Args:
        quality: "best", "worst", or a resolution like "720"
        output_format: "mp4", "webm", "mkv", "audio", or "best"

    Returns:
        The format string for yt-dlp -f option
    """
    if output_format == "audio":
        return "bestaudio/best"

    # Build quality filter
    if quality == "best":
        quality_filter = "bestvideo*+bestaudio/best"
    elif quality == "worst":
        quality_filter = "worstvideo*+worstaudio/worst"
    else:
        # Specific resolution like "720"
        try:
            height = int(quality)
            quality_filter = f"bestvideo[height<={height}]+bestaudio/best[height<={height}]"
        except ValueError:
            quality_filter = "bestvideo*+bestaudio/best"

    return quality_filter


def download_video(
    url: str,
    output_dir: str = ".",
    quality: str = "best",
    output_format: str = "mp4",
    list_formats: bool = False,
    cookies_browser: Optional[str] = None,
    cookies_file: Optional[str] = None,
    subtitles: Optional[str] = None,
    continue_download: bool = False,
    progress_level: str = "simple"
) -> tuple[bool, Optional[str]]:
    """
    Download a video using yt-dlp.

    Args:
        url: The video URL
        output_dir: Directory to save the video
        quality: Video quality preference
        output_format: Output format preference
        list_formats: If True, only list available formats

    Returns:
        Tuple of (success: bool, file_path: Optional[str])
    """
    # Ensure output directory exists
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    # Build the command
    cmd = ["yt-dlp"]

    # Configure progress display based on level
    if progress_level == "minimal":
        cmd.extend(["--quiet", "--progress"])
    elif progress_level == "simple":
        cmd.extend(["--progress", "--newline"])
    # For "detailed", use default yt-dlp output

    # Add cookie options
    if cookies_browser:
        cmd.extend(["--cookies-from-browser", cookies_browser])
    elif cookies_file:
        cmd.extend(["--cookies", cookies_file])

    # Add subtitle options
    if subtitles:
        cmd.extend(["--write-subs", "--sub-langs", subtitles])

    # Add continue option for resuming downloads
    if continue_download:
        cmd.append("--continue")

    if list_formats:
        cmd.extend(["--list-formats", url])
    else:
        # Set output template
        cmd.extend(["-o", str(output_path / "%(title)s.%(ext)s")])

        # Set format
        format_string = build_format_string(quality, output_format)
        cmd.extend(["-f", format_string])

        # Set merge output format if specified and not audio-only
        if output_format != "audio" and output_format != "best":
            cmd.extend(["--merge-output-format", output_format])

        # Add audio extraction options if audio format requested
        if output_format == "audio":
            cmd.extend(["-x", "--audio-format", "mp3", "--audio-quality", "0"])

        # Add URL
        cmd.append(url)

    print(f"Running: {' '.join(cmd)}")
    print("-" * 60)

    try:
        result = subprocess.run(cmd, capture_output=False, text=True)
        success = result.returncode == 0

        if success and not list_formats:
            # Try to find the downloaded file
            # yt-dlp output is complex, so we scan the output directory for recent files
            video_extensions = {".mp4", ".webm", ".mkv", ".mov", ".avi", ".flv", ".mp3", ".m4a", ".ogg"}
            downloaded_files = [
                f for f in output_path.iterdir()
                if f.is_file() and f.suffix.lower() in video_extensions
            ]

            # Sort by modification time (newest first)
            downloaded_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)

            if downloaded_files:
                return True, str(downloaded_files[0])
            return True, None

        return success, None

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return False, None


def main():
    parser = argparse.ArgumentParser(
        description="Download videos using yt-dlp",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python download_video.py "https://youtube.com/watch?v=xxxxx"
  python download_video.py "https://bilibili.com/video/BVxxxxx" --quality 720
  python download_video.py "https://youtube.com/watch?v=xxxxx" --format audio
  python download_video.py "https://youtube.com/watch?v=xxxxx" --list-formats
  python download_video.py "https://youtube.com/watch?v=xxxxx" --cookies chrome
  python download_video.py "https://youtube.com/watch?v=xxxxx" --subtitles en,zh
  python download_video.py "https://youtube.com/watch?v=xxxxx" --continue
  python download_video.py "https://youtube.com/watch?v=xxxxx" --progress minimal
        """
    )

    parser.add_argument("url", help="Video URL to download")
    parser.add_argument(
        "--output-dir", "-o",
        default=".",
        help="Directory to save the video (default: current directory)"
    )
    parser.add_argument(
        "--quality", "-q",
        default="best",
        help='Video quality: "best", "worst", or resolution like "720" (default: best)'
    )
    parser.add_argument(
        "--format", "-f",
        default="mp4",
        choices=["mp4", "webm", "mkv", "audio", "best"],
        help='Output format: mp4, webm, mkv, audio (audio-only), or best (default: mp4)'
    )
    parser.add_argument(
        "--list-formats", "-l",
        action="store_true",
        help="List available formats without downloading"
    )
    parser.add_argument(
        "--cookies", "-c",
        metavar="BROWSER",
        help="Use cookies from browser (chrome, firefox, safari, edge, etc.)"
    )
    parser.add_argument(
        "--cookies-file",
        metavar="PATH",
        help="Path to cookies file"
    )
    parser.add_argument(
        "--subtitles", "-s",
        metavar="LANGS",
        help='Download subtitles (e.g., "en,zh")'
    )
    parser.add_argument(
        "--continue", "-C",
        dest="continue_download",
        action="store_true",
        help="Resume partially downloaded files"
    )
    parser.add_argument(
        "--progress", "-p",
        default="simple",
        choices=["detailed", "simple", "minimal"],
        help='Progress display level: detailed (full output), simple (progress bar), minimal (quiet)'
    )

    args = parser.parse_args()

    # Check if yt-dlp is installed
    if not check_yt_dlp():
        print(install_instructions(), file=sys.stderr)
        sys.exit(1)

    # Download the video
    success, file_path = download_video(
        url=args.url,
        output_dir=args.output_dir,
        quality=args.quality,
        output_format=args.format,
        list_formats=args.list_formats,
        cookies_browser=args.cookies,
        cookies_file=args.cookies_file,
        subtitles=args.subtitles,
        continue_download=args.continue_download,
        progress_level=args.progress
    )

    if success:
        if args.list_formats:
            print("\nUse -f option with a format code to download a specific format.")
        elif file_path:
            print(f"\n✓ Download completed successfully!")
            print(f"  Saved to: {file_path}")
        else:
            print("\n✓ Download completed!")
        sys.exit(0)
    else:
        print("\n✗ Download failed.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
