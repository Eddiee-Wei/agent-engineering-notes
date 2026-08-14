---
title: DeerFlow
description: "DeerFlow 2.0 的 super-agent harness、运行时边界与 1.0→2.0 演进"
last_verified: 2026-08-13
---

# DeerFlow

> 本章锁定 [DeerFlow v2.0.0](https://github.com/bytedance/deer-flow/releases/tag/v2.0.0)（2026-06-25）及对应源码。截至 2026-08-13，官方 Releases 只有这一版 2.0 稳定 release；1.x 保留在 [`main-1.x`](https://github.com/bytedance/deer-flow/tree/main-1.x)。下文不把开发分支提交当作已发布能力。

## 1. 定位：它首先是可运行的 Agent 产品底座

DeerFlow 2.0 是字节跳动开源的 **super-agent harness**：在 LangGraph/LangChain 之上预装 lead agent、sub-agents、长期记忆、Skills、工具发现、Sandbox、文件/Artifact、Gateway、Web UI 和 IM 渠道。官方强调它不再只是让开发者自行拼图的 framework，而是带默认交互和运行环境、同时允许替换部件的应用级 harness。[v2 README](https://github.com/bytedance/deer-flow/tree/v2.0.0#readme)与[后端说明](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/README.md)给出了这一边界。

它的强项是让 Agent 获得一台可操作的虚拟计算机：可以在 Workspace 中读写文件、执行工具、调用检索/MCP、按需加载 Skills、把独立子任务交给 sub-agent，最后交付报告、网页、演示文稿、图像等文件。2.0 的使用范围因此从“深度研究”扩展到研究、编码、内容生产和长时复合任务。

它不是通用分布式任务平台，也没有承诺任意多 Gateway worker 的透明扩展。官方当前部署仍有明确的进程内运行状态和单 worker 限制；这应当是架构选型的前置条件，而不是上线后的调参细节。

## 2. 运行时语义地图

| 工程语义 | DeerFlow 2.0 对应物 | 边界 |
| --- | --- | --- |
| Agent 定义 | lead agent / custom agent + model、middleware、tools、Skills | 基于 LangChain `create_agent`，不是固定研究 DAG |
| Run | Gateway `run_id` 对一次图执行的记录 | 与 `thread_id` 会话不是同一个概念 |
| Session | LangGraph `thread_id` + checkpointer 状态 | Embedded Client 没有 checkpointer 时即使传 thread_id 也仍是无状态多轮 |
| Run State | `ThreadState` | 含 messages、sandbox、artifacts、todos 等工作态 |
| Event | LangGraph `values`、`updates`、`messages` 等投影，经 Gateway 转为 SSE | 流式分片不代表 Run 已完成；Gateway 不支持 `astream_events` 的 `events` mode |
| Memory | LLM 提取的用户/Agent 长期记忆 | 与 thread checkpoint、消息历史分离，默认异步 best-effort 更新 |
| Artifact | Sandbox `outputs` 等路径及 Gateway serving API | 路径记录不是内容寻址的不可变版本库 |
| Child task | lead agent 调 `task()` 启动 sub-agent | 当前执行器与结果表是进程内结构，不是持久化分布式任务系统 |

模型负责决定是否规划、调用工具、澄清或委托；runtime/middleware 负责工具配对、循环检测、并发上限、Sandbox 获取、状态 reducer、持久化、取消和安全终止。把这两层分开，才能判断“智能决策”和“确定性保证”各自在哪里生效。

## 3. 整体架构与请求路径

v2 的默认拓扑是：

```text
Browser / IM / Python Client
          |
        Nginx
          |
  FastAPI Gateway :8001
    |  /api/langgraph/* -> Gateway 原生 LangGraph-compatible routes
    |  /api/*           -> models / skills / memory / artifacts / uploads ...
    |
  embedded lead_agent runtime
    |- LangGraph checkpointer
    |- RunManager + RunStore + RunEventStore
    |- StreamBridge -> SSE
    |- Sandbox provider / provisioner
    `- Subagent executor
```

官方[架构文档](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/docs/ARCHITECTURE.md)明确：Agent runtime 嵌在 Gateway 中，Nginx 把 `/api/langgraph/*` 重写到 Gateway 的兼容 API；默认不另起一个 LangGraph Server。仓库保留 `langgraph.json` 是为了 Studio/工具或直接 LangGraph Server 兼容，不是 Docker/脚本的默认生产入口。

这也解释了并发限制：Gateway 不只是无状态 HTTP 转发，它拥有 `RunManager`、`StreamBridge`、活动 asyncio task、断线订阅和取消所有权。

## 4. 核心抽象与 middleware chain

### 4.1 Lead Agent

lead agent 是统一入口，由 [`make_lead_agent`](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/agents/lead_agent/agent.py) 构建。它使用 LangChain `create_agent`，将模型、工具、`ThreadState` 与一组 middleware 组合为 LangGraph。默认系统不是“planner 节点后固定接 researcher 节点”，而是在一条通用 Agent loop 中动态选择规划、工具、Skill 与 sub-agent。

### 4.2 Middleware 是 harness 的控制骨架

当前链路包含或按配置加入：动态上下文、Sandbox、Skill 激活、摘要、Todo/Plan mode、Token usage、标题、Memory、视觉内容、延迟工具发现、sub-agent 上限、循环检测、模型安全终止、澄清、guardrails，以及工具错误/悬空 tool-call 修复等。实际顺序和条件以 [`build_middlewares`](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/agents/lead_agent/agent.py) 为准。

这些 middleware 解决的是运行时不变量：例如同一 tool call 必须有匹配结果、超大工具输出应外置到 Sandbox、循环必须有上限、澄清应终止当前运行。把它们只理解为“prompt 插件”会低估其控制作用。

### 4.3 Plan mode

Plan mode 是按请求启用的 `TodoListMiddleware`，向 Agent 暴露 `write_todos`，状态为 pending/in_progress/completed；官方[使用说明](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/docs/plan_mode_usage.md)显示其默认关闭。Todo 有助于模型维护步骤，但它不是具备依赖、租约、验收证据和 durable child-task 状态机的完整任务调度器。

## 5. Runtime 与事件循环

一次 Gateway run 的关键路径是：

```text
鉴权/线程所有权 -> RunManager.create(pending) 并写 RunStore
  -> 后台 asyncio task 执行 graph.astream(...)
  -> lead agent: model -> tools/subagents -> model ...
  -> checkpointer 保存 thread state
  -> RunJournal 记录 message/trace/lifecycle 与 token usage
  -> StreamBridge 发布 values / updates / messages-tuple / custom / end
  -> 更新 RunStore 为 success/error/timeout/interrupted
```

[`worker.py`](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/runtime/runs/worker.py)使用 `graph.astream` 同时取得完整状态快照、节点写入与消息流。它明确说明 Gateway 不提供 `events` stream mode，因为 Python 公共 API 的 `astream_events()` 无法同时给出该实现需要的 `values` 快照。API 消费者应只依赖公开支持的 stream mode，不要把 LangGraph 的每种底层事件都假设为 Gateway 契约。

断开连接可以配置 cancel 或 continue；Run 终态为 pending、running、success、error、timeout、interrupted。Event/SSE 适合 UI 增量更新，RunStore 适合生命周期与历史，RunEventStore/trace 适合审计诊断；三者不能互相代替。

## 6. State、Session、Memory 与 Artifact

### 6.1 `ThreadState`

[`ThreadState`](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/agents/thread_state.py)扩展 LangChain `AgentState`，除 messages 外还有 sandbox、thread data、title、artifacts、todos、uploaded files、viewed images 和延迟工具 promotions。字段通过 reducer 合并；尤其 sandbox reducer 只接受相同 `sandbox_id` 的幂等写，若同一线程出现两个不同 ID 就直接报错，而不是静默选择一个。这是把隔离不变量写进状态合并逻辑的好例子。

### 6.2 Checkpointer 才决定多轮是否可恢复

配置支持 memory、SQLite、PostgreSQL checkpointer；未配置时 Gateway/工厂可回退到 in-memory saver。[异步 provider](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/runtime/checkpointer/async_provider.py)负责建立相应后端。Memory saver 随进程消失，SQLite 更适合单机，PostgreSQL 才是共享持久化的候选，但仍需自行运维连接池、迁移、备份与容量。

Embedded [`DeerFlowClient`](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/client.py)也明确声明：构造时不传 checkpointer，则每次 `chat()`/`stream()` 都是无状态调用；`thread_id` 只用于文件隔离。不能因为 ID 相同就假设对话历史自动存在。

### 6.3 长期 Memory

Memory middleware 在 Agent 完成后筛选用户输入和最终回复，按 thread/user/agent 加入带 debounce 的队列，再由 LLM 异步提取个人上下文、事实和长期背景。默认 `FileMemoryStorage` 以用户/Agent 作用域保存 JSON，支持替换自定义 storage class；源码见 [`memory_middleware.py`](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/agents/middlewares/memory_middleware.py)与 [`storage.py`](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/agents/memory/storage.py)。

这个更新是 best-effort：队列与 timer 在进程内，源码明确指出 daemon 异步 flush 可能在进程退出时丢失。它适合作为可修正的个性化上下文，不应作为订单、审批或合规事实的唯一记录。

### 6.4 Workspace 与 Artifact

虚拟路径约定包括 `/mnt/user-data/workspace`、`uploads`、`outputs` 和 `/mnt/skills`。Artifact state 保存生成路径，Gateway 提供下载/展示 API；超大工具结果也可外置为文件。若业务需要不可变版本、内容 hash、血缘、保留策略或对象存储灾备，应在这些路径之上再构建 artifact service。

## 7. Model、Tool、Skills 与 Sandbox

### 7.1 Model

Model factory 通过配置的 class path 和参数创建 LangChain chat model，并支持 OpenAI-compatible provider 以及项目适配器。官方建议使用长上下文、可靠 tool use、推理和按需多模态模型；这是能力偏好，不是对所有兼容 API 行为一致的承诺。结构化输出、thinking block、stream usage、tool-call 参数都应在目标 provider 上做契约测试。

### 7.2 Tool 与渐进式 Skills

工具来源包括 Sandbox 文件/命令、Web 搜索抓取、MCP、社区工具和内置控制工具。延迟工具发现只先暴露小目录，模型按需 promotion，避免把全部 schema 常驻上下文。

Skill 是带 `SKILL.md` 的结构化流程；基础 prompt 先放元数据，内容按需加载，可区分 public/custom，也可由用户显式 `/skill-name` 激活。v2.0.0 release 特别修复了 `allowed-tools` 元数据的强制执行，说明工具白名单是 runtime 约束而非只靠文字提示。[Skills 说明](https://github.com/bytedance/deer-flow/tree/v2.0.0#skills--tools)给出了加载与虚拟路径。

### 7.3 Sandbox 边界

后端提供 Local 与 AIO/Docker，并可通过 provisioner 使用 Kubernetes Pod。AIO provider 才把 shell 放进容器；Local provider 的文件工具映射到宿主机线程目录，host bash 默认禁用，因为它不是安全隔离边界。[后端 README](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/README.md#sandbox-system)对此有明确说明。

即便使用容器，镜像、网络、挂载、Docker socket、凭据、Pod security、资源 limit 和回收仍由部署负责。v2.0.0 已将宿主 Docker socket 限制在明确的 DooD 模式，并默认不挂载宿主 CLI 认证目录，但这不是对所有自定义镜像和扩展工具的自动安全证明。

## 8. Sub-Agent 与工作流

lead agent 通过 `task()` 动态拉起 sub-agent。每个 sub-agent 有独立系统上下文、工具过滤、Skill 选择、模型、迭代上限和超时，默认不允许继续调用 `task` 或向用户澄清；结果回到 lead agent 汇总。源码创建子图时显式 `checkpointer=False`，避免把子 Agent checkpoint 混入父线程；[v2.0.0 changelog](https://github.com/bytedance/deer-flow/blob/v2.0.0/CHANGELOG.md)也记录了这项隔离修复。

当前并发实现必须准确理解：

- lead agent middleware 默认限制一条模型响应最多保留 3 个 `task` 调用，可配置；
- sub-agent scheduler 是进程内 `ThreadPoolExecutor(max_workers=3)`，并复用专用持久 event loop；
- built-in general-purpose 与 bash Agent 有各自最大轮次，默认全局 sub-agent 超时为 30 分钟，可覆盖；
- 活动结果保存在进程内 `_background_tasks`；sub-agent 自身不使用持久 checkpointer。

这些事实可在 [`subagent_limit_middleware.py`](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/agents/middlewares/subagent_limit_middleware.py)、[`executor.py`](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/subagents/executor.py)和[`subagents_config.py`](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/config/subagents_config.py)验证。

因此，sub-agent fan-out 是**单进程内受限并行委托**，不是 durable distributed child-task。Gateway 崩溃后，父 Run 历史可能从持久存储恢复，但进行中的子任务不会因为 `_background_tasks` 字典而跨进程续跑。关键业务需要把子任务提升为带 lease、heartbeat、Attempt 和幂等键的外部任务。

## 9. Persistence、恢复与 HITL

### 9.1 三种持久化不要混为一谈

1. **LangGraph checkpointer**：保存 ThreadState 和节点级 checkpoint，可用于线程继续/回滚。
2. **RunStore**：保存 run 元数据、状态、token 和摘要，支持 Gateway 重启后查询历史。
3. **RunEventStore**：保存 message、trace、lifecycle，可选 memory、DB 或 JSONL 实现。

[`RunManager`](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/runtime/runs/manager.py)仍维护活动 task/abort event 等进程内记录，同时可从 RunStore hydrate 只读历史。v2.0.0 修复包括重启后恢复历史 run、checkpoint rollback 覆盖更新 checkpoint、持久化 run summary 和 interrupted 状态。

### 9.2 取消与恢复的所有权限制

v2.0.0 的 breaking change 明确规定：cancel/multitask 需要当前拥有 run 的 worker 上存在可工作的 RunStore；跨 worker cancel 返回 HTTP 409，而不是假装成功。持久化一条 run row 并不能让另一个进程控制原进程的 asyncio task。

### 9.3 澄清与人在回路

当模型调用 `ask_clarification`，[`ClarificationMiddleware`](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/agents/middlewares/clarification_middleware.py)确定性地产生带稳定 ID 的 ToolMessage，并返回 `Command(goto=END)` 结束当前图运行。用户下一条消息在同一 thread 上继续。因此它实现了产品层的“暂停等待用户”，但不是把任意 Python 调用栈冻结在内存里；可恢复上下文取决于 checkpointer 已成功持久化。

外部有副作用的工具同样需要幂等与对账。Checkpoint 能恢复图状态，不能自动撤回已经发送的邮件或重复执行到一半的第三方操作。

## 10. Deployment、Observability、Evaluation 与 Safety

### 10.1 部署

官方默认提供 Nginx + Gateway + Frontend，可把 database 与 Sandbox provisioner 放到独立层，也可使用进程内 Python Client。数据库 schema 由 Alembic 管理；PostgreSQL extra 同时覆盖 store/checkpointer 依赖。部署前要确认配置 reload 边界、运行目录、上传/Artifact 存储和 Sandbox 生命周期。

### 10.2 可观测

DeerFlow 可同时挂载 LangSmith 与 Langfuse callback，根图下面收纳 model/tool/middleware/sub-agent span；`thread_id`/`user_id` 被传播，sub-agent token usage 归因回父 Run，token tracking 默认开启。RunJournal 还把回调规范化为 message/trace/lifecycle event。双 provider 能力见[后端 tracing 文档](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/README.md#langsmith-tracing)。

### 10.3 Evaluation

1.x 曾加入面向报告质量的 evaluation UI/module，但 2.0 是无代码继承的重写。v2.0.0 仓库有 replay E2E golden fixtures、单元/集成测试以及个别 Skill 自带 eval 脚本，却没有一个可与完整通用评测平台等同的稳定核心 API。生产项目应基于真实任务契约建立数据集、工具轨迹检查、Artifact 验收、引用正确性和回归阈值，并用 trace/replay 定位失败；不要把“有 tracing”当成“已评估质量”。[Replay E2E 文档](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/docs/REPLAY_E2E.md)是当前官方测试入口之一。

### 10.4 Safety

官方[安全声明](https://github.com/bytedance/deer-flow/tree/v2.0.0#%EF%B8%8F-security-notice)强调 DeerFlow 具有命令、文件和业务操作等高权限，默认面向仅 `127.0.0.1` 可达的本地可信环境；跨设备或公网部署必须使用反向代理认证/IP allowlist、专用 VLAN/网络隔离并及时升级。

v2.0.0 还加入/修复了线程 ownership、跨站认证 POST、上传 symlink、skill archive 解压上限、MCP 敏感值遮蔽、用户级 PVC/Memory/IM 文件隔离，以及生成 HTML/SVG 强制下载以降低 XSS 风险。自定义 MCP、Skill、镜像与工具仍是新的供应链和权限边界，必须审查。

## 11. 高并发与超多请求：官方限制与工程扩展

### 11.1 最重要的当前事实：Gateway 默认单 worker

[v2.0.0 release](https://github.com/bytedance/deer-flow/releases/tag/v2.0.0)明确写明 Docker Gateway 默认单 worker，用于防止 multi-worker breakage。README 进一步说明：`RunManager` 与 stream bridge 在进程内，当前没有共享跨 worker stream bridge；在 Nginx 无 sticky session 时提高 `GATEWAY_WORKERS` 会破坏 run cancel、SSE reconnect、请求去重和 IM channels。因此官方建议当前不要靠增加同一 Gateway 的 worker 数横向扩展，而应先纵向给单 worker 增加资源，或把数据库/Sandbox 拆到独立层。[部署原文](https://github.com/bytedance/deer-flow/blob/v2.0.0/README.md#docker-production-deployment)

这意味着：FastAPI 是 async、sub-agent 能并行、checkpointer 可用 PostgreSQL，都不能推出“Gateway 已支持透明多 worker”。它们解决不同层次的问题。

### 11.2 单 worker 内仍可并发，但有共享瓶颈

不同 Run 可以形成多个 asyncio task，模型/HTTP I/O 可让出 event loop；单 Run 内最多若干 sub-agent 并行。但 Python event loop、进程内 scheduler、StreamBridge、模型配额、数据库池、SQLite 写锁、文件 I/O、Sandbox 创建和 SSE 长连接都会形成上限。官方还专门加入 blocking-I/O detector、把部分文件/上传/ready polling 移出 event loop，这证明阻塞调用会影响所有并发 handler，而不是 async 关键字自动消除阻塞。

### 11.3 若业务必须继续扩展

以下是基于当前所有权模型的**工程建议，不是 DeerFlow v2.0.0 内置保证**：

| 目标 | 建议扩展 |
| --- | --- |
| 平滑吸收突发请求 | 在 Gateway 前加带租户配额与队列上限的 admission，满载返回可重试状态而不是无限创建 Run |
| 多执行实例 | 先按 tenant/thread 做显式一致性分片与 sticky routing；长期应把 run lease/heartbeat/fencing、cancel topic 和 stream log 外置，消除进程内 owner 假设 |
| Durable child task | 以外部队列保存 Task/Attempt，worker 定期续租；sub-agent 工具只提交任务并读取状态，副作用带幂等键 |
| 状态与事件 | 使用 PostgreSQL checkpointer/RunStore，给 event stream 选择可重放 broker；Artifact 放对象存储，避免共享本地盘假设 |
| Sandbox | 使用外部 provisioner/K8s，做租户资源限额、镜像预热池、出网控制、TTL 回收与审计 |
| 模型与工具 | 每租户/模型/provider 设置 semaphore、速率预算、超时、熔断和重试上限；隔离慢工具池 |
| 运维验证 | 分别压测短聊天、长 SSE、长上下文、sub-agent fan-out、Artifact 与 Sandbox 冷启动，并做 worker kill/断网/限流故障注入 |

在官方共享 stream bridge/跨 worker owner 协议完成前，简单地把多个无状态 Pod 放到随机负载均衡后面并不安全。若采用 sticky shard，也必须设计 shard 故障后的 Run 接管和用户重连，而不能只依赖 cookie 粘性。

## 12. 版本演进：DeerFlow 1.0 → 2.0

### 12.1 1.0：专门化 Deep Research 工作流

官方没有为 1.0 在 GitHub Releases 建立一个可与 v2.0.0 对应的稳定 tag；因此这里不编造“1.0.0 release 日期”，而以官方标记为 1.x 的 [`main-1.x` branch](https://github.com/bytedance/deer-flow/tree/main-1.x)为证据。

1.x 的定位是 Deep Exploration and Efficient Research Flow，核心路径是 coordinator/clarification → planner → researcher/coder team → reporter。它围绕研究计划、Web 搜索/抓取、Python、RAG/MCP、报告引用和后续 podcast/slide 制作展开；用户可以确认或修改研究 plan。它是“为深度研究预先设计的多 Agent graph”。

这一版的好处是任务域明确：计划、研究分工、报告和引用都有专门节点与 UI。边界也清楚：要做通用编码、任意文件工作流或动态 Skills，开发者需要继续改图、节点和 prompt。

### 12.2 2.0：无代码继承的 ground-up rewrite

官方 [v2.0.0 release notes](https://github.com/bytedance/deer-flow/releases/tag/v2.0.0)明确说 2.0 与 1.x **不共享代码**。变化不是换 UI，而是心智模型重置：

| 维度 | 1.x | 2.0 | 新版本收益 |
| --- | --- | --- | --- |
| 产品中心 | Deep Research 流程 | 通用 super-agent harness | 研究、编码、内容/Artifact 可共享同一 runtime |
| 编排 | 固定 coordinator/planner/researcher/reporter 图 | lead agent 动态使用 todo、tool、Skill、sub-agent | 工作方式按请求组合，扩展不必总改主图 |
| 能力封装 | 节点、prompt、专用 agent | 渐进式 Skill + Tool/MCP + middleware | 能力可发现、可白名单、可复用 |
| 执行环境 | 研究工具与代码节点 | 统一 Sandbox 虚拟文件系统 | 文件/命令/Artifact 成为一等工作面 |
| 状态 | LangGraph 研究会话 | ThreadState + checkpointer + Run/Event store + Memory | 对运行、会话、长期记忆和产物分层 |
| 服务 | 研究 Web 应用 | Gateway 嵌入 runtime、LangGraph-compatible API、Embedded Client、IM | 产品接入面更完整 |
| 长任务 | 研究计划驱动 | loop detection、summary、todo、sub-agent、timeout、interrupt | 通用长时任务的运行控制更丰富 |

### 12.3 2.0.0 稳定版相对早期 2.0 里程碑的收口

v2.0.0 milestone 合入大量修复，稳定版尤其强化：

- Run 从 RunStore hydrate，持久化 interrupted；重启后可查看历史；
- rollback/checkpoint、RunJournal、消息 summary 与 token attribution；
- sub-agent 原子终态、父 checkpointer 隔离、默认更长超时、阻塞 I/O 下沉；
- 用户级 Memory、custom-agent 自更新和 IM 连接隔离；
- Skills `allowed-tools`、上传/MCP/Sandbox/Auth 多项安全修复；
- SQL 过滤/索引、RunManager 与内存 event store 索引等热点优化；
- 同时以 Gateway 单 worker 规避尚未解决的跨进程状态断裂。

收益是 2.0 从“功能完整的 RC”走向更可诊断、可恢复、可隔离的稳定基线；但 single-worker 与进程内 sub-agent/stream 所有权也被官方明确暴露，使用者可以据此做真实架构决策。

### 12.4 迁移影响

1.x→2.0 不能当作普通依赖升级：

1. 盘点自定义 planner/researcher/reporter 节点，把稳定流程移成 Skill，把外部能力移成 Tool/MCP，把运行规则移成 middleware/guardrail。
2. 不假设旧 checkpoint、会话表、配置文件、前端事件或报告状态可直接兼容；建立数据导出/只读保留策略。
3. 将原来的“研究 plan 接受”映射到 2.0 todo/clarification/业务审批，补上真正的任务验收字段。
4. 重新选择 Sandbox、checkpointer、RunStore、Memory 与 Artifact 后端，验证用户/线程隔离。
5. 双轨回放代表性研究任务，对引用、工具轨迹、报告 Artifact 与中断恢复做结果级比较，而不是只比最终文本。
6. 生产前按 v2 单 worker 事实重新做容量与故障模型，不沿用 1.x 的部署假设。

## 13. 最小代码

v2.0.0 可通过 Embedded Client 使用同一 Agent factory，而不启动 HTTP 服务：

```python
from deerflow.client import DeerFlowClient

client = DeerFlowClient()  # 省略 checkpointer：每次调用无状态

for event in client.stream(
    "比较两份上传文档，并把结论写到 outputs/report.md",
    thread_id="research-42",
    plan_mode=True,
    subagent_enabled=True,
):
    if event.type == "messages-tuple" and event.data.get("type") == "ai":
        print(event.data.get("content", ""), end="")
    elif event.type == "end":
        print("\nrun finished", event.data.get("usage", {}))
```

若要多轮对话，必须在 `DeerFlowClient(checkpointer=...)` 显式传入 saver；服务端则在 `config.yaml` 配置 memory/SQLite/PostgreSQL checkpointer。生产代码还应处理 tool、custom、error、interrupt 和 Artifact 事件，而不是只拼接 AI 文本。

## 14. 独到优势、适用场景与边界

DeerFlow 2.0 的辨识度来自四件事的组合：**渐进式 Skills、隔离的虚拟文件系统、lead/sub-agent 动态委托、完整 Web/Gateway/IM 产品面**。它很适合需要实际产出文件、跨多步研究与编码、让用户查看进度和产物的“桌面型 Agent”或私有团队助手。

适合：深度研究与有引用报告、代码/数据/演示文稿生成、带上传与 Artifact 的知识工作、需要自定义 Skills/MCP 的个人或团队 Agent。

需要额外工程：公网多租户、高并发横向扩展、强事务副作用、跨进程 durable sub-agent、不可变 Artifact 版本、严格审批链和全面质量评测。当前实现提供许多构件，但不会自动替业务系统完成这些保证。

## 15. 结论

DeerFlow 的 1.0→2.0 是从专用 Deep Research 图到通用 super-agent harness 的重写。2.0 的收益是把 Skills、Sandbox、Memory、sub-agent、Artifact 和产品服务面收进统一运行时；迁移代价是旧图、配置、状态和部署不能假设兼容。当前最关键的生产事实，是 Gateway 活动状态与 stream bridge 仍在进程内、官方默认单 worker。正确使用方式是先接受这一边界，用限流、持久化和外部 Sandbox 提升单实例可靠性；若确需横向扩展，再以共享事件流、run ownership/lease 和 durable queue 做明确架构升级。

## 参考资料

- [DeerFlow v2.0.0 release](https://github.com/bytedance/deer-flow/releases/tag/v2.0.0)
- [DeerFlow v2.0.0 README](https://github.com/bytedance/deer-flow/tree/v2.0.0#readme)
- [DeerFlow v2.0.0 CHANGELOG](https://github.com/bytedance/deer-flow/blob/v2.0.0/CHANGELOG.md)
- [DeerFlow 1.x branch](https://github.com/bytedance/deer-flow/tree/main-1.x)
- [Backend README](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/README.md)
- [Backend Architecture](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/docs/ARCHITECTURE.md)
- [RunManager 源码](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/runtime/runs/manager.py)
- [Subagent Executor 源码](https://github.com/bytedance/deer-flow/blob/v2.0.0/backend/packages/harness/deerflow/subagents/executor.py)
