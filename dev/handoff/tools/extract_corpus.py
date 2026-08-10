#!/usr/bin/env python3
"""从本地 Claude Code 会话转录中提取「交接 prompt」语料。

用途：重建 spec §10.1 回归验证所需的黄金基准——**判据是使用者自己写的 prompt，
不是「我对好 prompt 的想象」**，这是该验证唯一具备判别力的原因。

用法：
    python3 tools/extract_corpus.py <项目 slug 片段> > corpus.md

<项目 slug 片段> 用于筛选 ~/.claude/projects/ 下的会话目录（目录名是项目路径的转写形式），
传入能唯一标识目标项目的一段即可，例如仓库名。

只用标准库，不截断正文，排除 skill 加载文本 / 任务通知 / agent 间消息等注入内容。
"""

import json
import re
import sys
from pathlib import Path

PROJECTS = Path.home() / ".claude" / "projects"

# 交接 prompt 的正向特征：开头是接手/继续/推进类动词，或含显式接力声明
OPENING_RE = re.compile(r"^\s*(接手|继续推进|继续|推进|我们在推进|下面是给新会话|给新会话的|主工作区已经)")
RELAY_MARK = ("这是接力", "新会话", "接手", "从这里接手")

# 噪音特征：命中任一即丢弃
NOISE_PREFIX = (
    "Base directory for this skill:",
    "<task-notification>",
    "Another Claude session sent a message",
    "Review this change for",
    "<command-name>",
    "Caveat:",
    "<local-command",
)

MIN_LENGTH = 400  # 交接 prompt 都很长，短的是普通指令


def extract_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "\n".join(
            b.get("text", "") for b in content
            if isinstance(b, dict) and b.get("type") == "text"
        )
    return ""


def is_handoff_prompt(text: str) -> bool:
    """判定一条用户消息是否为交接 prompt。

    ⚠️ 规则第 3 条（RELAY_MARK）会漏掉不含「接力/新会话/接手」字样的早期形态
    （例如纯粹的【先读事实源】【当前状态】【硬约束】三段式）。
    考察骨架演进时放宽该条重跑即可——此处保持规则单一可解释，不自动补全。
    """
    if len(text) < MIN_LENGTH:
        return False
    if not OPENING_RE.search(text):
        return False
    return any(mark in text for mark in RELAY_MARK)


def short_location(dir_name: str) -> str:
    """把会话目录名压成可读的位置标识。"""
    trimmed = dir_name.lstrip("-")
    segments = [s for s in trimmed.split("-") if s]
    return "-".join(segments[-3:]) if segments else dir_name


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    slug_mark = sys.argv[1]

    if not PROJECTS.is_dir():
        print("未找到会话转录目录: %s" % PROJECTS, file=sys.stderr)
        return 1

    hits = []
    seen_bodies = set()
    for jsonl in PROJECTS.glob("*/*.jsonl"):
        if slug_mark not in jsonl.parent.name:
            continue
        try:
            with jsonl.open(encoding="utf-8") as fh:
                for line in fh:
                    # 先做廉价的字符串预筛，避免对每行都 json.loads
                    if "接手" not in line and "新会话" not in line and "推进" not in line:
                        continue
                    try:
                        rec = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if rec.get("type") != "user":
                        continue
                    text = extract_text((rec.get("message") or {}).get("content")).strip()
                    if not text or text.startswith(NOISE_PREFIX):
                        continue
                    if not is_handoff_prompt(text):
                        continue
                    key = text[:200]
                    if key in seen_bodies:  # 同一 prompt 被贴进多个会话，只留一份
                        continue
                    seen_bodies.add(key)
                    hits.append({
                        "ts": rec.get("timestamp", ""),
                        "loc": short_location(jsonl.parent.name),
                        "text": text,
                    })
        except OSError as exc:
            print("[跳过] %s: %s" % (jsonl, exc), file=sys.stderr)

    hits.sort(key=lambda h: h["ts"])
    for i, h in enumerate(hits, 1):
        print("\n---\n\n## 实例 %d · %s · %s\n" % (i, h["ts"][:10], h["loc"]))
        print("```text")
        print(h["text"])
        print("```")
    print("提取到 %d 份" % len(hits), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
