---
layout: default
title: "Personal Agent 与普通 Agent：同一框架怎样构建两种应用"
nav_order: 5
description: 从 Codex 公开源码和 Dot 产品行为出发，拆解持续责任、任务看板、上下文与恢复机制，并对照 tRPC-Agent-Go 的应用装配边界。
last_verified: 2026-10-27
---

<span class="eyebrow">01 · NOTES · 05</span>

# Personal Agent 与普通 Agent：同一框架怎样构建两种应用

给一个能对话、调用工具的 Agent 增加长期记忆和任务看板，是否就得到了 Personal Agent？

我的判断是：这些组件能让它记住事情，但还要回答另一组问题——用户离开后谁继续负责，什么时候再次运行，凭什么判断已经完成，连接断开后能否安全接续，以及结果应该告诉谁。

**Personal Agent 的主要工程变化，是把一次请求中的能力，装配成围绕一个人的持续服务。** 模型、工具调用循环和基础框架可以相同；改变的是责任的生命周期、状态归属、上下文装配和行动边界。

本文主要分析 Codex 公开源码，并用 Dot 官方文档校准产品层行为。文中的 Workspace、Task、Run 和通知服务等设计，是基于这些证据提出的应用架构，不能当作 Dot 内部数据库或云端实现的还原。

## 先说明源码能回答到哪里

核验日期为 **2026-10-27**。源码阅读固定在以下版本，避免后续主分支变化影响引用：

| 对象 | 本文使用的证据 | 能回答的问题 |
| --- | --- | --- |
| Codex 运行时 | [`openai/codex@c587d6e5`][codex-commit] | 计划工具、目标续跑、会话记录、上下文、记忆和子 Agent 怎样实现 |
| Dot 产品 | [Dot 概览][dot-overview]、[任务与记忆][dot-memory]、[控制项][dot-controls] | 产品承诺哪些持续工作、记忆、委派和控制行为 |
| 同框架构建示例 | [`trpc-agent-go v1.11.2`][trpc-version] | 普通调用、转交和可管理后台执行的区别 |

OpenAI 的开源说明列出了 Codex CLI、SDK 和 App Server 等公开项目，也明确 Codex cloud 并未开源。本文没有取得可核对的 Dot 云端完整实现，因此不会把公开 Rust 模块与 Dot 的服务拓扑一一等同。公开代码也可能包含实验能力；看到实现，不代表所有产品入口都已启用。[来源：OpenAI 开源说明][open-source]

下文区分三类结论：**源码事实**、**官方产品行为**、**应用设计建议**。本文做的是源码和文档分析，没有运行 Codex、Dot 或 tRPC 的端到端实验，也没有声称下面的设计已通过故障注入验证。

## 业务上，区别在于承诺的范围

“普通 Agent”不是严格技术分类。这里将它限定为**主要围绕用户当前请求交付结果的 Agent**，例如回答问题、分析日志、修改代码。它同样可以有持久会话、记忆、复杂流程和多 Agent。

Personal Agent 也不必然主动运行。更准确的分类有三个维度：

- **个体连续性**：是否围绕同一个人保留偏好、关系和工作状态。
- **任务连续性**：一项工作能否跨多次运行、多个会话继续推进。
- **触发主动性**：是否能由时间或外部事件触发，而不只等待新消息。

一个记住饮食偏好的问答助手具备个体连续性，但未必主动安排事情；一个通宵执行构建的 Agent 可以运行很久，却没有个人助理的身份。Dot 类产品通常把这些能力组合起来。

以合成场景说明：用户说“帮我准备下周评审的材料”。

| 维度 | 主要处理当前请求的 Agent | 承担持续职责的 Personal Agent |
| --- | --- | --- |
| 对工作的理解 | 本轮产出一份材料或建议 | 跟踪材料、缺失信息、截止时间和最终交付 |
| 结束条件 | 当前执行结束，向用户返回结果 | 本次执行可结束；未完成的责任仍然保留 |
| 用户没有回复 | 等待下一次请求 | 保存待答问题，按约定等待或在适当时机提醒 |
| 新建会话 | 根据会话配置恢复历史 | 能根据用户和任务身份找回相关工作，而不依赖旧聊天页 |
| 任务看板 | 展示本轮步骤即可满足需求 | 展示跨会话任务、阻塞项、近期进展、来源和交付物 |
| 衡量质量 | 答复正确、工具调用成功、时延合理 | 还要衡量遗漏跟进、重复操作、任务达成、打扰程度和长期成本 |

Dot 官方文档描述了跨对话的持续工作、后台任务、唤醒与调度，也区分对话上下文、记忆和自己的笔记。这支持“持续职责”的产品理解，但不说明底层必须存在一个永远在线的模型进程。[来源：Dot 概览][dot-overview]、[任务与记忆][dot-memory]

因此，产品可以给用户一个稳定的对话入口，技术上仍然按任务建立多个执行会话。**入口连续，不要求每一次推理都携带同一条无限增长的聊天记录。**

## 从公开 Codex 代码看：这些能力分布在不同组件

最容易产生误解的地方，是把“模型看到一个工具”理解成“这个工具已经实现整项产品能力”。沿着真实代码读下去，会看到工具通常只是入口，状态与执行由其他组件负责。

### 1. `update_plan` 表达步骤，不能单独代表长期任务系统

在 [`PlanHandler`][code-plan] 中，处理器解析计划参数，然后发送 `EventMsg::PlanUpdate(args)`，返回 `Plan updated`。它证明了模型可以通过结构化工具更新步骤，并让宿主收到计划事件。

这段处理器本身没有定义跨用户的任务归属、下次唤醒时间、任务分配、通知或交付验收。也不能反过来推断计划绝不持久化：事件与工具调用可能通过其他记录链路保存。

对应用设计的启发是把两层分开：

```text
Task：准备评审材料，负责人、来源、截止时间、完成标准
  ├─ Run 1：收集背景
  │   └─ Plan：查资料 → 对比 → 形成提纲
  └─ Run 2：收到补充信息后修改
      └─ Plan：定位变化 → 修订 → 检查交付物
```

计划可随执行重写。任务的归属、承诺和最终完成状态需要更稳定的管理。

### 2. Goal 的持续推进由宿主生命周期驱动

公开代码中的 [`GoalExtension`][code-goal-extension] 接入了线程启动、恢复、空闲，以及执行生命周期。它不是只给模型加一句“请继续工作”。

[`GoalRuntimeHandle`][code-goal-runtime] 的恢复路径从状态服务读取线程目标；`continue_if_idle` 再检查工具是否可用、是否暂缓续跑、线程是否存在、目标是否仍然 active，然后通过 `start_turn_if_idle` 提交新的输入。代码还在读取目标与启动之间持有同步许可，防止外部目标修改在这一窗口交错。

这给出了一个具体模式：

```text
持久目标 → 宿主发现线程空闲 → 校验当前目标状态 → 启动下一轮
```

它能支持线程内目标的连续推进；仅凭这段代码，不能推出多租户调度、日历任务、跨设备唯一执行和个人任务总览也都已经解决。那些是另一层控制逻辑。

### 3. 会话恢复和模型上下文是两种数据用途

[`RolloutRecorder`][code-rollout] 负责记录可回放、可检查的会话数据，提供 `persist`、`flush` 和读取历史的接口。调用方仍需遵守其持久化与错误处理契约；看到记录接口，不等于任意时刻崩溃都没有丢失窗口。

另一边，[`ContextManager`][code-context] 为模型准备历史：记录工具结果时可进行截断，发送给模型前会规范化内容，还具有压缩替换的独立路径。代码明确区分实时上下文中的工具输出截断与保留原始 rollout payload。

因此，历史证据与本轮输入可以分开管理：前者支持追溯，后者服从当前问题、模型能力和上下文预算。保存了全部历史，不意味着每一轮都要发送全部历史。

### 4. 记忆读取和记忆形成也是分开的

[`MemoriesExtension`][code-memory-extension] 通过上下文贡献接口和工具贡献接口接入运行时。其配置决定是否启用记忆以及专用检索工具。

读取侧的 [`prompts.rs`][code-memory-prompts] 读取 `memory_summary.md`，按预算截断，再装配读记忆的指令；需要细节时，可以使用单独的记忆工具。初始摘要和后续检索还需要使用一致的记忆命名空间。

写入侧的 [`start_memories_startup_task`][code-memory-start] 另行启动后台管道，跳过临时会话和非根 Agent，并检查状态存储与配额，再运行两个处理阶段。

这些事实支持“提炼后保留、按需读取”的实现方式。它们**不证明** Dot 云端使用同样的文件布局，也不意味着模型形成的记忆可以代替任务状态或授权记录。

### 5. Heartbeat 输入有来源标记，不能只靠消息文本识别

[`history/src/heartbeat.rs`][code-heartbeat] 区分普通用户输入与宿主标记的 heartbeat，使用触发类型或消息元数据判定来源，并解析对应的调度指令。

这里的 heartbeat 指**自动唤醒产生的输入**，不是分布式 worker 的租约续期。它说明同一个 Agent Loop 可以接收不同来源的输入，但不能据此认定调度服务、投递重试和多节点执行互斥已经实现。

应用需要保留这类来源差异：用户的一句话、群内引用的文本、定时器发出的事件，不应因为最后都变成字符串就拥有相同权限。

### 6. 启动子 Agent 与子任务完成是不同事件

在 [`multi_agents_v2/spawn.rs`][code-spawn] 中，宿主构造启动请求，创建子线程，记录其状态并发出 Started 活动，再返回任务标识等信息。启动处理器完成，只表示启动这一步完成。

该实现也显式处理历史继承方式。它说明上下文传递是一项可配置行为，而不是“既然是同一个人的 Agent，所有上下文就自动共享”。Dot 产品文档则说明，委派任务获得相关指令和上下文，并非必然携带此前全部对话；二者是不同层面的证据，不能直接视为同一个默认实现。[来源：Dot 任务与记忆][dot-memory]

对外部操作尤其要区分：**派发成功、执行结束、业务目标达成、结果已送达用户**，分别需要自己的证据。

## 应用架构上，多出来的是持续责任的管理

下面是建议的应用分层，不是 Dot 的源码目录映射。它可以由一个服务起步，模块边界不要求立即拆成微服务。

```text
个人入口 / 群聊入口 / 时间与外部事件
              │
              ▼
身份、渠道和事件接入
  ├─ 可信用户身份、租户、会话与消息来源
  └─ 去重、权限校验、当前可披露对象
              │
              ▼
Personal Agent 应用层
  ├─ 个人空间：稳定归属、会话绑定、偏好与资源索引
  ├─ 持续职责：目标、授权范围、暂停、到期与唤醒条件
  ├─ 任务服务：任务、计划、待答问题、产物和事件
  ├─ 执行控制：运行记录、领取、取消、恢复和结果核验
  ├─ 上下文装配：按任务、权限和预算挑选输入
  └─ 通知服务：收件人、去重、静默策略与送达状态
              │
              ▼
可复用 Agent Runtime
  ├─ 模型、工具调用循环、事件和执行生命周期
  ├─ Session / Memory / Context 扩展接口
  └─ 同步调用、转交、可管理的子执行
              │
              ▼
数据库、队列、对象存储、外部工具与可观测性
```

普通请求型应用也可能需要上述许多模块。变化在于：当产品承诺持续负责，它们从可选优化变成需要有明确语义的组成部分。

### 不要让一个 Session ID 承担所有身份

下面是一组建议的领域关系；命名可以变化，边界应明确：

| 对象 | 表达什么 | 为什么不能被别的对象替代 |
| --- | --- | --- |
| Principal | 这次操作是谁、代表谁执行 | 对话里声称的姓名不是身份 |
| Workspace | 用户在某产品和租户范围内的稳定数据归属 | 不一定是一台常驻容器或一个目录 |
| Responsibility | 持续委托，例如跟踪某事项直到某日 | 一次执行完成后，持续职责可能仍然存在 |
| Task | 有范围、归属与完成标准的一项工作 | 不能仅靠一段聊天标题表达 |
| Session / Thread | 一段对话与其执行上下文 | 可以新建、分叉或压缩，不应导致任务失踪 |
| Run / Attempt | 一次执行及其重试尝试 | 失败重试不应重新创建业务任务 |
| Plan / Step | 当前执行采用的步骤 | 可以变动，不是业务完成的唯一证据 |
| Interaction | 等待用户补充、选择或确认的问题 | 等待回复不应保持模型进程一直运行 |
| Artifact | 交付物及其版本和可访问位置 | 链接有效、内容可读与任务成功也要分别检查 |
| Event / Delivery | 发生了什么，以及是否已经通知用户 | 数据落库不等于通知送达 |

“一个人只有一个 Workspace”可以作为某个产品的规则，但通常需要把租户和产品命名空间计入唯一性约束。个人身份相同，不代表不同组织的数据应合并。

群聊入口则可以继续表现为普通助手：理解讨论、澄清、形成任务，并按明确授权把任务关联到相应个人空间。无需为每个群都创造一个拥有全部成员私人上下文的超级 Workspace。来源、群内可见回执和个人内部执行内容，应分别建模。

### 看板是持久状态的视图

建议将长期任务列表和本次执行步骤做成两个视图：

```text
任务、执行、交互与产物的持久记录
             ↓ 查询投影
长期任务列表 / 正在执行 / 等待我处理 / 本轮步骤 / 最近交付
```

Agent 调用业务工具修改状态，由服务检查权限、状态迁移和版本；看板查询这些记录。界面可以轮询，也可以订阅事件，但不应靠解析模型最近一句“我已完成”来确定状态。

跨会话恢复也沿着稳定对象完成：认证身份找到 Workspace，再根据用户意图选择 Task，载入最新状态、待答问题和必要证据。恢复的是可继续工作的事实与执行位置，不是强制恢复一个永不结束的聊天。

## 上下文管理上，长期化意味着更明确地挑选

Personal Agent 的数据会持续增长，而每次推理仍然有限。可以把上下文装配理解为一次有权限约束的查询：

```text
当前输入 + 可信身份 + 当前任务
           ↓
先按租户、主体、任务和渠道过滤可访问数据
           ↓
读取最新结构化状态；检索相关记忆与证据
           ↓
按时效、相关性和预算装配本轮输入
```

| 层次 | 典型内容 | 建议处理方式 |
| --- | --- | --- |
| 身份与策略 | 当前主体、允许的操作、受众和授权范围 | 由可信宿主提供，每次敏感操作重新校验 |
| 当前任务事实 | 状态、版本、负责人、待答问题、完成条件 | 从权威存储读取；不要仅从摘要推断 |
| 最近对话 | 用户刚做的纠正、当前指代对象 | 有界窗口，必要时保留摘要及原文引用 |
| 个人长期记忆 | 稳定偏好、已核实背景、长期工作习惯 | 带来源、更新时间、作用域，并允许更正和遗忘 |
| 原始证据 | 文档、工具结果、历史执行片段 | 按需检索；保留定位和版本信息 |
| 交付物 | 报告、文件、代码或外部资源 | 以稳定引用和版本管理；需要时读取内容 |

这里最重要的区别是**记忆与事实状态承担不同职责**。

“用户习惯周五处理材料”可以作为可修正的偏好；“任务已批准发布”需要精确的授权事实；“操作可能已经生效但回执丢失”需要执行状态与核验结果。把三者都写进一份记忆摘要，会让恢复和权限判断依赖不可靠的自然语言推断。

新会话也不应默认导入所有私人历史。先确定正在处理哪件事，再装配它需要的上下文。需要在群中回复时，还要判断哪些信息允许向当前受众披露；能够读取某份私人资料，并不自动获得在群里转述的许可。这也是 Dot 官方资料区分渠道和持续助手身份时值得借鉴的边界。[来源：Dot 任务与记忆][dot-memory]

原始聊天、检索文档和模型生成的记忆还必须保留来源区别。它们可以帮助理解任务，却不能通过一句“我是另一个用户”改写宿主身份或扩大权限。

## 同一个 tRPC-Agent-Go 框架，具体怎么装出两种应用

Codex 的代码说明了组件划分；另一个框架可以使用不同语言和接口实现相同的产品语义。下面以固定的 tRPC-Agent-Go v1.11.2 为例，避免把“必须更换框架”当作默认答案。

### 请求型应用：执行边界围绕当前请求

```text
消息接入 → 认证 → 选择 Session → 准备上下文
       → Runner 执行 Agent → 消费事件与工具结果 → 返回回复
```

这里可以配置 Session 持久化、Memory、摘要和子 Agent。是否具有这些能力，并不能单独决定它是 Personal Agent。

### 持续型应用：每次 Runner 执行属于一个更长的责任

```text
用户消息 / 到期事件 / 外部变化
             ↓
验证来源与作用域，定位 Workspace 和 Task
             ↓
去重并持久化本次运行意图，领取执行资格
             ↓
加载最新任务状态、待答问题、授权范围与必要上下文
             ↓
调用同一个 Runner，观察实际执行事件
             ↓
保存运行结果、任务变更、产物引用和后续触发条件
             ↓
符合通知规则时投递；等待下次输入或事件
```

区别主要位于 Runner 前后的应用服务。可以复用同样的模型、LLMAgent、工具接口和事件循环；无需给每个用户永久保留一个运行中的 Agent 实例。用户相关状态应进入隔离的请求上下文和持久存储，共享实例中则避免可变的用户私有数据。

以下是**应用层伪代码**，表示职责边界，不是可以直接编译的框架 API 示例：

```text
handle(trigger):
  scope = authenticate_and_resolve_scope(trigger)
  task = load_authorized_task(scope, trigger.task_ref)
  run = admit_and_claim(task, trigger.idempotency_key)
  input = assemble_context(scope, task, run)

  observe_actual_execution(runner, input, run):
    persist_progress_and_effect_receipts(run)

  reconcile_unconfirmed_effects(run)
  verify_outcome_and_commit_task_state(task, run)
  enqueue_authorized_delivery(task, run)
```

真实实现还要处理超时、取消、进程退出和部分成功；伪代码的顺序不代表外部系统能够参与数据库原子事务。

### 三种委派方式要选对

tRPC 的公开文档明确区分三类机制：[来源：Task Run 文档][trpc-taskrun]

| 机制 | 语义 | 适合的需求 |
| --- | --- | --- |
| `agenttool.NewTool` | 像调用同步工具一样等待专家结果 | 小型分析、评审或计算 |
| `transfer_to_agent` | 当前 invocation 将控制权交给子 Agent，继续当前执行 | 路由和对话接管 |
| `agent/taskrun` + `tool/taskrun` | 创建独立子会话和可查询、等待、取消的 run | 可管理的后台工作 |

这意味着 `transfer` 工具返回，不能自动成为子 Agent 业务完成的证据。`taskrun` 的 `sync` 也只是等待方式，不会取消 run 的身份；等待超时与取消子执行是不同动作。

v1.11.2 提供的 `inprocess.Service` 是单进程实现，可使用 MemoryStore 或 FileStore。官方文档明确要求分布式部署自行提供外部存储、队列、租约和跨节点取消支持的 Controller。不能把“运行记录写进文件”当作任意节点重启后无缝恢复执行的保证。[来源：运行时实现边界][trpc-taskrun]

还有一个容易遗漏的边界：内建子执行转录读取工具按当前用户及父 Session 限定访问。若产品要在新会话找回长期任务，需要应用层建立稳定任务关系，并执行相应鉴权；不能靠去掉父会话检查来实现跨会话恢复。[来源：Progress and Transcript][trpc-transcript]

### 哪些放公共层，哪些留在产品层

建议按语义拆分，而不按“Dot 相关文件”整体搬进公共 core：

| 层次 | 适合承担的内容 |
| --- | --- |
| 公共运行时与适配层 | 执行生命周期、真实子执行事件、上下文贡献接口、工具上下文、取消与错误传播 |
| Personal Agent 业务层 | Workspace 归属、任务来源、接受分配、恢复策略、群聊披露、通知规则与完成标准 |
| 基础设施实现 | 数据库事务、队列、资源存储、运行领取与版本检查、通知投递、监控 |

公共层应该让产品接入这些能力，而不是硬编码“每个用户恰好一个 Workspace”“群任务必须怎样接受”等具体规则。产品层也不应通过猜测工具名称或模型输出文本，弥补运行时缺失的生命周期信号。

## 长期运行真正难的是不确定状态

考虑一个合成故障场景：Agent 创建外部文档，外部系统已成功处理，但返回途中连接断开。

如果只保存“工具失败”，下一轮可能再次创建文档；如果工具一开始就写“已完成”，则可能掩盖实际失败。更稳妥的方案需要保留操作意图和结果确定性：

```text
记录意图和幂等键
      ↓
发起外部操作
      ├─ 有可靠成功回执 → 保存外部对象标识 → 校验业务结果
      ├─ 确定未执行成功 → 根据策略重试或结束
      └─ 可能已执行但无法确认 → 标为待核验 → 查询外部状态或请求处理
```

这里的 unknown 是**对某次操作结果的不确定**，不必把整个用户任务永久标成失败。它需要能够影响后续执行，防止恢复路径再次盲目写入。

同样，执行租约可以减少并发领取，但租约过期并不能撤回旧 worker 已发给外部系统的请求。数据库的 revision 检查、外部接口支持的幂等键、外部对象回查，各自处理不同问题；没有这些配合，不应宣称 exactly-once 外部副作用。

通知还有独立的失败窗口。任务与“待通知意图”可以在同一数据库事务中保存，再由投递器发送；对不支持幂等发送的渠道仍要处理重复风险。任务成功、通知排队、渠道接受、用户已读，也不能混成一个 completed 字段。

长期职责的取消同样要拆开：暂停后续唤醒、取消当前执行、停止已委派子任务、撤销未来行动授权，不一定是同一个操作。Dot 官方控制文档也把停止与暂停相关行为分开说明；应用应向用户明确各自影响。[来源：Dot 控制项][dot-controls]

## 什么时候值得做，以及怎么验收

如果大部分需求都能在一次请求内完成，用户也没有持续跟进预期，先把普通 Agent 的准确性和工具可靠性做好通常更有价值。长期化会增加存储、调度、权限、恢复和通知成本；更多模型调用或更多子 Agent，本身并不证明产品更好。

当用户反复遇到“换个会话就丢了”“需要我一直催”“等到资料齐全才应该继续”“完成后要找到正确的人”，持续责任模型才直接对应业务缺口。

可以用以下验收场景判断是否兑现承诺。这些是建议的测试，不是本文已通过的测试结果：

| 场景 | 必须观察的结果 |
| --- | --- |
| 在新会话继续已有任务 | 找到相同业务任务，读取最新状态，不重复建任务 |
| 用户没有回答问题 | 保存待答对象并停止不必要的推理，之后能定位原问题继续 |
| 相同触发事件重复到达 | 按事件和任务语义去重，避免重复创建同一次运行 |
| 子 Agent 启动后主连接断开 | 已开始的真实执行仍有可查状态，不因转交回执被误判为完成 |
| 外部写入成功但回执丢失 | 进入核验流程，重试前确认是否已生效 |
| 两个 worker 并发恢复 | 旧版本不能覆盖新状态，过期执行者的副作用有应对机制 |
| 新会话读取其他用户任务 | 服务拒绝访问，不能由 prompt 改写 owner 绕过 |
| 从私聊切换到群聊回复 | 只披露允许公开的状态和结果，不自动携带私人记忆 |
| 用户暂停持续职责 | 停止相应后续唤醒，并明确现有执行和子任务的处置 |
| 结果已生成但通知失败 | 交付物保留，通知可重试，任务状态不会被错误改写 |
| 旧记忆被用户纠正 | 后续决策使用新事实，能追溯和撤销过期记忆 |

实施时可以逐步增加承诺：先实现稳定任务身份和跨会话恢复，再补真实执行记录、待答交互和结果核验，最后加入持续职责、事件唤醒和主动通知。每增加一种承诺，都为它定义失败状态与验收证据。

## 继续阅读

- [Agent Runtime：一次运行如何开始、推进与结束](../docs/02-agent-runtime-semantics.md)
- [Agent 的状态边界：Context、Session、Memory 与 Artifact](../docs/03-agent-state-semantics.md)
- [Agent 的任务边界：Goal、Plan、Steering 与 Completion](../docs/04-agent-task-semantics.md)
- [Agent 的授权边界](../docs/07-agent-authorization-semantics.md)
- [Context Engineering](../engineering/context-engineering.md)
- [Memory Engineering](../engineering/memory-engineering.md)
- [工具结果太大怎么办：把上下文预算与文件生命周期分开](tool-results-context-and-lifecycle.md)

[codex-commit]: https://github.com/openai/codex/tree/c587d6e54cb1e4013bf0cf9ea769edde48a23a1e
[open-source]: https://learn.chatgpt.com/docs/open-source
[dot-overview]: https://learn.chatgpt.com/docs/dots
[dot-memory]: https://learn.chatgpt.com/docs/dots/tasks-and-memory
[dot-controls]: https://learn.chatgpt.com/docs/dots/controls
[code-plan]: https://github.com/openai/codex/blob/c587d6e54cb1e4013bf0cf9ea769edde48a23a1e/codex-rs/core/src/tools/handlers/plan.rs#L65
[code-goal-extension]: https://github.com/openai/codex/blob/c587d6e54cb1e4013bf0cf9ea769edde48a23a1e/codex-rs/ext/goal/src/extension.rs#L103
[code-goal-runtime]: https://github.com/openai/codex/blob/c587d6e54cb1e4013bf0cf9ea769edde48a23a1e/codex-rs/ext/goal/src/runtime.rs#L412
[code-rollout]: https://github.com/openai/codex/blob/c587d6e54cb1e4013bf0cf9ea769edde48a23a1e/codex-rs/rollout/src/recorder.rs#L1079
[code-context]: https://github.com/openai/codex/blob/c587d6e54cb1e4013bf0cf9ea769edde48a23a1e/codex-rs/core/src/context_manager/history.rs#L507
[code-memory-extension]: https://github.com/openai/codex/blob/c587d6e54cb1e4013bf0cf9ea769edde48a23a1e/codex-rs/ext/memories/src/extension.rs#L55
[code-memory-prompts]: https://github.com/openai/codex/blob/c587d6e54cb1e4013bf0cf9ea769edde48a23a1e/codex-rs/ext/memories/src/prompts.rs#L31
[code-memory-start]: https://github.com/openai/codex/blob/c587d6e54cb1e4013bf0cf9ea769edde48a23a1e/codex-rs/memories/write/src/start.rs#L20
[code-heartbeat]: https://github.com/openai/codex/blob/c587d6e54cb1e4013bf0cf9ea769edde48a23a1e/codex-rs/history/src/heartbeat.rs#L15
[code-spawn]: https://github.com/openai/codex/blob/c587d6e54cb1e4013bf0cf9ea769edde48a23a1e/codex-rs/core/src/tools/handlers/multi_agents_v2/spawn.rs#L96
[trpc-version]: https://github.com/trpc-group/trpc-agent-go/tree/5a0030b628a5bd93c8c5a30b1451f6fdd9d6740e
[trpc-taskrun]: https://github.com/trpc-group/trpc-agent-go/blob/5a0030b628a5bd93c8c5a30b1451f6fdd9d6740e/docs/mkdocs/en/taskrun.md#L1
[trpc-transcript]: https://github.com/trpc-group/trpc-agent-go/blob/5a0030b628a5bd93c8c5a30b1451f6fdd9d6740e/docs/mkdocs/en/taskrun.md#L366
