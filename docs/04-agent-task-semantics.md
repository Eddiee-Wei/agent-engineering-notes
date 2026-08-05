---
title: "Agent Task Boundaries: Goal, Plan, Steering, and Completion"
nav_title_zh: Agent 的任务边界：Goal、Plan、Steering 与 Completion
nav_order: 4
description: 区分 Request、Task Definition、Plan、Steering 与 Completion，理解 Agent 任务如何形成、变更和被证据验收。
---

# 04｜Agent 的任务边界：Goal、Plan、Steering 与 Completion

在[从模型调用到 Agent](01-agent-primer.md)中，Goal 与 Completion Contract 是动态执行闭环的起点和终点；[Agent Runtime](02-agent-runtime-semantics.md)解释了 Run、Attempt 与 Outcome；[Agent 的状态边界](03-agent-state-semantics.md)又要求每条状态声明绑定 Scope、Version 与 Provenance。把三者连起来以后，还剩下一个看似简单、实际经常缺位的对象：**这次执行究竟承诺完成什么？**

很多系统直接把最后一条用户消息传给 `runner.run()`，随后把消息历史、系统提示词、计划和工具结果都塞进同一个 Context。模型看起来知道任务，Runtime 也确实在运行，但系统未必能回答：

- 哪句话定义了 Goal，哪句话只是背景或建议？
- “不能修改公开 API”是软偏好、过程约束还是不可破坏的不变量？
- 模型发现原计划行不通以后，可以改 Plan，还是也可以降低验收标准？
- 用户中途说“顺便升级依赖”，这是补充信息、修改当前任务还是创建新任务？
- 测试通过对应哪个代码版本、哪个任务版本，能否证明现在的任务已经完成？
- 子 Agent 都返回成功，为什么父任务仍可能失败？

本文采用一套**框架无关但不假装是行业标准**的分析坐标。核心判断是：

> **Task 不是 Prompt 字符串，也不是当前 Plan。生产系统需要一个可版本化的 Task Contract：它固定期望的世界变化、受保护边界与完成证据；Plan 可以随观察重写，Contract 只能通过明确的变更协议修改，Outcome 则必须由对应版本的证据裁决。**

## 一个“测试全绿，但任务失败”的结果

继续使用贯穿前三篇的任务：**修复失败的认证测试，并证明修改有效**；同时不得修改公开 API、覆盖用户改动或顺带升级依赖，最终要提供测试命令、退出码和代码版本。

Agent 读取日志后发现，把 `Authorize(user)` 改成 `Authorize(user, policy)` 最容易通过测试。它修改生产代码，也更新了测试调用点，随后全量测试变绿，并输出“修复完成”。

从局部轨迹看，它做对了很多事情：选中了相关文件，代码可以编译，测试也真实执行过。但任务仍然失败，因为：

1. 测试通过是一个 **Postcondition Candidate**，不是整个 Goal；
2. 公开 API 不变是执行全过程必须保护的 **Invariant**；
3. 修改测试使其接受新接口，不能反向证明原需求已经满足；
4. 如果测试证据没有绑定 Workspace Commit，它甚至不能证明当前交付版本仍然通过。

这类失败不是模型“不够聪明”这么简单。系统把 Goal、Constraint、Plan 与 Completion 混成一段文本，导致它只知道“现在准备做什么”，却没有一份稳定依据判断“什么绝对不能被做”和“最终必须证明什么”。

## User Request、Intent 与 Task 不是同一个对象

用户消息首先是一份输入证据，而不是天然完整的执行契约。

```text
User Request
→ Intent Candidate
→ Task Draft
→ Clarify / Authorize
→ Task Contract Version
→ Runtime Execution
```

这几层分别回答不同问题：

- **User Request**：用户实际表达了什么，包括正文、附件、后续消息与显式撤回；
- **Intent Candidate**：系统当前怎样解释用户为什么提出请求；
- **Task Draft**：把目标、范围、约束、假设和缺口整理成可讨论结构；
- **Task Contract**：经过必要澄清和授权后，某个执行可以依赖的版本化规范；
- **Run**：Runtime 对指定 Contract Version 的一次因果执行。

从 Request 到 Contract 不是无损解析。自然语言里经常同时存在：

- 指代不清：“把它修好”中的“它”是哪一个失败？
- 隐含范围：“不要动接口”是否也禁止增加兼容重载？
- 条件冲突：“今天必须发布”与“所有回归测试必须通过”同时无法满足；
- 不可靠假设：“这个接口没人使用”可能只是用户推测；
- 外部 Policy：即使用户要求，也不能读取越权数据或绕过审批。

模型可以生成 Intent Candidate 和 Task Draft，却不应独自把高风险歧义固化成事实。缺少必要信息时，正确状态是 `NeedsClarification`；要求不受支持或违反 Policy 时，正确结果可能是 `Rejected` 或 `Stopped`。用一段自信的任务摘要掩盖歧义，只会让错误更难被发现。

Task Contract 也不是法律合同，更不要求所有 SDK 实现同名类。它是一种工程契约：只要系统承诺长期运行、暂停恢复、多人协作或产生真实副作用，就必须能重建当时执行所依据的目标与边界。

## 五层任务模型

与其平铺一组容易混用的名词，不如把任务理解为五层对象：

| 层次 | 包含什么 | 保护的边界 |
| --- | --- | --- |
| Request / Intent | 原始消息、附件、用户动机与解释 | 原始表达不能被模型摘要改写成事实 |
| Task Definition | Goal、Scope、Non-goal、Constraint、Invariant、Preference、Policy 引用 | 规定要改变什么、不能改变什么、谁有权授权 |
| Plan | 当前路径、步骤、假设与预算分配 | 可随 Observation 重写，但不能静默降低 Goal |
| Steering / Amendment | 新证据、计划提示、契约修订、取消或新任务 | 新输入必须先分类，再决定是否产生新版本 |
| Completion / Acceptance | Condition、Evidence、Verdict、Delivery 与人工接受 | 模型只能提出完成，证据才有资格裁决完成 |

其中四个区别最关键：Intent 解释“为什么”，Goal 说明“世界要怎样改变”；任务内 Constraint 不等于外部 Policy；Invariant 必须在高风险 Action 前形成门禁，而不只是最后检查；Plan 是可证伪假设，不是 Contract 或事实。

## Task Contract 固定的是执行依据

一个框架无关的 Task Contract 可以长成这样：

```python
class TaskContract:
    task_id: str
    version: int
    derived_from: list[SourceRef]
    requester: PrincipalRef

    scope: Scope
    non_goals: list[str]
    goal_conditions: list[Condition]
    invariants: list[Condition]
    process_constraints: list[Condition]
    preferences: list[WeightedPreference]

    inputs: list[VersionedReference]
    world_assertions: dict[str, str]
    budgets: Budget
    completion: CompletionContract

    assumptions: list[Assumption]
    open_questions: list[Question]
    policy_refs: list[VersionedReference]
```

这不是建议把一切都变成庞大 JSON，而是揭示一份可托付任务至少有八类信息：

1. **Identity**：这是哪个 Task、哪个版本；
2. **Provenance**：要求来自哪条消息、工单、审批或业务对象；
3. **Scope**：可以改变哪些对象，哪些明确不在范围内；
4. **Desired Delta**：完成前后的世界应有什么可观察差异；
5. **Protected Boundary**：执行中不能破坏哪些条件；
6. **Inputs and Assertions**：任务基于哪个 Workspace、Artifact、Schema 或外部资源版本；
7. **Evidence Standard**：哪些检查、回执或人工判断足以证明完成；
8. **Change Authority**：谁可以澄清、扩展、取消或替代这份契约。

Task Contract 应保存来源引用，而不是只留下模型改写后的摘要。摘要可能遗漏限定词，也可能把“最好不要”升级成“禁止”，或把“必须”弱化成“尽量”。当用户质疑结果时，系统需要从 Contract 回到原始 Request，而不是让模型解释自己当初可能理解了什么。

Contract 也不应该直接等于 Model Context。Context 是对当前 Model Turn 的有损投影，可能压缩、裁剪或隐藏敏感字段；Contract 是更稳定的事实源。模型每轮只需要看到与当前决策相关的 Contract Projection，Runtime 和 Verifier 则保留完整版本。

### Assumption 是待偿还的认知债务

自然语言编译 Task 时，应区分 **Confirmed**、带来源与失效条件的 **Inferred**，以及产品为了继续执行而采用、允许用户纠正的 **Defaulted**。猜错日志语言可能只影响效率；猜错仓库、生产环境或可修改范围会改变真实副作用，必须在 Action 前验证或澄清。

Task Draft 可以保留 `assumptions` 与 `open_questions`；进入 Ready 后，每项都应被验证、显式接受、确定性默认或标为阻塞。Observation 只推翻计划依据时可以 Replan；影响 Goal、Scope、Invariant 或证据标准时必须 Amendment。

## Goal 应描述世界变化，而不只是输出形状

对于真实任务，更有用的表达是：

```text
Task Success
= Desired World Delta
+ Protected Invariants
+ Required Deliverables
+ Sufficient Evidence
```

仍以修复测试为例：

| 类型 | 示例 | 检查时机 |
| --- | --- | --- |
| Precondition | Workspace 仍基于 Commit `C1`；失败可以复现 | 开始与恢复前 |
| Goal Condition | 认证缺陷被修复，原输入得到预期行为 | Completion |
| Postcondition | 目标测试与约定回归集通过 | Completion |
| Invariant | 公开 API 不变；用户已有修改不丢失 | 每次相关 Action 前后 |
| Process Constraint | 只修改允许路径；写入前取得审批 | Action 前 |
| Budget | 最多 40 步、30 分钟、指定成本 | 全程累计 |
| Non-goal | 不升级依赖，不重构无关模块 | Scope 判断时 |
| Preference | 在可行方案中优先选择更小 Diff | 方案排序时 |
| Policy | 不可访问密钥；禁止未经审批的生产写入 | 确定性控制面 |

这种拆分避免了两个常见错误。

第一，**把代理指标当 Goal**。测试通过只是对某些行为的采样，不代表所有业务语义都正确。修改测试、跳过用例或在错误 Workspace 运行，都可能让指标变绿而目标未达成。

第二，**把软偏好当硬约束，或反过来**。较小 Diff 通常是 Preference；保护用户改动应是 Invariant。如果二者冲突，系统可以接受稍大修改，却不能为了更漂亮的 Diff 丢失用户工作。

硬条件互相矛盾时，不存在“更聪明的 Agent 就能解决”的保证。系统应暴露冲突并请求取舍；如果操作者没有修改 Contract 的权限，Runtime 只能阻塞、停止或拒绝，而不是让模型自行决定哪条要求不再重要。

## Plan 是可替换的假设

Plan 回答“基于当前证据，准备怎样做”，因此它应当被设计成可以失败：

```text
Contract v3
├── Goal: 修复认证缺陷
├── Invariant: 公开 API 不变
└── Plan v1: 修改函数签名       ← 被 Invariant 否决
    Plan v2: 调整内部适配层     ← 测试暴露并发问题
    Plan v3: 修复缓存键与适配层 ← 当前候选
```

环境证据可以改变 Plan：搜索结果证明文件不存在，测试推翻错误归因，工具返回权限拒绝，用户提供新的日志。这些都属于正常 Replan。

环境证据不能自动改变 Contract。发现“不改 API 很难”只能说明当前计划或能力不足，不能证明“不改 API”已经失效。同样，预算即将耗尽时，Runtime 可以 Stopped 或请求扩充预算，不能把 Completion Contract 改成“尽力而为”以后宣布 Completed。

生产系统至少应区分：

- `contract_version`：目标、Scope、硬约束与验收标准的版本；
- `plan_version`：当前路径与步骤的版本；
- `state_version`：Run State 已提交到哪个版本；
- `world_version`：行动和证据对应哪个外部世界。

计划项被勾选也不是完成证据。`run_tests` Step 已结束，只说明命令运行过；只有退出码、日志、测试配置和 Workspace Version 被验证后，才能支持相应 Condition。

## Task、Run、Attempt 与 Session 怎样衔接

[Runtime 语义](02-agent-runtime-semantics.md)中的身份坐标可以继续扩展：

```text
Session / Context
└── Task T9
    ├── Task Contract v1
    │   └── Logical Run R42
    │       ├── Attempt A1
    │       └── Attempt A2 after resume
    └── Task Contract v2 or Follow-up Task T10
        └── Logical Run R43
```

这套坐标只强调四条边界：Session 可以包含多个 Task；每个 Run 必须绑定 Contract Version；Retry / Resume 可以创建新 Attempt，但不能顺便换 Goal；一个产品级 Task 也可以包含执行、独立验证和人工验收等多个 Run。更细的身份和恢复语义见 [02｜Agent Runtime](02-agent-runtime-semantics.md)。

产品还不应把所有状态压进 `pending / running / done / failed`：

| 维度 | 回答的问题 | 示例 |
| --- | --- | --- |
| Specification | 任务规范是否可执行 | Draft、Ready、Superseded |
| Execution | 当前是否在运行 | Queued、Running、Paused、Terminal |
| Satisfaction | Goal 是否被证据满足 | Unassessed、Satisfied、Unsatisfied、Unknown |
| Delivery / Acceptance | 结果是否送达并被接受 | Delivered、Accepted、Rejected |

Run 失败后 Task 仍可由新 Run 完成；Run 正常结束时 Verdict 也可能是 `unknown`；Artifact 已交付也不代表用户已经接受。UI 可以简化展示，但内部不能丢失这些原因。

![Task Contract、Run 与完成证据的关系](../assets/images/agent-task-contract.svg)

移动端可打开 [SVG 原图](../assets/images/agent-task-contract.svg) 查看细节。图中上层是 Contract 的形成与修订，下层是绑定特定版本的执行和证据链。最重要的关系是：**新 Contract 不能改写旧 Run 已经发生的事实，旧证据也不能未经重新验证就证明新 Contract。**

低风险澄清可以在安全边界更新版本并继续；改变 Goal、权限、受保护对象或完成标准时，通常应停止旧 Run、Reconcile 已发生 Effect，再创建新 Run。无论采用哪种策略，历史 Event 都必须保留当时生效的 `contract_version`。

## Steering 首先是输入分类

Agent 运行中收到新消息，不能一律追加到 Context 后继续。系统应先判断它改变了哪一层：

| 新输入 | 示例 | 应更新什么 | 是否通常需要 Contract Version |
| --- | --- | --- | --- |
| Observation / Evidence | “这里是刚产生的完整错误日志” | Run State、Context、Plan | 否 |
| 事实纠正 | “目标分支是 `release`，不是 `main`” | World Assertion；重新验证已做工作 | 是，若执行基线改变 |
| Plan Hint | “可以先看看最近提交” | Plan Candidate | 否 |
| Constraint Amendment | “不能修改数据库 Schema” | Constraint / Invariant | 是 |
| Scope Expansion | “顺便升级依赖并清理旧代码” | Scope、Goal、Budget | 是，或创建新 Task |
| Policy / Permission Change | 审批通过、凭据撤销 | 外部 Policy、Capability | Contract 引用和执行权需重验 |
| Cancel / Supersede | “先别修了，改成只输出诊断报告” | 原 Task 终止；创建替代 Contract | 是 |
| Independent Request | “再帮另一个仓库修同类问题” | 新 Task | 新身份 |

一个可审计的变更协议可以压缩为：

```text
Classify Input → Assess Impact → Pause Safely → Reconcile Old Effects
→ Authorize Amendment → Resume or Start New Run
```

难点在 `Reconcile`：如果 v1 已经修改文件，而 v2 新增“不得修改该文件”，系统不能只替换 Context。它必须说明旧修改如何保留、撤销、补偿或交给人处理。

变更影响也有层级：`cosmetic < evidence-only < replan < reauthorize < new-run < new-task`。Amendment 应保存父版本、修改字段、来源、授权者和生效时间。用户补充一句话不自动代表有权修改所有字段；组织 Policy 与权限仍由外部控制面决定。

## Completion 是一份带版本的裁决

模型停止调用工具并生成最终文本，只说明它提出了 **Final Candidate**。任务完成还需要一条更严格的链：

```text
Final Candidate
→ Completion Claim
→ Evidence Collection
→ Condition Evaluation
→ Completion Verdict
→ Run Outcome
→ Delivery / Acceptance
```

一个 Verdict 可以包含：

```python
class CompletionVerdict:
    task_id: str
    contract_version: int
    status: Literal[
        "satisfied", "unsatisfied", "unknown", "needs_human"
    ]
    condition_results: list[ConditionResult]
    evidence_refs: list[VersionedReference]
    world_versions: dict[str, str]
    unknowns: list[str]
    evaluator_version: str
    evaluated_at: datetime
```

这里的 `unknown` 非常重要。测试请求超时，不等于测试失败，也不等于测试通过；外部部署请求返回超时，可能是没有执行，也可能已经成功。不能证明完成时，系统应暴露证据缺口，而不是让模型根据语气补齐结果。

Verdict 必须回答：

- 每个 Required Condition 是否分别通过；
- 所有 Invariant 是否有足够覆盖，而不只是没有发现问题；
- Evidence 对应哪个 Workspace、Artifact 和外部资源版本；
- Evidence 是否过期、是否由同一错误假设生成；
- 哪些判断来自确定性检查，哪些来自 Judge 或人工；
- 失败是任务未满足、执行故障、策略拒绝还是结果未知。

在本文沿用的 Runtime 语义中，只有 Completion Contract 通过，Run 才进入 `Completed`；`Failed`、`Cancelled`、`TimedOut`、`Stopped` 与 `Paused` 分别保留执行故障、停止原因和是否仍可继续。许多 SDK 在 Final Output 形成时即可结束 Agent Loop，但应用仍要用测试、数据库状态、Artifact 或人工验收判断业务 Goal。

Completion Contract 本质上是一套证据策略：每个 Condition 需要 Predicate / Rubric、证据类型、Evaluator 版本、World Scope / Freshness 和失败语义。多个 Condition 也不是计算简单通过率；Required Invariant 未验证，不能被其他绿色指标平均掉。

Verifier 不是事实制造者。LLM-as-Judge 可以判断文风，却不应仅凭 Transcript 断言生产资源已经创建。Delivery 与 Acceptance 也应分开：Artifact 可用不代表开放式任务已被责任人认可，必要时 Verdict 应明确返回 `needs_human`。

## 通往 Multi-Agent：委派的是子契约

Multi-Agent 委派时，Child Assignment 至少要携带父任务版本、派生 Goal、允许 Scope、继承约束、输入版本、预算、预期 Artifact、证据要求与验收责任人。子 Agent 可以在自己的 Scope 内规划，却不能放宽父任务的不变量；父 Agent 也必须在合并后重新验证兼容性和全局 Completion Contract。

Handoff、Agent-as-Tool 与 Child Task 解决的控制权和生命周期并不相同。它们怎样形成协作拓扑、隔离状态、处理部分失败并完成团队收敛，详见 [05｜Multi-Agent：委派、协作与团队收敛](05-multi-agent-collaboration.md)。无论采用哪一种方式，子契约派生、约束继承和父任务验收都不能被省略。

## 八类失败：从“看起来完成”追到契约缺口

| 失败模式 | 被混淆的对象 | 典型后果 | 应维护的不变量 |
| --- | --- | --- | --- |
| Prompt-as-Task | Request = Contract | 过期消息、背景信息或注入内容变成任务要求 | Contract 有明确来源与授权 |
| Silent Goal Drift | Plan = Goal | 遇到困难后偷偷降低目标 | 只有 Amendment 能改变 Goal |
| Plan-as-Proof | Step Done = Condition Satisfied | 命令运行过就宣布成功 | Completion 依赖证据而非步骤状态 |
| Constraint Laundering | Hard = Soft | 不变量被模型重新解释成偏好 | 条件类型与变更权限固定 |
| Moving Goalpost | Context Update = Contract Update | Run 不知道自己执行哪个版本 | Action 与 Event 绑定 Contract Version |
| Stale Evidence | Evidence = Timeless Truth | 旧测试证明新代码或新需求 | Evidence 绑定 World Version 与时间 |
| Scope Creep | Follow-up = Same Task | “顺便”不断扩大权限、成本和风险 | Scope 扩展需修订或新 Task |
| Local Success | Child Completed = Parent Completed | 子结果冲突、合并后破坏全局条件 | 父任务独立验收端到端结果 |

这些控制不保证需求永远清晰，也不保证 Verifier 永远正确。它们的价值是让失败类型可见：系统知道当前缺的是授权、信息、可行方案、环境证据还是人工判断，而不是把一切包装成新的 Prompt 再试一次。

## 不同框架和协议怎样落在这套坐标上

以下映射锁定到 2026-08-03 检查的官方资料与源码：A2A [`2cdf197`](https://github.com/a2aproject/A2A/tree/2cdf197805cf3eb780714f730cdfd24bce1c9998)、tRPC-Agent-Go [`0cf9fb2`](https://github.com/trpc-group/trpc-agent-go/tree/0cf9fb2bfd0204230ac694b3f16732979110dded)、Google ADK Python [`f4e7233`](https://github.com/google/adk-python/tree/f4e7233469e3595336dfb0d84c281b2f6245ce4c)、OpenAI Agents SDK Python [`e943ded`](https://github.com/openai/openai-agents-python/tree/e943deda36b4dd43249df1236e32318acbc61473)、LangGraph [`b2926a0`](https://github.com/langchain-ai/langgraph/tree/b2926a0ff9589c28c7e01fe7cdbb337b86d5a4b4)。它比较的是语义位置，不表示类型可以直接互换。

| 系统 | 暴露的相关对象 | 可以确认的语义 | Task Contract 仍需谁负责 |
| --- | --- | --- | --- |
| A2A | `contextId`、`Task`、`TaskState`、Message、Artifact | Context 可包含多个 Task；Task 有中断与终态；终态 Task 不重启，后续精炼创建同 Context 下的新 Task | 协议不替客户端定义领域 Goal、Invariant 与充分证据 |
| tRPC-Agent-Go | Run Input、RequestID、InvocationID、Session、Event | API 将 Session、Input、Profile 与 RunOptions 转成一次 Runner Run；父子 Invocation 可独立关联 | 应用或上层 Workflow 编译需求并把版本写入 State/Options/Event |
| Google ADK | User Query、Invocation、Session、Event、Artifact | Invocation 表示响应单次用户查询的执行；Runner 通过 Event 提交状态与 Artifact | 应用 State 与 Agent Logic 定义任务字段、修订和验收 |
| OpenAI Agents SDK | Run Input、RunState、Guardrail、Handoff、RunResult | Runner 驱动 Tool/Handoff 循环；RunState 可恢复中断；Guardrail 检查输入、工具与最终输出 | 应用定义领域 Goal、外部世界检查和 Completion Verdict |
| LangGraph | Thread、Graph State、Task、Checkpoint、Interrupt | Thread 聚合多次 Run 的 Graph State；Checkpoint/Interrupt 支持更新、暂停和恢复 | State Schema 与 Workflow 必须显式保存 Contract Version 和变更规则 |

A2A 的 Task 最接近跨 Agent 可追踪 Unit of Work，但它的 `status`、`artifacts` 与 `history` 仍不会替领域应用定义 Goal、Invariant 和充分证据。其他 Runtime 也说明同一边界：拥有 Run、Invocation、Thread 或可恢复 State，不代表自动拥有稳定任务规范。

## 任务边界检查

面对一个 Agent Framework、Harness 或产品，可以先问八个问题：

1. **Request 与 Contract 是否分离**：原始表达、系统解释和已授权 Task 分别保存在哪里？
2. **任务定义是否可区分**：Goal、Scope、Constraint、Invariant、Preference 与 Policy 各由谁决定？
3. **Plan 能否失败而 Goal 不漂移**：Observation 到来后改的是路径，还是验收标准？
4. **执行是否绑定版本**：Run、Action、Event 和 Verdict 能否追溯当时的 Contract Version？
5. **Steering 是否先分类**：新消息是证据、计划提示、Amendment、Cancel 还是 New Task？
6. **旧 Effect 是否被协调**：新约束生效前已经发生的副作用怎样保留、撤销或补偿？
7. **完成是否依赖证据**：Evidence 是否绑定 Condition、World Version、来源与新鲜度，并表达 Unknown / NeedsHuman？
8. **委派是否保留父边界**：子任务怎样继承约束、提交 Artifact，并由父任务做端到端验收？

如果这些问题没有答案，“Agent 正在执行一个任务”通常只意味着模型正在消费一段上下文。

## 结论

一个任务系统真正保护的不是 Prompt，而是人的意图在多步执行中的稳定性：

- Request 保存原始表达；
- Intent 解释为什么；
- Goal 描述期望的世界变化；
- Constraint 与 Invariant 划定不可越过的边界；
- Plan 提供可随证据更新的路径；
- Task Contract 固定执行与变更依据；
- Completion Verdict 用对应版本的环境证据判断满足程度；
- Outcome 说明一次 Run 为什么不再继续。

Agent 的自治不来自自由解释任务，而来自在稳定契约内动态选择行动。最值得保留的工程边界是：

> **证据可以改变 Plan，授权才能改变 Contract；模型可以提出完成，只有绑定任务版本和真实世界的证据才能裁决完成。**

## 参考资料

- [Life of a Task — Agent2Agent Protocol](https://a2a-protocol.org/latest/topics/life-of-a-task/)
- [A2A Protocol Specification](https://github.com/a2aproject/A2A/blob/2cdf197805cf3eb780714f730cdfd24bce1c9998/docs/specification.md)
- [tRPC-Agent API — tRPC-Agent-Go](https://trpc-group.github.io/trpc-agent-go/trpcagent/)
- [Agent — tRPC-Agent-Go](https://trpc-group.github.io/trpc-agent-go/agent/)
- [Tool — tRPC-Agent-Go](https://trpc-group.github.io/trpc-agent-go/tool/)
- [Runtime Event Loop — Google ADK](https://adk.dev/runtime/event-loop/)
- [Running agents — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/running_agents/)
- [Results — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/results/)
- [Guardrails — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/guardrails/)
- [Handoffs — OpenAI Agents SDK](https://openai.github.io/openai-agents-python/handoffs/)
- [Persistence — LangGraph](https://docs.langchain.com/oss/python/langgraph/persistence)
- [Interrupts — LangGraph](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [A2A @ 2cdf197](https://github.com/a2aproject/A2A/tree/2cdf197805cf3eb780714f730cdfd24bce1c9998)
- [tRPC-Agent-Go @ 0cf9fb2](https://github.com/trpc-group/trpc-agent-go/tree/0cf9fb2bfd0204230ac694b3f16732979110dded)
- [Google ADK for Python @ f4e7233](https://github.com/google/adk-python/tree/f4e7233469e3595336dfb0d84c281b2f6245ce4c)
- [OpenAI Agents SDK for Python @ e943ded](https://github.com/openai/openai-agents-python/tree/e943deda36b4dd43249df1236e32318acbc61473)
- [LangGraph @ b2926a0](https://github.com/langchain-ai/langgraph/tree/b2926a0ff9589c28c7e01fe7cdbb337b86d5a4b4)
