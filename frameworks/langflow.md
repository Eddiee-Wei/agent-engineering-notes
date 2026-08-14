---
title: Langflow
description: Langflow 1.11 的可视化 Flow、Component、Agent、Workflow API、LFX、HITL、部署与高并发生产实践。
last_verified: 2026-08-13
---

# Langflow

> 版本快照：本文以 Langflow OSS [`v1.11.3`](https://github.com/langflow-ai/langflow/releases/tag/v1.11.3) 为稳定基线，发布于 2026-08-11，对应源码提交 [`14ad03a`](https://github.com/langflow-ai/langflow/tree/14ad03a3f03bc071186286f65c08e847f7f5d88c)。资料核对日期为 2026-08-13；仓库中已经存在 1.12 开发版号，但本文不把 dev / pre-release 或 Next 文档当成当前稳定能力。

Langflow 是一个开源的 Python 可视化 AI 应用框架。它把模型、Prompt、数据、Retriever、Agent、Tool 和外部协议封装成带类型端口的 Component，让开发者在画布上组装、测试、版本化，再通过 API、MCP、A2A 或独立 Runtime 交付。

它最准确的定位是：

> **以可视化开发体验为入口、以可编辑 Python Component 为逃生舱、以可序列化 Flow 为交付物的 Agent / Workflow 构建与服务平台。**

这一定义也指出了边界：画布适合协作和快速迭代，但它不是一个自动获得分布式并行、跨系统事务和强租户隔离的 Durable Workflow Engine。

## 先把四个运行形态分开

| 形态 | 包含什么 | 主要用途 | 状态与安全边界 |
| --- | --- | --- | --- |
| Langflow Desktop | UI、Backend 与本地依赖 | 个人原型和演示 | 不作为共享生产控制面 |
| Langflow IDE | Visual Editor + API + 数据库 | 团队开发、调试、管理 Flow | 是代码执行平台，应放在开发环境 |
| Headless Runtime | Backend / API，不提供编辑器 | 在生产环境服务已审核 Flow | 外部 PostgreSQL，按 Flow 独立扩缩容 |
| Standalone LFX | 轻量 Executor / CLI / Python 库 | 从 JSON / Python 运行或服务 Flow | 无 UI、无 Langflow DB，默认无持久状态 |

[部署架构文档](https://docs.langflow.org/deployment-architecture)建议把 IDE 与 Runtime 分成开发、生产环境。这样既能缩小生产攻击面，也能让某个 Flow 的资源和发布节奏独立于编辑器。

## Flow 的真实执行模型

Flow 是一组 Component（Node）、Port 与 Edge 的可序列化定义。执行时，Runtime：

1. 根据 Node 与 Edge 构造有向无环图；
2. 校验和准备每个 Component；
3. 按依赖关系排序；
4. 依序 Build / Execute Node；
5. 把结果传给依赖它的后继 Node；
6. 收集终端 Component 的输出和运行事件。

当前稳定文档明确说明：**一次 Flow 内的 Node 按依赖顺序逐个执行。** 画布上有多个分支，不等于这些分支会被 Runtime 自动并行执行。[Flow 文档](https://docs.langflow.org/concepts-flows#flow-graphs)对这一点写得很清楚。

这个设计适合可解释的组件流水线，也意味着高并发优化首先发生在“多个请求 / 多个 Runtime 副本”层，而不是假设同一次 DAG 会像 Pregel 一样原生 Fan-out。

```text
Chat Input
   → Guardrail
   → Agent ──Tool Mode──→ Web Search / SQL / MCP Tools
   → Structured Response
   → Chat Output
```

模型驱动的 Tool Loop 可以发生在 Agent Component **内部**；画布负责连接 Agent 的输入、工具与下游，而不是把每个模型思考 Step 都暴露成一个 Flow Node。

## Component：画布与 Python 之间的契约

Component 由以下几部分组成：

- 类级元数据：名称、说明、Icon 与文档；
- `inputs`：字段、配置控件与输入 Port；
- `outputs`：输出 Port 及其对应方法；
- 执行方法：同步或异步 Python 逻辑；
- `self.ctx`：一次 Component 实例执行期间共享的内部数据；
- Log、Status、Trace 与 Error 语义。

类型化 Port 会在连线阶段阻止明显不兼容的组合。常见类型包括 JSON、Table、Message、LanguageModel、Embeddings、Memory 和 Tool；需要时可以用 Type Convert 等 Component 做显式转换。

### 一个最小自定义 Component

```python
from lfx.custom.custom_component.component import Component
from lfx.io import Output, StrInput
from lfx.schema import Data


class NormalizeTicket(Component):
    display_name = "Normalize Ticket"
    description = "把工单文本转成统一 JSON。"
    icon = "file-text"

    inputs = [
        StrInput(name="text", display_name="Ticket", required=True),
    ]
    outputs = [
        Output(name="result", display_name="Result", method="normalize"),
    ]

    def normalize(self) -> Data:
        value = self.text.strip()
        self.status = f"normalized {len(value)} chars"
        return Data(data={"text": value, "empty": not bool(value)})
```

自定义 Component 的价值是让可视化系统没有被最小公分母锁死：缺少的 Provider、内部 API、数据转换和策略都能用 Python 补齐。代价同样直接——这段代码在 Backend 进程中运行，拥有该进程能访问的文件、网络和凭据。

### Component 版本不等于包版本

把一个 Component 拖进 Flow 时，Flow 得到的是当时定义的一个脱离副本。升级 Langflow 后，现有 Flow 不会自动同步到最新 Component；UI 会提示安全更新或可能破坏连线的更新。

这是一项重要的可重复性设计：生产 Flow 不会因为组件库升级而静默改变。但团队仍应把导出的 Flow JSON、依赖和镜像一起锁定，并在更新 Component 后重新做 Contract Test。

## Agent、Tool 与 Multi-Agent

### Agent Component

Agent Component 收敛了模型、System Instruction、Tool Calling、Chat Memory 和 Structured Response。任意支持 Tool Mode 的 Component 都可以连接到 Agent 的 Toolset Port，另一个 Agent 也可以作为 Tool 被调用。

Agent 的 Chat Memory 默认按 `session_id` 分组。生产调用应由服务端生成包含应用、租户与用户边界的 Session ID，不能让不同用户复用一个固定值。结构化输出仍需要业务校验；类型正确不代表操作已授权。

### Multi-Agent 组合

Langflow 没有要求所有团队拓扑都使用一个固定类，常见组合是：

- 把专用 Agent 开启 Tool Mode，交给 Supervisor Agent 调用；
- 用 Run Flow Component 把子 Flow 当作可复用能力；
- 用 Router / If-Else 根据结构化分类结果选择下游；
- 连接 MCP Tools，从远端 Server 动态获取工具；
- 通过 A2A Agent Component 调用远端 Agent，或把 Flow 发布为 A2A Server；
- 在关键 Tool 前启用审批，或把 Human Input 放到显式分支点。

多一个 Agent 通常会多一次模型调用、上下文复制和故障点。画布审查时应标注每条路径的模型调用数、Token 上限、外部效果和终态，不要只看拓扑是否“像团队”。

## Flow 版本、Draft 与发布物

Flow 会自动保存当前 Draft，但 Auto-save 不会创建版本。Version History 中的 Save 才会生成显式、可恢复的快照，保存在 Langflow 数据库中。

工程上应再增加一层 Git 流程：

1. 在 IDE 中设计并保存 Flow Version；
2. 导出规范化 JSON，审查 Node、Edge、Prompt、Model 与 Tool；
3. 固定 Langflow / LFX 主次版本和 Bundle 依赖；
4. 在隔离环境做测试与安全扫描；
5. 构建不可变 Runtime 镜像；
6. 按 Flow Version 灰度，而不是直接让生产读取可编辑 Draft。

LFX 的 DevOps 命令覆盖 `validate`、`requirements`、`status`、`push`、`pull` 与 `export`，适合把这一过程接入 CI。

## API：同步、流式与后台是三种完成语义

传统 v1 `/run` 端点仍可运行 Flow。1.11 的 Developer v2 [Workflow API](https://docs.langflow.org/workflow-api) 提供统一的 Beta 入口：

```http
POST /api/v2/workflows
```

一个典型请求如下：

```json
{
  "flow_id": "67ccd2be-17f0-8190-81ff-3bb2cf6508e6",
  "input_value": "汇总这个告警并给出下一步",
  "mode": "stream",
  "stream_protocol": "agui",
  "session_id": "tenant-7:user-42:incident-9",
  "tweaks": {
    "Agent-abc": {"temperature": 0.1}
  }
}
```

| Mode | 返回方式 | 客户端应怎样判断完成 |
| --- | --- | --- |
| `sync` | 等待完整 `WorkflowExecutionResponse` | 检查 `status`、`has_errors` 与 Component errors |
| `stream` | SSE；Langflow EventManager 或 AG-UI | 等到 `end` / `RUN_FINISHED`，失败处理 `error` / `RUN_ERROR` |
| `background` | 立即返回 `job_id` | 轮询状态或重连事件，直到终态 |

SSE 帧带单调递增的 ID；后台 Run 可在 `GET /api/v2/workflows/{job_id}/events` 通过 `Last-Event-ID` 续接。状态包括 `queued`、`in_progress`、`suspended`、`completed`、`failed`、`cancelled` 和 `timed_out`。

“连接断了”不是“Run 已取消”，收到最后一个 Token 也不等于业务完成。客户端应保存 `job_id` / Event ID，支持终态查询，并把重复提交与 UI 重连设计为幂等路径。Workflow API 仍标记为 Beta，1.10 到 1.11 已发生请求 Schema 变化，客户端必须锁版本并做契约测试。

## Human-in-the-Loop 与恢复边界

1.11 可以用两种方式暂停 Flow：

- **Human Input Component**：在图上形成多个用户动作分支；
- **Agent Tool Approval**：当 Agent 请求特定 Tool 时审批、拒绝或编辑参数。

暂停会创建 Checkpoint；恢复后已完成的前序 Step 不会重新执行。这个能力适合审批、人工补充信息和高风险写操作，但不能替代外部系统事务：暂停前已经发送的消息或数据库写入仍需幂等键和效果查询。

审批记录至少要包含 Flow Version、Job ID、Tool、参数摘要、发起人、审批人、策略版本、决定和有效期。对于悬挂的 `suspended` Job，还应设置运营告警、超时与清理策略。

## Native Traces 与可观测性

Native Tracing 默认记录：

- 每次 Flow Run 的状态与总耗时；
- 每个 Component 的输入、输出、Latency 和 Error；
- LangChain Chain、Tool、Retriever、LLM 与 Token 用量；
- HITL 的批准或拒绝 Span。

Trace / Span 保存在 Langflow 数据库，可在 Flow Activity UI 查看，也可通过 `/monitor/traces` 查询。还可以接入 LangSmith、Langfuse 等外部 Provider。

Trace 是审计和优化的原材料，不是免费存储：输入输出可能含个人数据、Prompt、Tool Result 和 Secret。生产环境应设置脱敏、访问控制、保留期和删除流程，并监控 Trace 写入对主数据库的影响。

## LFX：把可视化 Flow 变成轻量运行物

LFX（Langflow Executor）已经被完整 Langflow Server 用作 Flow Runtime。单独安装时，它去掉 UI 和 Langflow 数据库：

```bash
# 单次运行
uv run lfx run support-flow.json --input-value "订单 A-17 怎么了？"

# 作为 FastAPI 服务
uv run lfx serve ./flows/
# POST /flows/{flow_id}/run
```

`lfx run` / `lfx serve` 都可接受导出的 JSON 或定义 Graph 的 Python 文件；`lfx prewarm` 可以提前导入 Component 与 Flow，减少 Fork / Snapshot 后冷启动。

Standalone LFX 使用 `NoopSession`，不会像完整 Langflow 一样持久化 Flow、Message 和 User。它很适合把已审核 Flow 放进较小的不可变镜像，也意味着会话记忆、租户数据、版本管理和持久化要由外部系统承担。

从 1.11 起，直接 `uv pip install lfx` 只安装 Engine；需要的 Provider Bundle 要显式安装。LFX 与 Langflow 在相同 `major.minor` 上保证兼容，但 Patch 可独立发布，部署仍应锁定两个确切版本与扩展清单。

## Langflow 的独到优势

### 可视化不是截图，而是可执行、可导出的定义

Port 类型、Component 参数、实时单节点运行、Playground、Trace 和 Flow JSON 共同组成一条从讨论到执行的路径。产品、数据和工程人员可以围绕同一个拓扑审查系统，而不是靠文档猜代码结构。

### 每个 Component 都保留 Python 逃生舱

低代码画布没有限制为封闭组件市场。团队可以查看和改写 Component 源码，接入内部 API，并把成熟实现打成 Bundle；这让原型可以逐步工程化。

### Flow 天然适合作为集成边界

同一个 Flow 可由 API 调用、作为 MCP Tool 发布、暴露为 A2A Agent，或用 LFX 放进独立服务。协议入口围绕同一份可序列化定义演进。

### IDE 与轻量 Runtime 可以分离

开发环境保留完整编辑体验，生产只运行审核过的 Flow。LFX 又提供更小的无数据库执行形态，使团队能按 Flow 的风险、状态需求和流量选择交付方式。

### 对 Agent 生命周期的产品化反馈完整

Playground 展示 Token、Tool Call、Input 与 Result；Native Trace 下沉到 Component Span；HITL、AG-UI 与后台重连覆盖了从开发调试到最终用户交互的连续体验。

## 高并发与超多请求场景

### 先承认单个 Flow 的串行关键路径

稳定版 Flow Graph 按依赖顺序逐 Node 执行。因此一次 Run 的延迟近似为关键路径上各 Component 延迟之和：

```text
Run 延迟 ≈ Queue Wait + Σ(Node Build + Model/Tool I/O) + Trace/DB 开销
```

优化方式包括减少重复模型调用、只连接需要的 Agent 输出、冻结确定且可复用的上游、把大对象换成引用、为外部 Tool 设置超时与缓存。若业务必须在一个请求内并行数百个分片，应在专用 Component / 外部并行服务中显式实现并限制并发，或选择原生表达 Fan-out 的编排 Runtime。

### 多请求并发：Runtime 副本才是主要扩展单元

估算在途量可以从 Little's Law 开始：

```text
同时在途 Run ≈ 峰值 QPS × P95 Run 时长（秒）
```

例如 5 QPS、P95 为 30 秒，就可能有约 150 个在途 Run。容量瓶颈通常是模型 RPM/TPM、外部 Tool、数据库连接、SSE 长连接、内存与 Trace 写入，而不是画布 Node 数量。

生产部署应：

1. 使用 Headless Runtime，不把 IDE 暴露给终端用户；
2. 使用外部 PostgreSQL，设置连接池、备份与迁移演练；
3. 以不可变 Flow / 镜像部署多个副本；
4. 按 Flow 或资源特征分 Pool，隔离慢模型、CPU 重任务和普通请求；
5. 在 API Gateway 做认证、租户限流、Payload 上限和 Deadline；
6. 为 Model、Tool、DB 分别设置 Bulkhead、Retry Budget 与熔断；
7. 记录 Queue Wait、首 Token、每个 Component、DB 与终态延迟。

### 多 Worker 不能只改一个数字

Langflow 默认一个 Worker，Build Job Queue 位于进程内。仅设置 `LANGFLOW_WORKERS>1` 时，Worker A 创建的 Build Job 可能被路由到 Worker B 查询，而 B 看不到 A 的内存 Queue。

官方[多 Worker 指南](https://docs.langflow.org/deployment-multi-worker)要求在所有 Worker 使用同一 Redis Streams Queue：

```text
LANGFLOW_WORKERS=3
LANGFLOW_JOB_QUEUE_TYPE=redis
LANGFLOW_REDIS_QUEUE_URL=redis://redis:6379/1
```

关键约束包括：

- Redis 6+，所有 Worker 的 Queue Type 必须一致；
- Queue 使用独立 DB（默认 1），不要与 Cache 的 DB 0 混用；
- Redis Pub/Sub 与 Cancel Marker 支持跨 Worker 取消；
- `/monitor/job_queue` 用于检查 Backend、Active Job 与 Cancel Dispatcher；
- 默认登录限流计数仍是进程级，要用 `LANGFLOW_RATE_LIMIT_STORAGE_URI` 指向共享 Redis；
- `LANGFLOW_GUNICORN_PRELOAD` 是 Linux 上的实验选项；macOS / Windows 使用单 Uvicorn 进程。

这份指南明确保证的是 Build Job 的跨 Worker 事件、轮询和取消路径，不能据此假设所有第三方 Component、会话内存或 Beta Workflow API 模式天然分布式一致。尤其是后台、暂停、重连与 Worker Crash 场景，要针对确切的 1.11.3 镜像做多副本故障测试，不能只做正常路径压测。

### 背压、配额与慢消费者

- 限制同步请求并发，长任务优先使用 Background Mode；
- SSE Client 必须持续消费并支持重连，Proxy 关闭缓冲；
- 对每租户限制同时在途 Run、Token、Tool QPS 和文件大小；
- Retry 总时长必须小于上游 Deadline，避免超时后继续烧配额；
- 用业务幂等键保护写 Tool，Job 取消后查询外部效果；
- LFX Prewarm 降低冷启动，但不替代容量与限流；
- 对 Session 热点和共享 Chat Memory 做单独压测。

## 安全边界：Langflow IDE 本质上是代码执行平台

[官方安全文档](https://docs.langflow.org/security)直言：编辑器允许开发者运行任意 Python，并拥有 Backend 进程的文件系统和网络权限；单个进程内不提供用户或租户之间的安全隔离。

生产设计至少要做到：

- IDE 只对受信开发者开放，生产使用 Backend-only Runtime；
- 设置 `LANGFLOW_ALLOW_CUSTOM_COMPONENTS=false`，并审核允许的 Component 路径；
- 必要时设置 `LANGFLOW_CUSTOM_COMPONENT_ADMIN_ONLY=true`；
- 不可信租户使用独立进程、磁盘、网络、数据库和凭据；
- Container 使用非 Root、只读文件系统、Egress Allowlist 与最小 Secret；
- 外部 API Gateway 执行 AuthN / AuthZ，不把 Flow 可见性当安全边界；
- 防御 SSRF、路径穿越、SQL 参数覆盖、Prompt Injection、XSS 与大 Payload；
- 对 MCP / A2A 远端、Model Discovery URL 和 Web Tool 做独立出站策略。

`LANGFLOW_ALLOW_CUSTOM_COMPONENTS=false` 仍是 Beta 防线，且管理员配置的 `LANGFLOW_COMPONENTS_PATH` 默认可作为 Allowlist 被加载。它不能替代容器和网络隔离。

## 从 1.9 到 1.11.3：升级到底带来了什么

### 1.9：数据类型命名收敛

1.9 将 `Data` Port 重命名为 JSON，将 `DataFrame` 重命名为 Table，使画布术语更接近用户看到的数据。旧 Flow 兼容，但自定义 Component、文档和测试应逐步使用新名称。

**好处**是 Port 语义更直观，结构化对象与表格的边界更容易被非框架作者理解。

### 1.10：LFX、Extension Bundle 与 Workflow API 基础

1.10 推进 LFX 与 Langflow 的版本线对齐，并开始把 Provider 集成从核心包拆到 Extension Bundle；v2 Workflow API 也在这一阶段形成早期契约。

**好处**是 Executor 可以更轻，Provider 依赖不必全部压入核心安装，Flow 也更容易进入 Git / CI / 独立 Runtime。代价是依赖清单和 Component 兼容性需要显式管理。

### 1.11：Agent 交互与生产边界完善

[1.11 Release Notes](https://docs.langflow.org/release-notes)的主线包括：

1. HITL Checkpoint 与 Human Input / Tool Approval；
2. A2A Server 与 Remote A2A Agent；
3. Workflow API 支持 AG-UI，统一 `sync` / `stream` / `background`；
4. OpenAI-compatible Provider 从 `/v1/models` 发现模型；
5. Data Operations 统一多种转换组件；
6. Standalone LFX 改为 Engine-only，Bundle 显式安装。

同时有明确破坏性变化：Workflow API 请求从 `background + inputs` 迁到 `mode + input_value + tweaks`；官方 Docker 默认关闭 Auto-login，移除默认超级用户密码；容器 `HOME` 移到 `/app/data`；短 Secret 升级要保持旧 Key 才能解密历史凭据；部分 PyTorch 重依赖组件改为 Opt-in。

**好处**是终端用户交互、跨 Agent 协议、轻量部署和默认认证更完整；升级成本则集中在 API Client、Secret、数据目录和 Provider Bundle。

### 1.11.3：以安全修复为主的 Patch

当前 [1.11.3 Release](https://github.com/langflow-ai/langflow/releases/tag/v1.11.3)重点修复 Markdown Sanitization、SQL 连接目标覆盖、Bundle FileInput 与 ChatInput 路径约束、Git Symlink、歧义 URL、OpenAI Model Discovery、Admin-only Component Build、`X-Forwarded-For`、MCP Redirect / SSRF、Web Search Payload 上限和存储感知的 S3 清理；同时修复 SQLite Lock Retry、LFX Upgrade Check 与 Azure AI Foundry Model Discovery。

**好处**是把可视化代码平台最敏感的文件、网络、SQL、代理头和动态组件入口进一步收紧。由于这些修复直接涉及安全边界，1.11 系列部署不应停在更早 Patch；升级后仍需基础设施隔离。

## 适用判断

Langflow 很适合：

- 需要产品、数据与工程共同查看和调整 AI 流程；
- 需要快速试验 Model、RAG、Agent、Tool 与 Provider 组合；
- 希望自定义 Python，同时保留画布、Playground 和 Trace；
- 想把同一 Flow 发布为 API、MCP Tool、A2A Agent 或轻量 LFX 服务；
- 需要低门槛 HITL 和可视化调试。

以下情形需要额外系统或不同 Runtime：

- 单个 Run 必须原生并行成百上千个动态任务；
- 要求通用的长期 Durable Execution、Exactly-once 副作用或复杂补偿；
- 多个不可信租户共享任意代码编辑器，却没有基础设施隔离；
- 以为 Background Mode、Redis 或多 Worker 会自动解决全部队列和一致性问题；
- Flow JSON 没有 Git、依赖锁、评测和发布审批，却直接被生产加载。

## 阅读源码时抓住这条线

基于 [`v1.11.3`](https://github.com/langflow-ai/langflow/tree/v1.11.3)，推荐按以下顺序阅读：

1. `src/lfx/src/lfx/graph/`：Flow DAG、Vertex、Edge 与执行顺序；
2. `src/lfx/src/lfx/custom/`、`inputs/`、`template/`：Component 和 Port 契约；
3. `src/lfx/src/lfx/processing/`：JSON 构图、Tweaks 与运行入口；
4. `src/lfx/src/lfx/workflow/`：v2 Workflow Router、Protocol Adapter 与 Host 边界；
5. `src/lfx/src/lfx/services/`：Session、Settings、Trace 与依赖注入；
6. `src/backend/base/langflow/api/`：完整 Server 的 v1 / v2 API；
7. `src/backend/base/langflow/services/job_queue/`：内存 / Redis Build Queue 与取消；
8. `src/backend/base/langflow/services/background_execution/`：Background Job、Event Replay 与 HITL 生命周期。

## 结论

Langflow 最值得借鉴的是把 Agent 工程从“只在代码里存在”变成可共同观察的运行物：**类型化 Component 连接数据，画布表达 Flow，Python 保留扩展能力，Flow JSON 承担交付，LFX 把设计带到轻量 Runtime，Trace、HITL 与协议出口再把运行反馈带回来。**

它的生产价值建立在诚实边界上：单次 Flow 当前顺序执行，IDE 能运行任意代码，Multi-worker 需要共享 Queue，持久状态依赖数据库，Beta API 必须锁版本。把这些约束纳入发布、隔离和容量设计后，Langflow 才会从优秀的原型工具变成可靠的 Agent 应用交付链。

## 主要资料

- [Langflow Overview](https://docs.langflow.org/about-langflow)
- [Build Flows and Flow Execution](https://docs.langflow.org/concepts-flows)
- [Components](https://docs.langflow.org/concepts-components)
- [Agents and Tools](https://docs.langflow.org/agents)
- [Workflow API (Beta)](https://docs.langflow.org/workflow-api)
- [LFX Overview](https://docs.langflow.org/lfx-overview)
- [Deployment Architecture](https://docs.langflow.org/deployment-architecture)
- [Multi-worker Deployment](https://docs.langflow.org/deployment-multi-worker)
- [Security](https://docs.langflow.org/security)
- [Langflow 1.11.3 Source and Release](https://github.com/langflow-ai/langflow/releases/tag/v1.11.3)
