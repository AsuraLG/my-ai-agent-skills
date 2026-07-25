---
name: kb
description: 定位并使用本地"{目标业务}知识库"，并与已配置的 CodeGraph 项目索引协同工作，为{目标业务}的业务与代码分析提供依据。只要涉及以下内容都应主动使用本skill：{目标业务}、{知识库项目名}、{业务关键词1}、{业务关键词2}、{业务关键词3}，或任何{目标业务}相关的业务/服务/代码分析请求——即使用户没有直接提到"知识库"或"KB"字样。
metadata:
  version: v1
  last_updated: "2026-07-25"
---

# {目标业务}知识库 + CodeGraph 协作协议

> **这是一个可直接复制使用的示例 skill。** 复制到你自己的 skill 目录后，把全文中所有 `{...}` 占位符替换成你自己业务的信息即可投入使用；占位符含义见文末"占位符说明"表。

把本skill作为了解{目标业务}本地知识的入口。

本skill定义以下两者之间的协作协议：

- 本地{目标业务}知识库（业务/系统/服务背景知识），以及
- 已配置的 CodeGraph 项目索引（当前代码事实、调用链路、符号关系、影响面分析）。

**不要**在回答或工作流逻辑中硬编码知识库或 CodeGraph 项目路径，先从本skill的配置文件里读取。同样，**也不要硬编码本skill自身的绝对路径**——见下方"配置文件"一节，改为在每次调用时动态推断。

## 配置文件

本skill自身的配置文件、模板文件都和 `SKILL.md` 放在同一个目录下。**不要**把这个目录的路径写死在文档或命令里，因为本skill可能被安装在不同机器、不同用户目录下。每次调用时动态推断出这个目录，记作 `SKILL_DIR`：

1. 优先用当前会话上下文里给出的"本skill所在目录"信息（多数agent在加载skill时会提供，例如一行 `Base directory for this skill: <path>`）。
2. 若上下文没给，退回：`find ~ -maxdepth 4 -type d -iname {skill目录名} 2>/dev/null`，取匹配到的目录。

得到 `SKILL_DIR` 后：

- 配置文件：`${SKILL_DIR}/config.json`
- 模板/参考配置：`${SKILL_DIR}/config.example.json`

预期字段：

```json
{
  "knowledgeBasePath": "__CONFIGURE_KNOWLEDGE_BASE_PATH__",
  "codegraphProjectPath": "__CONFIGURE_CODEGRAPH_PROJECT_PATH__",
  "codegraphEnabled": true,
  "defaultMode": "hybrid",
  "allowCodegraphIndexMaintenance": false
}
```

字段含义：

- `knowledgeBasePath`：`{知识库项目名}` 的绝对路径。所有模式下都必须配置。
- `codegraphProjectPath`：包含 `.codegraph/` 的项目根目录绝对路径。这是传给 `codegraph -p` 或 MCP `projectPath` 的路径，**不是** `.codegraph` 目录本身。
- `codegraphEnabled`：为 `true` 时，preflight 通过后可使用 CodeGraph；为 `false` 时只用 KB-only 模式。
- `defaultMode`：`hybrid`、`kb-only`、`codegraph-only` 三选一，默认通常应为 `hybrid`。
- `allowCodegraphIndexMaintenance`：为 `false` 时，即使 `.codegraph` 缺失或过期也不要运行 CodeGraph 的写入/维护命令，改为报告用户可自行授权执行的确切命令。

## 强制 Preflight 检查

使用本skill执行任何任务前，先做一次 preflight 检查。

1. 读取 `config.json`。
2. 把任何空值、缺失值，或匹配 `__CONFIGURE_*__` 的值都当作占位符处理。
3. 若 `knowledgeBasePath` 是占位符、缺失，或路径不存在，停下来，让用户先配置 `config.json`。
4. 若 `codegraphEnabled=true` 且 `codegraphProjectPath` 是占位符、缺失，或路径不存在，停下来，让用户配置 `config.json`，或将 `codegraphEnabled` 设为 `false` 改用 KB-only。
5. 若 `codegraphEnabled=true` 且 `${codegraphProjectPath}/.codegraph` 不存在，不要自动初始化。停止代码层面的 CodeGraph 分析，报告需要用户授权执行的确切初始化命令。
6. 若 `codegraphEnabled=true` 且 `.codegraph` 存在，在需要代码级准确性、或用户询问当前实现时，运行/读取 `codegraph status -p "$codegraphProjectPath"`。
7. 在使用本skill后的第一条可见回复中，简要报告 preflight 状态：已配置的 KB 路径、已配置的 CodeGraph 项目路径（或说明已禁用）、CodeGraph 是否可用。

只读的 preflight 示例命令：

```bash
# SKILL_DIR 取本次加载时上下文给出的"本skill所在目录"（如 "Base directory for this skill: ..."），不要用记忆里的旧值
CONFIG="$SKILL_DIR/config.json"
cat "$CONFIG"
KB="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("knowledgeBasePath", ""))' "$CONFIG")"
CG="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("codegraphProjectPath", ""))' "$CONFIG")"
test -d "$KB" && echo "KB exists: $KB"
test -d "$CG/.codegraph" && codegraph status -p "$CG"
```

若值是占位符，不要用猜测的路径继续执行，请用户去编辑 `config.json`。

## 模式

### `kb-only`

用于业务背景、术语、领域边界、服务/SDK导航、人工确认过的运行时事实，以及已总结好的知识。

工作流：

1. 搜索/读取已配置的知识库。
2. 领域不明确时，先看 `README.md` 和索引文件。
3. 打开大量文件前，先用领域词做定向搜索。
4. 引用查阅过的知识库文件。
5. 把 KB 证据与推断、未知项区分开。

常用命令：

```bash
find "$knowledgeBasePath" -maxdepth 2 -type f | sort
rg -n "关键词|服务名|接口名|SDK|{业务关键词1}|{业务关键词2}|{业务关键词3}|配置" "$knowledgeBasePath"
```

### `codegraph-only`

用于不需要业务背景的纯代码问题，或用户明确要求了解当前代码实现、符号关系、调用者/被调用者、影响面时。

工作流：

1. 使用已配置的 `codegraphProjectPath`。
2. 优先使用 CodeGraph 的 MCP 工具（若可用）；始终传入 `projectPath`。
3. 用 `-p "$codegraphProjectPath"` 作为 CLI 兜底方式。
4. 把 CodeGraph 的输出当作当前代码事实，而非业务意图。

常用 CLI 命令（`YourService`、`yourMethod` 为示例符号名，替换为你项目中的真实类名/方法名）：

```bash
codegraph query -p "$codegraphProjectPath" "YourService" --limit 20
codegraph explore -p "$codegraphProjectPath" "YourServiceImpl yourMethod YourService yourMethod"
codegraph node -p "$codegraphProjectPath" YourService
codegraph callers -p "$codegraphProjectPath" yourMethod
codegraph callees -p "$codegraphProjectPath" yourMethod
codegraph impact -p "$codegraphProjectPath" YourService --depth 2
```

对应的 MCP 用法（仅当该工具确实在本次会话中注册时可用）：

- `codegraph_explore({"projectPath": codegraphProjectPath, "query": "..."})` —— 通常可用，优先用这个。
- `codegraph_node({"projectPath": codegraphProjectPath, "symbol": "...", "includeCode": true})`
- `codegraph_callers({"projectPath": codegraphProjectPath, "symbol": "..."})`

并非每个agent/会话都会把上面这些都注册成 MCP 工具——有些会话只暴露 `codegraph_explore`。在依赖 `codegraph_node`、`codegraph_callers` 或其他 MCP 工具名之前，先确认当前工具列表里确实存在它（例如用工具搜索确认）。若不存在，退回使用上面对应的 CLI 命令，不要假设该调用一定能成功。

### `hybrid`（默认）

用于大多数既需要业务理解、又需要实现细节的{目标业务}问题。

工作流：

1. 先用 KB 确定业务领域、能力、服务/SDK、接口、表、MQ topic、远程依赖，以及已知边界。
2. 从 KB 证据中提取 CodeGraph 锚点：类名、接口名、方法名、表 mapper 名、消息监听器名、producer 名、枚举名、服务名。
3. 用这些锚点在 CodeGraph 中验证当前代码路径，补全实现细节。
4. 若 KB 与 CodeGraph 有冲突，明确报告冲突：KB 可能代表已文档化/已确认的知识；CodeGraph 代表当前索引到的代码。
5. 不要仅因为 CodeGraph 显示出现了偏移就去修改 KB，除非用户明确要求更新 KB。

同时使用两者时，建议的回答分节结构：

```text
Preflight
- KB path: ...
- CodeGraph project path: ...
- CodeGraph status: available / unavailable / disabled

KB evidence
- files consulted and what they establish

CodeGraph evidence
- symbols/call paths/files consulted and what they establish

Synthesis
- combined explanation

Unknowns / limits
- runtime facts, remote semantics, stale docs, or unverified assumptions
```

## 职责划分

用下表避免过度依赖单一信息源：

| 问题/事实类型 | 首选来源 | 说明 |
| --- | --- | --- |
| 业务领域、能力边界、术语 | KB | CodeGraph 无法证明业务意图。 |
| 服务/SDK 地图与已知入口点 | KB 优先，CodeGraph 验证 | KB 提供导航；CodeGraph 验证当前实现。 |
| 当前方法实现与调用链 | CodeGraph | 引用 CodeGraph 给出的文件/符号。 |
| 修改某符号的调用者/被调用者与影响面 | CodeGraph | 使用 `callers`、`callees`、`impact` 或 `affected`。 |
| 表、MQ topic、远程依赖 | KB 优先，CodeGraph 验证 | KB 可能包含运行时或人工确认过的事实。 |
| 生产环境数据库、服务治理平台、配置中心、日志系统、链路追踪系统、运行时状态 | KB / 经授权的运行时工具 | CodeGraph 只能看到代码/配置，看不到实时状态。请替换为你公司实际使用的运维/治理工具（如自建 RDS、Nacos/Apollo、SkyWalking/Zipkin 等）。 |
| 历史设计意图与待确认事项 | KB | 有的话使用"待确认清单"。 |

## CodeGraph 项目路径规则

已配置的 `codegraphProjectPath` 默认具有权威性，即便 AI 是从另一个目录启动的也是如此。

始终使用以下方式之一：

```bash
codegraph status -p "$codegraphProjectPath"
codegraph explore -p "$codegraphProjectPath" "..."
codegraph node -p "$codegraphProjectPath" "..."
```

或 MCP 的 `projectPath`：

```json
{"projectPath": "/absolute/project/root", "query": "..."}
```

只有在用户明确要求把当前工作目录当作一个独立项目来分析，或已配置路径被禁用/不可用且当前目录能通过 preflight 检查时，才改用当前工作目录下的 `.codegraph`。

## CodeGraph 索引维护边界

分析阶段、preflight 通过后，允许运行以下只读 CodeGraph 命令：

```bash
codegraph status -p "$codegraphProjectPath"
codegraph query -p "$codegraphProjectPath" "..."
codegraph explore -p "$codegraphProjectPath" "..."
codegraph node -p "$codegraphProjectPath" "..."
codegraph callers -p "$codegraphProjectPath" "..."
codegraph callees -p "$codegraphProjectPath" "..."
codegraph impact -p "$codegraphProjectPath" "..."
codegraph affected -p "$codegraphProjectPath" ...
```

写入/维护类命令需要用户明确授权，并且必须遵守当前编码助手正在生效的安全规则：

```bash
codegraph init "$codegraphProjectPath"
codegraph sync "$codegraphProjectPath"
codegraph index --force "$codegraphProjectPath"
codegraph uninit "$codegraphProjectPath"
codegraph unlock "$codegraphProjectPath"
```

若 `.codegraph` 缺失或已过期，而用户只是要求做分析，**不要**运行维护类命令。报告阻塞原因和所需的确切命令即可。

若 `allowCodegraphIndexMaintenance=false`，即使维护类命令在其他方面已获授权，也不要通过本skill执行；改为提供命令让用户自行运行，或请求用户明确修改配置来放开限制。

## 知识库安全

- 除非用户明确要求更新知识库，否则不要修改它。
- 除非用户明确要求修改 KB schema，否则不要往知识库里添加 CodeGraph 专属的元数据。
- KB 与 CodeGraph 应保持各自独立可用。本skill定义的是两者的协作方式，而非硬耦合。
- 若 KB 指向源代码仓库、API 或运行时系统，应把 KB 内容当作导航/背景信息；需要实现级准确性时，要对照所引用的源头做验证。

## 输出要求

本skill参与作答时，回答中应包含：

- 简明的 preflight 状态；
- 使用了 KB 时，列出查阅过的知识库文件；
- 使用了 CodeGraph 时，列出查阅过的符号/查询/文件；
- 结论或摘要；
- 当答案依赖解读时，明确区分证据与推断；
- 任何不确定性或缺失的证据；
- 若答案需要更深入的源码、运行时或远程系统验证，说明下一步该查什么。

---

## 占位符说明

复制本模板后，请将下列占位符替换为你自己业务的真实信息：

| 占位符 | 含义 | 示例 |
| --- | --- | --- |
| `{目标业务}` | 本知识库覆盖的业务/系统全称，贯穿全文用于描述适用范围 | "跨境电商履约系统"、"信贷风控平台" |
| `{知识库项目名}` | 本地知识库的项目/目录名称，对应 `config.json` 中 `knowledgeBasePath` 指向的目录 | `fulfillment-knowledge-base` |
| `{skill目录名}` | 本skill自身部署后的目录名，用于 preflight 阶段兜底查找 `SKILL_DIR` | `fulfillment-kb` |
| `{业务关键词1}` / `{业务关键词2}` / `{业务关键词3}` | 触发本skill、以及 `kb-only` 模式下做定向搜索时使用的领域关键词，可按需增减 | "履约单"、"运力"、"轨迹" |
| `YourService` / `yourMethod` / `YourServiceImpl` | CodeGraph 查询示例中的类名/方法名，替换为你项目里的真实符号 | `OrderService`、`createOrder` |
| 生产环境工具名（服务治理平台/配置中心/链路追踪系统） | 替换为你公司实际使用的对应工具 | Nacos、Apollo、SkyWalking |

另外，`config.example.json` 中的 `__CONFIGURE_KNOWLEDGE_BASE_PATH__`、`__CONFIGURE_CODEGRAPH_PROJECT_PATH__` 是运行时才需要真实填写的占位符，用户复制为 `config.json` 后按字段说明填入绝对路径即可，模板阶段无需处理。
