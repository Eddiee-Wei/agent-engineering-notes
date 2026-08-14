---
title: Google Agent Development Kit（ADK）
description: Google ADK 多语言 SDK 的 Event Loop、Agent、Workflow、Session、Plugin、恢复机制、部署与高并发生产实践。
last_verified: 2026-08-13
---

# Google Agent Development Kit（ADK）

> 版本快照：Google ADK 不是一个共用版本号的单仓库项目。本文逐一核对各官方仓库的稳定 Release 与对应 Tag，资料截止 2026-08-13；不把开发分支、预发布版本或某一种语言已经拥有的能力泛化到全部 SDK。

| SDK | 当前稳定主线 | 发布日期 | 对应源码提交 | 仍在维护的并行线 |
| --- | --- | --- | --- | --- |
| Python | [`google-adk==2.6.3`](https://github.com/google/adk-python/releases/tag/v2.6.3) | 2026-08-07 | [`0b55dcf`](https://github.com/google/adk-python/tree/0b55dcf9d32e22d4c8b303c3da1c275c135682bf) | 1.x 最新为 [`1.38.0`](https://github.com/google/adk-python/releases/tag/v1.38.0) |
| Go | [`google.golang.org/adk/v2 v2.2.0`](https://github.com/google/adk-go/releases/tag/v2.2.0) | 2026-08-10 | [`b264039`](https://github.com/google/adk-go/tree/b264039aaec43baedc123e5b9a0cf87681d0bbca) | 1.x 最新为 [`v1.6.0`](https://github.com/google/adk-go/releases/tag/v1.6.0)，发布于 2026-08-12 |
| TypeScript | [`@google/adk 1.6.0`](https://github.com/google/adk-js/releases/tag/adk-v1.6.0) | 2026-08-06 | [`72f89b0`](https://github.com/google/adk-js/tree/72f89b0766f0adaae2241367d9dc613dff7e75de) | 无 2.x 主线 |
| Java | [`google-adk 1.7.1`](https://github.com/google/adk-java/releases/tag/v1.7.1) | 2026-08-03 | [`1bcb3de`](https://github.com/google/adk-java/tree/1bcb3de16cdb62d1c22b8d463d14b4eb73ca5332) | 无 2.x 主线 |
| Kotlin | [`google-adk-kotlin 0.7.0`](https://github.com/google/adk-kotlin/releases/tag/v0.7.0) | 2026-08-03 | [`4dec374`](https://github.com/google/adk-kotlin/tree/4dec3747a3e26570c1ffc5fa626271c6fa667625) | 尚未到 1.0 |

这里的“当前稳定主线”按架构世代判断，而不是只按发布日期排序。Go `v1.6.0` 比 `v2.2.0` 晚两天发布，但它是兼容维护线，不是比 v2 更新的主线。类似地，[Kotlin Quickstart](https://adk.dev/get-started/kotlin/)截至核对日仍展示 `0.5.0` 依赖，而官方 Release 已到 `0.7.0`；安装版本应以 Release / Maven Central 和自己的兼容性测试为准，不能只抄文档片段。

Google ADK 最准确的定位是：

> **一族代码优先的 Agent SDK，以 Runner 与 Event Loop 统一 Agent、Tool、状态和外部服务的执行语义，再用 Workflow、Session、Artifact、Memory、Plugin、评测与部署接口把 Agent 做成可测试、可观察、可交付的软件。**

它对 Gemini 与 Google Cloud 集成最深，但模型和部署并不被设计成只能使用 Google：可以接入其他模型、MCP、OpenAPI 与 A2A，也可以部署到 Cloud Run、GKE 或其他容器平台。真正需要警惕的不是“能否换模型”，而是各语言 SDK 的版本和能力并不齐步。

## 先看能力矩阵，而不是把 Python 文档当通用契约

[官方页面](https://adk.dev/)用语言页签和“Supported in”标记能力。以本文版本为基线，几个影响架构的差异如下：

| 能力 | 官方明确支持的语言 | 工程含义 |
| --- | --- | --- |
| Runner Event Loop、Session State | Python、TypeScript、Go、Java、Kotlin | 五种 SDK 共享核心运行模型，方法名和异步类型不同 |
| 2.0 Graph / Dynamic Workflow | Python 2.x、Go 2.x | 不应为 Java、TypeScript、Kotlin 直接照搬 `Workflow` Graph 示例 |
| Sequential / Parallel / Loop 模板 | Python、TypeScript、Go、Java | 仍可用于常见确定性流程；2.0 的 Graph 是更灵活的新选择，不等于模板立刻消失 |
| Workflow Resume | Python、Kotlin | 通过相同 `invocation_id` 恢复；Tool 是 at-least-once |
| Invocation Cancellation | TypeScript | `AbortSignal` 能向 Runner、Model、Tool、Plugin 传播，已提交 Event 不回滚 |
| Ambient Trigger | Python、Go | Pub/Sub / Eventarc 触发、进程内并发阈值和瞬态重试 |
| Standard Live Agent 配置 | Python、TypeScript | Graph Workflow 当前又明确不支持 Live Streaming |

这张表是时间锚，不是永久承诺。升级前应重新检查目标语言页的 Supported 标记、API Reference 和 Release Notes。

## 核心执行模型：Event 是运行时的提交边界

ADK 最值得先理解的不是某个 Agent 构造器，而是 [Runtime Event Loop](https://adk.dev/runtime/event-loop/)：

1. `Runner` 接收用户输入，通过 `SessionService` 把输入纳入当前会话；
2. Runner 调用 Agent / Workflow 的执行逻辑；
3. Agent、Model、Tool 或 Callback 运行到需要对外报告时，产生一个 `Event`；
4. 执行逻辑暂停，Runner 处理 `Event.actions`，调用 Session、Artifact、Memory 等 Service；
5. Event 被提交并向上游流式送出后，执行逻辑才继续；
6. 循环直到当前 Invocation 不再产生 Event。

可以把关键关系压缩为：

```text
Request
  -> Runner
     -> Agent / Workflow / Tool
        -> yield Event(content, actions)
     <- pause
     -> SessionService / ArtifactService / MemoryService commit
  <- stream committed Event
     -> resume execution with committed state
```

这个“yield → Runner commit → resume”顺序不是实现细节。若 Tool 或 Callback 通过 Context 修改 State，变化先进入 `EventActions.state_delta`；只有携带它的 Event 被 Runner 处理后，持久层才得到更新。直接改原始 Session 对象、手工向 `session.events` 追加记录，可能让内存看似变化，却绕过持久化、路由和恢复语义。

### Event 同时承担四种职责

一个 [Event](https://adk.dev/events/)不只是聊天消息：

- `content` 承载文本、多模态内容、Function Call 与 Function Response；
- `author`、`invocation_id`、`id`、`timestamp`、`branch` 标识来源和执行分支；
- `actions.state_delta`、`artifact_delta`、`transfer_to_agent`、`escalate` 等表达副作用和控制；
- 流式 Partial Event 支撑实时 UI，最终 Event 才形成稳定的会话历史。

因此消费 Event Stream 时至少要区分“用于即时显示的 Partial”与“已经成为最终结果或提交记录的 Event”。不能把每个 Token Chunk 都当作一条完成记录，也不能只保存最终文本而丢掉 Tool、Transfer、State Delta 和 Invocation ID，否则审计与恢复信息会被截断。

## 一个最小但真实的 Python 2.x Agent

以下目录可以直接交给 ADK CLI：

```text
order_agent/
├── __init__.py
└── agent.py
```

```python
# order_agent/agent.py
from google.adk import Agent


def lookup_order(order_id: str) -> dict:
    """Return the current status for an order id."""
    # 生产代码应从认证上下文取得租户，而不是相信模型传来的 tenant_id。
    return {"order_id": order_id, "status": "ready_for_pickup"}


root_agent = Agent(
    name="order_support",
    model="gemini-2.5-flash",
    instruction=(
        "Help users check an order. Always call lookup_order when an order id "
        "is present. Never invent an order status."
    ),
    tools=[lookup_order],
)
```

```bash
pip install "google-adk==2.6.3"
export GOOGLE_API_KEY="..."
adk run order_agent
```

普通函数的参数标注与 Docstring 会成为模型可见的 Tool Schema。这个便利也意味着 Schema 是安全边界：不要把 `tenant_id`、角色、数据库连接、访问令牌设计成让模型自由填写的参数；通过 `ToolContext` 或应用认证上下文注入可信身份，并在 Tool 内再次做授权。

开发期也可使用 `adk web`，但 Web UI / InMemory Services 是调试入口，不应被误认为生产认证、持久化和租户隔离方案。

## Agent、Tool 与 Workflow 是三种不同责任

### 1. LLM Agent：推理与 Tool Loop

`LlmAgent` / `Agent` 负责组装 Instruction、Model、Tool、子 Agent、输入输出 Schema 和 Callback。模型决定是否调用 Tool、是否转交另一个 Agent以及怎样生成内容。

ADK 支持普通 Function Tool、内置 Google Tool、OpenAPI Tool、MCP Toolset 和 Agent Tool。外部协议带来复用能力，也带来独立故障域：MCP Server 或远程 A2A Agent 的认证、超时、取消、版本和数据外泄边界必须单独设计。

### 2. 确定性 Workflow：控制流不交给模型猜

模板 Workflow 适合固定形状：

- `SequentialAgent`：按顺序运行子 Agent；
- `ParallelAgent`：并发启动互相独立的分支；
- `LoopAgent`：重复执行到达到条件或上限；
- Custom Agent：用代码实现特定编排。

[Parallel Workflow 文档](https://adk.dev/agents/workflow-agents/parallel-agents/)强调：分支有独立执行 Branch，不自动共享对话历史或可变状态，完成顺序也不确定。正确的 Fan-out / Fan-in 是让每个分支写不同输出，再由显式 Join / Synthesis 步骤合并；若多个分支更新同一 Key 或外部对象，就要自己定义锁、合并规则与冲突策略。

### 3. 2.0 Workflow Runtime：Agent 也成为 Graph Node

[ADK 2.0](https://adk.dev/2.0/)把 Python 和 Go 从层级 Agent Executor 扩展成 Graph Runtime。Function、Tool、LLM Agent、Human Input 和嵌套 Workflow 都能成为 Node，Edge 可表达：

- 顺序链；
- 条件路由；
- Fan-out / Fan-in；
- Loop 与 Retry；
- Human-in-the-Loop 暂停；
- 运行时动态生成的流程。

Python 的最小 Graph 与当前 `v2.6.3` README 一致：

```python
from google.adk import Agent, Workflow

generate_fruit = Agent(
    name="generate_fruit",
    model="gemini-2.5-flash",
    instruction="Return one fruit name and nothing else.",
)

explain_benefit = Agent(
    name="explain_benefit",
    model="gemini-2.5-flash",
    instruction="Explain one health benefit of the fruit from the prior node.",
)

root_agent = Workflow(
    name="fruit_workflow",
    edges=[("START", generate_fruit, explain_benefit)],
)
```

Graph 提高了可预测性，但不是所有运行方式的超集。截至本文时间，[Graph Known Limitations](https://adk.dev/graphs/#known-limitations)仍明确列出不支持 Live Streaming，部分第三方 Integration 也可能不兼容。需要实时双向音视频的 Agent，应先验证普通 Agent / Live Runtime 路径，而不是默认套在 Graph 上。

### 4. 协作与结构化委派

多 Agent 不只有“父 Agent 把全部历史交给子 Agent”一种形态：

- 子 Agent Transfer：把后续会话控制权转给专业 Agent；
- `single_turn`：将专业 Agent 作为一次结构化调用，隔离输入输出；
- `task`：允许委派任务进行多轮工作，再返回结果；
- Agent as Workflow Node：让委派成为确定性流程的一步；
- A2A Remote Agent：把跨服务、跨团队边界显式化。

Python 2.x 的 `task` / `single_turn` 会使用隔离 Branch 保留内部事件，又控制哪些上下文进入父 Agent。它比“把子 Agent 包成一个返回字符串的普通函数”更有审计价值，但它是 Python 当前 API，不能假定其他 SDK 已有完全相同的 Mode 与序列化细节。

## Session、State、Memory、Artifact 不要混成一个“记忆”

| 概念 | 生命周期 | 适合内容 | 关键 Service |
| --- | --- | --- | --- |
| Invocation | 一次用户输入到本轮结束 | 请求级临时变量、Trace 与预算 | Runner / InvocationContext |
| Session | 一条持续的对话线程 | Event 历史与当前会话进度 | SessionService |
| State | Session 关联的结构化 KV | 偏好、步骤、标志、Node 输出 | SessionService |
| Memory | 可检索的跨 Session 知识 | 长期事实、历史摘要、语义检索 | MemoryService |
| Artifact | 命名、版本化的二进制对象 | PDF、图片、音频、数据文件 | ArtifactService |

[State 文档](https://adk.dev/sessions/state/)定义了四种 Key Scope：

| Key 形式 | Scope | 是否跨 Invocation |
| --- | --- | --- |
| `order_status` | 当前 Session | 是，取决于持久 SessionService |
| `user:language` | 同一 App 下的 User | 是 |
| `app:policy_version` | 整个 App | 是 |
| `temp:raw_result` | 当前 Invocation，子 Agent 共享 | 否 |

State Value 必须可序列化。连接池、Client、函数和自定义对象应放依赖容器，通过 ID 在需要时获取。更新应走 Tool / Callback Context，让框架生成 Delta；直接修改底层对象会破坏 Event 作为提交日志的含义。

[Artifact](https://adk.dev/artifacts/)按名称自动分配整数版本，读取时可取 Latest 或指定版本。普通文件名是 Session Scope，`user:` 前缀通常表示 User Scope；但 Go 文档特别注明 Namespacing 取决于 GCS ArtifactService 实现，因此跨语言、跨 Backend 时应验证具体 Provider，而不是把文件名前缀当成强制通用协议。

### 生产 SessionService 与并发写

`InMemorySessionService`、`InMemoryArtifactService` 和内存 Memory 适合测试，进程重启后会丢失，也不能让多个 Replica 共享状态。生产环境应使用数据库或云 Service。

Python [DatabaseSessionService 文档](https://adk.dev/sessions/session/#database-session-service)说明了同一 Session 的两层串行化：

- 进程内 Lock 串行同一 Session 的 `append_event`；
- PostgreSQL、MySQL、MariaDB 使用 `SELECT ... FOR UPDATE` 防止多个 Replica 并发修改同一 Session。

这能防止丢失更新，却也意味着“一个超热 Session”会成为数据库 Hot Partition。水平扩容主要提升不同 Session 的吞吐，不会让同一 Session 的写无限并行。数据库还必须使用异步 Driver；Python v1.22 发生过 Session Schema 变更，升级旧库需要显式 Migration。

## Plugin 与 Callback：全局控制面和局部行为要分开

[Plugin](https://adk.dev/plugins/)注册在 Runner 上，对它管理的全部 Agent、Model 和 Tool 生效；Agent Callback 只绑定某个 Agent。对应 Hook 包括 User Message、Run、Agent、Model、Tool、Event 与 Error。

还有一个容易忽略的顺序：同一 Lifecycle Point 上，Plugin Hook 先于 Agent / Model / Tool Callback；如果 Plugin 返回了替代结果，后续局部 Callback 可能被跳过。因此：

- 认证映射、全局 Policy、日志、指标、缓存、统一 Retry 适合 Plugin；
- 某个 Agent 的 Prompt 调整、结果校验和特定状态变化适合 Callback；
- Plugin 顺序和短路结果必须纳入测试；
- Plugin 能统一执行 Policy，但它本身不是进程、网络或云 IAM 的安全边界。

## Streaming、Live、恢复和取消是四件事

### Streaming

`RunConfig.streaming_mode` 可控制非流式结果或 SSE Partial Event；双向实时路径使用 `run_live()`。应用应该在客户端断开时停止无用工作，并对 Partial / Final Event 分开计数。

### Live

Live Agent 处理持续音频、视频和实时输入，拥有独立的会话恢复、语音活动检测等配置。它与“普通 Agent 的 SSE Token Stream”不同，也与 Graph Workflow 当前能力不同。

### Resume

[Resume](https://adk.dev/runtime/resume/)当前明确支持 Python 与 Kotlin。启用 Resumability 后，通过原 `invocation_id` 恢复；Sequential、Loop、Parallel 会读取已完成步骤，已成功 Tool 的结果可被重新注入。

它提供的是 Durable Progress，不是 Exactly-once：中断点附近的 Tool 至少执行一次，恢复时可能重复。付款、发消息、建工单等 Tool 必须使用业务幂等键和效果查询。停止后还不能先修改 Workflow 定义再恢复旧 Invocation。

### Cancellation

[Cancellation](https://adk.dev/runtime/cancel/)当前明确支持 TypeScript。`AbortSignal` 可向 Runner、Agent、Gemini 请求、AgentTool、MCP Tool 和 Plugin 传播；取消后生成器优雅结束，已提交 Event 保留，尚未 Yield 的 Partial 被丢弃，不做事务回滚。

Go 使用 `context.Context` 承担语言惯用的取消传播，`v2.2.0`又修复了 Workflow 的外部 Context Cancellation；这不等于五种 SDK 已经共享同一个公共 Cancellation API。自定义 Tool 无论使用哪种语言，都应主动向下游传递 Deadline / Cancel Signal。

## 独到优势

### 1. Event 既是 Stream，又是状态和控制的提交协议

很多 Agent 框架把流式输出、状态写入和 Agent Transfer 分成三套机制。ADK 把它们放进 Event / EventActions，并让 Runner 在继续执行前统一处理。这使 UI、Trace、持久化、恢复和多 Agent 路由可以围绕同一条事件线推理。

### 2. 确定性 Workflow 与 LLM Agent 使用同一 Runtime

Graph Node 可以是函数、Tool、Agent、人类输入或嵌套 Workflow。确定性步骤不必伪装成 Prompt，推理步骤也不必逃离 Workflow 引擎；这对既有业务规则又需要模型判断的系统尤其有价值。

### 3. Service 接口让本地开发和生产存储保持同一概念模型

Session、Memory、Artifact 分开建模，并提供内存、数据库和云实现。开发者可以从 InMemory 起步，同时清楚知道持久化替换点在哪里。

### 4. Runner 级 Plugin 适合集中治理

全局 Hook 覆盖 Agent、Model、Tool、Event 和 Error，比逐个 Agent 复制日志、预算和 Policy 更容易保持一致；其短路语义也允许在模型或 Tool 之前拒绝不合规操作。

### 5. 从本地 CLI 到云端事件驱动的交付链较完整

同一 Agent 可用 CLI / Dev UI 调试，作为 REST / SSE 服务运行，接入 MCP / A2A，响应 Pub/Sub / Eventarc，并部署到 [Agent Runtime、Cloud Run、GKE 或其他容器平台](https://adk.dev/deploy/)。这条路径与 Google Cloud 结合紧密，同时仍保留容器化和非 Gemini Model 的出口。

## 高并发与超高请求量

先把四个不同层次的并发拆开：

| 层次 | ADK 机制 | 主要瓶颈 |
| --- | --- | --- |
| 请求间 | Web Worker、Replica、Ambient Trigger Semaphore | Model Quota、连接池、Session DB |
| 单 Invocation 内 | ParallelAgent、Graph Fan-out | 分支数、Token、下游限流 |
| Tool 执行 | Async I/O；Python `ToolThreadPoolConfig` | Blocking I/O、线程数、GIL、外部 API |
| 同一 Session 写 | Session Lock / DB Row Lock | 热 Session 串行化 |

### 1. 用到达率和服务时间做第一版容量估算

若峰值到达率是 `λ` 个 Invocation/s，P95 服务时间是 `W` 秒，则在途并发近似：

```text
C ≈ λ × W
```

若每个 Invocation 平均产生 `q` 次模型调用，模型侧请求率约为 `λ × q`。Parallel Fan-out 会降低单次墙钟时间，却可能把瞬时 Model RPS、Token/s 与数据库写放大数倍。扩容前应同时观察：

- Invocation P50 / P95 / P99；
- 每次 Run 的 LLM Call 数、Token 与 Tool Call 数；
- 分支 Fan-out 宽度；
- Model 429、Tool Timeout、Retry 次数；
- Session Lock 等待与数据库连接池饱和；
- 首 Event 与最终 Event 延迟。

### 2. 把并发上限放在 Runtime 入口，而不是只依赖云平台

[Ambient Trigger](https://adk.dev/runtime/ambient-agents/#concurrency-control)用 Semaphore 在单进程内限流，超过阈值的请求排队。Python `v2.6.3` 默认 10，可用 `ADK_TRIGGER_MAX_CONCURRENT` 调整。这里还存在一个值得上线前核对的文档/版本差异：官网把 Go 默认值也列为 10，但 Go `v2.2.0` 的 [launcher](https://github.com/google/adk-go/blob/b264039aaec43baedc123e5b9a0cf87681d0bbca/cmd/launcher/web/triggers/pubsub/pubsub.go) 与 [Cloud Run deploy Flag](https://github.com/google/adk-go/blob/b264039aaec43baedc123e5b9a0cf87681d0bbca/cmd/adkgo/internal/deploy/cloudrun/cloudrun.go) 实际默认是 100。因此生产部署不要依赖隐含默认值，应显式设置并以所锁版本的 CLI `--help` / 源码为准。这个 Semaphore 是**每进程**的，Replica 增加时聚合并发也会随之放大。

Trigger 还会对 429 等瞬态错误做带 Jitter 的指数退避；耗尽后返回 500，由 Pub/Sub / Eventarc 再投递。每次重投会创建新 Session，所以消费 Tool 仍需用 Event ID / 业务 ID 幂等。Trigger 请求同步等待，官方给出的 Pub/Sub / Eventarc 上限是约 10 分钟；更长任务应改用 Pull Consumer、Cloud Run Job 或 Worker Pool。

普通 REST 服务同样需要入口 Semaphore / Queue、租户配额和拒绝策略。只把 Cloud Run `max-instances` 调大，会把压力直接转移到 Model Quota 与数据库。

### 3. 限制单次 Run 的放大系数

[RunConfig](https://adk.dev/runtime/runconfig/)的 `max_llm_calls` 默认 500；生产环境通常应按业务远低于这个值设置。还要限制：

- Graph 最大 Node / Loop 次数；
- Parallel Branch 数；
- Tool 超时、Retry 和结果大小；
- Context Event 数、压缩阈值和 Artifact 大小；
- 每个租户的 Token、成本和同时运行数。

Python `ToolThreadPoolConfig(max_workers=N)`可让 Blocking I/O Tool 不阻塞 Event Loop，但它对纯 Python CPU 计算受 GIL 限制。CPU 重任务应放进进程池或外部 Worker，而不是无限加线程。

### 4. 水平扩展时把有状态组件外置

可横向扩容的形态应让 API / Runner Replica 尽量无状态，把 Session、Memory、Artifact、幂等记录和 Queue 放入共享 Backend。需要验证：

- 所有 Replica 使用同一个持久 SessionService；
- Session ID、User ID 与 App Name 的租户映射不可由客户端伪造；
- Artifact Backend 的 Scope 与版本语义在目标语言中一致；
- Streaming 经过 Proxy / Load Balancer 时不被缓存或提前断开；
- Replica 被终止时取消信号能传给 Tool 和 Model；
- 同一 Session 的并发 Turn 是拒绝、排队还是串行，产品语义要先定。

Agent Runtime、Cloud Run 与 GKE 能提供计算层自动扩缩容，但不会自动解决 Model 配额、外部 Tool 限流、跨系统事务和 Exactly-once。

## 安全与可靠性清单

1. **身份与授权**：从网关或 Workload Identity 注入 User / Tenant，Tool 在后端按资源再次授权；Prompt 中的“我是管理员”永远不是凭证。
2. **Tool 最小权限**：读写 Tool 分开，参数 Schema 收窄，危险写操作使用确认、幂等键、效果回执和补偿。
3. **Prompt Injection**：网页、文件、Memory、MCP Result 都是不可信输入；模型的 Tool Call 必须经过 Policy，而不是自动获得权限。
4. **远程边界**：MCP、A2A、OpenAPI Tool 都设置认证、Allowlist、TLS、Deadline、Payload 上限和版本固定。
5. **状态隔离**：验证 `app_name` / `user_id` / `session_id` 组合，谨慎使用 `app:`、`user:` 与 User-scoped Artifact，避免跨租户读取。
6. **持久化与重复执行**：所有产生现实副作用的 Tool 按 at-least-once 设计；数据库写用业务唯一键，调用外部 API 保存请求 ID。
7. **Plugin 治理**：集中记录 Policy Decision、Model / Tool 延迟和错误；同时测试多个 Plugin 的顺序、短路和失败策略。
8. **敏感可观测数据**：Trace、Event、Tool 参数和 Artifact 可能含 PII / Secret；默认脱敏、限制 Capture Content，并为审计存储设 TTL。
9. **开发入口隔离**：`adk web`、InMemory Service、开放 API Server 不直接暴露公网；Ambient Trigger 的认证由部署层负责。
10. **资源上限**：限制 LLM Call、Loop、Branch、文件和 Context；对 429 使用有界退避，避免 Retry Storm。

HITL 是业务确认机制，不等于授权系统。即使用户点击“确认”，Tool 仍必须验证该用户是否真的有权执行操作。

## 从 1.x 升级到 2.x

### Python：先迁执行契约，再迁业务

[官方 2.0 Migration](https://adk.dev/2.0/)列出几个会“代码能启动但语义已错”的变化：

1. Event 新增 `node_info` 和 `output`；自定义 Session Table、严格 JSON Schema 和下游 Client 必须先扩字段。
2. `BaseAgent` 成为 `BaseNode`，Graph Engine 可能绕过旧的自定义 `_run_async_impl()` 驱动方式；横切逻辑迁到标准 Callback / Node。
3. 不再手工 `session.events.append(...)` 或直接 Enqueue；Node / Agent 要 Yield Event，让 Runtime 处理路由和持久化。
4. 不要用宽泛 `except Exception` 吞掉可重试错误，更不能捕获 `BaseException` 后不重抛，否则 Retry 和 HITL Interrupt 会失效。
5. 2.0 Session 可由 ADK 1.28+ 读取并忽略附加字段，但早于 1.28 的 Reader 不兼容。

Python 2.0 于 2026-05-19 GA；如果暂时不能迁移，`1.38.0`仍是维护线，但应显式 Pin，不能用无上限依赖让生产跨 Major 自动升级。

### Go：Major 路径本身就是编译期边界

Go 2.0 于 2026-06-30 GA。迁移至少包括：

- Import 从 `google.golang.org/adk` 改为 `google.golang.org/adk/v2`；
- `session.NewEvent` 首参改为 `context.Context`，让时间与 UUID Provider 支撑确定性、可重放 Event；
- 自定义 Agent 驱动逻辑迁到 Graph / 标准 Callback；
- 自定义 Event Storage 接受 `IsolationScope`、`Routes`、`RequestedInput`、`Output`、`NodeInfo` 等新字段；
- ToolContext / CallbackContext 的代码按新的统一 Context 接口回归。

`v2.2.0`又修复了 Workflow 外部 Context Cancellation、Memory Lock、Artifact Version Race、路径穿越与 Live 清理等问题。晚发布的 `v1.6.0`只代表 1.x 兼容线仍受维护。

### Python 2.6、TypeScript 1.6、Java 1.7、Kotlin 0.7

- Python 2.6 系列加入 A2A 每 Invocation 认证、Managed Agent、更多评测 / Judge / Simulation 和生产加固；`2.6.3`本身是很窄的 CLI Sandbox Launcher Deploy 修复，不应把整个系列特性都说成该 Patch 新增。
- TypeScript 1.6 增加 A2A Bearer Auth、Session TTL / ExpireTime、HITL Tool，并修复 Prototype Pollution、路径与 Archive Traversal、Artifact 隔离、MCP Error 等安全问题。
- Java 仍在 1.x API 世代；升级到 `1.7.1`应按 Java Release Notes 与自己的 RxJava / Model / Tool 集成回归，不要套用 Python Graph Migration。
- Kotlin `0.7.0`增加 Vertex AI Session / Memory、Context-aware Tool Filter、Web Server Plugin 等，并修复 Session Event 并发访问；0.x 仍意味着公共 API 稳定性风险高，应精确锁版。

多语言系统最好通过 A2A / HTTP Schema 互操作，而不是共享某个 SDK 的内部 Session Row 或 Event Class。即使字段名称相似，各仓库版本节奏和序列化细节也可能不同。

## 适用判断

Google ADK 很适合：

- 团队需要用 Python、Go、TypeScript、Java 或 Kotlin 以代码管理 Agent；
- 既有 LLM 推理，又有确定性路由、并行、循环、HITL 和 Tool；
- 需要把 Session、Memory、Artifact 与 Event 审计分开；
- 深度使用 Gemini / Google Cloud，同时希望保留其他 Model 和容器部署；
- 需要 MCP、A2A、OpenAPI、Live Agent、评测与云端事件触发的完整交付链。

以下情形需要额外系统或更谨慎的设计：

- 期望五种 SDK 功能和版本完全同步；
- 把 InMemoryRunner / ADK Web 当作生产控制面；
- 要求通用的 Exactly-once 副作用或跨服务事务；
- 一个超热 Session 必须接受大量真正并行的写；
- Graph Workflow 同时必须支持当前尚未兼容的 Live Streaming；
- 没有外部 Queue、数据库、限流和 IAM，却只靠 Runner 自动获得大规模分布式执行。

## 阅读源码时抓住这几条线

版本切换时先 Checkout 本文表格中的精确 Tag，再读对应语言：

### Python `v2.6.3`

1. `src/google/adk/runners.py`：Runner、Event Loop、Run / Live 入口；
2. `src/google/adk/events/`：Event 与 EventActions；
3. `src/google/adk/agents/`：BaseAgent、LlmAgent、Context 与 Task Mode；
4. `src/google/adk/workflow/`：Graph Runtime、Node、Edge、Retry 与 HITL；
5. `src/google/adk/sessions/`、`memory/`、`artifacts/`：Service 与持久化；
6. `src/google/adk/plugins/`：Runner 级 Hook 和内置治理能力。

### Go `v2.2.0`

1. `runner/` 与 `session/`：Invocation、Event、持久化与取消；
2. `agent/` 与 `agent/workflowagent/`：Agent / Graph 适配；
3. `workflow/` 与 `internal/workflowinternal/`：调度、路由和 Join；
4. `plugin/`、`tool/`、`artifact/`、`memory/`：扩展与 Service 边界。

### TypeScript、Java 与 Kotlin

- TypeScript：`core/src/runner/`、`events/`、`sessions/`、`plugins/`、`tools/`；
- Java：`core/src/main/`、`a2a/src/main/` 与 `dev/src/main/`；
- Kotlin：从 `core`、`runner`、`sessions`、`plugins` 和 KSP Tool Processor 入手，并特别关注 JVM / Android 实现差异。

## 结论

Google ADK 最值得借鉴的是把 Agent Runtime 的“事实”收敛到 Event：**Agent 产生 Event，Runner 提交 Action，Service 保存状态，消费者观察同一事件线，Workflow 再用 Node 与 Edge 约束下一步。** 这让流式交互、状态、Tool、多 Agent、恢复和审计不必各自发明一套生命周期。

它的生产价值也建立在清晰边界上：ADK 是多语言 SDK 家族而非单版本产品，2.0 Graph 当前只在 Python / Go，Resume、Cancellation、Ambient、Live 的支持集合各不相同；水平扩缩容依赖外部持久化与部署平台，同一 Session 仍会串行，Tool 仍是 at-least-once。把这些约束写进依赖锁、能力矩阵、容量模型和安全设计后，ADK 才会从“能运行的 Agent Demo”变成可维护的软件系统。

## 主要资料

- [ADK 官方文档](https://adk.dev/)
- [ADK Release Notes 入口](https://adk.dev/release-notes/)
- [Runtime Event Loop](https://adk.dev/runtime/event-loop/)
- [ADK 2.0 与迁移说明](https://adk.dev/2.0/)
- [Graph-based Workflows](https://adk.dev/graphs/)
- [Parallel Template Workflow](https://adk.dev/agents/workflow-agents/parallel-agents/)
- [Session 与 DatabaseSessionService](https://adk.dev/sessions/session/)
- [State Scope](https://adk.dev/sessions/state/)
- [Events](https://adk.dev/events/)
- [Artifacts](https://adk.dev/artifacts/)
- [Plugins](https://adk.dev/plugins/)
- [Runtime Config](https://adk.dev/runtime/runconfig/)
- [Resume](https://adk.dev/runtime/resume/)
- [Cancellation](https://adk.dev/runtime/cancel/)
- [Ambient Agents](https://adk.dev/runtime/ambient-agents/)
- [Deployment](https://adk.dev/deploy/)
- [Python v2.6.3](https://github.com/google/adk-python/releases/tag/v2.6.3)、[Go v2.2.0](https://github.com/google/adk-go/releases/tag/v2.2.0)、[TypeScript 1.6.0](https://github.com/google/adk-js/releases/tag/adk-v1.6.0)、[Java 1.7.1](https://github.com/google/adk-java/releases/tag/v1.7.1)、[Kotlin 0.7.0](https://github.com/google/adk-kotlin/releases/tag/v0.7.0)
