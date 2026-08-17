---
title: "Agent Runtime: How a Run Starts, Progresses, and Ends"
nav_title_zh: Agent Runtime：一次运行如何开始、推进与结束
nav_order: 2
description: 从 Trigger、Activation、Run、Attempt、Step、Event 到暂停、取消与终态，理解一次 Agent 运行如何被激活、推进与结束。
---

# 02｜Agent Runtime：一次运行如何开始、推进与结束

在[从模型调用到 Agent](01-agent-primer.md)中，Agent Runtime 被描述为确定性控制面：它驱动模型与工具之间的循环，处理状态、权限、取消、错误和完成判定。但只知道“Runtime 负责运行 Agent”还不够。真正进入框架源码或生产系统后，很快会遇到一组看似直观、实际并不统一的对象：

- 一次用户提问是一个 Turn，还是一个 Run？
- 一个 Run 里调用了三次模型，究竟有几个 Turn？
- Tool Call、Tool Result 和状态提交分别算 Step 还是 Event？
- 流里已经出现最终文本，Run 为什么仍未完成？
- Session 保存了全部消息，服务重启后为什么仍不能从原位置恢复？
- Cancel、Timeout、Pause、Stop 和 Fail 是否只是不同错误码？

这些问题不是命名洁癖。它们决定取消信号发给谁、预算按什么累计、状态何时提交、事件能否重放、失败后是否可以重试，以及 UI 何时有资格向用户显示“任务完成”。

本文采用一套**框架无关但不假装是行业标准**的词汇，再把它映射到 tRPC-Agent-Go、Google ADK 和 OpenAI Agents SDK。核心判断是：

> **Runtime 不只是包住模型的 `while` 循环，而是一套执行协议：它把概率性的模型决策转换成可标识、可观察、可中断、可恢复，并且具有明确终态的系统行为。**

## 从一个任务看出不同运行边界

继续使用一个具体任务：**修复仓库里失败的测试，并证明修改有效。**

用户此前已经在同一对话中说明了仓库位置和限制。新消息到达后，Runtime 可能经历：

1. 从 Session 加载历史和会话状态；
2. 创建本次执行身份；
3. 调用模型，让它决定先搜索测试还是读取日志；
4. 执行搜索工具并把结果送回模型；
5. 模型生成文件修改，Runtime 在写入前请求审批；
6. 执行暂停，HTTP 请求或事件流可能先结束；
7. 用户批准后，从待审批动作处继续，而不是让模型重新猜一遍；
8. 工具修改文件，随后运行测试；
9. Runtime 根据测试结果验证 Completion Contract；
10. 提交最终状态、发出终态事件、持久化 Session，并关闭事件流。

从用户界面看，这可能只是“一问一答”；从模型看，是多轮生成；从 Runtime 看，是带暂停和恢复的一次逻辑执行；从进程看，恢复前后甚至可能是两次执行尝试；从事件消费者看，则是一串文本、工具、状态和控制事件。

如果把它们全部叫作“对话轮次”，生命周期会立刻失真。

## Run 怎样被激活：Request 只是一个入口

`runner.run(...)` 是代码入口，却不一定是一次 Logical Run 的业务起点。Agent 可以由前台消息、Webhook、领域事件、定时计划或持续任务的唤醒条件触发；同一个 Standing Task 还可能在不同时间产生多个 Run。反过来，一次 HTTP 请求也可能只是在查询、取消或恢复既有 Run，而不是创建新 Run。

```text
Standing Task / Request
        ↓
Trigger → Normalize → Authenticate / Authorize → Deduplicate / Admit
        → Bind Task Contract and Session → Create Logical Run → Acquire Attempt
```

不同入口需要保留不同的触发证据：

| 激活来源 | 创建 Run 前需要固定什么 | 典型风险 |
| --- | --- | --- |
| 用户请求 / 前台消息 | Principal、原始消息、回复目标、Session 与 Task Draft | 客户端断线后 Run 被误取消，或重复发送产生两个 Run |
| Webhook / 领域事件 | Event ID、Source、Subject、发生时间与来源版本 | 至少一次投递造成重复副作用，乱序事件基于旧世界执行 |
| Schedule / Cron | Schedule ID、计划触发时间、时区与 Misfire Policy | 服务恢复后漏跑、补跑过多或同一时刻重复触发 |
| Standing Task / Monitor | Task Contract Version、唤醒条件、检查游标与冷却规则 | 每次轮询都创建工作，旧条件失效后仍继续运行 |
| 远端 Agent / Protocol Task | 调用方身份、上游 Task / Context、回传通道与截止时间 | 上游重试产生重复子任务，取消和终态无法关联 |

可以把这些字段包装成 **Activation Record**。它不是新的万能对象，而是要求 Runtime 在创建 Run 前能够回答：谁因为什么触发了工作、是否已经处理过、绑定哪个任务版本、允许使用什么权限，以及结果应回到哪里。

```python
class ActivationRecord:
    activation_id: str
    trigger_id: str
    trigger_type: str
    source: str
    subject: str | None
    occurred_at: datetime | None
    scheduled_for: datetime | None
    principal_id: str
    task_id: str
    contract_version: int
    session_id: str | None
    capability_ref: str
    reply_to: str | None
    dedupe_key: str
```

`trigger_id` 或幂等键用于识别重复投递；Admission Control 决定当前是否允许启动；Task Contract 决定触发事件究竟只是 Observation，还是足以授权一次新的执行。[CloudEvents](https://github.com/cloudevents/spec/blob/ce@stable/cloudevents/spec.md)要求生产者让同一 `source` 下的 `id` 能唯一标识事件，并允许重发的同一事件沿用 ID，正好为消费端去重提供身份；但去重只防重复激活，不能替代工具副作用的幂等。

### Schedule 与 Standing Task 不是 Run

Schedule 表达“什么时候尝试激活”，Standing Task 表达“长期承诺在什么条件下工作”，Run 才是一次具体因果执行。三者必须拥有不同身份：暂停或完成一次 Run，不会自动删除下一次计划；撤销 Standing Task，则应阻止后续 Trigger 创建新 Run。

定时语义还必须明确：重叠执行是 `Allow`、`Forbid` 还是 `Replace`，错过触发是跳过、只补一次还是逐次补跑，Deadline 和时区怎样解释。[Kubernetes CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)公开暴露并发策略、起始截止时间和时区，也明确提醒调度是近似的，某些情况下可能创建两个 Job 或漏建 Job。因此，事件处理和任务动作都应按可能重复设计，而不是把 Cron 当成 Exactly-once 承诺。

Resume 通常不是再次激活一个新 Run。审批通过、外部结果到达或 Worker 重新取得执行权时，更合理的身份关系是同一 Logical Run 创建新 Attempt，并保留原 Activation、Contract 与已发生 Effect。只有目标、Scope 或任务身份已经改变，才应明确创建 New Run 或 New Task。

[tRPC-Agent-Go 的 OpenClaw Runtime](https://trpc-group.github.io/trpc-agent-go/openclaw-runtime/)把消息入口、Gateway、Cron、Session 与 Runner 组合成长时间运行外壳，也说明了一个重要分层：Trigger 属于运行入口和产品控制面，Runner 承接规范化后的执行；调度能力本身不等于 Agent 决策能力。

## 先建立一套可推理的坐标

可以先用下面的关系建立直觉：

```text
Session
└── Conversation Turn
    └── Logical Run
        ├── Attempt 1
        ├── Attempt 2 after resume
        ├── Agent Invocation(s)
        ├── Model Turn(s)
        ├── Step(s)
        └── Event Stream
```

这不是要求所有框架都实现同一棵对象树，而是一套分析坐标。Graph、并行工具和 Multi-Agent 会让实际执行变成 DAG；关键是不要把不同生命周期压进同一个 ID。父子 Run 怎样被委派、Join、取消并形成团队终态，在 [05｜Multi-Agent](05-multi-agent-collaboration.md) 中继续展开。

| 概念 | 本文定义 | 典型生命周期 | 不应混淆 |
| --- | --- | --- | --- |
| Session | 一段对话或任务上下文的连续性边界 | 分钟到数月，可包含多个 Run | 不是当前正在执行的任务，也不天然是 Checkpoint |
| Conversation Turn | 一次用户输入到一次面向用户结果的交互边界 | 一次前台交互 | 不等于一次模型调用 |
| Logical Run | 围绕一个输入或目标形成的因果执行单元 | 从创建到某个明确终态 | 不等于某个进程、线程或 HTTP 请求 |
| Attempt | Logical Run 的一次具体执行尝试 | 从获得执行权到退出或失去执行权 | Retry/Resume 可以产生新 Attempt，而不必产生新 Run |
| Agent Invocation | 某个 Agent 在 Run 中的一次调用 | 一次 Agent 进入到返回、转交或停止 | 一个 Run 可以调用多个 Agent |
| Model Turn | 一次模型请求与响应 | 一次模型 I/O | 工具执行通常由它触发，但属于 Runtime 行动 |
| Step | 一次具有独立语义的状态转换或调度单元 | 模型决策、工具批次、Handoff、验证等 | 框架对 Step 粒度没有统一标准 |
| Event | 对已发生事实、状态增量或控制信号的带身份记录 | 产生、提交、发布、消费 | 不只是 Token，也不等于 Trace Span |

### Turn 必须带限定词

`Turn` 是最容易造成误解的词。

- 产品层常把“一次用户输入 + 一次可见回复”称为 Conversation Turn。
- Runtime 可能把“一次模型生成，以及由它触发的工具工作”称为 Turn。
- 有些代码又把每次循环、Agent 调用或事件称为 Turn。

为避免歧义，后文统一使用 **Conversation Turn** 和 **Model Turn**。引用框架原生 `turn` 字段或 `max_turns` 时，会明确说明它的计数单位，而不会假设它与用户回合相同。

### Run 与 Attempt 的分离很重要

许多实现只有 `run_id`，但生产系统通常还需要 `attempt_id`。

假设 Run `R42` 在工具写入文件后进程崩溃。调度器重新拉起 Worker：

- 如果创建全新的 Run，原审批、预算和因果链会被切断；
- 如果复用同一个 Attempt，日志和租约又无法区分崩溃前后的执行者；
- 更清晰的做法是保留 `run_id=R42`，创建 `attempt_id=A2`，从可验证的恢复点继续。

Logical Run 表示“这是同一个目标执行”，Attempt 表示“这是该执行的一次物理承载”。这个分离也让最大重试次数、Worker 租约、幂等键和故障归因有了明确挂载点。

## Runtime 实际承诺了什么

框架的 API 可能只暴露 `runner.run(...)`，但一个完整 Runtime 至少要履行七类责任：

1. **规范化激活**：保留 Trigger 身份，去重并执行 Admission；
2. **建立身份与输入边界**：创建 Run / Attempt，装配 Session、工具、策略和预算；
3. **驱动决策与行动**：调用模型、解析候选行动、调度工具并回传 Observation；
4. **执行确定性治理**：校验 Schema、授权、审批、并发和资源限制；
5. **提交并发布事实**：保存状态、回执和进度，向 UI 或上层 Workflow 发出 Event；
6. **处理控制转移**：响应暂停、Steering、取消、超时和外部唤醒；
7. **形成明确终态**：区分完成、受控停止、失败、取消和超时，并清理资源。

一个框架无关的接口可以长成这样：

```python
class RunHandle:
    run_id: str
    session_id: str

    async def events(self) -> AsyncIterator["EventEnvelope"]: ...
    async def cancel(self, mode: str = "cooperative") -> None: ...
    async def snapshot(self) -> "RunSnapshot": ...


class EventEnvelope:
    event_id: str
    run_id: str
    attempt_id: str
    invocation_id: str | None
    step_id: str | None
    sequence: int
    kind: str
    payload: object
    state_delta: dict | None
    causation_id: str | None


RunOutcome = Completed | Paused | Stopped | Failed | Cancelled | TimedOut
```

这些字段不要求原样进入每个 SDK，却揭示了 Runtime 必须回答的问题：

- `correlation` 说明哪些事件属于同一次执行；
- `causation` 说明哪个模型输出、工具调用或审批触发了当前事件；
- `sequence` 说明同一 Run 内如何重建顺序；
- `attempt_id` 说明事件来自哪次实际执行；
- `outcome` 说明“循环不再继续”的业务语义。

只提供一串 Message 而没有这些边界，仍可做 Demo，却很难安全恢复、并发执行或解释失败。

## 生命周期是两套耦合状态机

![Agent Runtime 双层生命周期](../assets/images/agent-runtime-lifecycle.svg)

移动端可打开 [SVG 原图](../assets/images/agent-runtime-lifecycle.svg) 查看细节。

上层是 **Run 执行状态机**：

- `Created`：身份已经分配，但尚未获得执行资源；
- `Running`：Runtime 正在调用模型、执行工具或处理状态；
- `Paused`：Run 尚未结束，正在等待审批、用户输入或外部结果；
- `Resuming`：Runtime 正在校验快照、版本、权限和外部副作用；
- `CancelRequested`：停止意图已发出，但执行栈尚未确认退出；
- `Completed / Failed / Cancelled / TimedOut / Stopped`：语义不同的终态。

下层是 **Event 与状态提交链**：

```text
Produced → Validated → Committed → Published → Consumed
```

两者不能合并成一个布尔值 `done`。例如：

- 模型已经生成最终文本，但 Completion Contract 尚未验证；
- Tool Result Event 已产生，但 Session 写入失败；
- 状态已经提交，但客户端在收到 Event 前断线；
- Run 已 Completed，但终态 Event 仍在队列中；
- 用户已请求 Cancel，但外部工具还没有响应取消信号。

因此，下面五个时刻可能完全不同：

1. 最后一个 Token 到达；
2. 模型生成 Final Response；
3. Runtime 判定 Run 进入终态；
4. 终态与 Session 状态持久化完成；
5. 调用方消费完事件流并完成清理。

> **Streaming 是观察执行的方式，不是定义执行完成的方式。**

### Pause 不是终态，但一次 API 调用可能已经结束

等待审批时，某次 HTTP 请求、协程或异步迭代器可以正常返回；Logical Run 却仍处于 `Paused`。如果系统只记录“请求已结束”，就会误把等待外部输入的任务当成 Completed。

一个有效的 Pause 至少需要：

- 暂停原因与等待对象；
- 待审批或待完成动作的稳定标识；
- 可序列化的继续执行状态；
- 已提交到哪里的明确边界；
- 恢复前必须重新校验的权限与版本。

没有这些信息的“暂停”，实际只是停止并希望下一次模型调用能够猜回原进度。

## Event 不是 Token，也不是 Trace

Token Delta 只是 Event 的一个低层类别。对 Runtime 更重要的是能够表达输出、行动、状态与控制转移的语义事件。

| Event 类别 | 例子 | 是否通常需要持久化 |
| --- | --- | --- |
| 原始模型流 | Token、Response Delta | 通常不逐片持久化 |
| 语义输出 | Message、Final Candidate、结构化结果 | 通常需要 |
| 行动 | Tool Call、Tool Result、Handoff | 涉及副作用时必须可追溯 |
| 状态与控制 | State Delta、Checkpoint、Approval Required、Paused | 通常需要 |
| 终态 | Completed、Failed、Cancelled、TimedOut、Stopped | 必须可追溯 |

一个 `tool_result` 只有 `{result: "ok"}` 还不够。Event Envelope 应通过稳定 ID、Run / Attempt 关联、因果 ID、序号和版本说明它回应哪个行动、属于哪次执行、能否去重和重放。

Event 与 Trace 也不能互换：Event 可能驱动状态提交、审批和上层 Workflow；Trace 是为诊断生成的观测投影。Event 丢失可能改变业务行为，Trace 丢失主要影响排障。

流关闭同样不等于成功。调用方停止消费可能造成背压，却未必自动 Cancel 底层 Run；网络重连还可能产生重复事件。消费者必须读取明确的 Terminal Event 或 Run Outcome，并用 Event ID、游标和幂等消费处理断连。

## 退出循环不等于同一种结果

| 状态 | 是否是 Logical Run 终态 | 能否原地继续 | 已发生副作用 | 典型含义 |
| --- | --- | --- | --- | --- |
| Paused | 否 | 应当可以 | 保留 | 等待审批、用户输入或外部结果 |
| Completed | 是 | 无需 | 已提交 | Completion Contract 已通过 |
| Stopped | 是 | 通常创建新 Run 或显式恢复 | 保留 | 预算耗尽、策略停止或人工终止 |
| Failed | 是 | 取决于 Checkpoint 与错误类型 | 可能部分成功 | Runtime 无法履行执行契约 |
| Cancelled | 是 | 通常不能直接继续 | 不回滚 | Runtime 已确认响应取消 |
| TimedOut | 是 | 视恢复能力而定 | 不确定 | Deadline 到达并结束本次执行 |

停止原因决定后续能否继续，而不只是错误码不同：

- **Cancel** 通常是协作式请求，不是事务回滚。信号应传播到模型请求、工具和子 Agent；即使最终为 `Cancelled`，已经发生的副作用仍需确认或补偿。
- **Timeout** 常借用 Cancellation 机制退出，但应保留 `TimedOut` 原因，以便采用不同的重试、告警和容量策略。
- **Tool Error** 可以成为 Observation、触发重试、暂停或策略停止；只有 Runtime 无法继续履行执行契约时，才应把 Run 标成 `Failed`。

所以退出前至少要分清：哪些行动未开始、哪些已确认完成、哪些结果未知，以及哪些支持补偿。

## Resume、Retry、Replay 和 New Run

| 操作 | 身份关系 | 从哪里继续 | 主要风险 |
| --- | --- | --- | --- |
| Resume | 同一 Logical Run，新 Attempt | Checkpoint 或可序列化 RunState | 快照不完整、版本不兼容 |
| Retry | 同一 Run 的 Step/Attempt，或由策略创建新 Run | 重新执行失败单元 | 重复副作用 |
| Replay | 通常不继续真实执行 | Event Log、Trace 或记录输入 | 重放外部动作会污染环境 |
| New Run with Session History | 新 Logical Run | 历史消息或 Session State | 只能语义接续，不能精确恢复 |

Session 历史能帮助模型“接着聊”，却不能替代 Checkpoint。精确恢复还需要当前控制位置、待处理行动与审批、已提交 Event 游标、预算、Session / Workspace / Artifact 版本，以及 Tool、Graph 和策略指纹。

最危险的状态是外部行动已经受理，但回执尚未提交。新的 Attempt 不能直接假设失败或重放，而应先查询环境，用 Tool Call ID、幂等键或效果回执把结果补成 Observation，再决定继续、补偿或人工介入。更完整的恢复与状态版本问题交给 [03｜Agent 的状态边界](03-agent-state-semantics.md)。

## Run 是执行边界，Session 是连续性边界

Session 通常回答：

- 这是哪个用户、哪个应用下的哪段对话？
- 之前说过什么、发生过哪些事件？
- 当前对话状态是什么？

Run 则回答：

- 这一次要完成什么目标？
- 当前执行到哪里？
- 哪个 Attempt 正在持有执行权？
- 预算、取消、审批和终态属于谁？

| 数据 | 更合适的所有者 |
| --- | --- |
| 对话历史、会话级偏好、跨 Run 的上下文 | Session |
| 当前 Step、待处理 Tool Call、审批、预算、Outcome | Run / RunState |
| Worker 租约、重试次数、当前进程信息 | Attempt |
| 跨 Session 的用户偏好或经验 | Memory / Profile |
| 外部事实与可引用资料 | Knowledge / Store |
| 文件、报告、代码修改等任务产物 | Artifact / Workspace |

Session 可以持久化 Event 和 State，却不因此自动成为 Runtime Checkpoint。相反，一个无对话产品也可以有 Durable Run：例如后台研究任务、定时 Agent 或事件触发的运维 Agent。

同一 Session 的并发 Run 可能都基于旧版本生成结果，随后互相覆盖历史或打乱 Tool Call / Tool Result 邻接关系。实现可以选择单写者、乐观版本、隔离分支或安全边界 Steering；但不能用同一个 `session_id` 同时充当执行身份和并发策略。

## 三个框架怎样映射这些概念

以下比较锁定到 2026-07-30 检查的官方资料与源码：tRPC-Agent-Go [`4b64469`](https://github.com/trpc-group/trpc-agent-go/tree/4b644694756e63de58cafbf18fec3c4634b42b11)、Google ADK Python [`2c6a7ff`](https://github.com/google/adk-python/tree/2c6a7ffb4a8f46e2bf94359290476a2664ddf8b6)、OpenAI Agents SDK Python [`992abf7`](https://github.com/openai/openai-agents-python/tree/992abf763d24881bab55663de6a93cf58f1c6118)。它比较的是语义位置，不表示类型可以直接互换。

| 问题 | tRPC-Agent-Go | Google ADK Python | OpenAI Agents SDK Python |
| --- | --- | --- | --- |
| 根执行入口 | 每次 `Runner.Run` 是一个 Run | `runner.run_async()` 处理一次 Invocation | 每次 `Runner.run*()` 驱动一个 Agent Run |
| 根身份 | `RequestID` 是 Run 控制 ID；`InvocationID` 标识 Agent 调用，并支持父子关系 | `invocation_id` 关联一次用户消息到最终响应及其全部 Event | Run 主要由调用、`RunResult` / `RunState` 表达；Trace ID / Group ID 另做观测关联 |
| Session | 持有 State、Events、Summary 等 | 持有有序 Events 与 Session State | `Session` 协议管理跨 Run 的输入/输出历史；也可选择服务端 Conversation 状态 |
| Turn / Step | 文档使用 Assistant Round；内部安全边界围绕一次模型输出及完整 Tool Batch | 明确定义 Step：一次 LLM 调用及它请求的工具，工具总结会形成下一 Step | `max_turns` 中一个 Turn 是一次 AI Invocation，包括相应 Tool Calls |
| Event | `event.Event` 携带 Request/Invocation、Response、StateDelta、Actions；Runner Completion 是统一终止信号 | `Event` 携带内容、Actions 和 `invocation_id`；非 Partial Event 可作为状态提交边界 | 同时提供原始 Response Event、语义 Run Item Event 与 Agent Updated Event |
| Pause / Resume | 支持等待用户回复、运行控制和安全边界 Steering；跨进程恢复能力需看具体 Agent/Graph/Task Runtime | Resumability 需显式启用；可按原 `invocation_id` 恢复，Custom Agent 需自行支持 | 审批产生 `interruptions`；`RunState` 保存当前 Step 后可审批并继续 |
| Cancel | Context 或 `ManagedRunner.Cancel(requestID)`，依赖各层协作响应 | 部分语言使用 AbortSignal；已提交 Event 不回滚 | Streaming Result 支持立即取消或完成当前 Turn 后取消 |
| 完成信号 | `IsRunnerCompletion()` 是消费整个 Run Event Stream 的统一信号 | Event Generator 结束，应用需识别 Final Response；Partial Event 不代表完成 | 非流式返回 `RunResult`；流式需消费完 `stream_events()`，再读取完整结果 |

表中最值得带走的不是类型名，而是三个差异：tRPC-Agent-Go 把 Run 控制身份与父子 Agent Invocation 分开；Google ADK 让非 Partial Event 参与执行逻辑与状态提交之间的协议；OpenAI Agents SDK 的一次用户逻辑回合内部还会经历多个模型 Turn，并可在审批中断后从 `RunState` 继续。

因此，看到“支持 Session、Streaming、Resume”还不够。仍要追问 ID 的作用域、Turn / Step 的边界、哪些 Event 会提交、Pause 保存什么、Cancel 传播到哪里，以及最终文本、Run 终态和流关闭分别由什么表示。

## 阅读或设计 Runtime 时的检查清单

面对任何 Agent Framework，可以先问十个问题：

1. Run 由 Request、Event、Schedule 还是 Standing Task 激活，重复触发怎样去重？
2. 根执行由哪个 API 创建，稳定 Run ID 在哪里？
3. Run、Attempt、Agent Invocation、模型调用和工具调用怎样关联？
4. `Turn`、`Step`、`Round` 分别以什么为边界？
5. Event 是否有稳定身份、顺序和因果关系，哪些会持久化？
6. 状态提交、Event 发布和客户端消费分别在什么时候完成？
7. Pause、Cancel、Timeout 和工具错误各自怎样改变 Run？
8. Resume、Retry、Replay 和 New Run 是否拥有不同身份与入口？
9. 结果未知的外部副作用怎样查询、去重或补偿？
10. Session 并发、快照版本和 Runtime 配置变化怎样处理？

一个框架拥有名为 Runner、Session 或 Event 的类型，不代表它已经提供相同的执行保证。

## 结论

Run、Turn、Step、Event 和 Session 不是越多越专业的名词，而是对不同工程边界的回答：

- **Session** 回答“哪些执行共享连续上下文”；
- **Trigger / Activation** 回答“谁因为什么触发这次执行，以及重复到达怎样处理”；
- **Run** 回答“当前哪个目标正在被执行”；
- **Attempt** 回答“哪次物理执行正在承载它”；
- **Model Turn 与 Step** 回答“决策和行动怎样推进”；
- **Event** 回答“哪些事实、状态变化和控制信号可以被观察与重建”；
- **Outcome** 回答“为什么不再继续”。

这些身份解决了“谁正在执行”，下一步还需要区分“哪些数据属于当前决策、连续会话、长期复用、恢复切面或独立产物”。详见 [03｜Agent 的状态边界](03-agent-state-semantics.md)。

如果继续追问“这个 Run 究竟承诺完成哪个版本的目标、用户 Steering 何时构成任务变更、终态凭什么满足验收”，详见 [04｜Agent 的任务边界](04-agent-task-semantics.md)。

模型让下一步具有动态性，Runtime 则让这份动态性拥有可验证的因果、状态和终点。一个 Runtime 的成熟度，不取决于它能循环多少次，而取决于它能否清楚说明：

> **现在执行的是谁、状态已经提交到哪里、停止意味着什么，以及下一次继续时凭什么不会重复伤害真实环境。**

## 参考资料

- [CloudEvents Specification](https://github.com/cloudevents/spec/blob/ce@stable/cloudevents/spec.md)
- [CronJob — Kubernetes](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/)
- [OpenClaw Runtime — tRPC-Agent-Go](https://trpc-group.github.io/trpc-agent-go/openclaw-runtime/)
- [Runner — tRPC-Agent-Go](https://trpc-group.github.io/trpc-agent-go/runner/)
- [Session — tRPC-Agent-Go](https://trpc-group.github.io/trpc-agent-go/session/)
- [Agent — tRPC-Agent-Go](https://trpc-group.github.io/trpc-agent-go/agent/)
- [Runtime Event Loop — Google ADK](https://adk.dev/runtime/event-loop/)
- [Events — Google ADK](https://adk.dev/events/)
- [Session、State 与 Memory — Google ADK](https://adk.dev/sessions/)
- [Resume stopped agents — Google ADK](https://adk.dev/runtime/resume/)
- [Cancel agent runs — Google ADK](https://adk.dev/runtime/cancel/)
- [Running agents — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/running_agents/)
- [Results — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/results/)
- [Streaming — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/streaming/)
- [Sessions — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/sessions/)
