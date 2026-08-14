---
title: tRPC-Agent-Go
description: "tRPC-Agent-Go v1.11.1 的 Go 原生运行时、Graph、多 Agent 与版本演进"
last_verified: 2026-08-13
---

# tRPC-Agent-Go

> 本章锁定 [tRPC-Agent-Go v1.11.1](https://github.com/trpc-group/trpc-agent-go/releases/tag/v1.11.1)（2026-08-13，commit `03069cd`）及对应源码；截至本章核验日，这是官方最新稳定 tag。`main` 分支仍在开发，以下不把未发布提交当作稳定能力。

## 1. 定位与边界

tRPC-Agent-Go 是腾讯开源、Apache-2.0 许可的 Go 原生 Agent 框架。官方把 LLM Agent、Graph 工作流、工具调用、Session/Memory/Artifact/Knowledge、Multi-Agent、Evaluation 和 OpenTelemetry 放在同一套 Go API 中，并提供 MCP、A2A、AG-UI 与 HTTP 服务适配。[v1.11.1 README](https://github.com/trpc-group/trpc-agent-go/tree/v1.11.1#readme)给出的目标，是让 Agent 进入已有 Go 服务的并发、取消、部署和可观测体系。

这里的“生产框架”应按组件边界理解：

- 它提供 Agent runtime、事件协议、可插拔存储、图执行器和服务端 adapter；
- 它不自动提供跨节点 run ownership、全局同 Session 串行、业务事务、租户鉴权或集群调度；
- Go 的 goroutine/channel、流式返回和外部数据库让扩展更容易实现，但不等于应用已自动水平扩展。

因此，它既适合在 Go 微服务里嵌入一个轻量 Agent，也能承载 Graph、Team 和后台 TaskRun；当系统进入多实例和超多请求阶段，仍要由应用补齐队列、租约、幂等、限流与一致性策略。

## 2. 先统一运行时语义

| 概念 | tRPC-Agent-Go 中的载体 | 不应误解为 |
| --- | --- | --- |
| Agent | `agent.Agent`，核心方法是 `Run(ctx, invocation) (<-chan *event.Event, error)` | 一个固定 ReAct 实现；LLMAgent、GraphAgent 和组合 Agent 都实现它 |
| Run | 一次 `Runner.Run`，由 `RequestID` 控制取消、状态和最终 completion | 一个可跨实例自动接管的 durable job |
| Invocation | 某个 Agent 的一次执行，具有 `InvocationID`、parent 与 branch | 顶层 HTTP request 的同义词 |
| Event | 模型、工具、图、转交、状态变化或 runner completion 的流式信封 | 只有 token delta，或天然等于 trace span |
| Runtime State | `Invocation.RunOptions.RuntimeState` 等本次执行数据 | 会自动跨轮持久化的 Session |
| Session | `AppName/UserID/SessionID` 下的事件、状态与摘要 | 锁、任务队列或完整 Memory 系统 |
| Memory | 跨 Session 检索/写入的长期记忆服务 | 当前对话历史 |
| Checkpoint | Graph 执行状态、pending writes 与 lineage | 普通 Session Event 的别名 |
| Artifact | 具名、可版本化的二进制/文件内容 | Graph State 或聊天消息 |

框架公开 Event 有 `RequestID`、`InvocationID`、`ParentInvocationID`、`ParentMetadata`、`Branch`、`Tag`、`StateDelta` 和 `Extensions` 等字段。[Event 源码](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/event/event.go)中特别说明：父 Agent 并行多次调用同一个 AgentTool 时，只有父 Invocation ID 不足以区分分支，需结合 `ParentMetadata.TriggerID`。

框架没有为所有模型/工具重试统一公开一个跨重试 `AttemptID`。若业务要做计费去重、外部副作用幂等或独立 attempt 审计，应自行携带 request/attempt/idempotency key，不要拿 Event ID 或 Invocation ID 替代全部语义。

## 3. 核心抽象

### 3.1 `Agent` 与 `Invocation`

[`agent.Agent`](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/agent/agent.go)的核心执行签名是 `Run(ctx, invocation) (<-chan *event.Event, error)`，接口另包含 `Tools`、`Info`、`SubAgents` 和 `FindSubAgent`。这一小接口让不同执行模型共享 Runner：

- `LLMAgent` 实现模型—工具循环；
- `GraphAgent` 把显式状态图包装成 Agent；
- Chain、Parallel、Cycle 与 Team 组合多个 Agent；
- 自定义 Agent 可直接发出统一 Event。

[`Invocation`](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/agent/invocation.go)则是一次执行的依赖容器：当前 Agent/模型、Session 与 Session Service、用户消息、Runtime State、Memory/Artifact Service、插件、结构化输出、调用预算、父 Invocation 和 trace capture 都从这里传递。它是 run-scoped context，不应被长期缓存为用户档案。

### 3.2 `Runner` 是应用入口与生命周期协调器

[`Runner`](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/runner/runner.go)负责：获取或创建 Session、附加用户 Event、构造 Invocation、消费 Agent Event、持久化可持久事件、触发 memory/evolution/summary 等收尾逻辑，并发出 `runner.completion`。

扩展接口进一步分开控制能力：

- `ManagedRunner` 以 `RequestID` 查询活动 run、取消 `context`；
- `SteerableRunner` 把新用户消息排队，在完整 `tool_call → tool_response` 之后、下一次模型请求之前插入；
- Agent factory 可按请求/租户动态构造模型、工具和 Sandbox；
- plugins/callbacks 可包围 Agent、Model 与 Tool 生命周期。

这些活动 run 和 steering queue 在默认 Runner 的进程内 map 中。服务重启或请求落到另一实例时，不能只靠 `RequestID` 找回控制权。

## 4. LLMAgent runtime 与 event loop

LLMAgent 的核心循环可以概括为：

1. Runner 载入 Session，写入用户输入并创建 Invocation。
2. flow 汇总 instruction、Session 历史、Runtime State、Memory、Skills 与工具 schema，构造模型请求。
3. 模型按配置流式发出 text/reasoning/tool-call Event；调用预算与 `context.Context` 持续生效。
4. 若有工具调用，processor 校验参数、权限、并发策略和人工/外部执行状态，再执行并形成 tool result Event。
5. 工具结果和 `StateDelta` 进入 Session/下一轮 prompt；若仍需模型判断则回到第 2 步。
6. 得到最终回答、停止条件、错误或取消后，Runner 完成持久化、摘要/记忆等收尾并发出 runner completion。

这不是“模型自由运行到底”。模型决定何时调用哪个已暴露工具、返回什么内容；runtime 决定工具是否获准、何时并发、事件如何落库、何时停止。`MaxLLMCalls`、工具迭代上限、deadline 与取消是工程止损线。[Runner 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/runner.md)和[工具调用 processor](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/internal/flow/processor/functioncall.go)展示了这一分工。

### 4.1 `Done` 不等于整个 Run 结束

一个模型响应或工具相关 Event 的 `Done=true` 只表示该 Event/响应完成，后面仍可能继续工具、子 Agent 或下一轮模型。真正的顶层结束标记是 `event.IsRunnerCompletion()`；消费方也应持续 drain channel，不能在第一条完整 assistant 消息处提前退出。

默认 Runner 不把每个 partial token Event 都当成对话事实持久化，而以非 partial 的完整事件为主。取消时是否保存已输出的 assistant 片段是显式选项；v1.11.1 又修复了取消期间自动摘要结果的处理。这意味着 UI 流、持久 Session 与最终 trace 相关但不相同。

### 4.2 取消与 steering 都是协作式的

取消通过 `context.Context` 下传；模型 provider、Tool 和自定义节点只有正确监听 context 才能及时停下。Steering 也不会破坏进行中的工具协议，而是在安全边界注入新消息。这能避免把用户插话塞进 `tool_call` 与对应 `tool_response` 之间，但不是抢占式线程中断。

## 5. State、Session、Memory、Checkpoint 与 Artifact

### 5.1 四层状态必须分开设计

1. **Runtime/Invocation State**：只服务当前 Run 或节点，适合租户配置、临时变量和调用控制。
2. **Session**：以 `AppName + UserID + SessionID` 定位，保存事件、命名空间 state 与可选 summary，支撑多轮上下文。
3. **Memory**：以用户为中心跨 Session 检索/写入事实，可走自动 extraction、Agentic tools 或外部 memory 服务。
4. **Graph Checkpoint**：保存图 state、next tasks、pending writes、lineage/namespace，支撑精确中断恢复和 time travel。

Artifact 是第五种独立数据：它存文件/二进制，而不是把大文件硬塞进消息或 Graph State。[Artifact API](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/artifact.md)支持 session/user scope、版本列表和按版本读取；当前代码包含内存、COS 与 S3 兼容实现。

### 5.2 Session backend 不等于 Run 调度器

官方 [Session 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/session/index.md)与对应子页提供内存、SQLite、Redis、MySQL、PostgreSQL/pgvector、ClickHouse、MongoDB、TDSQL 等实现。不同 backend 的索引、TTL、摘要、事务与并发语义不同，应按实际包文档验证，不能因为实现了同一接口就假定能力完全一致。

外部 Session backend 解决“数据可被多实例看到”，并不自动解决：

- 同一 Session 两个 Run 的端到端串行；
- 谁拥有活动 Run、谁可取消或 steering；
- 模型—工具—写事件全过程的原子事务；
- 外部工具副作用与 Session commit 的一致提交。

默认 Runner 没有按 Session 建立跨实例全局锁。即使某 backend 的单次 `AppendEvent` 是并发安全的，两个并行 Run 仍可能都基于旧历史推理再交错写入。业务需要按 Session 串行、用 version/CAS 做乐观并发，或明确允许分叉。

### 5.3 Memory 是策略，不只是向量库

[`memory.Service`](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/memory/memory.go)与官方[记忆文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/memory.md)把长期记忆从 Session 中拆开。仓库包含内存、Redis、SQL/向量、Mem0、ChromaDB、TencentDB 等适配，但写入时机、检索质量、冲突合并、遗忘和隐私删除仍是应用策略。自动 extraction 应配评测、用户范围、敏感信息规则和可撤销路径。

## 6. Model、Tool、Skills 与 Workspace

### 6.1 Model

统一 `model.Model` 接口之上已有 OpenAI 兼容、Anthropic、Gemini、Bedrock、Ollama 等 provider 集成，也有 failover、hedge 与 per-call model selector。Hedge 可降低尾延迟风险，但可能增加调用量；selector 能按请求选择模型，但不能替代租户配额与预算控制。结构化输出通过 generation config/Agent 约束返回形状，实际工具调用与 JSON schema 兼容性仍应按 provider 回归。

### 6.2 Tool 与 MCP

函数可以包装为 typed Function Tool；ToolSet 便于动态提供工具集合；MCP 支持 stdio、SSE 与 streamable HTTP；AgentTool 则把另一个 Agent 暴露成工具。[Tool 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/tool.md)还描述了外部/人工执行、权限 policy 和并发元数据。

v1.11 的工具并发控制值得单独理解：

- parallel tool execution 必须显式启用；
- `ConcurrencyConfig` 可限制单 Invocation 最大并发并设置 group；
- 工具可声明自己不是 `ConcurrencySafe`；
- critical failure 可取消同批 sibling tool。

它解决的是单次执行中的有界并发与共享资源保护，不是跨 pod 的全局 semaphore。访问同一账号、同一文件或同一业务实体时，还需要业务 key 级互斥/幂等。

### 6.3 Skills、Workspace 与代码执行

Skills 以 `SKILL.md` 提供渐进式说明和运行入口；v1.11 又增加会话复盘后的异步 skill extraction/evolution，并带质量门、审批、过期和 rollback 能力。将模型产物升级为可复用 Skill 前，应当视作代码/配置变更进行审查。

v1.10 引入的 Workspace facade 把文件、命令与 Artifact 操作统一到代码执行器；当前实现有 local、container、Jupyter、E2B 和 OS sandbox 等路径。[Code Executor 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/codeexecutor.md)说明了接口与限制。Local workspace 只是本机执行，并非隔离；容器或 sandbox 也必须配置文件系统、网络、环境变量、进程和资源权限，不能仅因 backend 名称就视为安全。

## 7. Graph workflow、Checkpoint 与 HITL

GraphAgent 适合把关键路径从“完全由模型临场决定”提升为显式图：

- `StateSchema` 定义 key 与 Reducer，合并并行分支更新；
- Function、LLM、Tools、Agent node 组合确定性逻辑与模型判断；
- conditional edge、fan-out、join、retry、cache 与 timeout 控制执行；
- Event 描述 node、state update、checkpoint、interrupt 和错误。

[Graph 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/graph.md)提供两种 engine：默认 BSP/Pregel 按 plan—execute—update 的 superstep 推进，利于批次级确定性；v1.7 起可选 DAG eager engine，让依赖满足的 node 立即调度，减少不必要的全局 barrier。DAG 并不“更正确”：它的 checkpoint cadence、`MaxSteps` 含义与 timeout 选项不同，依赖 side effect 顺序的图迁移时必须复测。

Checkpoint saver 保存 state、pending writes 和 lineage；SQLite/Redis 等实现可用于恢复。它支持：

- 从特定 checkpoint 继续；
- 读取/编辑状态后生成派生 checkpoint；
- `graph.Interrupt` 等待人工输入；
- static/external interrupt；
- 嵌套 GraphAgent 的 interrupt 向父图传播，再从父 checkpoint 恢复。

HITL 的“恢复”需要同一 lineage/checkpoint/namespace 与匹配的 ResumeMap key。审核记录、审核人身份、审批过期和业务授权仍应在外部系统持久化；Graph interrupt 只提供控制流暂停点。

## 8. Workflow 与 Multi-Agent

### 8.1 确定性组合与模型委托

框架同时提供多种不同语义，选型前要回答“父 Agent 是否等待、谁拥有最终答复、是否需要 run id”：

| 机制 | 语义 | 持久/恢复边界 |
| --- | --- | --- |
| Chain / Parallel / Cycle | 应用预先确定顺序、并行或循环 | 跟随当前 Runner/Session；不是独立任务队列 |
| AgentTool | 父 Agent 同步调用专家，结果作为 tool result 返回 | 子事件可关联父 tool call；父模型仍需接受/整合结果 |
| `transfer_to_agent` | 在当前 Invocation 链中把控制权交给 sub-agent | 是 handoff，不创建后台 run id |
| Coordinator Team | 协调者把任务分给成员并综合 | 可并行调用独立成员，但最终责任在 coordinator |
| Swarm | 成员间连续 handoff，最后活动成员给出结果 | 可限制 handoff；可开启成员独立 Session |
| TaskRun | 在 child Session 启动可查询、等待、取消的后台 run | 默认实现仅单进程；分布式需自建 Controller |

[Multi-Agent 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/multiagent.md)和[Team 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/team.md)详细区分这些路径。v1.10 的 Swarm independent sessions 把非入口成员 transcript 放到稳定派生 Session，减少角色历史相互污染；它只解决历史隔离，不自动延续跨请求 active member，后者需另开 cross-request transfer。

无论哪种委托，child 的“完成”都不等于父任务“已验收”。高风险任务应让父 workflow/业务服务检查结构化输出、证据、权限和副作用状态，再提交最终结果。

### 8.2 TaskRun 的真实 durability

[`agent/taskrun`](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/taskrun.md)定义稳定的 `Controller`、Run/Status、Spawn/List/Wait/Cancel API；内置 `inprocess.Service` 用 goroutine 执行，并提供 MemoryStore/FileStore。官方明确把它定位为测试、本地或单进程产品适配层。

多节点实现应自行提供外部 Store、durable queue、worker lease/heartbeat、跨节点取消和规范化 wire payload。FileStore 能保存状态记录，不会让进程退出后的 goroutine 继续执行；`SpawnRequest` 中任意 Go 对象也不能直接当跨节点协议。

### 8.3 Dynamic Workflow

v1.11 的 Dynamic Workflow 允许模型临时生成 Python 编排代码，通过 bridge 调用已注册 Agent/白名单 Tool，并支持 `parallel`/batch；子 Agent Event 仍回到统一事件流。[Dynamic Workflow 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/dynamic-workflow.md)强调，LocalRunner 不是安全 Sandbox；稳定、强约束流程应写 Go/Graph，临时协作才适合动态代码。

该能力没有事务性：早期分支已修改外部系统、后续分支失败时不会自动回滚。生产使用应采用 Sandbox、显式可调用工具清单、短时凭证、网络/文件限制、并发预算和幂等/补偿流程。

## 9. Persistence、Resume 与恢复边界

tRPC-Agent-Go 有两条不要混用的恢复链：

1. `agent.WithResume(true)` 检查 Session 尾部未完成的工具调用，执行当前 Agent 可解析的工具，再继续 LLMAgent loop；它不是任意 Go 调用栈或所有副作用的重放。
2. Graph checkpoint resume 按 lineage/checkpoint 恢复图 state、pending writes 和中断位置；它不自动证明之前的外部 API 是否只执行一次。

Session 事件、Graph checkpoint、TaskRun 控制记录与 Artifact 应分别设置保留期和一致性规则。要实现 crash-safe 恢复，还需：

- 为有副作用工具设置稳定 operation/idempotency key；
- 在“发出副作用”和“记录完成”之间使用 outbox/inbox、业务事务或可对账状态机；
- 区分 retry、resume 与人工 replay，避免重复扣款/发信/发布；
- 将取消、超时、未知结果和补偿作为一等终态，而不是只保留 success/error。

## 10. Deployment、Observability、Evaluation 与 Safety

### 10.1 服务与协议

框架可通过 AG-UI 接前端、A2A 调远程 Agent、MCP 接工具，也有 OpenAI-compatible 与 [`server/trpcagent`](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/trpcagent.md) HTTP API。后者把当前进程里的 Agent/Runner 暴露为结构与 run 接口；它是 transport adapter，不是分布式调度控制面。

部署时应明确哪些实例持有 Runner 活动状态、SSE/AG-UI 连接和 Workspace。若入口可随机漂移而控制状态仍在内存，cancel、steering 与实时事件续传会失效；可用粘性路由作短期方案，长期则需共享事件总线与 durable run owner。

### 10.2 Observability

官方[可观测文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/observability.md)覆盖 OpenTelemetry trace/metrics，并提供 Jaeger、Prometheus 与 Langfuse 示例。Event、execution trace 与 OTel span 解决不同问题：Event 面向运行时消费，execution trace 汇总 Agent/模型/工具轨迹，span 用于跨服务诊断。生产中应以 `RequestID/InvocationID/Session` 关联它们，同时对 prompt、工具参数、Memory 和 Artifact 元数据做脱敏、采样和访问控制。

### 10.3 Evaluation

[`evaluation`](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/evaluation.md)是一等模块：EvalSet/Case、Metric/Criterion、tool trajectory、final response、LLM Judge、多轮用户模拟、重复运行、execution trace、tool mock 和 PromptIter 都有对应 API。v1.10 加入 PromptIter stage parallelism；v1.11 增加有界 sample parallelism、best-of-N verifier、模板/typed score 与工具描述优化。

这些并行 knob 只提高一次评测作业内部的利用率。评测共享 callback、provider 配额和输出目录必须并发安全；离线分数也应与线上成功率、成本、延迟、人工升级和安全事件共同看待。

### 10.4 Safety

当前可组合的安全构件包括工具 permission policy、命令 allow/deny、调用预算、schema 校验、非并发安全声明、人工/外部工具执行、Workspace/Sandbox 权限以及 MCP/A2A 的认证适配。v1.11.0 release 中曾合入通用 tool safety guard，随后在同一 release 又被官方 revert，因此本章不把它列为当前稳定能力。

应用仍要负责租户认证授权、secret 下发、网络 egress、文件根目录、资源配额、审计留存和高危操作复核。尤其不要把模型生成的 shell/Python、远程 MCP server 或用户上传的 Skill 当作可信代码。

## 11. 高并发与超多请求：真实能力和扩展策略

### 11.1 框架当前能做什么

- 每个 Run 通过 channel 流式交付，并用 context 协作取消；不同 Run 可在一个 Go 进程中并发。
- LLMAgent 可有界并行执行工具；Graph 可 fan-out/join，DAG engine 可减少全局 barrier。
- ParallelAgent/Team 可并发独立成员；Evaluation 也有显式并发上限。
- Redis/SQL Session、Redis/SQLite checkpoint 和对象存储 Artifact 可把数据移出进程。

这些是构建高吞吐服务的构件。官方没有给出适用于任意模型、工具和部署的统一 QPS/并发保证，本章也不引用未经复现的性能数字。

### 11.2 不能由这些构件自动推出什么

- goroutine 很轻，不代表上游模型、DB、MCP 或浏览器资源没有并发上限；
- channel/SSE 是流式传输，不是可重放消息队列；
- Redis Session 让历史共享，不代表同 Session run 自动串行；
- Graph/Tool 并行是进程内调度，不是跨节点 autoscaling；
- Runner 的 cancel/status/steering 默认在本机 map，进程退出即失去活动控制；
- in-process TaskRun 即使使用 FileStore，也不是 durable distributed worker。

### 11.3 面向超多请求的工程扩展

以下是基于上述源码边界的工程方案，不是框架声称的自动能力：

1. **入口与执行解耦**：入口只做鉴权、建 Run、返回 stream token；durable queue 把任务交给带 lease、heartbeat 和 fencing token 的 worker。
2. **按 Session 一致性分区**：对热点 Session 串行/分片，或在事件版本上做 CAS；不同 Session 才无共享地扩展。
3. **外置状态**：Session/Checkpoint 用合适的 Redis/SQL backend，Artifact 用对象存储；Run 元数据、Event log 和业务 outbox 独立建模。
4. **分层并发预算**：tenant、model provider、tool、MCP server、Workspace 和 graph fan-out 各自设置 semaphore、rate limit、deadline、队列长度与熔断。
5. **分布式控制面**：把 cancel、steering、progress 和 event fan-out 放入共享 bus；worker 只接受自己持有 lease 的控制消息。
6. **副作用幂等**：外部工具以业务 operation key 去重，并可查询未知结果、补偿或人工对账。
7. **长连接容量**：单独压测 SSE/AG-UI 连接、慢消费者、buffer、断线续传与负载均衡超时，不只压测普通 HTTP。
8. **按工作负载验证**：分别压测纯聊天、并行工具、Graph、Sandbox、TaskRun 与大 Artifact；观测 p95/p99、取消回收、队列等待、provider 限流和存储冲突。

## 12. 版本演进：从 0.x 到 v1.11.1

tRPC-Agent-Go 没有一个可由官方 tag 证明的“v1.0.0 大重写”断点。仓库中不存在 `v1.0.0` tag，而 `v0.10.0` 与 `v1.1.0` 指向同一个 commit `0452419e`（2025-12-29）。因此更诚实的写法，是把 v1 看成版本成熟度线，并按 release 里程碑追踪架构变化，而不是编造一次 1.0 breaking rewrite。[官方 Releases](https://github.com/trpc-group/trpc-agent-go/releases)保留了这些记录。

| 里程碑 | 主要改变 | 工程收益 | 迁移/验证影响 |
| --- | --- | --- | --- |
| 2025 v0.x → v1.1 | 建立 Runner/Event、LLMAgent、Graph、Session/Memory、工具与多 Agent 基础；`v0.10.0` 和 `v1.1.0` 同 commit | Go API 进入 v1 维护线；升级标签本身不引入代码差异 | 不把 SemVer 标签变化误当实现重写；依赖仍应锁 tag 并跑集成测试 |
| [v1.7.0](https://github.com/trpc-group/trpc-agent-go/releases/tag/v1.7.0)（2026-03-17） | 引入 opt-in DAG engine；增加 SQLite Session/Memory、Redis checkpoint 原子写、图流与性能/trace 改进 | 可对无全局 barrier 需求的图做更细粒度调度；本地持久化和 checkpoint 可靠性增强 | 默认仍是 BSP；DAG 的 checkpoint 时机、step/timeout 语义不同，side effect 顺序要重验 |
| [v1.8.0](https://github.com/trpc-group/trpc-agent-go/releases/tag/v1.8.0)（2026-04-04） | Agent/Graph 指标与 execution trace 增强；Langfuse 链接；评测 rubric/user simulation/hallucination；Session 并发与摘要改进 | 更容易按 Agent/图节点诊断，并把轨迹纳入质量评测 | 指标基数、敏感字段和采样策略要重新审查；数据库 schema/并发回归不可省略 |
| [v1.9.0](https://github.com/trpc-group/trpc-agent-go/releases/tag/v1.9.0)（2026-05-08） | PromptIter、hedge model、Mem0、MySQL vector、远程实验/LLM Judge，以及 A2A Graph interrupt 传递 | 把 prompt 优化、尾延迟策略、长期记忆与远程评测纳入框架 | Hedge 可能增加调用成本；新 Memory backend 与自动 prompt 优化必须做数据/质量门控 |
| [v1.10.0](https://github.com/trpc-group/trpc-agent-go/releases/tag/v1.10.0)（2026-06-05） | flattened graph trace、per-call model selector、Swarm independent sessions、PromptIter stage parallelism、Workspace facade、工具权限/命令策略、TaskRun progress/transcript/worktree | 可观测、模型路由、成员历史隔离、代码工作区和长任务控制面形成一条工程链 | Workspace/TaskRun 的默认实现仍有本机边界；独立成员 Session、权限默认值和评测并行度需显式配置 |
| [v1.11.0](https://github.com/trpc-group/trpc-agent-go/releases/tag/v1.11.0)（2026-08-06） | Dynamic Workflow、Agent evolution、best-of-N verifier、有界评测并行、工具并发组/安全声明、A2A v1、Sandbox/Workspace hardening、ParentMetadata 与更丰富 trace/eval | 临时多 Agent 编排、可演进 Skills、并行分支归因和受控并发明显增强 | 新动态代码路径需 Sandbox/白名单；并行事件必须按 ID 归并；同版已 revert 的 tool safety guard 不能依赖 |
| [v1.11.1](https://github.com/trpc-group/trpc-agent-go/releases/tag/v1.11.1)（2026-08-13） | 修复取消安全的自动摘要、丢弃已取消 summary 结果、AgentTool streaming history 持久化，并减少流式 telemetry 的 state clone | 取消与流式子 Agent 的历史更一致，热路径复制更少 | 属于 v1.11 维护升级；仍应回归取消、摘要、流式 AgentTool 和 telemetry，不把 patch 当容量承诺 |

从旧版升级的推荐顺序是：先锁定 Event/Runner completion 消费契约，再迁 Session/Memory backend；随后分别回放 LLMAgent tools、Graph checkpoint/HITL、Multi-Agent history；最后才开启 DAG、并行工具、Dynamic Workflow 或自动 evolution 等新增能力。这样可以把“兼容性升级”和“架构能力启用”拆成两类变更。

## 13. 最小示例

下面只展示当前 Runner/Event 控制结构，模型名与凭证以所选 provider 为准：

```go
package main

import (
	"context"
	"fmt"
	"log"

	"trpc.group/trpc-go/trpc-agent-go/agent"
	"trpc.group/trpc-go/trpc-agent-go/agent/llmagent"
	"trpc.group/trpc-go/trpc-agent-go/model"
	"trpc.group/trpc-go/trpc-agent-go/model/openai"
	"trpc.group/trpc-go/trpc-agent-go/runner"
)

func main() {
	ctx := context.Background()
	m := openai.New("gpt-4o-mini")
	a := llmagent.New(
		"assistant",
		llmagent.WithModel(m),
		llmagent.WithInstruction("只基于可核验证据回答。"),
		llmagent.WithGenerationConfig(model.GenerationConfig{Stream: true}),
	)

	r := runner.NewRunner("docs-app", a)
	defer r.Close()

	events, err := r.Run(
		ctx,
		"user-42",
		"session-7",
		model.NewUserMessage("总结这份设计的恢复边界"),
		agent.WithRequestID("req-20260813-001"),
	)
	if err != nil {
		log.Fatal(err)
	}

	for e := range events {
		if e.IsRunnerCompletion() {
			fmt.Println("run finished")
			continue
		}
		if e.Response != nil && len(e.Choices) > 0 {
			fmt.Print(e.Choices[0].Delta.Content)
		}
	}
}
```

生产代码还要处理 error、tool/graph/transfer Event、context 取消、partial 与完整消息去重，并使用外部配置注入 Session/Memory/Artifact、模型凭证、权限、预算和 telemetry。

## 14. 独到优势、适用场景与边界

tRPC-Agent-Go 的辨识度在于：以一个很小的 `Agent.Run → Event channel` 契约，把 Go 服务式 Runner、LLM loop、BSP/DAG Graph、AgentTool/Team/TaskRun、可插拔状态后端、协议 adapter、OTel 与 Evaluation 连成同一技术栈。显式的 Request/Invocation/ParentMetadata 又让并行多 Agent 的事件归因比只看文本流更可控。

适合：已有 Go 微服务体系中的业务助手、需要强类型 Tool 与 context 取消的在线 Agent、显式 Graph/HITL 流程、带 MCP/A2A/AG-UI 的平台、多 Agent 协作、需要 trajectory/evaluation 和 OpenTelemetry 的工程团队。

需要额外工程：跨实例 durable run、热点同 Session、一致性敏感的金融/交易副作用、模型生成代码、高隔离多租户、跨节点后台任务与严格合规审计。框架提供接口和构件，但业务必须把运行所有权、授权、幂等、队列、Sandbox 和数据治理落实为自己的系统保证。

## 15. 结论

以 v1.11.1 看，tRPC-Agent-Go 已形成从轻量 LLMAgent 到 Graph、Team、TaskRun、Dynamic Workflow 和 Evaluation 的连续 Go 原生栈。它近几个版本的演进重点也很清晰：v1.7 增加 DAG engine，v1.8 强化观测与评测，v1.9 引入 PromptIter/hedge/新记忆后端，v1.10 补齐 Workspace、独立成员 Session 与长任务控制，v1.11 再加入动态编排、演进、并发治理和更完整的事件归因。

正确的生产判断不是“Go 是否足够快”，而是逐层验证：Runner 活动状态在哪里、同 Session 如何排序、Event 如何完成与归因、Checkpoint 能恢复什么、工具副作用如何幂等、Workspace 是否真正隔离，以及目标 workload 的容量曲线。把这些边界补齐后，框架的强类型、可组合与服务集成优势才能稳定落地。

## 参考资料

- [tRPC-Agent-Go v1.11.1 源码与 README](https://github.com/trpc-group/trpc-agent-go/tree/v1.11.1)
- [官方 Releases](https://github.com/trpc-group/trpc-agent-go/releases)
- [`Agent` 与 `Invocation` 源码](https://github.com/trpc-group/trpc-agent-go/tree/v1.11.1/agent)
- [`Runner` 源码](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/runner/runner.go)
- [`Event` 源码](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/event/event.go)
- [Session 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/session/index.md)
- [Memory 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/memory.md)
- [Graph 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/graph.md)
- [Multi-Agent 与 Team 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/multiagent.md)
- [TaskRun 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/taskrun.md)
- [Dynamic Workflow 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/dynamic-workflow.md)
- [Evaluation 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/evaluation.md)
- [Observability 文档](https://github.com/trpc-group/trpc-agent-go/blob/v1.11.1/docs/mkdocs/zh/observability.md)
