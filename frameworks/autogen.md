---
title: AutoGen
description: AutoGen 0.2、0.4 分层重构与维护期的运行时、状态、多 Agent 和迁移边界。
last_verified: 2026-08-13
---

# AutoGen

> 本文以 **2026-08-13** 为时间锚。AutoGen Python 的最新稳定 release 仍是 [python-v0.7.5](https://github.com/microsoft/autogen/releases/tag/python-v0.7.5)（2025-09-30），对应提交 [`83afbf5`](https://github.com/microsoft/autogen/commit/83afbf5857aac683340d4c692194e548b1e8edda)。但“最新版本”不等于“仍在新增功能”：当前官方 README 已明确项目进入维护模式。

## 先说当前状态

截至本文时间点，AutoGen 应按三个时代理解：

1. **0.2：会话优先的多 Agent 编程模型。** 核心是 `ConversableAgent`、`AssistantAgent`、`UserProxyAgent`、`GroupChat`，大量控制逻辑通过 reply function、代理对话和嵌套 chat 表达。
2. **0.4：从底层重写的异步、事件驱动、分层架构。** 这是 ground-up rewrite，不是 0.2 API 的小幅升级；其架构后来延续到 0.5–0.7 版本线。
3. **当前：维护/迁移期。** [AutoGen README 的 2026-08-13 快照](https://github.com/microsoft/autogen/blob/027ecf0a379bcc1d09956d46d12d44a3ad9cee14/README.md)写明仓库由社区维护，只接受 bug 修复与关键安全补丁，不再规划新功能或增强；新用户被引导到已达到 1.0 的 **Microsoft Agent Framework（MAF）**，现有 AutoGen 用户应参考[官方 AutoGen → MAF 迁移指南](https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-autogen/)。

AutoGen 与 Microsoft Agent Framework 是两个不同项目。MAF 由 Microsoft 的 AutoGen 与 Semantic Kernel 团队共同建设，是后续迁移方向；本文只解释迁移语境，不把 MAF 的能力倒推成 AutoGen 已有能力，也不把本章改写成 MAF 教程。

## 定位与边界

0.4 之后的 AutoGen 是一个分层的多 Agent 应用框架：高层 AgentChat 提供任务式 Agent 与 Team；底层 Core 提供有身份和生命周期的 Agent、消息、topic/subscription 以及本地/分布式 runtime；Ext 放模型客户端、工具、代码执行器、MCP 等集成。

它适合研究和实现“Agent 通过消息协作”的系统，以及需要精细控制团队发言、handoff、终止和事件流的 Python 应用。它并不自带一套通用的业务 Session 数据库、持久任务队列、事务 outbox、生产级身份平台或稳定的分布式执行控制面。当前处于维护期，新的长期项目还必须把未来迁移成本纳入设计。

## 0.2 到 0.4：究竟重构了什么

Microsoft 在 [0.4 发布说明](https://devblogs.microsoft.com/autogen/autogen-reimagined-launching-autogen-0-4/)和[官方迁移指南](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/migration-guide.html)中把 0.4 描述为完整重写，目标包括异步消息、可观测性、交互控制、模块化和分布式扩展。主要语义变化如下：

| 0.2 思路 | 0.4+ 对应思路 | 迁移影响 |
| --- | --- | --- |
| `ConversableAgent` 包办会话、reply hook、工具和代码执行 | AgentChat 的 `AssistantAgent` / 自定义 `BaseChatAgent`，或 Core 的 `RoutedAgent` + message handler | 自定义 reply 逻辑通常要改写为 Agent、工具、Team 或消息处理器 |
| `initiate_chat` 驱动对话 | `run()` / `run_stream()` 返回消息事件与 `TaskResult` | 应用显式消费事件、终止原因和最终结果 |
| 嵌套 chat、顺序 chat、GroupChat 配置 | AgentChat Team 预设，或 Core 消息拓扑 | 控制流与状态需要重新建模，不是参数一一重命名 |
| 常由 UserProxy 代理执行工具 | 0.4 的 `AssistantAgent` 默认在自身 Run 中执行工具 | 权限、沙箱和工具审计边界会变化 |
| 模型配置混在 Agent 配置中 | 独立 model client 与 model context | 客户端生命周期、异步关闭和上下文策略需要显式处理 |
| 依赖聊天对象隐式保存历史 | Agent/Team `save_state()` / `load_state()` 返回可序列化状态 | 持久化介质、版本和并发控制由应用提供 |

迁移还要注意包名供应链问题：官方指南警告 Microsoft 已失去 PyPI 上 `pyautogen` 包的管理权限，`0.2.34` 之后该包的发布并非 Microsoft 发布；需要旧版官方 AgentChat 时，指南要求使用 `autogen-agentchat~=0.2`。不要只凭包名相似就升级。

## 0.4+ 的三层架构

### `autogen-core`

Core 是消息驱动基础层，主要抽象包括：

- `AgentId` / `AgentType`：运行时中的逻辑身份与类型；
- `RoutedAgent`、`@message_handler`：按消息类型处理事件或请求；
- `send_message`：点对点、等待返回的 request/response；
- `publish_message`、Topic 与 Subscription：一对多事件发布；
- Agent Runtime：投递消息、按需创建 Agent、管理生命周期与追踪；
- Model Client、Tool、Workbench、Code Executor、Memory/Model Context 等组件协议。

Core 适合需要显式消息契约、actor 风格隔离或自定义拓扑的系统。它提供通信语义，不替 Agent 定义业务逻辑，也不自动替消息提供业务级 exactly-once。

### `autogen-agentchat`

AgentChat 是高层任务 API：

- `AssistantAgent` 将模型、system message、tools、model context、memory 与 handoff 组合成可运行 Agent；
- `BaseChatAgent` 是自定义高层 Agent 的基类；
- `UserProxyAgent` 把用户输入建模为团队成员；
- `run()` / `run_stream()` 接收任务，返回消息序列、事件和 `TaskResult`；
- Team 负责轮次、发言者选择、handoff、终止与状态聚合。

[`AssistantAgent` 文档](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/agents.html)明确说明 `run()` 会更新内部消息历史。因此 AgentChat 对象是**有状态运行对象**，不是可在任意并发请求间共享的无状态 singleton。

### `autogen-ext`

Ext 集中放置具体适配：OpenAI/Azure 等模型客户端、Docker/本地命令执行器、MCP Workbench、gRPC runtime 等。分层让核心消息语义与供应商集成解耦，但每个扩展仍有自己的生命周期、凭据、限流和安全边界。

## 运行时与事件循环

### AgentChat 的 Agent loop

`AssistantAgent` 的典型执行可抽象为：

```text
task/message
  -> 更新 model context，并让 Memory 提供相关内容
  -> model client 生成文本、tool calls 或 handoff
  -> 若是 tool calls：执行并产生 ToolCallExecutionEvent
  -> 按 max_tool_iterations 决定再次调用模型或返回工具结果
  -> 产生消息事件与 TaskResult，更新 Agent 内部状态
```

工具请求与工具结果在消息类型上分开，这有利于追踪“模型建议调用”和“执行确已发生”。默认一个 tool iteration；提高 `max_tool_iterations` 才形成连续的模型—工具循环。模型若一次返回多个 tool call，默认可并行执行；有互相干扰的副作用时应在 model client 关闭 parallel tool calls。

`run_stream()` 是异步事件生成器，能让 UI 和日志系统逐事件消费；`CancellationToken` 可传播取消。但事件流不是持久日志，取消也不能回滚已经完成的外部写操作。

### Core 的消息循环

[`SingleThreadedAgentRuntime` 源码说明](https://github.com/microsoft/autogen/blob/83afbf5857aac683340d4c692194e548b1e8edda/python/packages/autogen-core/src/autogen_core/_single_threaded_agent_runtime.py)非常具体：它从一个 asyncio 队列按接收顺序取消息，每条消息在独立 asyncio task 中处理，因此处理可重叠；官方同时明确它适合开发和 standalone 应用，**不适合高吞吐或高并发场景**。

这里的 “single-threaded” 不等于所有 handler 串行，也不等于线程安全。若两个消息处理器同时修改同一 Agent 的可变字段，仍需按 AgentId 分区、使用锁或改为单写者协议；若 handler 做阻塞 CPU/I/O，也会阻塞事件循环。

Core 区分：

- 直接消息：有明确收件人，像异步 RPC；
- 发布消息：按 topic/subscription fan-out，发布者不等待每个订阅者的业务结果；
- Agent 生命周期：runtime 按 `AgentId` 懒创建和管理实例。

消息“被投递”不能直接证明业务任务“已完成”。生产系统还要保存消息 ID、Attempt、处理结果、幂等记录和失败/死信状态。

## 状态、会话与记忆

### AgentChat 状态

Agent 与 Team 保留消息历史、轮次和管理器状态。`save_state()` 把这些内容返回为可 JSON 序列化的映射；Team 的状态包含所有参与 Agent 和 GroupChat manager。`load_state()` 把状态写入新实例或已有的停止实例。官方 [`teams` API](https://microsoft.github.io/autogen/stable/reference/python/autogen_agentchat.teams.html)警告：Team 运行中调用 `save_state()` 可能得到不一致状态，应在停止后保存。

这是一套**序列化协议**，不是内置 Session 服务。应用仍要决定：

- `session_id` 与 Team 实例/状态记录如何映射；
- 状态放数据库、对象存储还是缓存；
- schema / Agent / prompt / model 版本如何迁移；
- 同一 Session 是否只允许一个运行者；
- 状态保存与外部副作用之间如何对账。

建议把一次 `run()` 视为 Run，把重试视为独立 Attempt，把 `TaskResult.messages` 视为运行事件的一部分；不要让一个 Team 对象同时服务多个用户。

### Model Context 与 Memory

Model Context 决定当前模型可见哪些消息，可选择无界、buffer 或 token-limited 策略；它解决上下文窗口问题。Memory 是协议：具体实现负责查询、把相关内容加入 model context、以及运行后更新存储。两者都不等于审计日志，Memory 的召回结果也不应被当成未经验证的事实。

对于需要共享资源与状态的一组工具，可使用 [`Workbench`](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/components/workbench.html)，包括 MCP workbench。Workbench 生命周期与 Session/Run 需要明确绑定，特别是浏览器、文件系统或远程 MCP server 会保留状态时。

## 工具、模型与代码执行

Core Tool 用 schema 描述模型可调用的函数；AgentChat 可直接接收 Python callable、Tool 或 Workbench。模型客户端独立于 Agent，可配置模型能力、并行 tool call 等。几个关键边界：

- `AgentTool` / `TeamTool` 把有状态 Agent/Team 暴露成工具；官方要求关闭并行 tool calls，因为同一实例并发运行会发生内部状态冲突。
- 函数 schema 只约束形状，不构成用户授权。工具执行前还应做身份、租户、scope、资源归属和参数语义校验。
- [`Command Line Code Executors`](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/components/command-line-code-executors.html)可在本地或 Docker 中运行生成代码；生产中应优先隔离容器/沙箱，限制网络、文件、CPU、内存和执行时间。直接在服务进程本地执行模型生成代码属于高风险能力。
- MCP server 的 tool metadata 会进入模型上下文，只连接可信 server，并以最小权限凭据和网络隔离运行。

## 多 Agent 与工作流

[`AgentChat Teams`](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html)提供多种管理方式：

- `RoundRobinGroupChat`：固定轮转；
- `SelectorGroupChat`：由模型或选择函数挑选下一位；
- `Swarm`：通过 handoff 在角色间转移控制；
- `MagenticOneGroupChat`：面向复杂任务的管理式团队。

此外，Core 文档演示并发 Agent、顺序流、Group Chat、handoff、反思、debate 等消息模式。`GraphFlow` 可表达顺序、fan-out/fan-in、分支与循环，但当前 API 标注为 experimental，生产使用应固定版本并准备适配 breaking change。

Team 的终止条件是正式控制面：最大消息数、文本匹配、handoff、来源匹配等可组合。不要让“模型自然会停”成为唯一上限；还要设置总 deadline、token/调用预算和工具超时。

多 Agent 增加的是角色分工和可表达的协作拓扑，也会增加模型调用、共享状态和终止判断。应为每次委派写清 [Task Contract](../docs/04-agent-task-semantics.md)：目标、输入、约束、预期产物、验证证据和失败语义。

## 持久化、恢复与 HITL

### 保存和恢复

AutoGen 可以保存/加载 Agent 与 Team state；Core Agent 也提供 `save_state`/`load_state` 协议。但框架没有保证状态写入与你调用的外部服务在同一个事务中。可靠恢复需要应用补齐 checkpoint 版本、幂等键、外部状态查询、补偿动作和 Attempt 日志。

例如，一个 Agent 已经发出邮件，却在 Team state 落库前崩溃；恢复后重复同一步可能再次发信。正确策略是让发送工具接受业务幂等键并能查询最终状态，而不是假设 `load_state()` 会回滚现实世界。

### 人工介入

[`Human-in-the-Loop` 官方指南](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/human-in-the-loop.html)区分两种路径：

1. **Run 内 `UserProxyAgent`**：团队阻塞等待即时输入。官方明确说明此时 Team 处于无法保存/恢复的不稳定状态，只适合按钮审批等短交互。
2. **Run 间反馈**：通过 `max_turns` 或 `HandoffTermination` 先让 Run 正常返回，应用保存 Team state；反馈到达后加载状态，在下一次 `run()` 继续。这才适合异步、持久化的人机协作。

Team 的 `pause()` / `resume()` 是 experimental，只调用参与者的 `on_pause()` / `on_resume()`；默认可能是 no-op，且 pause 不会让当前 `run()` 返回。它不是通用的耐久 checkpoint。要实现小时/天级审批，应采用“终止—持久化—新 Run 恢复”的应用协议。

审批仍要验证审批人身份、版本、有效期和资源范围。UserProxy 的文字“APPROVE”不是充分的授权证据。

## 部署、可观测性、评测与安全

### 部署与运行面

AgentChat 可以嵌入 FastAPI、WebSocket、后台 Worker 或批任务。Core 的 [`Runtime Architecture`](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/core-concepts/architecture.html)定义 standalone 与 distributed 两类环境；分布式 runtime 由 gRPC host 路由消息、Worker 声明所承载的 Agent。

但官方 [`Distributed Agent Runtime`](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/framework/distributed-agent-runtime.html)明确标注 **experimental，预期会有 breaking changes**。host/worker 通信本身也没有替应用说明持久队列、checkpoint 事务、Worker 租约、升级兼容和跨区域容灾。不能因存在 gRPC runtime 就宣称已具备生产级水平扩展。

AutoGen Studio 是用于搭建和探索工作流的低代码原型工具；[官方 README 快照](https://github.com/microsoft/autogen/blob/027ecf0a379bcc1d09956d46d12d44a3ad9cee14/README.md)提示它不是 production-ready 应用。把 Studio 暴露到生产必须另加认证、授权、数据隔离、密钥管理和安全审查。

### 可观测性与评测

[`Core Telemetry`](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/framework/telemetry.html)与 AgentChat [`Tracing`](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tracing.html)使用 OpenTelemetry 表达 runtime、消息、Agent、模型和工具 span。生产追踪应关联 request/run/attempt/session、AgentId、message ID、topic、模型/提示词版本、工具授权与外部副作用 ID；对 prompt、memory 与 tool 参数进行脱敏。

仓库包含 AutoGenBench 等评测/benchmark 工具，适合运行任务集和比较配置，但不是业务验收的替代品。还应使用确定性工具契约测试、黄金样本、恢复演练、安全测试和人工复核，并把“模型裁判”与真实业务指标分开。

### 安全

最重要的控制点是：

- 生成代码只在受限沙箱执行，禁止默认继承宿主全部文件、网络和云凭据；
- 工具按用户/租户做 server-side 授权，写操作要求确认与幂等；
- 消息、Memory、trace 和 state 都可能包含敏感内容，需加密、留存与删除策略；
- 限制 Agent 可发布的 topic 和可寻址的 Agent，不能把模型文本当路由权限；
- 对 MCP/tool 描述、检索文档和其他 Agent 消息一并考虑 prompt injection；
- 固定依赖版本并关注维护期安全修复，准备迁往仍主动演进的后继平台。

## 并发与超多请求的真实能力

AutoGen 的 async/event-driven 架构允许 I/O 重叠、消息 fan-out 和流式消费，Core 也定义跨进程 runtime；这些都是扩展积木，不是容量结论。

需要同时遵守的事实包括：

- `AssistantAgent` 和 Team 会修改内部状态；同一实例不应并发服务不同 Run。
- `AgentTool`/`TeamTool` 明确禁止并发调用同一有状态实例。
- `SingleThreadedAgentRuntime` 官方明确不适合高吞吐/高并发。
- 分布式 gRPC runtime 仍是 experimental。
- 模型供应商、工具、Memory store 和下游 API 各有独立并发/速率上限。

大量请求下的稳健架构通常是：

```text
stateless API
  -> 持久队列 / admission control
  -> session_id 分区的 Worker
  -> 每个 Run 新建 AgentChat Team，或独占加载该 Session state
  -> save_state + 版本检查 + 外部副作用对账
  -> 共享数据库 / 对象存储 / OTel collector
```

工程策略：

1. 不共享运行中的 Agent/Team；每次构造新实例，或以 Session 为 key 做单写者 actor/shard。
2. 队列携带 `run_id`、`attempt_id`、deadline、租户和幂等键；取消只停止未完成工作，不假设回滚副作用。
3. 为模型与每类工具设置 semaphore、token bucket、预算和熔断；fan-out 前先计算并发放大倍数。
4. state 使用乐观版本或租约，保存时拒绝覆盖新版本；大消息/Artifact 放对象存储。
5. runtime/Worker 故障后从外部 checkpoint 恢复，而不是依赖进程内对象仍存在。
6. 通过实际 workload 压测排队延迟、尾延迟、失败/重试、状态冲突和重复副作用；不引用未经验证的性能数字。

如果必须采用 Core distributed runtime，应把它视为需要自己产品化的通信层：在实验 API 之外增加持久入口、状态存储、Worker 健康/租约、部署编排、版本兼容和故障注入测试。

## 独到优势

AutoGen 0.4 架构的鲜明之处是把高层团队范式与低层事件驱动 runtime 放在同一体系中：使用者既可以用 `RoundRobinGroupChat` 快速描述角色协作，也可以下降到 AgentId、typed message、topic/subscription 和 handler 精确控制通信。研究复杂多 Agent 拓扑时，这种分层给出了丰富的观察与定制入口。

它还积累了大量可读的多 Agent pattern、事件类型、终止条件和迁移资料，适合维护既有 AutoGen 系统、复现实验以及梳理下一代架构需求。当前维护状态也提供了清晰决策信号：现有系统可固定版本并稳健运行，新投资应同时制定 MAF 迁移路线。

## 适用场景与不适用边界

适合：

- 已在生产或研究中使用 AutoGen，需要理解 0.2→0.4/0.7 并继续维护；
- 研究消息驱动多 Agent、handoff、group chat、反思或辩论模式；
- 需要 AgentChat 快速组队，同时保留下探 Core runtime 的能力；
- 把 AutoGen 嵌入已有 API、队列、状态库与可观测平台。

需要谨慎或优先规划迁移：

- 新建且预期多年持续获得新特性的 Microsoft Agent 项目；官方已将新用户导向 MAF；
- 只靠 `SingleThreadedAgentRuntime` 承载高吞吐服务；
- 要求分布式 runtime API 长期稳定、内建 durable queue 或 exactly-once；
- 需要在 Run 中长期阻塞等待人工，同时无损保存与恢复；
- 将有状态 Team 作为全局 singleton 并发复用；
- 高风险代码执行或工具副作用，却没有沙箱、授权和幂等协议。

## 最小示例（0.4+ AgentChat）

```python
import asyncio

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.conditions import MaxMessageTermination
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_ext.models.openai import OpenAIChatCompletionClient


async def main() -> None:
    model = OpenAIChatCompletionClient(model="gpt-4o-mini")
    writer = AssistantAgent(
        "writer",
        model_client=model,
        system_message="起草简短答案，并列出仍需核实的事实。",
    )
    reviewer = AssistantAgent(
        "reviewer",
        model_client=model,
        system_message="核对证据；最后一条消息给出可交付答案。",
    )
    team = RoundRobinGroupChat(
        [writer, reviewer],
        termination_condition=MaxMessageTermination(4),
    )

    # team 是有状态对象；不要把它并发复用给其他 session。
    result = await team.run(task="解释候选 tool call 与已执行 tool call 的区别")
    state = await team.save_state()  # 应用负责带版本写入持久存储
    print(result.messages[-1].content)
    print(state.keys())
    await model.close()


asyncio.run(main())
```

持久 HITL 应采用如下应用协议，而不是在运行中的 UserProxy 上等待数小时：

```text
team.run(..., termination=HandoffTermination("user"))
  -> Run 正常结束
  -> team.save_state() + 保存审批请求
  -> HTTP 202 / durable wait
  -> 验证审批人、版本和权限
  -> 新建 team -> load_state() -> team.run(feedback)
```

## 版本与迁移建议

- **仍在 0.2**：先固定官方 `autogen-agentchat~=0.2`，盘点 ConversableAgent、reply hook、UserProxy 工具执行、nested/sequential chat 与 GroupChat 用法；按迁移指南重建测试，不能机械替换类名。
- **已在 0.4–0.7**：固定 `python-v0.7.5` 对应依赖，保存状态 schema 与组件版本，避免依赖 experimental API；只期待维护期的 bug/security 修复。
- **新项目或长期演进**：按当前 README 评估 Microsoft Agent Framework；已有系统使用官方映射逐功能迁移，双跑验证消息、工具、副作用、HITL 和 checkpoint，不把两个框架对象混为同一 API。

## 结论

AutoGen 的技术价值集中在 0.4 之后清晰的两级编程面：AgentChat 表达任务和团队，Core 表达 Agent 身份、消息与 runtime。正确的生产理解必须同时承认它的状态与扩展边界：Agent/Team 有状态，保存协议不是数据库，streaming 不是持久事件日志，experimental distributed runtime 不是现成的高可用任务平台。到 2026-08-13，框架已进入维护与向 MAF 迁移的阶段；维护既有系统应稳定版本、补齐工程控制，新系统则应从官方后继方向重新评估。

## 主要官方资料

- [AutoGen README 的 2026-08-13 快照（维护状态）](https://github.com/microsoft/autogen/blob/027ecf0a379bcc1d09956d46d12d44a3ad9cee14/README.md)
- [python-v0.7.5 release](https://github.com/microsoft/autogen/releases/tag/python-v0.7.5)
- [AutoGen 0.4 launch](https://devblogs.microsoft.com/autogen/autogen-reimagined-launching-autogen-0-4/)
- [v0.2 → v0.4 migration guide](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/migration-guide.html)
- [AgentChat Agents](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/agents.html)、[Teams](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/teams.html) 与 [State](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/state.html)
- [Core runtime architecture](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/core-concepts/architecture.html) 与 [Distributed runtime](https://microsoft.github.io/autogen/stable/user-guide/core-user-guide/framework/distributed-agent-runtime.html)
- [Human-in-the-Loop](https://microsoft.github.io/autogen/stable/user-guide/agentchat-user-guide/tutorial/human-in-the-loop.html)
- [Microsoft Agent Framework migration from AutoGen](https://learn.microsoft.com/en-us/agent-framework/migration-guide/from-autogen/)
