---
title: "Agent State Boundaries: Context, Session, Memory, and Artifacts"
nav_title_zh: Agent 的状态边界：Context、Session、Memory 与 Artifact
nav_order: 3
description: 区分观察、声明、决策输入、连续性、恢复与产物，理解 Agent 如何保存状态并判断什么可以相信。
---

# 03｜Agent 的状态边界：Context、Session、Memory 与 Artifact

在[从模型调用到 Agent](01-agent-primer.md)中，State 是动态闭环得以延续的必要条件；在[Agent Runtime](02-agent-runtime-semantics.md)中，Run、Attempt、Event、Session 与 Checkpoint 又把“状态”拆成了不同身份和生命周期。真正把 Agent 放进生产以后，问题会继续向外扩张：

- 当前计划存在 Run State，历史消息存在 Session，为什么服务重启后仍不能恢复？
- 工具已经修改代码，Checkpoint 还停在修改之前，应该相信谁？
- UI 已经收到 Final Event，Session 写入却失败，任务算不算完成？
- 两个 Run 同时更新一个 Session，后写入者是否有权覆盖前一个 Run？
- Memory 里记录了“用户允许修改生产配置”，这条信息由谁确认，何时失效？
- Artifact 文件名没有变化，内容已经迭代三版，Checkpoint 引用的究竟是哪一版？
- 工具返回“请求已受理”以后，系统为什么不能直接写成“部署成功”？

这些并不是多加几个数据库字段就能解决的问题。它们来自一个更根本的误解：把 Context、Run State、Session、Memory、Store、Checkpoint 和 Artifact 当成七种可以随意互换的“存储”。

本文的核心判断是：

> **Agent 状态不是一个对象，而是一组具有不同作用域、所有权、事实性、提交边界和恢复能力的语义角色。生产系统真正要维护的不是“有没有保存数据”，而是这些角色之间的转换是否仍然指向同一个真实世界。**

## 一个“测试已经通过”的事故

继续使用前两篇的任务：**修复仓库中失败的测试，并证明修改有效。** Run `R42` 在 Workspace Commit `C1` 上写入 Effect `E7`，测试通过并生成 `report@v3`；Runtime 随即流式展示“修复完成”，但 Session 写入超时。客户端从旧 Checkpoint 创建新 Attempt 时，另一个 Run 已把 Workspace 更新到 `C2`，新 Attempt 却仍准备重放 `E7`。

此时必须分别回答：Workspace 里真实存在什么，`E7` 是否发生、回执是否丢失，Run State 和 Session 各提交到哪里，Checkpoint 能否精确恢复，以及 `report@v3` 是否仍对应当前版本。

如果系统只有一个可变的 `state` 字典，这些问题会互相覆盖；最后写入的值看起来最完整，却未必最接近事实。

## State 不是 Value，而是一条声明

生产系统不能只保存：

```json
{"tests_passed": true}
```

它至少还要知道这条值描述的是哪个世界：

```text
State Claim
= Value
+ Scope
+ Owner
+ Version
+ Provenance
+ Observed At
```

对于 `tests_passed=true`：

- **Scope**：属于哪个 tenant、user、session、run、attempt、workspace；
- **Owner**：由哪个测试工具或验证节点产生，谁可以覆盖；
- **Version**：对应哪个 Commit、文件摘要、Tool Schema 和测试配置；
- **Provenance**：来自哪条命令、退出码、日志和 Artifact；
- **Observed At**：何时观察到，此后外部状态是否已改变。

这不是要求把每个布尔值包装成复杂对象，而是要求系统知道哪些字段可以简化，哪些声明一旦失去身份和版本就不再可信。

### Observation、Claim 与 Evidence 不是同一个对象

Agent 的认知链更适合写成：

```text
World
  → Observation
  → Claim
  → Evidence Package
  → Verification
  → Accepted / Rejected / Unknown
```

- **Observation** 是某个来源在特定时间和 Scope 下返回的原始记录，例如进程退出码、HTTP 响应、文件摘要或用户输入；
- **Claim** 是系统根据一个或多个 Observation 表达的可判断命题，例如“当前 Commit 上测试通过”；
- **Evidence Package** 固定支持或反驳 Claim 的来源引用、版本、采集方式、时间与完整性；
- **Verification** 按明确 Predicate、Rubric 或人工责任判断证据是否足够；
- **Unknown** 表示证据缺失、冲突、过期或无法覆盖命题，而不是一个低概率的 `false`。

Tool Result 只自动产生 Observation，不自动产生正确的 Claim。`HTTP 202 Accepted` 可以证明服务接收了请求，却不能单独证明部署已经完成；`exit_code=0` 可以证明该进程如何退出，却不一定证明命令运行在目标 Workspace、覆盖了全部测试，或结果在当前版本仍成立。解析器、模型和 Verifier 都可能从同一回执形成不同层次的 Claim，因此原始回执与派生声明应分开保存。

| 记录 | 例子 | 可以直接推出什么 | 不能直接推出什么 |
| --- | --- | --- | --- |
| 原始 Observation | `pytest` 返回退出码 0 | 该进程按此退出码结束 | 目标 Commit 的所有要求已经满足 |
| 环境 Claim | `tests_passed@commit=C1` | 一个需要证据支持的命题 | 永久事实，或 C2 上仍成立 |
| 模型推断 | “失败可能来自时区” | 可指导下一步验证的 Hypothesis | 已确认根因 |
| Verification Result | Required Conditions 在 C1 上通过 | 在给定标准和证据范围内成立 | 用户已接受、权限仍有效或未来不会回归 |

### Provenance、Freshness 与 Confidence 各回答不同问题

可信声明至少需要三个互不替代的维度：

1. **Provenance** 回答“它从哪里来、由谁观察、经过什么变换”。[W3C PROV-DM](https://www.w3.org/TR/prov-dm/)用 Derivation、Attribution、Association、Delegation 与 Invalidation 表达实体、活动和主体之间的来源关系，适合保存“谁观察、谁转述、谁代表谁行动”的血缘，而不是只留下最终文本。
2. **Freshness** 回答“它对哪个世界版本、在多长时间内仍可使用”。时间新不等于版本新；昨天对固定 Commit 的测试证据可以稳定，刚刚读取但未绑定资源版本的缓存却可能已经陈旧。
3. **Confidence** 回答“在现有证据下，对 Claim 的认知把握有多大”。它不是调用高风险工具的权限，也不能把缺失证据变成证据。高置信推断仍可能需要审批，低置信但可验证的假设则可以触发只读调查。

当来源冲突时，系统不应简单使用最后写入者、最长回答或最高自报置信。更稳妥的顺序是：先检查 Scope 和版本是否其实不同，再比较来源权威性、直接性、独立性与新鲜度；仍不能消解时保留多个 Claim 和冲突边，返回 `unknown` 或升级人工。后续重新观察可以让 Claim 进入 `superseded`、`invalidated` 或 `revalidated`，但不应改写旧 Event 当时记录的内容。

### Agent 最重要的状态往往在 Runtime 外面

Agent 数据库并不拥有整个世界：

- Coding Agent 修改的文件、Git Index、进程和测试环境存在 Workspace；
- 浏览器 Agent 操作的页面状态存在浏览器与远端服务；
- 运维 Agent 创建的资源存在云平台控制面；
- 数据 Agent 依赖的事实存在数据库、对象存储和数据目录。

这些外部系统通常才是 **System of Record**。Run State 保存的是行动意图、观察和进度；Checkpoint 保存的是恢复所需的执行切面；二者都不能仅凭一份旧副本宣布外部世界已经回到某个状态。

因此，恢复不是“反序列化成功以后继续跑”，而是重新验证：

- Workspace 是否仍是预期 Commit；
- 待处理 Effect 是否已经发生；
- Artifact Version 是否还存在；
- 凭据、权限、租约和外部资源版本是否仍有效。

> **Checkpoint 可以恢复 Runtime 的认知，不能自动回滚真实世界。**

## 三组状态边界

![Agent 状态语义地图](../assets/images/agent-state-map.svg)

移动端可打开 [SVG 原图](../assets/images/agent-state-map.svg) 查看箭头和边界。图中最外侧的 World / Workspace 不是第八种 Agent 组件，而是状态声明最终必须校准的事实边界。

| 概念 | 回答的问题 | 典型作用域 | 它是什么 | 它不保证什么 |
| --- | --- | --- | --- | --- |
| Context | 此刻允许消费者看见什么 | Model Turn / Step / Run | 从多种来源编译出的投影 | 不天然持久，也不是事实源 |
| Run State | 当前执行到哪里、还要做什么 | Logical Run / Attempt / Branch | 可变的操作状态 | 不等于对话历史或外部世界 |
| Session | 哪些交互属于同一段连续关系 | User + Conversation | 消息、事件和会话级状态的容器 | 不天然是事务或恢复点 |
| Memory | 哪些信息值得跨任务复用 | User / App / Custom Namespace | 经过选择、验证和索引的信息 | 不等于全量历史或权威知识 |
| Store | 数据怎样被存取 | Backend / Namespace | KV、文档、向量、Blob、Log 等基础设施能力 | 不能决定上层数据语义 |
| Checkpoint | 从哪个已提交切面继续 | Run / Graph / Step | 状态、控制位置与恢复元数据 | 不能证明外部副作用已回滚 |
| Artifact | 哪个独立产物被输入、生成或交付 | Session / User / Run / Task | 命名、版本化、可独立授权的大对象 | 不应承载 Runtime 控制状态 |

这些概念不是一条从短期到长期的线，可以先按责任归为三组：

- **决策输入**：Context 是一次决策看到的投影；
- **连续性**：Run State 维持当前执行，Session 维持交互，Memory 维持跨任务复用；
- **恢复与输出**：Checkpoint 固定恢复切面，Artifact 固定输入和交付物；Store 在下方提供存取能力。

同一个数据库可以承载多种角色，但不能因此抹掉它们不同的 Scope、Owner、Version 和生命周期。

## Context：一次决策的编译产物

`Context` 是最容易被滥用的词。它至少可能指：

1. 模型真正看到的 Instructions、Messages、Tool Definitions 和检索结果；
2. Runtime 传给工具、Callback 与 Hook 的本地依赖和元数据；
3. 当前环境，例如用户身份、Workspace、请求 Deadline 与权限。

[OpenAI Agents SDK 的 Context 文档](https://openai.github.io/openai-agents-python/context/)明确区分本地 `RunContextWrapper` 与模型可见 Context：前者不会自动发送给模型。这个区别不是某个 SDK 的特殊细节，而是一个普遍边界——**代码可访问不等于模型可见，模型可见也不等于模型可以修改事实源。**

更准确的表达是：

```text
Context Frame
= select(
    instructions,
    session history,
    run state,
    retrieved memory,
    knowledge,
    observations,
    artifact metadata,
    tool definitions,
)
```

`select` 表示选择、排序、压缩、摘要和权限过滤。它必然是有损的：

- 摘要会遗漏细节；
- 检索可能漏召回或召回过期信息；
- Tool Result 可能只返回外部世界的一部分；
- 为节省 Token，历史可能被裁剪；
- 出于最小权限，模型只能看到某些字段。

因此，Context 应满足两个重要不变量：

1. **可重建**：关键事实仍能从更权威的 Session、Run State、Memory、Artifact 或外部系统重新获取；
2. **带来源**：影响高风险决策的信息应保留来源、版本和新鲜度，而不只是变成一段无出处文本。

把 Context 当数据库，会让压缩后的内容逐渐取代原始事实；把全部数据库内容都塞进 Context，则会把权限、噪声和成本问题一起推给模型。选择与装配策略可以不断演进，但必须守住一个边界：**Context 是视图，不是仓库。**

## Run State：当前执行的操作事实

Run State 服务于一个 Logical Run，典型内容包括：

- 当前目标、约束与 Completion Contract；
- 已完成步骤、当前控制位置与候选计划；
- Tool Call、Observation 与验证结果；
- 待审批动作、待处理 Effect 与结果未知项；
- Token、时间、步骤和成本预算；
- 当前 Agent、Branch、子任务与合并状态；
- Artifact References 与外部版本断言。

它与进程内变量的区别在于语义，而不是介质。一个 Run State 可以只存在内存中，也可以持续持久化；但只要系统承诺 Pause、Resume 或 Worker 故障恢复，就必须说明哪些字段已经提交，哪些仍只是当前 Attempt 的临时变量。

并行 Tool、Graph 分支和 Multi-Agent 都可能同时更新 Run State。互斥锁只解决内存竞争，不能解决两个分支基于旧 Workspace 生成冲突 Patch，或旧 Attempt 在失去租约后继续提交。系统仍需定义聚合边界、逻辑写入者、合并规则、Branch / Namespace 与 Lease / Fencing。锁保护“同时写”，版本保护“基于什么写”，Fencing 保护“现在还有没有资格写”。多 Agent 之间怎样隔离 Context、共享最小状态并交换版本化 Artifact，详见 [05｜Multi-Agent](05-multi-agent-collaboration.md)。

## Session：连续性边界，不是事务边界

Session 通常把同一用户和应用中的多轮交互关联起来，可能包含：

- Message 或 Event History；
- 会话级 State；
- Summary；
- 创建、更新时间和版本；
- 与 User、App、Run 或 Artifact 的引用。

[Google ADK](https://adk.dev/sessions/)将 Session 描述为当前对话线程，其中包含 Event 与 State；[OpenAI Agents SDK](https://openai.github.io/openai-agents-python/sessions/)的 Session 则主要负责跨 `Runner.run` 维护对话历史。相同词名已经对应不同数据模型，更不能把“有 Session 类”推导为“拥有相同恢复保证”。

Session 首先回答：

> **后续交互应该继承哪段连续上下文？**

它不自动回答：

- 当前哪个 Run 还在执行；
- 哪个 Tool Call 已产生副作用；
- 从哪个 Node 或 Step 继续；
- 当前 Workspace 与历史消息是否仍一致；
- 同一 Session 的并发 Run 按什么顺序提交。

[tRPC-Agent-Go 的 Noop Session](https://trpc-group.github.io/trpc-agent-go/session/noop/)仍会在一次 Run 内创建瞬时 Session，同时不会禁用独立配置的 Memory、Artifact 或 Graph Checkpoint 服务。这说明 Session 的语义可以存在于不持久化的实现中，其他状态能力也不应被折叠成 Session 的开关。

Session 并发最容易制造“合理但错误”的历史：两个 Run 都读取 `S10`，较晚结束的旧 Run 用完整副本覆盖新结果。这是 Lost Update，不是线程安全问题。可以选择单写者、Event Append、乐观版本或隔离 Branch；“最后写入获胜”只有在业务明确允许覆盖时才是一种策略。

## Memory：事实发布流程，不是历史备份

Memory 经常被描述为“让 Agent 记住以前的事情”。生产系统更应该把它理解为：

```text
Candidate
→ Validate
→ Publish
→ Retrieve
→ Use
→ Correct / Expire / Delete
```

Session History 中出现过的信息只是 Memory Candidate：它可能是稳定偏好，也可能是模型推测、临时约束、过期信息或不可信内容。把每条历史自动写入长期 Memory，会造成错误固化、时效漂移、作用域泄漏、反馈放大和删除失效。

可用于高风险决策的 Memory 至少要记录来源与创建主体、User / App / Project Scope、事实 / 推断 / 偏好类型、验证与最后使用时间、版本或置信，以及 TTL、更正和删除路径。

Memory 也不等于 Knowledge。Memory 通常来自用户或 Agent 经历，强调个体连续性和复用；Knowledge 更接近可维护、可引用、面向多个任务的外部事实。两者都可能使用向量检索，但共享检索技术不会让它们拥有相同权威性。

> **Memory Write 是一次事实发布，而不是日志追加。**

### Memory 不能自动升级为 Skill

Memory 保存的是以后可能再次使用的事实、偏好或经验；Skill 封装的是完成某类任务时可复用的说明、步骤、脚本和工具约定。一次成功轨迹可以同时产生 Memory Candidate 和 Skill Candidate，但二者不是同一种发布物：前者回答“以后应该记住什么”，后者回答“以后允许按什么流程行动”。

一条轨迹只证明某个版本在某个环境里曾经成功，不能证明流程已经通用、权限边界正确或依赖仍然存在。从 Experience / Memory 到 Skill 至少还需要去上下文化、去敏、评测、安全审查、授权、版本化发布与回滚；加载后仍要经过 Tool Policy、Approval 与 Sandbox。`SKILL.md` 是能力描述和装配格式，不是安全边界本身。状态系统必须守住一条原则：**复用数据不能静默晋升为可执行能力，派生关系必须能撤销。**

## Store：基础设施能力不能反推数据语义

Store 可能指 KV Store、Document Store、Vector Store、Blob Store、Event Store，甚至只是一个框架定义的通用持久化接口。它回答：

- 数据按什么 Key 与 Namespace 存取；
- 是否支持查询、事务、版本、TTL 或向量检索；
- 数据保存在内存、数据库还是远端服务；
- 可用性、延迟、容量和一致性如何。

它不回答这份数据应该是 Session、Memory 还是 Checkpoint。

[LangGraph 的 Persistence 文档](https://docs.langchain.com/oss/python/langgraph/persistence)把 Checkpointer 与 Store 明确分开：前者保存 thread 中每个执行步骤的 Graph State Snapshot，后者用于跨 thread 保存和搜索数据。另一方面，某些框架会把 Storage 定义为供 Session 与 Memory 复用的底层客户端。这两种 `Store` 不是同一层抽象。

这带来两个常被忽视的判断：

1. **Persistent 不等于 Long-term**：Session 放入 PostgreSQL 后仍然只是 Session；Memory 使用内存实现时语义上仍是 Memory，只是无法跨进程保留。
2. **同库不等于同事务**：Session、Checkpoint 与 Artifact Metadata 即使都存在一个数据库，也可能位于不同表、分区、服务或提交链，不能假设一起成功。

Store 是实现选择；Scope、Ownership、Retention 和 Recovery Contract 才是语义。

## Checkpoint：可恢复执行的契约

普通 Snapshot 只回答“当时有哪些值”。生产 Checkpoint 还必须回答“下一步从哪里开始，以及此前哪些现实动作不能重复”。

一个框架无关的恢复信封可以写成：

```python
class RecoveryContract:
    checkpoint_id: str
    run_id: str
    attempt_id: str
    state_version: int
    control_cursor: object
    pending_writes: list[object]
    pending_effects: list[object]
    artifact_refs: list[object]
    external_assertions: dict[str, str]
    runtime_fingerprint: dict[str, str]
    parent_checkpoint_id: str | None
```

其中：

- **Control Cursor**：下一个 Node、Step、待审批动作或等待点；
- **Pending Writes**：已计算但尚未纳入稳定状态的更新；
- **Pending Effects**：未执行、已受理、已完成或结果未知的外部动作；
- **External Assertions**：Workspace Commit、数据库版本、Artifact Digest；
- **Runtime Fingerprint**：Agent、Prompt、Tool Schema、Graph 与 State Schema 版本；
- **Parent**：支持 Lineage、Fork、Time Travel 和审计。

[LangGraph](https://docs.langchain.com/oss/python/langgraph/persistence)的 `StateSnapshot` 除了 values，还包含 next、tasks、writes、step 与 parent；其 Pending Writes 机制避免恢复时重跑同一 super-step 中已经成功的节点。[tRPC-Agent-Go Graph](https://trpc-group.github.io/trpc-agent-go/graph/)同样把 per-invocation state、pending writes、checkpoint namespace 与恢复联系起来。这些实现细节共同说明：只有 Value 的 Snapshot 不足以恢复控制流。

Event Log 可以帮助重建状态，但不会自动成为 Checkpoint：事件还必须完整、有序、可去重，状态转换要版本兼容，外部副作用要有稳定身份与回执。Agent 的模型输出和 Tool 通常不具备天然确定性，不能仅因为“保存了 Event”就假设可以像确定性 Workflow 一样安全重放。

Resume 更适合被理解为五步协议：`Load → Validate → Reconcile → Acquire Ownership → Continue`。它先读取恢复信封，再校验 Runtime 版本和权限，重新观察 Workspace、Artifact 与待处理 Effect，建立新 Attempt 并取得 Lease，最后从明确 Cursor 前进。无法证明安全时，正确结果是 `Needs Review`、`Stopped` 或 New Run，而不是让模型猜回原进度。

## Artifact：独立产物不是一个超大的 State 字段

Artifact 是任务输入、中间结果或交付物，例如：

- 用户上传的 PDF、图片或数据集；
- Agent 生成的 Patch、报告、表格或图像；
- 测试日志、构建产物和评测结果；
- Sandbox 导出的文件或归档。

[Google ADK 的 Artifact 文档](https://adk.dev/artifacts/)将 Artifact 定义为按 Session 或 User 作用域管理的命名、版本化二进制数据，并通过独立 Artifact Service 保存；它明确不把 Artifact 本体直接存入 Session State。

一个成熟的 Artifact Reference 通常需要：

```text
artifact_id
+ version / content_hash
+ media_type
+ size
+ producer_run_id
+ source_versions
+ access_scope
+ retention_policy
```

只保存 `report.pdf` 会产生指针漂移：新版本覆盖同名文件以后，旧 Checkpoint 无法证明自己当时使用了什么。只保存对象存储 URL 也不够，因为 URL 可能过期、权限变化或指向可变对象。

State 应保存 Artifact Reference、摘要和血缘，Artifact Service 保存本体。这样可以：

- 让 Context 按需加载，而不是把大文件全部塞进模型；
- 为 Checkpoint 固定输入和输出版本；
- 把 Artifact 作为 Completion Contract 的环境证据；
- 独立执行权限、保留、删除和生命周期策略。

Artifact 不是只能在最后出现。中间分析、计划和测试报告也可以是 Artifact；关键是不要把“可以保存成文件”误解为“已经成为可信交付物”。

## 状态不会在盒子之间搬家，而是在不断变换

七个概念之间常见的是语义变换：

```text
World       --observe----> Observation
Observation --record-----> Run State
Observation --derive-----> Claim / Evidence Package
Run State   --snapshot---> Checkpoint
Sources     --select-----> Context
Session     --promote----> Memory
Experience  --derive-----> Skill Candidate
Run State   --materialize> Artifact
Artifact    --reference--> Run State / Session / Context
Events      --fold-------> State Projection
```

每种变换都有不同失败模式：

- `observe` 可能读取到过期、局部或结果未知的世界；
- `record` 要保留原始回执、观察主体、时间和世界版本，不能只存解析后的结论；
- `derive` 必须保留来源、变换、Scope、版本和冲突，不能把推断伪装成原始事实；
- `select` 是有损投影，不能反向覆盖来源；
- `snapshot` 必须绑定控制位置与版本；
- `promote` 需要验证、去敏和 Scope 审查；
- Skill Candidate 还要经过泛化、权限审查、评测、版本化发布与撤销门禁；
- `materialize` 需要原子命名、版本和血缘；
- `reference` 需要防止悬空与版本漂移；
- `fold` 依赖完整、有序、兼容的 Event。

因此，“把 Session 存进 Memory”“把 State 放进 Context”“从 Event 恢复 Checkpoint”都不是复制字段这么简单。真正需要设计的是箭头：谁触发变换、变换损失什么、何时提交、失败后哪一侧仍是事实源。

## 跨 Store 的提交、并发与生命周期

状态分布在多个 Store 和外部系统以后，以下问题会直接破坏事实一致性与恢复正确性：

| 工程问题 | 需要守住的语义 | 常见控制 |
| --- | --- | --- |
| 可见完成早于提交 | Final Token、Run State、Session、Artifact 与真实世界可能处于不同提交状态 | Completion Gate、Outbox、明确 Pending / Unknown |
| Session Lost Update | 每个可变聚合都有 Version 与冲突边界 | 单写者、Event Append、CAS、Branch |
| 未知 Effect 被重试 | 同一逻辑行动拥有稳定意图身份和可查询回执 | Effect ID、Idempotency Key、Reconcile |
| Zombie Attempt | 只有当前执行所有者可以提交 | Lease、Fencing Token、Attempt Version |
| 旧 Checkpoint 强行恢复 | 恢复点绑定 Runtime 与外部世界版本 | 兼容校验、迁移、拒绝 Resume |
| Claim / Memory 污染 | 可复用声明是带来源和失效规则的发布结果 | Candidate、证据、冲突、TTL、更正与撤销 |
| Artifact 漂移 | 引用固定到不可歧义版本 | Version、Content Hash、Lineage |

Agent 往往同时写文件系统、数据库、对象存储和第三方 API，它们通常没有全局事务。与其宣称 Exactly-once，更实际的做法是缩小原子边界，让状态和待发布事件可恢复，让消费者去重，并在结果未知时先 Reconcile。Effect ID 还必须表达“同一份行动意图”，不能只靠参数 Hash 猜测。

生命周期同样属于语义：Session、Memory、Checkpoint、Artifact 与 Effect Receipt 应有不同的 Retention、更正和删除路径。创建时没有定义失效、迁移与级联删除，通常意味着系统还没有真正拥有这份状态。

## 不同框架怎样落在这张地图上

下表只做限定映射，不宣称它们提供相同保证：

| 框架 | 相关对象 | 可以确认的语义 | 仍需追问 |
| --- | --- | --- | --- |
| tRPC-Agent-Go | Invocation State、Session、Memory Service、Artifact Service、Graph Checkpoint | Session 与独立服务可分离；Graph 有 per-invocation state、pending writes 与 checkpoint namespace | 各后端原子边界、Effect Receipt、跨服务删除 |
| Google ADK | Session、Event、Session State、Memory Service、Artifact Service | Session/State 聚焦当前交互，Memory 可跨 Session，Artifact 独立版本化 | 并发 Session 更新、恢复与外部世界校验 |
| OpenAI Agents SDK | Run Context、LLM Context、Session、RunState | 本地 Context 与模型 Context 分离；Session 管历史；RunState 可序列化中断执行 | 应用自定义 Context 的持久化、外部 Effect 一致性 |
| LangGraph | Graph State、Thread、Checkpoint、Store | Checkpoint 保存 thread 内步骤状态；Store 可跨 thread；支持 Pending Writes 与 Replay | Node 副作用幂等、Graph/State 版本迁移 |

框架名字只能帮助定位代码，不能替代契约审查。真正的问题始终是：

- Scope ID 是什么；
- 哪一份是事实源；
- 何时提交；
- 并发时谁拥有写权限；
- 崩溃后凭什么安全继续。

## 状态边界检查

面对一个 Agent Framework、Harness 或产品，可以用十条约束检查它的状态设计：

1. **先定角色再定存储**：这份数据属于 Context、Run、Session、Memory、Checkpoint 还是 Artifact？
2. **观察与声明分离**：原始 Tool Receipt、解析结果、模型推断和 Verification Result 是否可区分？
3. **证据可追溯**：Claim 是否绑定 Provenance、World Version、Freshness 与冲突状态，并能表达 Unknown？
4. **投影可重建**：Model Context 能否从更权威、带来源的版本重新编译？
5. **写入有身份**：每个可变聚合是否有 Scope、Version、逻辑写入者与冲突规则？
6. **连续性不混用**：Session 是否被误当成 Run 身份、事务或恢复点？
7. **恢复会校准现实**：Checkpoint 是否包含控制位置、待处理 Effect 与 Runtime 指纹，并在 Resume 时重查外部世界？
8. **复用经过发布**：Memory 与 Skill Candidate 是否区分来源、验证、时效和撤销路径？
9. **产物引用不漂移**：Artifact Reference 是否固定版本、Hash、来源与访问范围？
10. **提交与生命周期明确**：哪些 Store 必须先提交才能显示完成，各角色何时更正、迁移和删除？

如果这些问题没有答案，“支持状态、记忆和恢复”仍然只是功能名称。

## 结论

Context、Run State、Session、Memory、Store、Checkpoint 与 Artifact 的区别，不在于谁保存得更久，而在于它们分别保护哪一种连续性：

- Context 保护当前决策所需的信息边界；
- Run State 保护一次执行的操作连续性；
- Session 保护人与系统的交互连续性；
- Memory 保护经过筛选的信息复用；
- Checkpoint 保护可验证的执行恢复；
- Artifact 保护输入与交付物的身份和版本；
- Store 为这些语义提供不同强度的持久化能力。

Observation、Claim 与 Evidence 横跨这些角色：Observation 可以进入 Run State，Claim 可以被投影进 Context，Evidence 可以固化为 Artifact，经过发布的结论才可能进入 Memory。无论落在哪里，它们都不能失去来源、Scope、版本和失效条件。

成熟的 Agent 产品不会因为“数据已经保存”就宣布状态安全。它会继续追问：保存的是事实还是投影，写入基于哪个版本，外部副作用是否已经发生，谁仍拥有提交权，以及恢复以后会不会重复伤害真实世界。

> **状态系统的目标不是让 Agent 永远记得更多，而是让它在崩溃、并发、重试和变化之后，仍然知道什么可以相信、什么必须重查，以及下一步怎样安全发生。**

这些状态最终都要服务于某个可追溯的任务版本：Goal 与 Constraint 怎样形成 Contract、Plan 怎样在不改变任务的前提下重写、完成证据怎样绑定 Contract 与 World Version，详见 [04｜Agent 的任务边界](04-agent-task-semantics.md)。

## 参考资料

- [PROV-DM: The PROV Data Model — W3C](https://www.w3.org/TR/prov-dm/)
- [Context management — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/context/)
- [Sessions — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/sessions/)
- [RunState — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/ref/run_state/)
- [Session、State 与 Memory — Google ADK](https://adk.dev/sessions/)
- [Artifacts — Google ADK](https://adk.dev/artifacts/)
- [Noop Session — tRPC-Agent-Go](https://trpc-group.github.io/trpc-agent-go/session/noop/)
- [Graph Agent — tRPC-Agent-Go](https://trpc-group.github.io/trpc-agent-go/graph/)
- [Persistence — LangGraph](https://docs.langchain.com/oss/python/langgraph/persistence)
- [Temporal Workflow Execution](https://docs.temporal.io/workflow-execution)
- [Making retries safe with idempotent APIs — AWS Builders' Library](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
- [Transactional Outbox — Microsoft Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/databases/guide/transactional-out-box-cosmos)
- [tRPC-Agent-Go @ 93d495b](https://github.com/trpc-group/trpc-agent-go/tree/93d495b44e252f5dc3b0d55067a12eb84a60be94)
- [Google ADK for Python @ eebdf22](https://github.com/google/adk-python/tree/eebdf22c07d66b35d41b3307b964c2f37d237a57)
- [OpenAI Agents SDK for Python @ 2cec489](https://github.com/openai/openai-agents-python/tree/2cec48924bcd5f514091aaf6ae2a38683710437e)
- [LangGraph @ b2926a0](https://github.com/langchain-ai/langgraph/tree/b2926a0ff9589c28c7e01fe7cdbb337b86d5a4b4)
