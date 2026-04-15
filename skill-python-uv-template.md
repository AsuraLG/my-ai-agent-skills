# Skill Python with uv

这份模板用于约束 skill 中的 Python 脚本运行方式。

目标：

- 每个 skill 都有自己独立的 `uv` 项目和独立的 `.venv`
- skill 自动调用脚本时，使用 skill 根目录下的 `.venv`
- 用户手工在终端执行脚本时，也使用同一套 `.venv`
- 脚本运行时只做校验；如果当前解释器不是 skill 自己的 `.venv`，直接退出

## 推荐目录结构

```text
my-skill/
├── pyproject.toml
├── uv.lock
├── .venv/
└── scripts/
    ├── _runtime.py
    └── foo.py
```

## pyproject.toml 和 uv.lock 分别做什么

可以先用一句话区分：

- `pyproject.toml` 用来声明“这个 skill 想要什么”
- `uv.lock` 用来记录“这个 skill 最终精确安装了什么”

### pyproject.toml 的作用

`pyproject.toml` 是项目配置文件，通常由开发者维护。

在 skill 场景里，它主要用于：

- 声明项目名和版本
- 声明 Python 版本要求
- 声明直接依赖
- 存放部分工具配置

它描述的是“需求”或者“意图”，不是最终安装结果。

例如：

```toml
[project]
name = "my-skill"
version = "0.1.0"
description = "Example skill"
requires-python = ">=3.11"
dependencies = [
    "requests>=2.32.0",
    "pydantic>=2.7.0",
]
```

这里的含义是：

- 这个项目至少需要 Python 3.11
- 项目直接依赖 `requests` 和 `pydantic`
- 版本是范围，不是最终锁死的具体版本

### uv.lock 的作用

`uv.lock` 是 `uv` 生成的锁文件，通常不要手工编辑。

它主要用于：

- 固定直接依赖的最终版本
- 固定传递依赖的最终版本
- 让不同机器尽量得到一致的环境
- 让 `uv sync` 和 `uv run` 有一个稳定的可复现结果

例如，`pyproject.toml` 里只写：

```toml
dependencies = [
    "requests>=2.32.0",
]
```

但 `uv.lock` 里会进一步记录类似这样的精确结果：

```toml
version = 1
revision = 3
requires-python = ">=3.11"

[[package]]
name = "requests"
version = "2.32.3"

[[package]]
name = "urllib3"
version = "2.2.2"

[[package]]
name = "certifi"
version = "2024.7.4"
```

上面只是示意，不代表完整真实格式，但足够表达它的职责：

- `pyproject.toml` 写“我要 `requests>=2.32.0`”
- `uv.lock` 记“最后实际用了 `requests==2.32.3`，以及它依赖的 `urllib3`、`certifi` 等具体版本”

### 两者的配合关系

在日常开发中，可以这样理解：

- 改“依赖需求”时，主要改 `pyproject.toml`
- 固化“解析结果”时，由 `uv` 更新 `uv.lock`
- 创建或同步环境时，`uv` 会结合这两个文件来构建 `.venv`

典型流程：

```bash
uv add requests
uv sync
```

执行之后通常会发生：

- `pyproject.toml` 新增直接依赖
- `uv.lock` 更新精确版本
- `.venv` 同步成对应状态

### skill 场景里的建议

建议把这两个文件都提交到版本控制：

- `pyproject.toml`
- `uv.lock`

不要提交：

- `.venv/`

原因：

- `pyproject.toml` 负责声明依赖
- `uv.lock` 负责保证尽量可复现
- `.venv` 是本地构建产物，不适合跨机器直接共享

### 最小示例

一个最小可用的 `pyproject.toml`：

```toml
[project]
name = "image-helper-skill"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "requests>=2.32.0",
]
```

对应的工作方式：

```bash
uv sync
uv run python scripts/foo.py
```

对应的 `uv.lock` 不需要手写。它由 `uv` 自动生成和更新。

## 运行约定

不要围绕 `source .venv/bin/activate` 设计流程。

推荐统一使用：

```bash
uv run --project /path/to/my-skill python scripts/foo.py
```

如果当前 shell 已经在 skill 根目录，也可以直接：

```bash
uv run python scripts/foo.py
```

初始化环境时使用：

```bash
uv sync
```

## 为什么不用 activate

`activate` 主要适合交互式 shell，不适合作为稳定的自动化约束。

问题包括：

- 用户可能忘记激活
- 不同机器 shell 配置不同
- `alias python=...` 之类的配置会干扰结果
- 只检测 `VIRTUAL_ENV` 不够可靠

`uv run` 的意义是直接让命令在项目自己的环境里执行，而不是依赖用户先进入某个 shell 状态。

## 必须校验什么

不要只校验“是否在虚拟环境中”，要校验“是否在当前 skill 根目录的 `.venv` 中”。

不推荐这些方式作为唯一判断：

- `VIRTUAL_ENV`
- `sys.executable`
- `which python`

推荐使用：

- `sys.prefix`

原因：

- 另一个项目的虚拟环境也会满足“在虚拟环境中”
- `VIRTUAL_ENV` 在某些直接调用场景下不一定存在
- `venv` 里的 `python` 可能是符号链接，`sys.executable.resolve()` 可能误导判断
- `sys.prefix` 更适合判断当前解释器实际绑定到哪个虚拟环境

## 推荐模板

先放一个公共辅助模块，例如 `scripts/_runtime.py`：

```python
from pathlib import Path
import sys


SCRIPT_DIR = Path(__file__).resolve().parent
SKILL_ROOT = SCRIPT_DIR.parent
EXPECTED_PREFIX = (SKILL_ROOT / ".venv").resolve()


def ensure_skill_venv(entry_file: str) -> Path:
    current_prefix = Path(sys.prefix).resolve()

    if current_prefix == EXPECTED_PREFIX:
        return current_prefix

    entry_path = Path(entry_file).resolve()
    try:
        relative_entry = entry_path.relative_to(SKILL_ROOT)
    except ValueError:
        relative_entry = entry_path

    print(
        "错误: 当前脚本没有运行在 skill 自己的 uv 虚拟环境中。\n"
        f"期望环境: {EXPECTED_PREFIX}\n"
        f"当前环境: {current_prefix}\n"
        f"请使用: uv run --project {SKILL_ROOT} python {relative_entry}",
        file=sys.stderr,
    )
    raise SystemExit(1)
```

业务脚本例如 `scripts/foo.py`：

```python
import argparse

from _runtime import ensure_skill_venv


ensure_skill_venv(__file__)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", default="world")
    args = parser.parse_args()
    print(f"hello, {args.name}")


if __name__ == "__main__":
    main()
```

## pyproject.toml 示例

```toml
[project]
name = "my-skill"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "requests>=2.32.0",
]
```

## uv.lock 示例

下面是一个简化后的示意片段，只用于帮助理解，不建议手写：

```toml
version = 1
revision = 3
requires-python = ">=3.11"

[[package]]
name = "my-skill"
version = "0.1.0"
source = { virtual = "." }
dependencies = [
    { name = "requests" },
]

[[package]]
name = "requests"
version = "2.32.3"
dependencies = [
    { name = "certifi" },
    { name = "charset-normalizer" },
    { name = "idna" },
    { name = "urllib3" },
]

[[package]]
name = "urllib3"
version = "2.2.2"

[[package]]
name = "certifi"
version = "2024.7.4"
```

这个例子体现的是：

- skill 自己作为一个项目也会出现在锁文件里
- `requests` 的版本会被锁定
- `requests` 依赖的包也会一起被锁定

## skill 自动调用建议

skill 内部不要假设用户已经激活虚拟环境。

统一显式调用：

```bash
uv run --project "$SKILL_ROOT" python scripts/foo.py --name demo
```

这样有几个好处：

- 总是绑定 skill 根目录的项目环境
- `.venv` 不存在时，`uv` 会按项目状态处理环境
- 不依赖用户的 shell、alias、PATH 顺序

## 多个 skill 连续使用时是否会互相干扰

如果每个 skill 都遵守同一条运行约定：

```bash
uv run --project /path/to/skill-root python scripts/foo.py
```

并且脚本启动后再校验：

```python
ensure_skill_venv(__file__)
```

那么在同一个 AI 对话里连续使用多个 skill 时，Python 运行环境是隔离的。

这意味着：

- 每个 skill 都会使用自己根目录下的 `.venv`
- 每次脚本执行都是独立进程
- 每个进程加载的是自己的解释器和自己的 `site-packages`
- 前一个 skill 的 Python 依赖不会污染后一个 skill

## 需要明确的隔离边界

这种方式能保证的是 Python 解释器和 Python 依赖的隔离，不代表所有资源天然隔离。

下面这些资源仍然可能互相影响：

- 环境变量
- 当前工作目录
- 临时文件
- 缓存目录
- 输出文件
- 端口占用
- 数据库连接
- 浏览器会话
- 用户配置目录

如果希望 skill 之间进一步减少干扰，建议额外约束：

- 每个 skill 使用自己的输出目录
- 每个 skill 使用自己的缓存目录
- 不要写入共享的固定文件名
- 对外部服务使用明确的配置前缀或独立配置文件
- 必要时在启动命令里显式指定工作目录

## skill 内部再起子进程时的规则

如果某个 skill 的 Python 脚本内部还要再启动另一个 Python 子进程，不要写：

```python
subprocess.run(["python", "other.py"], check=True)
```

也不要写：

```python
subprocess.run(["pip", "install", "..."], check=True)
```

推荐写法：

```python
import subprocess
import sys

subprocess.run([sys.executable, "other.py"], check=True)
```

或者继续显式绑定当前 skill：

```python
subprocess.run(
    ["uv", "run", "--project", str(SKILL_ROOT), "python", "other.py"],
    check=True,
)
```

原因：

- `python` 可能被用户 shell alias 干扰
- `pip` 可能落到错误的环境
- `sys.executable` 才能稳定复用当前 skill 已经确认无误的解释器

## 用户手工执行建议

文档里直接要求用户这样执行：

```bash
cd /path/to/my-skill
uv sync
uv run python scripts/foo.py --name demo
```

或者：

```bash
uv run --project /path/to/my-skill python scripts/foo.py --name demo
```

## 不推荐的做法

### 1. 脚本自动重进 `.venv`

例如脚本启动后检测当前不是目标环境，再执行：

```python
os.execv(...)
```

这不是当前场景的首选，因为你的要求已经很明确：只检测，不自动切换。

### 2. 只检测 `VIRTUAL_ENV`

这只能说明“可能在某个虚拟环境中”，不能说明“就在当前 skill 的 `.venv` 中”。

### 3. 依赖 `activate`

这会把正确性建立在用户的交互习惯上，而不是建立在命令本身上。

### 4. 给这些脚本写 PEP 723 inline metadata

如果脚本使用了 inline metadata，再走 `uv run --script`，通常会进入脚本自己的隔离环境，而不是 skill 项目的 `.venv`。这和当前目标相反。

## 最小工作流

创建或更新 skill 依赖：

```bash
uv sync
```

自动化调用：

```bash
uv run --project /path/to/my-skill python scripts/foo.py
```

脚本内强校验：

```python
ensure_skill_venv(__file__)
```

## 一句话原则

用 `uv run` 决定“在哪个环境里执行”，用 `sys.prefix` 校验“当前是不是 skill 自己的 `.venv`”。
