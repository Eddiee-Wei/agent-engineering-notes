---
title: LangChain
description: LangChain v1 的 Agent 组件、Middleware、状态、工具、流式接口、Multi-Agent 与高并发生产实践。
last_verified: 2026-08-13
---

# LangChain

> 版本快照：本文以 Python 主包 [`langchain==1.3.15`](https://github.com/langchain-ai/langchain/releases/tag/langchain%3D%3D1.3.15) 为基线，发布于 2026-08-11，对应源码提交 [`f4bc503`](https://github.com/langchain-ai/langchain/tree/f4bc5031dbcf24edb0374a07830915a285222567)。资料核对日期为 2026-08-13；文中的 v1 指稳定文档，不把尚未发布的 Next 文档当成当前能力。

LangChain v1 最准确的定位，不是“一套包办所有事情的 Agent Runtime”，而是：

> **一套面向 Agent 的标准组件与集成层，用统一的 Model、Message、Tool、Runnable、Middleware 和 `create_agent` 接口，把模型差异、上下文工程和常见 Agent Loop 收敛到可组合的 Python 对象中。**

`create_agent` 返回的并不是另一个私有执行器，而是一个编译后的 LangGraph 图。因此，LangChain 负责高层 Agent 体验和集成抽象，持久化、Interrupt、线程状态与 Durable Execution 由底层 LangGraph Runtime 提供。[官方 v1 说明](https://docs.langchain.com/oss/python/releases/langchain-v1)也明确把这一点列为生产能力的基础。

## 先把生态边界画清楚

“LangChain”经常同时指项目、Python 主包和整套产品生态。工程设计时应把它们拆开：

| 层次 | 主要职责 | 典型对象或产品 |
| --- | --- | --- |
| `langchain-core` | 稳定协议、消息、工具、模型接口和 Runnable | `BaseMessage`、`BaseChatModel`、`BaseTool`、`Runnable` |
| `langchain` | v1 Agent 高层 API 与 Middleware | `create_agent`、`AgentState`、内置 Middleware |
| Provider / Community 包 | 模型、向量库、Retriever、外部服务适配 | `langchain-openai`、`langchain-anthropic`、`langchain-community` 等 |
| `langchain-classic` | v0 时代的旧 Chains、Retrievers、Indexing 等兼容实现 | `LLMChain`、`ConversationChain`、旧 Retriever 集合 |
| LangGraph | 有状态图 Runtime、Checkpoint、Interrupt、Store | `StateGraph`、Checkpointer、`Command`、`Send` |
| LangSmith | Trace、评测、Studio 与可选的 Agent Server / Deployment | 数据集、Experiment、部署队列、监控 |

这层拆分带来两个直接结论：

1. `langchain` 主包版本不能代表所有 Provider 包版本；依赖必须分别锁定并分别回归。
2. 只安装 SDK 不会自动得到水平扩缩容、任务队列、租户隔离和生产数据库；这些属于应用或部署层。

## v1 的核心执行模型

一个标准 Tool-calling Agent 的主循环很短：

```text
用户消息
  → before_agent / before_model Middleware
  → Model 生成 AIMessage
       ├─ 没有 tool_calls → 形成最终响应
       └─ 有 tool_calls   → wrap_tool_call → 执行工具 → ToolMessage
                                                ↓
                                           回到 Model
  → after_model / after_agent Middleware
```

真正让它成为工程框架的是循环周围的契约：

- Model 用统一的消息与 Tool Schema 接口接入；
- Middleware 可以改写 Prompt、模型、工具集合、输入输出和控制流；
- Agent State 在每个模型或工具 Step 之间更新；
- Checkpointer 把短期状态绑定到 `thread_id`；
- Store 保存跨 Thread 的长期记忆；
- `stream` / `astream` 输出 Token、Step 更新和自定义事件；
- Interrupt 把审批从一次函数调用延伸成可恢复的逻辑 Run。

### 最小但可扩展的 Agent

```python
from dataclasses import dataclass

from langchain.agents import create_agent
from langchain.agents.middleware import (
    HumanInTheLoopMiddleware,
    SummarizationMiddleware,
)
from langchain.tools import tool
from langgraph.checkpoint.memory import InMemorySaver


@tool
async def search_orders(order_id: str) -> str:
    """读取订单状态，不产生外部副作用。"""
    return f"order={order_id}, status=paid"


@tool
async def refund_order(order_id: str, reason: str) -> str:
    """为订单发起退款。"""
    return f"refund requested for {order_id}: {reason}"


@dataclass
class RequestContext:
    user_id: str
    tenant_id: str


agent = create_agent(
    model="openai:gpt-5.4-mini",
    tools=[search_orders, refund_order],
    system_prompt="你是订单支持 Agent；退款前必须取得审批。",
    context_schema=RequestContext,
    checkpointer=InMemorySaver(),  # 仅用于本地演示
    middleware=[
        SummarizationMiddleware(
            model="openai:gpt-5.4-mini",
            trigger={"tokens": 4_000},
        ),
        HumanInTheLoopMiddleware(
            interrupt_on={"refund_order": True},
        ),
    ],
)

config = {"configurable": {"thread_id": "support-42"}}

async def run() -> None:
    async for part in agent.astream(
        {"messages": [{"role": "user", "content": "给订单 A-17 退款"}]},
        config=config,
        context=RequestContext(user_id="u-7", tenant_id="t-1"),
        stream_mode="updates",
        version="v2",
    ):
        print(part)
```

生产环境要把 `InMemorySaver` 换成数据库 Checkpointer，并把真实 `user_id`、`tenant_id` 从认证上下文注入，而不是相信用户消息里的身份声明。

## 七个必须掌握的抽象

### 1. Model：统一入口，不抹掉能力差异

`init_chat_model` 和各 Provider 包让应用通过统一的 `invoke`、`stream`、`bind_tools`、Structured Output 等接口调用模型。统一接口适合做模型路由、回退和测试替身；Provider-specific 参数仍可以通过对应模型类或配置传入。

这是一种“公共语义 + 能力逃生舱”的设计。应用可以把模型调用写成稳定协议，同时保留缓存控制、推理强度、服务端工具等供应商能力。v1.2 又给 Tool 增加 `extras`，让 Provider-specific Tool 定义不必污染公共 Tool Schema。[v1 Changelog](https://docs.langchain.com/oss/python/releases/changelog)记录了这一演进。

### 2. Message 与 Standard Content Blocks

模型输出早已不只是字符串：还包括推理块、引用、图片、音频、文件、Tool Call、服务端 Tool Result 等。v1 在 `Message.content` 之外加入类型化的 `content_blocks` 视图，把多家模型的原生格式归一成文本、Reasoning、Citation、Multimodal、Tool 等公共块。[Messages 文档](https://docs.langchain.com/oss/python/langchain/messages)给出了完整类型表。

它的工程价值在下游：UI、审计、存储和评测不必为每家模型各写一套解析器。需要使用新 Provider 特性时，`non_standard` 块仍能保留原生内容。

### 3. Tool：Schema 是模型与真实世界的边界

普通函数、协程和 `@tool` 都可注册为 Tool。框架根据类型标注生成参数 Schema，并把 Tool Call 与 `ToolMessage` 用 `tool_call_id` 对齐。

Tool 设计至少要显式处理：

- 输入 Schema 是否足够窄，枚举和约束是否完整；
- 超时、重试、熔断和上游限流；
- 身份、租户、数据库连接应通过 `ToolRuntime` / Context 注入，而不是暴露给模型填写；
- 写操作是否有幂等键、审批与效果回执；
- 返回内容是否需要裁剪，避免把大结果塞回 Context；
- 多个 Tool Call 并发时是否会争用同一资源。

模型提出 Tool Call 不等于已经授权执行。权限检查适合放在 `wrap_tool_call` Middleware 或 Tool 内部，审批适合使用 HITL Middleware 与 Checkpointer。

### 4. Runnable：统一调用和组合协议

Model、Prompt、Retriever、Agent 和自定义函数大多实现 Runnable 协议，因而拥有一组一致的入口：

- `invoke` / `ainvoke`：单输入；
- `batch` / `abatch`：批输入；
- `stream` / `astream`：流式输出；
- `with_config`、`with_retry`、`with_fallbacks`：附加运行策略；
- `|` 和并行映射：构造 LCEL 数据流。

Runnable 的独到价值是把“可调用组件”变成统一代数：同一套组件既可独立测试，也可放进 Agent Tool、LangGraph Node 或批处理任务中。

### 5. Middleware：v1 的上下文工程控制面

Middleware 是 `create_agent` 最关键的扩展点。它不是另一个 Runtime；Hook 被编译进 Agent 所返回的 LangGraph。官方提供六类核心时机：

| Hook | 适合承担的职责 |
| --- | --- |
| `before_agent` | 校验输入、加载请求级上下文 |
| `before_model` | 裁剪或总结消息、构造动态 Prompt |
| `wrap_model_call` | 模型路由、超时、重试、缓存、预算、降级 |
| `after_model` | 输出校验、Guardrail、结构化响应检查 |
| `wrap_tool_call` | 权限、审批、幂等、Tool 重试和结果裁剪 |
| `after_agent` | 保存记忆、清理资源、记录结果 |

内置 Middleware 已覆盖摘要、PII、HITL、模型重试、Tool 重试、Tool Call 限额等常见需求；自定义 Middleware 可以声明额外 State Schema。完整执行顺序见[官方 Middleware 文档](https://docs.langchain.com/oss/python/langchain/middleware/overview)。

Middleware 顺序是语义，不是装饰：例如先做租户鉴权再查缓存，和先查缓存再鉴权，可能产生跨租户数据泄漏。工程上应把顺序写入测试。

### 6. State、Context、Checkpointer 与 Store

这四个对象回答不同问题：

| 对象 | 生命周期 | 是否在 Agent Loop 中变化 | 示例 |
| --- | --- | --- | --- |
| State | 一个 Thread 的多步执行与多轮对话 | 是 | Messages、当前阶段、结构化结果 |
| Context | 一次调用注入的静态依赖 | 通常否 | `user_id`、租户、数据库连接、Feature Flag |
| Checkpointer | 按 Thread 保存 State 的快照 | 由 Runtime 提交 | PostgreSQL Checkpointer |
| Store | 跨 Thread 的长期 JSON 记忆 | 由 Tool / Middleware 显式读写 | 用户偏好、跨会话事实 |

短期记忆本质上是 Agent State 加 Checkpointer；长期记忆使用 LangGraph Store，并按 namespace / key 组织。官方的[短期记忆](https://docs.langchain.com/oss/python/langchain/short-term-memory)和[长期记忆](https://docs.langchain.com/oss/python/langchain/long-term-memory)文档刻意分开了二者。

不要把 Trace 当 State，也不要把完整聊天记录无上限地当 Prompt。长期会话应配合摘要、消息裁剪、检索式记忆和数据保留策略。

### 7. Structured Output

`response_format` 可以接收 Pydantic、dataclass、TypedDict 或 JSON Schema。支持原生结构化输出的模型可采用 `ProviderStrategy`，否则可使用 `ToolStrategy`；成功结果写入 `structured_response`。

结构化输出降低了解析脆弱性，但仍要验证业务不变量。例如退款金额即使符合 `float` 类型，也必须检查币种、上下限和订单所有权。

## Streaming、Interrupt 与完成语义

LangChain Agent 继承 LangGraph 的流式能力。常用模式包括：

- `updates`：每个 Agent / Tool Step 完成后的增量；
- `messages`：模型 Token 与消息元数据；
- `custom`：Node 或 Tool 主动写出的业务进度。

[Streaming 文档](https://docs.langchain.com/oss/python/langchain/streaming)建议用 `astream` 服务异步应用。消费端应等待明确的最终状态，不能把 SSE 断开或收到最后一个 Token 当作业务完成。

HITL Middleware 会产生 LangGraph Interrupt。恢复需要相同 `thread_id` 和持久化 Checkpoint；暂停前已经执行的外部副作用不会自动回滚。审批记录至少应包含 Tool Call ID、参数摘要、审批人、策略版本和过期时间。

## Multi-Agent 不是一个固定类，而是一组组合模式

LangChain v1 把 Multi-Agent 设计为可组合模式，而不是强制一个 `Team` 对象：

| 模式 | 控制方式 | 适合的任务形态 |
| --- | --- | --- |
| Subagents | Supervisor 把专用 Agent 当 Tool 调用 | 中央控制、上下文隔离、可并行委派 |
| Handoffs | Tool 更新 `active_agent` / 阶段 State | 多轮直接交互、阶段切换、顺序约束 |
| Skills | 按需加载专用 Prompt 与资源 | 渐进披露、大量轻量专业能力 |
| Router | 分类后用 `Command` 或 `Send` 派发 | 清晰领域路由、并行多源查询 |
| Custom Workflow | 在 LangGraph 中组合 Agent Node 与确定性 Node | 复杂分支、Join、审批和业务状态机 |

官方的[模式与性能分析](https://docs.langchain.com/oss/python/langchain/multi-agent/index)还按模型调用次数和 Token 量讨论 Subagents、Handoffs、Skills、Router。这个分析可验证一个常见经验：Multi-Agent 的收益来自上下文隔离、并行和专业化，不来自 Agent 数量本身。

设计时要先计算关键路径上的模型调用数，并明确上下文怎样进入和离开子 Agent。并行三个 Agent 如果最终仍串行经过三次总结，延迟不会按 Agent 数量线性下降。

## LangChain 的独到优势

### 标准化异构模型的“最后一公里”

Model、Message、Tool 和 Standard Content Blocks 让业务代码可以采用公共语义，同时保留 Provider-specific 能力。对需要持续试验模型、Embedding、Vector Store 和外部服务的团队，这种稳定接口非常有价值。

### Middleware 把上下文工程变成可复用软件

动态 Prompt、摘要、Tool 选择、模型路由、PII、审批、重试和预算不必散落在业务函数里。它们可以被封装、排序、单测，并随 Agent 一起嵌入更大的图。

### 高层 Agent 与低层图编排是连续路径

开发可以从 `create_agent` 起步；当拓扑出现分类、Fan-out、Join、人工审批或确定性阶段时，整个 Agent 可直接作为 LangGraph Node。已有 Tool、Middleware、State 和 Streaming 语义继续有效。

### 组件生态适合渐进式组装

模型、Retriever、Document Loader、Vector Store、Tool 和观测组件按独立包演进。团队可以只引入需要的集成，并在公共 Runnable 接口上组合自己的组件。

### Trace 与轨迹评测形成反馈回路

LangSmith 与 AgentEvals 可记录模型、Tool 和轨迹，并使用确定性匹配或 LLM-as-judge 做回归。[Agent Evals 文档](https://docs.langchain.com/oss/python/langchain/test/evals)展示了 pytest 与数据集 Experiment 两条路径。

## 高并发与超多请求场景

必须区分三层并发，否则压测结论没有意义。

### 单个 Run 内的并发

- 模型一次返回多个 Tool Call 时，Tool Node 可以并发执行独立工具；
- LangGraph 的并行分支和 `Send` 可以并发执行 Node / Subagent；
- 异步 Tool 应使用真正的异步 I/O，不能在事件循环里直接跑阻塞 SDK；
- `max_concurrency` 要同时考虑模型 RPM/TPM、数据库连接池和下游 QPS；
- 写工具并行前要证明交换律或使用业务幂等键，不能依赖完成顺序。

### 单进程的多请求并发

优先使用 `ainvoke` / `astream` 和异步 Provider Client。同步 Middleware、CPU 密集解析、阻塞数据库驱动会阻塞事件循环，应放入受控线程池、进程池或独立服务。

估算容量时可以从 Little's Law 的近似开始：

```text
所需同时在途 Run 数 ≈ 峰值 QPS × P95 Run 时长（秒）
```

一个 2 QPS、P95 为 40 秒的 Agent，已经需要约 80 个同时在途 Run。此时瓶颈通常不是 Python 函数调用，而是模型配额、连接池、Checkpoint 写入、长连接数和 Tool 下游容量。

### 服务级水平扩展

SDK 本身没有分布式任务队列。自建服务至少要补齐：

1. 外部 PostgreSQL Checkpointer 和 Store；
2. 每租户、每模型、每 Tool 的背压与公平队列；
3. Run / Step / Tool Call 的幂等键；
4. SSE 断线重连、事件游标和终态查询；
5. 超时、取消、重试预算和 Dead-letter 处理；
6. 进程无关的认证、限流和 Secret 管理。

使用 LangSmith Agent Server 时，API Server 与 Queue Worker 可独立扩展，Thread 上同一时刻只执行一个 Run；其[运行架构](https://docs.langchain.com/langsmith/agent-server)把 Run 放入持久队列，Worker 获取租约、执行图、写 Checkpoint，再经 Pub/Sub 把事件转给 API Server。官方[扩容指南](https://docs.langchain.com/langsmith/agent-server-scale)给出的核心容量关系是：

```text
available_jobs = queue_workers × N_JOBS_PER_WORKER
throughput ≈ available_jobs / average_run_seconds
```

这属于可选部署产品的能力，不应写成 `langchain` Python 包本身的承诺。

### 热点与成本控制

- 将 `tenant_id + user_id + conversation_id` 组成稳定 Thread Key，避免误共享；
- 同一 Thread 的写入要串行化，跨 Thread 才做水平并发；
- 长会话用摘要和检索，不在每次请求读取全部历史；
- 对只读 Tool 结果和模型公共前缀做安全缓存，缓存键必须包含租户与策略版本；
- 分别记录 Queue Wait、Model、Tool、Checkpoint、Middleware 和首 Token 延迟；
- 让重试预算小于上游 Deadline，防止超时后的“幽灵工作”继续消耗配额。

## 生产安全与可靠性边界

LangChain 提供 Hook，不替应用做最终策略。上线前至少检查：

- Tool 是否最小权限，写操作是否审批并幂等；
- Prompt Injection 是否能把检索内容变成越权 Tool 参数；
- PII Middleware 是否覆盖输入、模型输出和 Tool Result；
- Structured Output 之后是否还有业务验证；
- Checkpoint、Trace、Memory 的加密、TTL、删除和租户隔离；
- Provider 包升级是否经过 Contract Test；
- 并行分支部分失败时，已经完成的外部副作用如何确认或补偿；
- Trace 是否意外保存 Secret、完整 Prompt 或个人数据。

一个实用的测试金字塔是：Tool Contract Test → Middleware 顺序测试 → 固定轨迹测试 → 沙箱集成测试 → 数据集评测 → 小流量 Canary。

## 从 v0 到 v1.3：升级到底带来了什么

### v0.x → v1.0：从“大工具箱”收敛为 Agent 核心

[v1 发布说明](https://docs.langchain.com/oss/python/releases/langchain-v1)和[迁移指南](https://docs.langchain.com/oss/python/migrate/langchain-v1)列出三项主线变化：

1. `create_agent` 取代 `langgraph.prebuilt.create_react_agent`，成为统一 Agent 入口；
2. Standard Content Blocks 统一现代模型的推理、引用、多模态与 Tool 内容；
3. `langchain` 命名空间精简，旧 Chains、Retrievers、Indexing 等迁到 `langchain-classic`。

同时，pre/post model Hook 迁移为 Middleware，自定义 State 推荐由 Middleware 声明，运行 Context 统一进入 LangGraph Runtime；Python 最低版本升至 3.10。

**好处**是 API 发现面更小，Agent 的横切逻辑可组合，模型输出更容易跨 Provider 消费，旧功能又保留在 Classic 包供渐进迁移。

### v1.2：补齐 Provider 能力和生产 Middleware

v1.2 增加 Tool `extras`、自动推断原生 `ProviderStrategy`、`SystemMessage` 形式的 System Prompt、模型重试 Middleware 和内容审核 Middleware。

**好处**是供应商特性不必破坏公共 Tool 抽象，Structured Output 路由更自动化，缓存控制与多模态 System Message 更自然，重试与内容安全也能作为统一策略复用。

### v1.3.0 → v1.3.15：流式协议与运行时硬化

1.3.0 为 Agent 的 `stream_events` / `astream_events` 增加 v3 事件协议。当前 1.3.15 Patch 又加入 Middleware `trace_policy`、`wrap_tool_call(state_schema=...)`、标准 `reasoning_effort` 参数，并修复摘要失败时历史丢失、HITL Gate 意外 Fail-open、Checkpoint 后陈旧 Structured Response、畸形结构化输出和 Tool Call Limit 留下孤立 Tool Call 等问题；详见[1.3.15 Release](https://github.com/langchain-ai/langchain/releases/tag/langchain%3D%3D1.3.15)。

**好处**主要是可观测策略更细、Middleware State 更完整，并强化长会话、审批和结构化响应的失败语义。它是对 v1 架构的加固，不是另一套 Agent 模型。

## 适用判断

LangChain 很适合以下起点：

- 需要快速接入多家模型和大量外部组件；
- 核心交互是 Tool-calling Loop，同时需要摘要、Guardrail、HITL、模型路由等上下文工程；
- 希望先用高层 Agent API，再逐步进入 LangGraph 自定义拓扑；
- 需要统一 Message / Tool / Runnable Contract 支撑测试与替换；
- 已经采用或计划采用 LangSmith 做 Trace 和评测。

以下情形需要额外设计，而不是只增加一个 Chain：

- 业务要求严格的跨系统事务、Exactly-once 副作用或长期定时调度；
- 需要数千并发长任务，却没有外部队列、持久化和配额治理；
- 多租户允许用户编写任意 Tool 代码，却没有进程、网络和数据隔离；
- 流程拓扑高度确定，此时应把确定性部分写成普通代码或显式 Graph Node。

## 阅读源码时抓住这条线

基于 [`langchain==1.3.15`](https://github.com/langchain-ai/langchain/tree/langchain%3D%3D1.3.15)，推荐按以下顺序阅读：

1. `libs/langchain_v1/langchain/agents/factory.py`：`create_agent` 如何组图；
2. `libs/langchain_v1/langchain/agents/middleware/`：Hook、State Schema 和内置策略；
3. `libs/core/langchain_core/messages/`：消息与 Content Blocks；
4. `libs/core/langchain_core/tools/`：Tool Schema、Runtime 注入与结果协议；
5. `libs/core/langchain_core/runnables/`：统一调用、批处理、流与配置传播；
6. Provider 包的 `chat_models`：公共接口怎样映射到供应商 API；
7. 再进入 [LangGraph](langgraph.md) 的 Pregel、Checkpoint 和 Interrupt，理解 Agent 的真实运行语义。

## 结论

LangChain v1 的核心成果是把庞杂生态重新收敛到一条清晰主线：**标准化模型与消息，用 Tool 连接行动，用 Middleware 管理上下文，再把 Agent Loop 编译到 LangGraph Runtime。**

它最值得吸收的工程思想，不是把所有逻辑都写成 Chain，而是建立稳定的组件契约：模型可以替换，Tool 可以独立测试，策略可以作为 Middleware 组合，Agent 又可以作为 Node 进入更大的工作流。真正进入高并发生产后，仍要把队列、配额、持久化、幂等、租户隔离和可观测性当成一等系统设计。

## 主要资料

- [LangChain v1 Release Notes](https://docs.langchain.com/oss/python/releases/langchain-v1)
- [LangChain v1 Migration Guide](https://docs.langchain.com/oss/python/migrate/langchain-v1)
- [Agents](https://docs.langchain.com/oss/python/langchain/agents)
- [Middleware](https://docs.langchain.com/oss/python/langchain/middleware/overview)
- [Messages and Standard Content Blocks](https://docs.langchain.com/oss/python/langchain/messages)
- [Runtime](https://docs.langchain.com/oss/python/langchain/runtime)
- [Multi-Agent](https://docs.langchain.com/oss/python/langchain/multi-agent/index)
- [Streaming](https://docs.langchain.com/oss/python/langchain/streaming)
- [LangChain 1.3.15 Source and Release](https://github.com/langchain-ai/langchain/releases/tag/langchain%3D%3D1.3.15)
