from pathlib import Path
import sys


RUNTIME_DIR = Path(__file__).resolve().parent
SKILL_ROOT = RUNTIME_DIR.parent
EXPECTED_PREFIX = (SKILL_ROOT / ".venv").resolve()


def ensure_skill_venv(entry_file: str) -> Path:
    current_prefix = Path(sys.prefix).resolve()

    if current_prefix == EXPECTED_PREFIX:
        return current_prefix

    entry_path = Path(entry_file).resolve()

    print(
        "错误: 当前脚本没有运行在 nano-banana 自己的 uv 虚拟环境中。\n"
        f"期望环境: {EXPECTED_PREFIX}\n"
        f"当前环境: {current_prefix}\n"
        f"请使用: uv run --project {SKILL_ROOT} python {entry_path}",
        file=sys.stderr,
    )
    raise SystemExit(1)
