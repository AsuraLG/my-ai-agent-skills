#!/usr/bin/python3
# -*- coding: utf-8 -*-

import argparse
import json
import os
import re
from datetime import datetime, timezone, timedelta
from html import unescape
from typing import Dict, List

import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9",
}
SEARCH_URL = "https://weixin.sogou.com/weixin"
SOGOU_HOST = "https://weixin.sogou.com"
DEFAULT_LIMIT = 10
MAX_LIMIT = 10
BEIJING_TIMEZONE = timezone(timedelta(hours=8))
NOISE_PATTERNS = [
    re.compile(r"^阅读原文$"),
    re.compile(r"^微信扫一扫关注.*"),
    re.compile(r"^长按(?:二维码)?关注.*"),
    re.compile(r"^本内容为作者独立观点.*"),
    re.compile(r"^如对本稿件有异议或投诉.*"),
    re.compile(r"^想涨知识\s*关注.*"),
    re.compile(r"^21君荐读$"),
    re.compile(r"^往期推荐$"),
    re.compile(r"^期待关注$"),
    re.compile(r"^相关阅读$"),
    re.compile(r"^延伸阅读$"),
    re.compile(r"^推荐阅读$"),
    re.compile(r"^扫码关注$"),
    re.compile(r"^关注我们$"),
    re.compile(r"^(?:出品|作者|编辑|微信统筹)丨.*"),
    re.compile(r"^End$", re.I),
]


def build_session() -> requests.Session:
    session = requests.Session()
    proxy = os.environ.get("WECHAT_ARTICLE_FETCH_PROXY", "").strip()
    if proxy:
        session.proxies = {"http": proxy, "https": proxy}
    session.headers.update(HEADERS)
    return session


def normalize_limit(limit: int) -> int:
    if limit <= 0:
        raise ValueError("limit must be greater than 0")
    return min(limit, MAX_LIMIT)


def extract_link_paths(search_html: str) -> List[str]:
    return re.findall(r'href="(/link\?[^\"]+)"', search_html)


def resolve_article_url(session: requests.Session, link_path: str, referer: str) -> str:
    response = session.get(
        SOGOU_HOST + link_path,
        headers={"Referer": referer},
        timeout=15,
    )
    response.raise_for_status()
    url_parts = re.findall(r"url \+= '([^']+)'", response.text)
    if not url_parts:
        return ""
    return "".join(url_parts).replace("@", "")


def extract_title(article_html: str) -> str:
    meta_match = re.search(r'"og:title"[^>]+content="([^"]+)"', article_html)
    if meta_match:
        return unescape(meta_match.group(1)).strip()

    title_match = re.search(r"<title>(.*?)</title>", article_html, re.S)
    if title_match:
        return unescape(title_match.group(1)).strip()

    return "Unknown"


def extract_first_match(patterns: List[str], article_html: str) -> str:
    for pattern in patterns:
        match = re.search(pattern, article_html, re.S)
        if match:
            return unescape(match.group(1)).strip()
    return ""


def format_publish_time(raw_value: str) -> str:
    if not raw_value:
        return ""
    if not raw_value.isdigit():
        return raw_value
    return datetime.fromtimestamp(int(raw_value), tz=BEIJING_TIMEZONE).strftime("%Y-%m-%d %H:%M:%S")


def extract_metadata(article_html: str) -> Dict[str, str]:
    account_name = extract_first_match(
        [
            r'var\s+nickname\s*=\s*htmlDecode\("([^"]*)"\)',
            r'property="og:article:author"\s+content="([^"]*)"',
            r'id="js_name"[^>]*>(.*?)<',
        ],
        article_html,
    )
    publish_time = extract_first_match(
        [
            r'var\s+ct\s*=\s*"?(\d+)"?\s*;',
            r'id="publish_time"[^>]*>(.*?)<',
        ],
        article_html,
    )
    author = extract_first_match(
        [
            r'var\s+user_name\s*=\s*"([^"]*)"',
            r'id="js_author_name"[^>]*>(.*?)<',
        ],
        article_html,
    )
    return {
        "account_name": account_name,
        "publish_time": format_publish_time(publish_time),
        "author": author,
    }


def is_noise_line(line: str) -> bool:
    return any(pattern.match(line) for pattern in NOISE_PATTERNS)


def clean_text_lines(text: str) -> str:
    normalized = unescape(text)
    normalized = re.sub(r"\r\n?", "\n", normalized)
    normalized = re.sub(r"[ \t\f\v]+", " ", normalized)

    cleaned_lines: List[str] = []
    for raw_line in normalized.split("\n"):
        line = raw_line.strip()
        if not line or is_noise_line(line):
            continue
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines)


def extract_content(article_html: str) -> str:
    body_match = re.search(
        r'<div[^>]+id="js_content"[^>]*>([\s\S]*?)</div>',
        article_html,
        re.S,
    )
    if not body_match:
        return ""

    text = body_match.group(1)
    text = re.sub(r"<script[\s\S]*?</script>", " ", text)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.I)
    text = re.sub(r"</(p|div|li|h[1-6])>", "\n", text, flags=re.I)
    text = re.sub(r"<(p|div|li|h[1-6])[^>]*>", "", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return clean_text_lines(text)


def fetch_article(session: requests.Session, article_url: str) -> Dict[str, str]:
    response = session.get(article_url, timeout=20)
    response.raise_for_status()
    html = response.text
    article = {
        "title": extract_title(html),
        "url": article_url,
        "content": extract_content(html),
    }
    article.update(extract_metadata(html))
    return article


def search_weixin(keyword: str, limit: int = DEFAULT_LIMIT) -> List[Dict[str, str]]:
    normalized_limit = normalize_limit(limit)
    session = build_session()
    response = session.get(
        SEARCH_URL,
        params={"query": keyword, "type": "2", "ie": "utf8"},
        timeout=15,
    )
    response.raise_for_status()

    articles: List[Dict[str, str]] = []
    seen_urls = set()

    for link_path in extract_link_paths(response.text):
        article_url = resolve_article_url(session, link_path, response.url)
        if not article_url or article_url in seen_urls:
            continue

        seen_urls.add(article_url)
        try:
            article = fetch_article(session, article_url)
        except requests.RequestException:
            articles.append(
                {
                    "title": "Unknown",
                    "url": article_url,
                    "account_name": "",
                    "publish_time": "",
                    "author": "",
                    "content": "",
                }
            )
            if len(articles) >= normalized_limit:
                break
            continue

        articles.append(article)
        if len(articles) >= normalized_limit:
            break

    return articles


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Search and fetch WeChat public account articles")
    parser.add_argument("--keyword", required=True, help="Search keyword")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="Max number of articles to return")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    payload = {
        "keyword": args.keyword,
        "count": 0,
        "articles": [],
    }
    results = search_weixin(keyword=args.keyword, limit=args.limit)
    payload["articles"] = results
    payload["count"] = len(results)

    if args.pretty:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return
    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
