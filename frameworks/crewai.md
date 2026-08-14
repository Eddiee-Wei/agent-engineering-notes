---
title: CrewAI
description: CrewAI 1.x 的 Agent、Task、Crew、Flow、状态恢复与生产扩展边界。
last_verified: 2026-08-13
---

# CrewAI

> 本文以 **2026-08-13** 可核实状态为准。版本锚点是 [CrewAI 1.15.15](https://github.com/crewAIInc/crewAI/releases/tag/1.15.15)（2026-08-12），tag 指向提交 [`28d868c`](https://github.com/crewAIInc/crewAI/commit/28d868c4f4d2e9a17ce00db3444e99b7f41347bb)。

## 一句话定位

CrewAI 是一个 Python 多 Agent 与事件工作流框架：`Agent + Task + Crew + Process` 表达一组角色如何自主完成任务，`Flow` 用普通 Python 方法、事件监听、路由和显式状态表达可控业务流程。两者可以嵌套——让 Crew 处理开放式判断，让 Flow 固定触发、审批、分支和副作用边界。

CrewAI 开源库提供编排、记忆、知识、guardrail、持久化、checkpoint、事件和追踪接入；CrewAI AMP 则是另一个商业管理/部署平面。不要把 AMP 的托管部署能力直接算作开源 Python 进程天然具备的能力。

## 定位与边界

CrewAI 的主要编程面有两类：

- **Crews**：角色驱动。Agent 拥有目标、背景、模型和工具；Task 规定工作与预期输出；Process 决定任务顺序或经理式协调。适合需要模型自行选择步骤、委派和综合的开放任务。
- **Flows**：事件驱动。`@start`、`@listen`、`@router` 把普通 Python 方法组成控制图，并用 Pydantic state 保存结构化状态。适合需要明确路径、可测试分支与人工/系统事件的业务流程。

边界是：框架不会替应用提供完整的身份授权、跨系统事务、持久消息队列、全局调度、公平租户配额或 exactly-once 外部副作用。Task guardrail 能校验输出，不能证明调用者有权执行写操作；checkpoint 能恢复框架状态，不能回滚已经发生的现实世界效果。

## 核心抽象

| 抽象 | 作用 | 关键边界 |
| --- | --- | --- |
| `Agent` | 角色、目标、模型、工具、知识/记忆与模型—工具循环 | 不是独立的授权主体或 durable worker |
| `Task` | 描述、`expected_output`、执行 Agent、上下文、结构化输出、guardrail | 不是只有自然语言标题的“待办项” |
| `Crew` | Agent 与 Task 的运行容器 | 一次 kickoff 仍需独立 Run/Attempt 标识 |
| `Process` | `sequential` 或 `hierarchical` 的 Crew 调度策略 | 不等于任意 DAG |
| `Flow` | start/listen/router 与 Python 代码构成的事件工作流 | 外层显式不代表内嵌 Crew 完全确定 |
| Flow state | Flow 生命周期内的结构化或非结构化共享状态 | 不应存放大型 Artifact 或全部审计事件 |
| `Memory` | 统一保存与召回跨执行知识/偏好 | 不是事实真值库或审计日志 |
| Persistence / Checkpoint | Flow 状态快照或完整运行实体恢复点 | 不包含外部副作用事务 |

[`Agent` 文档](https://docs.crewai.com/v1.15.15/en/concepts/agents)列出模型、工具、delegation、迭代/时间/RPM 上限、cache、reasoning、knowledge 等能力；[`Task` 文档](https://docs.crewai.com/v1.15.15/en/concepts/tasks)则把描述、预期输出、上下文、异步执行、人工输入、JSON/Pydantic 输出、callback 和 guardrail 放在任务契约上。生产中应让 Task 接近本站的 [Task Contract](../docs/04-agent-task-semantics.md)：明确输入、约束、交付物、验收证据与失败语义。

## 运行时与事件循环

### Agent loop

单个 Agent 执行 Task 时，行为可以概括为：

```text
Task 描述 + expected_output + context
  -> 组装角色提示、Memory/Knowledge 与可用工具
  -> 调用 LLM
  -> 若产生 tool call：校验参数、执行工具、把 observation 写回上下文
  -> 继续模型—工具迭代，直到形成答案、达到 max_iter/时间上限或失败
  -> Task guardrail 校验/转换输出；失败可把反馈送回并重试
  -> 生成 TaskOutput / CrewOutput 与事件
```

模型输出工具调用只是候选动作。工具真正执行、返回结果、被 guardrail 接受以及外部系统最终生效是不同事件，审计时应分别保存。`max_iter`、`max_execution_time`、`max_rpm` 是必要的局部护栏，还应有整个 Run 的 deadline、成本预算和取消传播。

Task guardrail 可返回通过后的结果，或以反馈触发重新生成；它适合 schema、引用、质量或业务规则检查。它不应承担用户授权、敏感数据访问控制或外部写入幂等。

### Crew 调度

[`Process` 文档](https://docs.crewai.com/v1.15.15/en/concepts/processes)当前正式枚举是：

- **Sequential**：按任务列表顺序运行，后续 Task 可消费前序输出；
- **Hierarchical**：经理 Agent/模型分配、委派并审查工作。

Task 可设 `async_execution=True` 让可并发的一组任务重叠运行；依赖这些结果的后续同步 Task 会等待。并发 Task 必须避免写同一文件、浏览器会话或业务记录，并为每个分支设置超时和幂等键。Hierarchical 的经理决策属于模型驱动控制流，应记录委派原因、任务输入与验收结果。

### Flow 事件循环

[`Flow` 文档](https://docs.crewai.com/v1.15.15/en/concepts/flows)用装饰器把方法注册进事件图：

- `@start()` 定义入口；满足条件的多个入口可形成并发起点；
- `@listen(method_or_event)` 在上游结果/事件后执行；
- `or_()` / `and_()` 表达任一或全部依赖；
- `@router()` 根据返回标签选择分支；
- `self.state` 在方法之间共享，可用 Pydantic model 约束类型。

Flow 方法可以是普通 Python、直接 LLM 调用，也可以 kickoff 一个 Agent 或 Crew。于是一个运行存在两层循环：Flow 外层由事件图推进，Crew/Agent 内层由模型和工具自主推进。恢复与追踪应同时记录 flow method、crew task、agent/tool event。

如果多个终止分支都可能完成，不要把“最后完成的方法返回值”当成稳定业务汇总；增加显式 join/aggregator，并让其校验必须到齐的分支与版本。

## 状态、会话、记忆与知识

### Flow state

Flow 支持字典式 state，也支持 Pydantic 结构化 state。状态实例带唯一 ID，用于持久化与恢复。建议 state 只保存运行所需的小型结构化字段：业务主键、阶段、分支结果引用、版本和审批状态；大型文档放对象存储，以 URI、hash 和内容类型引用。

不要把一次 Flow 对象并发用于多个用户。每次请求创建独立 Flow 实例；同一持久 state ID 采用单写者、租约或乐观版本，避免两个 Worker 同时推进。

### 统一 Memory

[`Memory` 文档](https://docs.crewai.com/v1.15.15/en/concepts/memory)中的新统一 `Memory` 取代早期 short-term、long-term、entity、external 等并列类型。保存时可由 LLM 分析 scope、类别和重要性；召回综合语义相关度、近期性与重要性。Memory 可按层级 scope 切片，Crew 默认共享，也可为 Agent 单独配置；Flow 可直接 remember/recall。

默认存储使用本地 `.crewai/memory` 下的 LanceDB，也可实现自定义 `StorageBackend`。批量 save 可在后台线程写入，recall 前有读取屏障，Crew 结束时会等待写入排空。这改善单进程体验，但本地目录不是多副本共享数据库，也没有自动解决租户分区、备份、加密、删除和并发写冲突。

Memory 内容可能发送给配置的 LLM做分析或召回整合。敏感数据需要数据分类、最小化、供应商合规和可删除性；召回内容属于上下文证据，不自动成为可信事实。

Knowledge 负责从显式知识源检索内容。Memory、Knowledge、Flow state、运行事件和 Artifact 的生命周期不同，应分库存储和治理，而不是全部塞进 prompt history。

## 工具与模型

Agent 可以分别配置主要 LLM 与 `function_calling_llm`，接收 CrewAI Tool、Python 工具、MCP、Apps/Skills 等能力。工具接口是否易接入，不改变生产执行原则：

1. schema 限制输入形状，server-side 策略验证输入语义；
2. 工具凭据按租户/用户下放，避免把平台超级凭据暴露给模型上下文；
3. 读写工具分开，写工具需要确认、幂等键与最终状态查询；
4. 工具结果返回结构化证据和错误类型；
5. 对 MCP/tool metadata、网页和检索内容统一考虑 prompt injection。

当前 [`Agent` 文档](https://docs.crewai.com/v1.15.15/en/concepts/agents)已将 Agent 上的 `allow_code_execution` / `code_execution_mode` 标为弃用，并说明旧 CodeInterpreterTool 已移除，推荐专用 E2B 或 Modal 沙箱。无论采用哪种执行器，都应限制镜像、网络、文件、CPU/内存、超时与凭据，并把输出当不可信输入处理。

模型可替换不意味着行为等价。要固定 provider/model snapshot、提示、工具 schema、Memory/Knowledge 配置和 CrewAI 版本，用自己的任务集回归委派、工具选择、结构化输出及成本/延迟。

## 工作流与多 Agent 的组合方式

一种可靠的划分是：

```text
Flow（确定性骨架）
  receive_and_validate
  -> Crew（研究、讨论、生成候选方案）
  -> deterministic_guardrail（schema / policy / evidence）
  -> human_feedback（高风险决策）
  -> side_effect_tool（幂等写入）
  -> verify_and_emit_artifact
```

Crew 适合内部存在多个合理步骤、需要角色专长和综合判断的任务；Flow 适合审批、重试、错误分类、路由、通知与副作用。Agent delegation 可让成员自主委派，但要启用明确的终止条件和预算，避免开放式对话无界扩张。

嵌套 Crew 时，把 Flow run ID、Crew kickoff ID、Task 和 tool call 全部关联起来。子 Crew 的自然语言“完成”必须映射为结构化产物和验证证据，外层 Flow 才能安全推进。

## 持久化、恢复与 HITL

### Flow persistence

[`@persist`](https://docs.crewai.com/v1.15.15/en/concepts/flows)可作用于整个 Flow 或单个方法，在步骤后保存 Flow state；默认实现是 SQLite，也可提供自定义 Flow persistence。它适合恢复结构化工作流状态。

当前恢复语义有一个重要迁移点：[Inputs `id` 弃用指南](https://docs.crewai.com/v1.15.15/en/guides/flows/inputs-id-deprecation)说明，过去通过 `inputs={"id": ...}` 沿同一 ID 继续的方式自 1.14.5 起已弃用。`restore_from_state_id` 会读取旧快照、创建**新的 state ID** 再运行，本质是 fork，不是继续向原 lineage 覆盖写入。需要保持同一待审批流程的恢复，应使用专门的 pending/resume API，而不是把 fork 当原地续跑。

### Checkpointing

1.15.15 的 [`Checkpointing`](https://docs.crewai.com/v1.15.15/en/concepts/checkpointing)可配置在 Crew、Flow 或 Agent，并由子组件继承。checkpoint 包含配置、Agent memory/knowledge、Task 进度与中间输出、内部属性、kickoff inputs、事件历史和 lineage；恢复会跳过已完成 Task，fork 则建立新 lineage。

默认在 `task_completed` 事件后写入。内置 `JsonProvider` 一 checkpoint 一文件，`SqliteProvider` 使用 SQLite/WAL；它们适合本地或单节点恢复。事件驱动的自动 checkpoint 是 **best effort**：写失败会记录日志而让运行继续；手动 `state.checkpoint()` / `acheckpoint()` 才会把失败抛给调用者。因此关键任务不能假设“方法返回就一定已有恢复点”，应监控 checkpoint 成功事件并按风险决定是否阻止继续。

Checkpoint 记录框架内状态，但外部邮件、支付、工单、数据库写入不会自动回滚。每个副作用仍要使用业务幂等键、outbox/收据和对账步骤；恢复时先查询外部最终状态，再决定跳过、重试或补偿。

### 人工介入

有两类 HITL：

- Task 的 `human_input=True` 在最终答案前阻塞请求输入，适合本地或短时同步确认；
- Flow 的 [`@human_feedback`](https://docs.crewai.com/v1.15.15/en/learn/human-feedback-in-flows)把反馈建模为流程事件，可按 outcome 路由，也可接入自定义 `HumanFeedbackProvider`。

自定义 provider 可抛出 `HumanFeedbackPending`；Flow 会持久化并让 kickoff 返回 pending。反馈到达后，用 `Flow.from_pending(flow_id)` 加载，再 `resume()` / `resume_async()`。这比长时间占住 Web 请求或 Worker 更适合异步审批。

应用仍必须验证：反馈来自谁、是否有权审批该资源、基于哪个 state/version、是否过期或重复，以及审批后将执行哪些工具。LLM 将自由文本分类成 outcome 是路由辅助，不是权限判定。

## 部署、可观测性、评测与安全

### OSS 与 AMP

开源 CrewAI 可嵌入 API、容器和 Worker，由团队自行提供网关、队列、数据库、密钥和伸缩。官方 [`CrewAI AMP`](https://docs.crewai.com/enterprise/introduction)是托管平台，提供部署、REST API、监控、trace、工具仓库和 webhook streaming 等控制面。选择 AMP 可以减少平台建设，但仍要审查数据边界、网络、身份、供应商限额和业务副作用；选择 OSS 则不能默认拥有 AMP 的调度与扩缩容能力。

### 事件与追踪

CrewAI 有覆盖 Crew、Flow、Task、Agent、LLM、Tool、Memory、Knowledge、MCP、HITL 等的事件总线。v1.15.15 release 新增/完善了 Flow 结果、耗时和 HITL 信号，同时修复边界 hook 中止时的 Flow start event 与 tracer provider 作用域问题。

[`Built-in Tracing`](https://docs.crewai.com/v1.15.15/en/observability/tracing)通过 `tracing=True` 或环境变量将 Crew/Flow 的 Agent 决策、Task 时间线、tool 与 LLM 调用发到 CrewAI AMP；官方也列出多种第三方观测集成。生产 trace 应包含 run/attempt/session/tenant、Flow method、Task、Agent、模型/提示词版本、tool 授权、checkpoint ID 和副作用收据。提示、Memory、tool 参数可能含隐私，上传前应确认脱敏和留存策略。

### 评测

[`crewai test`](https://docs.crewai.com/v1.15.15/en/concepts/testing)可把 Crew 运行多次并用指定模型给 Task/Crew/Agent 打分；当前文档说明 evaluator provider 仅支持 OpenAI。它适合回归趋势，不是上线验收的全部：LLM judge 分数应与确定性 schema/事实检查、工具契约测试、黄金集、恢复/重放、安全策略与人工抽检结合。本文不引用营销或 benchmark 性能数字，因为它们不能代表你的模型、工具和基础设施容量。

### 安全

官方 [`MCP Security`](https://docs.crewai.com/v1.15.15/en/mcp/security)强调只连接完全可信的 server，并列出 tool metadata prompt injection、stdio 任意代码、DNS rebinding、OAuth confused deputy、token passthrough、HTTPS 和 audience 校验等风险。生产控制面还应做到：

- 工具 allow-list 与最小权限，不让 MCP/Agent 自行扩大 scope；
- 代码执行独立沙箱，不继承宿主或云元数据凭据；
- Memory、Knowledge、trace、checkpoint 加密并按租户隔离；
- Task/Flow 输入做内容与资源归属校验；
- 高风险工具设置人工门、幂等与每日/每 Run 限额；
- 依赖和模型版本固定，跟进 release 中的安全依赖更新。

## 并发、超多请求与工程化扩展

[`Async kickoff`](https://docs.crewai.com/v1.15.15/en/learn/kickoff-async)区分了两个容易混淆的接口：

- `akickoff()` 是沿 Task、Memory、Knowledge 等路径的原生 async 执行，适合网络/模型 I/O 并发；
- `kickoff_async()` 是兼容接口，本质上用 `asyncio.to_thread` 包装同步 `kickoff()`，容量受线程池与同步代码约束；
- `akickoff_for_each()` 可并发处理一组 inputs。当前源码会为每个 input 复制 Crew，避免把同一运行状态直接并发复用。

这些能力都不等于水平扩展。单进程 async 共享 CPU、内存、文件系统和本地数据库；Flow/Crew fan-out 会成倍消耗模型与工具配额；默认 LanceDB、SQLite Flow persistence 和本地 JSON/SQLite checkpoint 不能自动成为多副本一致的共享存储。

高请求量下建议：

```text
API gateway / admission control
  -> durable queue（tenant、run、attempt、deadline、idempotency key）
  -> stateless workers（每个 Run 独立 Crew/Flow 实例）
  -> shared production DB / object store / vector store
  -> provider-aware rate limiter + circuit breaker
  -> event/trace pipeline + checkpoint monitor
```

具体策略：

1. 每次 kickoff 使用隔离实例；同一 Flow state ID 只允许一个 owner 推进。
2. 原生 async 任务用 semaphore 限制并发；线程包装接口还要限制线程池与阻塞工具。
3. 按租户、模型、工具分别设置 RPM、并发、token/成本预算；对 Hierarchical/delegation/fan-out 预估放大倍数。
4. 让队列负责重试节奏与死信；框架 Run 内重试和队列 Attempt 必须分别记录，避免乘法重试风暴。
5. 使用共享、具备并发控制和备份能力的持久层；不要让多个 Pod 写同一个本地 SQLite/LanceDB 路径。
6. 所有外部写工具接受幂等键，并能查询/核对最终状态；checkpoint 恢复前先对账。
7. 对 streaming 客户端做背压、断连取消和结果转存；streaming 是输出通道，不是可靠任务队列。
8. 用真实 workload 压测队列时间、尾延迟、限流、memory/checkpoint 冲突、恢复时间和重复副作用，不从 `async` 推导未经验证的 QPS。

CPU 密集工具应送到受控进程池或专用 Worker；长时 HITL 应返回 pending、释放计算资源，待事件到达再恢复。若部署在 AMP，也仍需根据模型/工具配额和业务幂等设计容量，而不是把“托管伸缩”理解为所有依赖无限扩展。

## 独到优势

CrewAI 的鲜明优势是把**角色式自主协作**与**显式事件工作流**作为同一框架中的一等概念。开放式研究、写作和分析可以封装为 Crew；审批、重试、系统集成和副作用则留在 Flow 的 Python 控制图里。使用者能在同一代码库中调整自主性边界，而不必把所有流程都塞进 Agent 对话。

另一个优势是 Task 具有较完整的交付契约：`expected_output`、structured output、context、guardrail、callback 与 HITL 都围绕任务组织。再配合统一 Memory、Flow persistence 和新 checkpoint，可以形成从生成到验证、暂停、恢复和分支探索的连续开发面。

## 适用场景与不适用边界

适合：

- 研究、内容、运营、咨询等角色分工明显的多 Agent 任务；
- 需要 Crew 自主完成开放子任务，同时用 Flow 固定业务主流程；
- Python 团队希望使用 Pydantic state、普通函数和装饰器表达事件工作流；
- 需要 guardrail、统一 Memory、checkpoint、持久 HITL 和丰富事件/追踪接入；
- 愿意自建运行基础设施，或明确选择 AMP 托管面的团队。

需要额外设计或谨慎使用：

- 强事务、资金或不可逆副作用流程，却没有幂等/outbox/对账；
- 只使用本地 LanceDB/SQLite/JSON 就期望多副本一致性；
- 把 `async_execution`、`akickoff` 或 streaming 直接视为水平扩展；
- 要求任意 DAG 的每个边都具备形式化、可重放调度语义，却只用自主 Crew 对话；
- 把 Task guardrail 或模型判断当作权限系统；
- 让代码工具或不可信 MCP server 拥有宿主机与生产凭据。

## 最小示例：Crew 与 Flow 分层

```python
from crewai import Agent, Crew, Process, Task


def build_crew() -> Crew:
    # Agent、Task、Crew 都在每个 Run 内构造，避免并发共享可变运行状态。
    researcher = Agent(
        role="Researcher",
        goal="找出可核实事实并保留来源",
        backstory="你只提交有证据的结论。",
        max_iter=6,
    )
    research = Task(
        description="研究 {topic}；列出事实、来源和未决问题。",
        expected_output="JSON：facts、sources、open_questions",
        agent=researcher,
    )
    return Crew(
        agents=[researcher],
        tasks=[research],
        process=Process.sequential,
    )


async def run_once(topic: str):
    return await build_crew().akickoff(inputs={"topic": topic})
```

把它放进业务 Flow 时，关键控制点应显式出现：

```python
from crewai.flow.flow import Flow, listen, router, start
from pydantic import BaseModel


class ReviewState(BaseModel):
    topic: str = ""
    draft_ref: str | None = None
    approved: bool = False


class ReviewFlow(Flow[ReviewState]):
    @start()
    def validate(self):
        if not self.state.topic.strip():
            raise ValueError("topic is required")
        return self.state.topic

    @listen(validate)
    async def research_with_crew(self, topic: str):
        # 实际应用把产物写对象存储，只在 state 保存引用与 hash。
        result = await build_crew().akickoff(inputs={"topic": topic})
        self.state.draft_ref = persist_artifact(result.raw)
        return self.state.draft_ref

    @router(research_with_crew)
    def quality_gate(self, artifact_ref: str):
        return "needs_human" if requires_review(artifact_ref) else "publish"
```

示例省略了模型/工具配置、HITL provider、checkpoint、身份、限流和幂等；这些是生产实现的一部分，而不是可选装饰。

## 版本与维护状态

- CrewAI 在 [OSS 1.0 GA 公告](https://crewai.com/blog/crewai-oss-1-0---we-are-going-ga)后把 Crew/Flow API 作为稳定主线，并持续扩展 tracing、CLI、MCP/平台集成。公告中的营销规模或性能数字不作为本文工程结论。
- **1.15.15（2026-08-12）** 是截至时间锚的最新稳定 release。该版本增加/完善 Flow outcome、duration、HITL telemetry，并包含 tracing、Flow start event、依赖安全与日期注入等修复。
- 当前功能演进较快，尤其是 checkpoint、Flow persistence/HITL 和弃用项。生产应固定精确版本，保存 checkpoint/state schema 版本，阅读每次 release，并在升级前验证恢复、Memory、事件监听和工具行为。

## 结论

CrewAI 最值得把握的不是“让多个角色聊天”，而是 Crew 与 Flow 的双层运行语义：Agent/Crew 在受预算和工具策略约束的空间里自主求解，Flow 把确定性控制、HITL、恢复和副作用放到可见的事件图中。1.15.15 已提供统一 Memory、Flow persistence、跨 Crew/Flow/Agent checkpoint 和原生 async 等丰富积木；要承载超多请求，仍需外部队列、共享存储、单写者/版本控制、供应商限流、幂等工具与可观测性。异步提高 I/O 利用率，streaming 改善反馈，它们都不能替代分布式可靠性设计。

## 主要官方资料

- [CrewAI 1.15.15 release](https://github.com/crewAIInc/crewAI/releases/tag/1.15.15)
- [Agents](https://docs.crewai.com/v1.15.15/en/concepts/agents)、[Tasks](https://docs.crewai.com/v1.15.15/en/concepts/tasks) 与 [Processes](https://docs.crewai.com/v1.15.15/en/concepts/processes)
- [Flows](https://docs.crewai.com/v1.15.15/en/concepts/flows) 与 [Flow inputs ID deprecation](https://docs.crewai.com/v1.15.15/en/guides/flows/inputs-id-deprecation)
- [Memory](https://docs.crewai.com/v1.15.15/en/concepts/memory) 与 [Checkpointing](https://docs.crewai.com/v1.15.15/en/concepts/checkpointing)
- [Human Feedback in Flows](https://docs.crewai.com/v1.15.15/en/learn/human-feedback-in-flows)
- [Kickoff Crews Asynchronously](https://docs.crewai.com/v1.15.15/en/learn/kickoff-async)
- [CrewAI Tracing](https://docs.crewai.com/v1.15.15/en/observability/tracing) 与 [Testing](https://docs.crewai.com/v1.15.15/en/concepts/testing)
- [MCP Security](https://docs.crewai.com/v1.15.15/en/mcp/security)
- [CrewAI AMP](https://docs.crewai.com/enterprise/introduction)
