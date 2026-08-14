---
title: Agno
description: Agno 2.x 的 Agent、Team、Workflow、AgentOS 运行时语义与生产工程边界。
last_verified: 2026-08-13
---

# Agno

> 本文以 **2026-08-13** 可核实的官方资料与源码为准。版本锚点是当日发布的 [Agno v2.9.0](https://github.com/agno-agi/agno/releases/tag/v2.9.0)，对应提交 [`b889441`](https://github.com/agno-agi/agno/commit/b8894410bc40f94c82377b5e7f2eb59a6528fdac)。

## 一句话定位

Agno 是一个 Python Agent 运行栈：用 `Agent` 表达单个模型—工具循环，用 `Team` 表达多 Agent 协作，用 `Workflow` 表达显式控制流，再用 `AgentOS` 把这些定义暴露为可部署、可观测、可鉴权的服务。它不只是提示词封装，也不是替应用接管全部业务一致性的分布式任务平台。

理解 Agno 2.x 的关键是把两层分开：

- `Agent`、`Team`、`Workflow` 是可复用的**定义**；2.0 重构后它们按无状态方式设计。
- 一次执行的输入、事件、输出、指标和中断要求属于 **Run**；跨多次 Run 的对话与应用状态属于 **Session**；长期偏好或事实属于 **Memory**。

这与本站的 [Agent Runtime 语义](../docs/02-agent-runtime-semantics.md) 和 [状态语义](../docs/03-agent-state-semantics.md) 相吻合：不要把 Python 对象本身当成持久化中的 Run，也不要把“模型要求调用工具”当成工具已成功完成。

## 定位与边界

Agno 的公开接口形成一条连续路径：

1. 用 Agent 快速构造一个带模型、工具、知识与记忆的自主循环；
2. 用 Team 让多个角色协调、路由、广播或按任务协作；
3. 用 Workflow 把关键路径固定成步骤、分支、循环和并行块；
4. 用 AgentOS 提供 HTTP/API、会话管理、鉴权、追踪和运行控制。

因此，它很适合“既需要模型自主性，也需要一部分确定性编排”的 Python 应用。边界同样明确：模型供应商限流、外部副作用的 exactly-once、跨服务事务、租户配额、业务审批授权，以及分布式 Worker 的租约与重试策略，仍由应用或基础设施负责。

## 核心抽象

| 抽象 | 负责什么 | 不应混同为 |
| --- | --- | --- |
| `Agent` | 模型调用、工具选择与执行、上下文组装、一次或多轮 Agent loop | 持久化队列或业务事务 |
| `Team` | 成员选择、委派、汇总以及多 Agent 的协作策略 | 确定性 DAG |
| `Workflow` | `Step`、`Loop`、`Parallel`、`Condition`、`Router` 组成的显式控制流 | 单个 Agent 的隐式思考过程 |
| `RunOutput` | 一次运行的结果、事件/指标及 HITL 要求 | 跨会话长期状态 |
| `Session` | 一组 Run、对话历史、会话状态和指标 | 长期语义记忆 |
| `Memory` | 跨运行保留并检索用户事实或偏好 | 完整审计日志 |
| `Knowledge` | 文档摄取、检索与上下文增强 | 权限系统或事实真值库 |
| `AgentOS` | 将 Agent/Team/Workflow 作为服务运行和管理 | 自动获得的无限横向扩展 |

[`Workflow` 构建文档](https://docs.agno.com/workflows/building-workflows)规定每个 `Step` 只承载一个 Agent、Team、普通函数或嵌套 Workflow；`Loop`、`Parallel`、`Condition` 和 `Router` 再组合出控制图。这个约束使“由代码决定下一步”与“由模型决定下一步”在结构上可见。

## 运行时与事件循环

### Agent Run

一次 Agent Run 可以抽象为：

```text
接收输入
  -> 读取 session / memory / knowledge，组装模型上下文
  -> 调用模型
  -> 若模型产生 tool call：校验与策略检查 -> 执行工具 -> 写回 observation
  -> 重复模型—工具循环，直到终止、取消、超限、出错或需要人工介入
  -> 生成 RunOutput，并写入配置的数据库/追踪系统
```

工具调用至少包含两个不同事实：“模型生成了候选 Tool Call”与“运行时实际执行并得到结果”。生产审计需要同时记录候选参数、授权决定、执行结果和副作用标识，不能只保存最终文本。

同步 `run()`、异步 `arun()` 和 streaming 改变的是调用与结果交付方式，不改变这个循环的语义。异步接口可以减少 I/O 等待时对线程的占用；streaming 可以更早传回事件；两者都不等于自动获得跨进程调度、持久消息队列或故障转移。

### Team Run

[`Team` 委派文档](https://docs.agno.com/teams/delegation)给出四种主要模式：

- **Coordinate**：领导者选择成员、形成委派任务并综合结果；
- **Route**：把请求路由给适合的成员；
- **Broadcast**：把同一请求发给多个成员，再汇总；
- **Tasks**：以明确任务组织成员执行。

异步 Broadcast 以及“delegate to all”可以并发调用成员，但这只表示一个 Team Run 内存在并发分支。共享的会话状态、工具配额、超时预算、取消传播和汇总顺序仍需明确。需要可重放确定性的步骤，应放进 Workflow，而不是依赖领导者每次都生成相同计划。

### Workflow Run

Workflow 是显式事件/步骤驱动的运行层。顺序 Step 形成关键路径，`Parallel` 发出并发分支，`Condition` 和 `Router` 选择路径，`Loop` 重复一段结构。嵌套 Agent 或 Team 时，步骤内部仍可能发生自主模型—工具循环，因此 Workflow 的外层确定性并不意味着内部完全确定。

工程上应为每个 Workflow Run 分配稳定的 `run_id`，为分支和工具副作用分配幂等键，并记录分支选择证据。这样恢复时才能判断“重放模型调用”“复用已完成输出”还是“对外部系统做补偿”。

## 状态、会话、记忆与知识

Agno 2.0 的重要变化是去掉 Agent/Team 上会随执行粘住的 run/session 属性，运行结果由 `RunOutput` 返回；数据库通过统一的 `db` 参数接入。官方的 [2.0 变更说明](https://docs.agno.com/other/v2-changelog)和[迁移指南](https://docs.agno.com/other/v2-migration)将这一点列为重构重点。

[`Session` 文档](https://docs.agno.com/sessions/overview)把会话描述为一组 Run 及其对话、状态、历史和指标。普通 Agent/Team 会话以消息和运行历史为主；[`Workflow Session`](https://docs.agno.com/sessions/workflow-sessions)还保存输入、输出、步骤结果、指标和共享状态。应用最好继续区分：

- **Context**：本次模型调用可见的窗口，可裁剪、压缩或重新生成；
- **Run State**：本次尝试的临时状态；
- **Session State**：同一业务会话跨 Run 共享的结构化状态；
- **Memory**：跨会话检索的用户事实/偏好；
- **Knowledge**：由文档与向量检索提供的外部知识；
- **Checkpoint / Artifact**：恢复点与可交付文件，不应塞进聊天历史。

“把历史加入上下文”只是读取策略，不等于已建立可靠的长期记忆。多租户系统必须让 `user_id`、`session_id`、租户键同时进入存储查询、缓存键和追踪属性，并验证调用者确实拥有对应 Session。

## 工具与模型

Agent 可配置模型、工具、知识库、记忆、结构化输入/输出、重试/限额以及模型上下文选项。工具可以是 Python 函数、Agno 工具包或 MCP 等外部能力。推荐把每个工具视为受策略控制的执行适配器：

1. 用明确 schema 限制参数；
2. 将只读与写操作分开；
3. 写操作要求用户/租户上下文、授权和幂等键；
4. 对高风险调用启用确认；
5. 返回结构化证据，而不只返回自然语言“成功”。

v2.9.0 的安全修复说明了这些边界为何重要：官方 release 修复了调用时覆盖 `tool_name` 可绕过 allow-list/HITL/日志的问题，并把 `user_id`、`session_id` 纳入缓存结果键，避免跨用户复用；在 AgentOS 严格分发时，无法解析的持久化组件引用改为返回错误，而不是静默降级。版本升级因此既是功能问题，也是安全与隔离问题。

模型适配层允许替换供应商，但“同一工具 schema”不保证不同模型作出同样决策。应对模型、提示词、工具版本和检索配置做版本化，并用业务样本回归，而不是只验证代码能运行。

## 持久化、恢复与 HITL

### 数据库和恢复边界

为 Agent/Team/Workflow 配置数据库后，Agno 可以保存 Session、Run、Workflow step 数据、记忆等。持久化提供“运行状态可查询/可重建”的基础，但不自动让外部 API、支付、发信或数据库写入变成事务的一部分。恢复策略仍应包含：

- 每个外部副作用的幂等键和最终状态查询；
- Run/Attempt 分离，重试不能伪装成同一次无痕执行；
- 乐观锁、租约或单写者，避免两个 Worker 同时推进同一 Run；
- 完成标记和 outbox/补偿记录，避免 checkpoint 与外部效果分叉。

### 人工介入

[`HITL` 文档](https://docs.agno.com/hitl/overview)支持工具执行前确认、向用户补充输入、以及由外部系统执行工具。Run 会带着 requirement 暂停，应用满足要求后通过 `continue_run` 继续；Team 可以向上传播成员产生的要求。v2.9.0 还增强了 Team 中暂停成员 Run 的持久化与恢复。

Workflow 有单独的 [`Workflow HITL`](https://docs.agno.com/workflows/hitl/overview)：数据库是恢复所需条件，Step/Router 可请求输入，其他控制原语可请求确认。v2.9.0 也会把 Workflow 内 Agent/Team 的工具级 HITL 传播为 Workflow 暂停；`Step`、`Steps`、`Condition`、`Loop` 与 `Router` 会保存暂停状态，应用随后通过 Workflow 的 `continue_run` 恢复。当前 `Parallel` 仍不支持这种 executor-level HITL，因此需要审批的分支不应藏在并行组里；对关键动作，也可以直接使用 Workflow 层的显式门，让控制与审计边界更清楚。

HITL 也不是权限系统。审批人身份、可审批范围、请求过期、重复提交和审计证据仍应在应用层验证。

## 部署、可观测性、评测与安全

### AgentOS 与部署

[`AgentOS`](https://docs.agno.com/agent-os/custom-fastapi/overview)可以集成到 FastAPI/ASGI 应用，并通过 API 运行或取消 Agent、Team、Workflow，管理 Session、Memory 和 Knowledge；[`AgentOSClient`](https://docs.agno.com/reference/clients/agentos-client)提供对应客户端。生产部署可以运行多个 ASGI Worker/副本，但应使用共享数据库、明确的请求路由、租户隔离和一致的密钥管理。

[`AgentOS Security`](https://docs.agno.com/agent-os/security/overview)包含 JWT/RBAC 等接入点，[`Middleware`](https://docs.agno.com/agent-os/middleware/overview)可实现限流、安全头和自定义策略。基础认证适合开发环境；生产环境应使用可验证的身份、最小权限 scope、服务间认证和独立的工具凭据。不要把“模型说可以执行”当成授权决定。

### 可观测性与评测

[`Tracing`](https://docs.agno.com/tracing/overview)可为 Agent、Team、Workflow、模型和工具建立 OpenTelemetry span，并携带 run/session 标识导出到外部系统。建议至少关联：请求 ID、Run/Attempt、Session、模型/提示词版本、工具调用与授权结果、token/延迟、取消原因和最终业务状态；敏感提示、工具参数与响应需要脱敏或分级留存。

[`Evals`](https://docs.agno.com/evals/overview)覆盖准确性、agent-as-judge、性能与可靠性维度。模型裁判适合规模化比较，但不是业务真值；上线门槛还应包含确定性断言、工具契约测试、安全策略测试、人工标注集以及恢复/重试演练。本文不引用官方性能页面中的供应商基准数字，因为它们不能直接推出你的模型、工具、网络和并发配置下的容量。

## 并发、海量请求与工程化扩展

Agno 提供异步执行、并行 Workflow/Team 分支、流式响应和后台运行，但要分别判断它们的能力：

- `arun()` 让单进程更有效地等待模型/网络 I/O；CPU 密集工具仍需独立执行池。
- streaming 是交付协议，不是调度协议；客户端变慢时还需要背压和断连处理。
- `Parallel`/Broadcast 扩大一个 Run 内的并发，也会放大模型配额和工具压力。
- 多 ASGI 副本能分摊入口请求，但同一 Run 的所有权、恢复和事件续传需要额外设计。

尤其要注意 [`Background Execution`](https://docs.agno.com/background-execution/overview) 的当前实现边界：`background=True` 需要数据库，非流式可返回 `PENDING` 后轮询；流式可按 `event_index` 恢复 SSE。可是后台 `asyncio.Task` 和实时事件缓冲位于**发起进程**内。多副本下，`/resume` 命中另一实例时无法订阅原实例的实时流；它可以从共享数据库回放已经持久化的事件，即使 Run 尚未完成，也只能回放当时已落库的部分，不能继续追随原进程后来产生的实时事件。首次创建请求需要已有的 Cookie/Session 亲和，或由入口显式维护 `run_id → instance` 所有权映射；等响应生成 `run_id` 后再对它做哈希，无法解决第一次路由。进程故障后数据库仍保留运行记录和已写事件，但不会自动接管原 `asyncio.Task`，所以这仍不是持久 Worker 队列。

面向大量请求的可靠拓扑通常是：

```text
API / admission control
  -> 持久任务队列（run_id、tenant_id、deadline、幂等键）
  -> 可水平扩展的 Worker
  -> 共享的 Run/Session 数据库与对象存储
  -> 模型/工具供应商的分层限流器
  -> 事件流、追踪和告警
```

进一步应做到：

1. 每个请求创建独立 Run 上下文，不共享可变的临时对象；
2. 以租户、模型和工具分别设置并发上限、速率和预算；
3. 对队列设置 deadline、取消传播和死信处理；
4. 对同一 Session 使用分区键、版本号或单写者；
5. 将大型 Artifact 放对象存储，只在事件中保存引用和校验和；
6. 使用压测验证 P50/P95/P99、队列时间、限流率、恢复时间和副作用重复率，而不是从 `async` 推导容量。

若继续使用 Agno 进程内后台任务，应让初始请求先按 Session/Cookie 亲和，并在取得 `run_id` 后记录其 owner，让重连回到原实例；同时接受进程故障时执行与实时流中断。要求故障接管时，改用外部持久队列与 Worker，由数据库中的 Run/Checkpoint 驱动恢复。

## 独到优势

Agno 的鲜明价值在于一套类型贯穿从 Agent loop、多人协作、显式 Workflow 到 AgentOS 服务层。团队可以从一个小型 Agent 起步，在不更换核心表达方式的情况下逐步加入 Session/Memory、Team、HITL、追踪和 API 控制面。2.x 的无状态定义与显式 `RunOutput` 也利于把配置对象和每次运行状态分离，建立更清晰的请求隔离。

另一个优势是自主层与确定性层可以嵌套：把开放式研究交给 Agent/Team，把审批、路由和副作用放到 Workflow 的显式步骤中。这种结构能直接表达 [Task Contract](../docs/04-agent-task-semantics.md) 中的输入、约束、交付物和验收证据。

## 适用场景与不适用边界

适合：

- Python 服务中的工具型助手、研究/内容/运营 Agent；
- 需要角色协作，同时又要用 Workflow 固定关键业务路径；
- 需要自托管 API、会话/记忆、HITL、追踪和评测接入的一体化项目；
- 希望按 Run/Session 显式隔离状态的多租户应用。

需要额外基础设施或谨慎评估：

- 必须跨进程故障接管、长期运行且 exactly-once 推进的任务；
- 强事务、资金或不可逆副作用主导的流程；
- 仅靠进程内 background task 就期望跨副本无缝恢复；
- 需要在 Workflow 内传播内部 Agent 工具级 HITL 的路径；
- 对审计、数据驻留、删除权和租户隔离有严格要求，却没有独立策略层和存储治理。

## 最小示例

下面示例只展示一个 Run 的最小结构。生产代码还要增加密钥管理、授权、超时、幂等、错误分类和追踪：

```python
import os

from agno.agent import Agent
from agno.db.postgres import PostgresDb
from agno.models.openai import OpenAIResponses


def lookup_order(order_id: str) -> dict:
    """只读查询；真实实现还应校验当前用户是否拥有订单。"""
    return {"order_id": order_id, "status": "shipped"}


agent = Agent(
    model=OpenAIResponses(id="gpt-5.4-mini"),
    tools=[lookup_order],
    db=PostgresDb(db_url=os.environ["AGENT_DB_URL"]),
    add_history_to_context=True,
)


async def answer(user_id: str, session_id: str, question: str) -> str:
    run = await agent.arun(
        question,
        user_id=user_id,
        session_id=session_id,
    )
    return run.content
```

需要审批的写操作可按如下结构建模：

```text
Workflow:
  validate_input
  -> Agent 生成“建议动作 + 证据”（无写权限）
  -> workflow-level HITL 审批
  -> execute_side_effect(idempotency_key=run_id + step_id)
  -> verify_external_state
  -> emit_artifact_and_audit_event
```

## 版本与维护状态

- **2.0** 是关键语义断点：Agent/Team/Workflow 改为无状态定义，运行信息进入 `RunOutput`；统一 `db`；Workflow v2 取代旧版；AgentOS 取代早期服务封装；知识接口与异步能力重构。升级必须按[官方迁移指南](https://docs.agno.com/other/v2-migration)逐项检查，而不能只改包版本。
- **2.9.0（2026-08-13）** 是本文时间锚上的最新稳定 release，包含 Team HITL 恢复、AgentOS 严格重建及工具名/缓存隔离等安全修复。发布节奏活跃，生产环境应固定精确版本、阅读每次 release，并先做回归与数据迁移演练。

## 结论

Agno 2.x 提供的是一套从自主 Agent 到显式 Workflow、再到服务运行面的连续抽象。正确使用方式是让 Agent/Team 负责需要模型判断的开放空间，让 Workflow 负责可验证的控制路径，让 Run/Session/Memory 各自承担不同生命周期的状态；再由数据库、队列、策略层和可观测系统补齐分布式可靠性。它已经提供异步、streaming、后台运行和多副本部署所需的许多积木，但海量请求能力仍来自完整的容量治理与故障模型，而不是某一个接口关键字。

## 主要官方资料

- [Agno v2.9.0 release](https://github.com/agno-agi/agno/releases/tag/v2.9.0)
- [Agno 2.0 changelog](https://docs.agno.com/other/v2-changelog) 与 [2.0 migration](https://docs.agno.com/other/v2-migration)
- [Sessions](https://docs.agno.com/sessions/overview) 与 [Workflow Sessions](https://docs.agno.com/sessions/workflow-sessions)
- [Team Delegation](https://docs.agno.com/teams/delegation) 与 [Building Workflows](https://docs.agno.com/workflows/building-workflows)
- [HITL](https://docs.agno.com/hitl/overview) 与 [Workflow HITL](https://docs.agno.com/workflows/hitl/overview)
- [Background Execution](https://docs.agno.com/background-execution/overview)
- [AgentOS Security](https://docs.agno.com/agent-os/security/overview)、[Tracing](https://docs.agno.com/tracing/overview) 与 [Evals](https://docs.agno.com/evals/overview)
