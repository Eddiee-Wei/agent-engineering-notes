---
title: LangGraph
description: LangGraph 1.2 的状态图、Pregel 执行、Checkpoint、Interrupt、Durable Execution、并行与生产扩展实践。
last_verified: 2026-08-13
---

# LangGraph

> 版本快照：本文以 Python 包 [`langgraph==1.2.11`](https://github.com/langchain-ai/langgraph/releases/tag/1.2.11) 为基线，发布于 2026-08-11，对应源码提交 [`644815f`](https://github.com/langchain-ai/langgraph/tree/644815f9e5bc52ad8f7a5227a456227e9c3e639b)。资料核对日期为 2026-08-13；本文只描述稳定版能力，不把尚未发布的 Next 文档当作当前契约。

LangGraph 是一个低层、有状态的工作流 Runtime。它解决的核心问题不是“怎样再封装一次 Prompt”，而是：

> **当一个 Agent 或业务流程会分支、并行、循环、等待人工、跨进程恢复并持续很久时，怎样用显式状态转换表达它，并为每一步建立可重放、可检查的执行边界。**

LangGraph 不要求使用 LangChain；Node 可以是普通 Python 函数、任意模型 SDK、数据库调用或另一个 Graph。反过来，[LangChain](langchain.md) 的 `create_agent` 会编译成 LangGraph，因此两者是“高层 Agent 组件”与“低层状态图 Runtime”的关系，而不是两套互斥框架。

## 先把产品边界画清楚

| 层次 | 主要职责 | 是否由 `langgraph` SDK 自带 |
| --- | --- | --- |
| Graph / Functional API | 定义 Node、Edge、State、Task 与控制流 | 是 |
| Pregel Runtime | 以超步调度任务、合并更新、流式输出 | 是 |
| Checkpointer / Store 协议 | Thread 快照、Pending Write、跨 Thread 记忆 | 协议在 OSS；生产后端是独立包 |
| LangGraph Platform API | Run、Thread、Assistant、Cron 等服务接口 | 否，属于部署产品 |
| Agent Server / Queue Worker | 持久队列、租约、水平扩展、SSE 转发 | 否，属于 LangSmith Deployment / 自建服务 |
| LangSmith | Trace、Studio、数据集与评测 | 否，可选产品 |

因此，“图能持久化”不等于“安装 SDK 就有分布式队列”；“Node 能并行”也不等于“任意副作用都获得 Exactly-once 语义”。

## Graph API：状态转换是第一等对象

一个 `StateGraph` 由五部分组成：

1. **State Schema**：整个 Graph 共享的逻辑状态；
2. **Reducer / Channel**：同一个 State Key 收到多个更新时怎样合并；
3. **Node**：读取当前 State，返回局部更新或控制命令；
4. **Edge**：决定下一步固定或条件路由；
5. **Checkpointer**：把 State 与待执行任务保存到 Thread。

下面这个小图同时展示确定性路由、并行 Map、Reducer 和人工审批：

```python
import operator
from typing import Annotated, Literal
from typing_extensions import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, Send, interrupt


class OverallState(TypedDict):
    topics: list[str]
    drafts: Annotated[list[str], operator.add]
    approved: bool


class WorkerState(TypedDict):
    topic: str


def fan_out(state: OverallState):
    return [Send("draft", {"topic": topic}) for topic in state["topics"]]


def draft(state: WorkerState):
    # 真实项目可在这里调用模型；每个 Send 获得独立输入。
    return {"drafts": [f"draft:{state['topic']}"]}


def approval(state: OverallState):
    answer = interrupt({"kind": "approve", "drafts": state["drafts"]})
    return {"approved": bool(answer["approved"])}


def route_after_approval(state: OverallState) -> Literal["publish", "revise"]:
    return "publish" if state["approved"] else "revise"


def publish(state: OverallState):
    return {}


def revise(state: OverallState):
    return {"drafts": ["revision requested"]}


builder = StateGraph(OverallState)
builder.add_node("draft", draft)
builder.add_node("approval", approval)
builder.add_node("publish", publish)
builder.add_node("revise", revise)
builder.add_conditional_edges(START, fan_out, ["draft"])
builder.add_edge("draft", "approval")
builder.add_conditional_edges("approval", route_after_approval)
builder.add_edge("publish", END)
builder.add_edge("revise", END)

graph = builder.compile(checkpointer=InMemorySaver())  # 仅用于本地演示
config = {"configurable": {"thread_id": "campaign-42"}}

# 首次调用会在 approval 暂停；恢复时必须使用同一个 thread_id。
graph.invoke({"topics": ["runtime", "memory"]}, config=config)
graph.invoke(Command(resume={"approved": True}), config=config)
```

生产环境应换用 PostgreSQL 等持久化 Checkpointer。示例中的发布 Node 也必须做业务幂等，不能把 Checkpoint 当成外部系统的事务提交。

## Reducer 决定并发语义

Node 返回的是 State 的**局部更新**，不是原地修改后的完整对象。每个 Key 默认只接受一个更新；如果同一超步的多个并行 Node 都写同一个 Key，就必须声明 Reducer，例如：

```python
class State(TypedDict):
    results: Annotated[list[str], operator.add]
```

这不是类型标注上的小细节，而是并发一致性的核心：

- `operator.add` 会聚合并行结果，但结果顺序不应被当成业务顺序；
- “最后写入获胜”在并行分支中通常不稳定；
- 自定义 Reducer 应满足确定性，最好具备结合性；
- 金额扣减、库存占用等不应仅靠内存 Reducer 保证，应由拥有事务能力的系统执行。

消息 State 通常使用 `add_messages`，它会按消息 ID 追加或覆盖，能正确处理人工修改和 Tool Message，而不是简单拼接列表。[Graph API 文档](https://docs.langchain.com/oss/python/langgraph/graph-api)说明了 Schema、Reducer 和多 Schema 的完整规则。

## Pregel 执行：节点并行，状态在屏障后可见

编译后的 Graph 使用受 Pregel 启发的 Bulk Synchronous Parallel 模型。一次逻辑执行分为离散的 **superstep**：

```text
计划本超步的任务
  → 并发执行可运行 Node
  → 收集每个 Node 的局部写入
  → Reducer 合并并提交新 State / Checkpoint
  → 下一超步才能读取这些更新
```

这带来几个容易忽略的语义：

- 同一超步中的兄弟 Node 通常看不到彼此刚写的数据；
- 同一超步整体具有事务式 State 更新边界，失败时不会把半合并 State 推进为下一快照；
- 启用 Checkpointer 后，已经成功的兄弟任务可留下 Pending Writes，恢复时不必重复执行；
- Graph 的“事务”只覆盖 Runtime State，不自动覆盖邮件、支付、数据库和第三方 API。

因此，切分 Node 不只是画图：它决定并行边界、重试范围、Checkpoint 粒度和可观测粒度。

## 三种控制原语

### Edge：静态拓扑与条件拓扑

普通 Edge 适合固定顺序；Conditional Edge 根据 State 返回一个或多个下一 Node。路由函数应尽量纯净、快速和可测试，避免在路由中偷偷执行副作用。

### `Send`：动态 Fan-out / Map-Reduce

`Send(node, arg)` 可以在运行时按数据量创建若干并行任务，且每个任务接收不同输入。它适合文档分片、候选方案并行分析和多源检索。各分支写回共享 Key 时要提供 Reducer，调用侧还要设置合理的 `max_concurrency`，避免一次输入生成几千个模型请求。

### `Command`：把更新与路由放在同一返回值

`Command(update=..., goto=...)` 让 Node 同时写 State 和决定后继；`Command(resume=...)` 恢复 Interrupt；子图中的 `Command(graph=Command.PARENT, goto=...)` 可把控制权交回父图，常用于 Multi-Agent Handoff。

如果 Node 返回 `Command(goto=...)`，静态 Edge 仍会执行；它不是自动替换已有 Edge。拓扑审查时要避免意外触发两条路径。

## Checkpoint、Thread、Store：三个不同概念

### Checkpoint 是每一步的执行快照

启用 Checkpointer 后，Runtime 按超步为 Thread 保存 `StateSnapshot`。核心字段包括：

- `values`：当前 Channel 值；
- `next`：下一超步要执行的 Node；
- `config` / `parent_config`：当前与父快照定位信息；
- `metadata`：来源、Step 等元数据；
- `tasks`：待执行任务、错误、Interrupt 与 Pending Write。

`thread_id` 是会话执行线的主键。服务端必须从认证后的租户与会话标识派生它，不能接受未校验的任意 ID，否则会造成跨租户状态读取。

### Store 是跨 Thread 的长期记忆

Checkpointer 保存某个 Thread 的过程状态；Store 以 namespace / key 保存可跨 Thread 检索的长期 JSON 文档。两者生命周期、删除策略和隔离键都不同。把所有长期记忆塞进 Checkpoint 会让快照膨胀，把执行进度只写 Store 又失去恢复语义。

### Time Travel 是分叉，不是时间倒流

读取历史 State 后重放，会复用该快照之前的状态，并重新执行其后的 Node；`update_state` 会创建一个新的 Checkpoint 分支。已经发送的邮件或支付不会因为分叉自动撤销，因此外部副作用仍需幂等键、效果查询和补偿流程。

[Persistence 文档](https://docs.langchain.com/oss/python/langgraph/persistence)对 Checkpoint、Replay、Pending Writes 与 Store 的边界有完整说明。

## Interrupt：暂停与恢复的真实语义

Node 内调用 `interrupt(value)` 时，Runtime 保存可恢复状态，并把 `value` 交给调用方；之后用同一 `thread_id` 和 `Command(resume=...)` 恢复。

最重要的规则是：**恢复会从这个 Node 的开头重新执行，而不是从 Python 函数的那一行继续。** 因此：

1. Interrupt 之前的副作用必须幂等，或移到单独 Node；
2. 同一 Node 内多个 Interrupt 的顺序不能在恢复前改变；
3. Interrupt 值与 Resume 值必须可序列化；
4. 不要用宽泛的 `try/except` 吞掉 Interrupt 产生的控制异常；
5. 审批必须绑定请求摘要、工具参数、策略版本、审批人和过期时间。

这套模型把人工审批变成 Durable Workflow 的一部分，而不是让 HTTP 请求一直占用线程等待人点击。[Interrupt 文档](https://docs.langchain.com/oss/python/langgraph/interrupts)给出了常见反模式。

## Durable Execution 与故障边界

LangGraph 的 Durable Execution 来自三个条件：

- 使用持久化 Checkpointer；
- 用同一个 `thread_id` 继续执行；
- Node / Task 的非确定性结果和副作用被正确封装。

调用时可以选择 Checkpoint 持久性：

| `durability` | 提交方式 | 适合场景 | 风险与代价 |
| --- | --- | --- | --- |
| `"async"` | 默认，执行与 Checkpoint 写入重叠 | 大多数在线流程 | 进程骤停时存在最近一步尚未落盘的窗口 |
| `"sync"` | 下一步前等待 Checkpoint 完成 | 高价值、恢复点要求严格 | 增加每步延迟和数据库写压力 |
| `"exit"` | 只在 Run 退出时保存；顶层 Interrupt 退出也会落下最终 Checkpoint | 可重算的短任务，或能接受较大重做区间的流程 | 能支撑 Interrupt/HITL 恢复，但异常崩溃前的中间超步没有快照，会从更早位置重做 |

更多 Node 往往能缩小失败重跑范围，但也增加 Checkpoint、序列化和调度开销。合理边界通常放在模型调用、昂贵 Tool、外部副作用和人工等待之间。

Graph API 之外，[Functional API](https://docs.langchain.com/oss/python/langgraph/functional-api)提供 `@entrypoint` 与 `@task`：开发者保留普通控制流写法，同时把昂贵或非确定性操作封装为可保存的 Task。它适合动态逻辑或迁移已有 Python 流程；Graph API 更适合需要可视拓扑和显式状态机的系统，两者可以互相调用。

## Subgraph 与 Multi-Agent

Subgraph 可以作为 Node 被父图调用。常见的 Multi-Agent 结构包括：

- Supervisor 通过 Tool / Node 调用多个专用子图；
- Router 用 Conditional Edge 或 `Send` 并行分派；
- Handoff 用 `Command.PARENT` 更新父 State 并切换活跃 Agent；
- 子图拥有私有 State，只把摘要或结构化结果返回父图；
- 确定性校验、审批、持久化 Node 包围不确定的 Agent Node。

子图是否共享父 Checkpointer、是否需要独立 namespace、State Key 如何映射，都应显式设计。不要把所有 Agent 的完整对话无条件合并到父 State，否则上下文隔离和成本优势会消失。

## LangGraph 的独到优势

### 把恢复语义做到控制流层

Checkpoint 不只是保存聊天记录；它包含下一任务、元数据、错误、Interrupt 和 Pending Writes。故障恢复、人工暂停、调试重放与状态分叉共享同一套执行模型。

### State + Reducer 明确表达并行合并

并行分支不能悄悄覆盖共享变量。Reducer 迫使设计者说明每个 Key 的合并规律，`Send` 又把动态 Map-Reduce 变成 Runtime 原语。

### 确定性工作流与 Agent Loop 可以放在同一张图

分类、规则校验、数据库操作、Agent、人工审批和补偿都可以是 Node。模型只承担真正需要判断的步骤，业务约束则保持为可测试的确定性代码。

### Graph API 与 Functional API 覆盖两种工程习惯

显式拓扑利于审计与可视化；Task 化普通代码利于渐进迁移。两者共享 Checkpoint、Stream、Interrupt 和 Runtime，不必为了 Durable Execution 把所有逻辑改写成一种 DSL。

### Runtime 与模型供应商解耦

LangGraph 不要求 LangChain Model，也不把状态绑定到某家模型消息格式。Node 只要遵守输入、输出和副作用契约即可。

## 高并发与超多请求场景

### 单个 Run 内：限制 Fan-out，而不是只追求并行

同一超步的 Node 与 `Send` 任务可并行，调用配置的 `max_concurrency` 会限制并行 Task 数。这个上限应取多个资源中的最小安全值：

```text
安全并发 ≈ min(模型 RPM/平均调用频率,
               模型 TPM/平均 Token,
               Tool 下游 QPS,
               数据库可用连接,
               进程 CPU/内存预算)
```

动态 Fan-out 前应先分批、去重并设置最大分支数。分支结果很大时，在对象存储保存正文，只把引用和摘要写 State，避免每个 Checkpoint 重复序列化巨型对象。

### 单进程：异步 I/O 仍然需要背压

使用 `ainvoke` / `astream`、异步模型 Client 和异步 Checkpointer。同步 SDK、CPU 密集解析或无上限 `asyncio.gather` 会阻塞或压垮事件循环。Node 级 Retry 应带抖动、上限与总 Deadline，不能让每层各重试三次形成指数放大。

### 多副本：把状态与队列移出进程

自建服务至少需要：

1. PostgreSQL 等生产 Checkpointer 与连接池；
2. 持久任务队列、租约、可见性超时和 Dead-letter；
3. 同一 Thread 的互斥或顺序保证；
4. Run / Node / Tool Call 的幂等键；
5. SSE 事件游标、断线重连和独立终态查询；
6. 按租户、模型与 Tool 的公平限流；
7. 取消传播、超时预算和孤儿任务回收。

可选的 [Agent Server](https://docs.langchain.com/langsmith/agent-server) 使用无状态 API Server、持久任务队列和 Queue Worker；API 与 Worker 可独立扩容，同一个 Thread 同时只执行一个 Run。官方[扩容指南](https://docs.langchain.com/langsmith/agent-server-scale)给出的基本关系是：

```text
available_jobs = queue_workers × N_JOBS_PER_WORKER
throughput ≈ available_jobs / average_run_seconds
```

这是部署产品的架构，不是 OSS `langgraph` 包自动提供的能力。自建系统也要针对 Checkpoint 写入放大、热点 Thread、长尾 Tool 和长连接数量分别压测。

### Checkpoint 成本是容量模型的一部分

大 State × 高频超步 × 大量 Thread 会同时增加数据库写放大、存储和恢复延迟。1.2 引入 Beta 的 `DeltaChannel`，通过保存增量写入并周期性生成完整快照降低某些聚合 Channel 的存储；Reducer 必须确定且满足批次不变性。它仍是 Beta，不应在没有迁移与恢复演练的情况下替换关键 State。

应分别记录 Queue Wait、Node、Model、Tool、Reducer、Checkpoint Put/Get、首事件和最终完成延迟。只看总 P95 很难判断应该扩 API、Worker、数据库还是模型配额。

## 生产可靠性与安全边界

- Checkpoint 不是跨系统事务；外部写操作必须幂等并能查询效果；
- `thread_id`、Store namespace 和 Trace 都必须包含经过认证的租户边界；
- Checkpoint / Store / Trace 的加密、TTL、删除和备份策略要分别定义；
- Node 输入来自模型或外部数据时，仍要做 Schema 与授权校验；
- Graph 递归、循环和 Fan-out 要有步数、时间、Token 与费用上限；
- 序列化器不能反序列化不可信的任意 Python 对象；
- Parallel Step 部分成功后，重试必须识别 Pending Write 和外部效果；
- Interrupt Resume API 要校验审批人、允许动作和请求版本，不能只接收布尔值。

还有一个常被忽略的发布风险：**恢复旧 Thread 时使用的是当前部署的 Graph 定义，并不会自动把工作流代码固定在最初版本。** Node 改名、State Schema 变化、路由改变或 Interrupt 顺序变化都可能破坏旧 Checkpoint。官方[向后兼容指南](https://docs.langchain.com/oss/python/langgraph/backward-compatibility)建议用 Staging、迁移和 Time Travel 验证长生命周期 Thread。

## 从 0.x 到 1.2.11：升级到底带来了什么

### 0.x → 1.0：稳定 Runtime，而非重写核心

[LangGraph v1 Release Notes](https://docs.langchain.com/oss/python/releases/langgraph-v1)把 v1 定义为稳定性导向的主版本：Graph API、执行模型和核心持久化语义保持兼容。最大的生态迁移是预构建 `create_react_agent` 被弃用，高层 Agent 新项目改用 LangChain v1 的 `create_agent`；LangGraph 继续承担底层 Runtime。

**好处**是团队可以继续使用已有 `StateGraph`，同时让高层 Agent API、Middleware 和现代 Message 语义在 LangChain 中独立演进。

### 1.2：增量快照与执行能力加固

1.2 系列加入 Beta `DeltaChannel`，为超大累积 State 提供增量 Checkpoint 路径，并持续改进 Functional API、流式事件、并行任务和持久化一致性。

**好处**是大 State 工作流可以更精细地权衡存储与恢复成本，但 Reducer 的确定性和迁移测试要求也更高。

### 1.2.11：Patch 重点是 Trace 与 Delta 正确性

当前 [1.2.11 Release](https://github.com/langchain-ai/langgraph/releases/tag/1.2.11)为 `add_node` 增加 `trace_policy`，并修复 Delta Checkpoint 与 Conformance Package 的一致性问题。

**好处**是 Node 级 Trace 策略更可控，新增的增量持久化路径更可靠。它仍属于 1.2 架构内的 Patch 加固，不能据此把 Beta `DeltaChannel` 当成无迁移风险的稳定磁盘格式。

## 适用判断

LangGraph 很适合：

- 长时运行、需要失败恢复或人工等待的 Agent；
- 包含分支、循环、并行 Map-Reduce、Handoff 与补偿的工作流；
- 希望把确定性业务 Node 与不确定模型 Node 放在同一控制面；
- 需要 State Inspection、Replay、Time Travel 和可恢复 Stream；
- 已有普通 Python 流程，希望用 Functional API 渐进获得 Durable Execution。

以下情形应保持克制：

- 单次、无状态、一步模型调用，普通函数已经足够；
- 希望 Graph 自动提供 Exactly-once 事务、Cron、分布式队列或租户隔离；
- 把每行代码都拆成 Node，导致状态和 Checkpoint 开销大于恢复收益；
- 允许不可信用户上传任意 Node 代码，却没有进程、文件、网络和凭据隔离。

## 阅读源码时抓住这条线

基于 [`1.2.11`](https://github.com/langchain-ai/langgraph/tree/1.2.11)，推荐按以下顺序阅读：

1. `libs/langgraph/langgraph/graph/state.py`：`StateGraph` 怎样验证和编译拓扑；
2. `libs/langgraph/langgraph/channels/`：State Key、Reducer 与 `DeltaChannel`；
3. `libs/langgraph/langgraph/pregel/main.py`：Invoke、Stream、Durability 与主执行入口；
4. `libs/langgraph/langgraph/pregel/_loop.py`：超步、Checkpoint 与任务推进；
5. `libs/langgraph/langgraph/pregel/_executor.py`：并发 Task 和 `max_concurrency`；
6. `libs/langgraph/langgraph/types.py`：`Send`、`Command`、`interrupt`、`StateSnapshot`；
7. `libs/checkpoint/`：Saver 协议、序列化与 Pending Writes。

## 结论

LangGraph 最值得借鉴的不是“把流程画成图”，而是把 Agent 的执行事实拆成明确契约：**State 用 Reducer 合并，Node 在超步中调度，Checkpoint 固化恢复点，Interrupt 把人纳入控制流，外部副作用则以幂等和补偿单独治理。**

它能让长任务在失败、暂停和发布升级中更可解释，但不会替应用消除分布式系统的复杂度。进入高并发生产后，真正决定可靠性的仍是队列、租约、数据库、限流、幂等、Schema 演进和租户隔离。

## 主要资料

- [LangGraph Overview](https://docs.langchain.com/oss/python/langgraph/overview)
- [LangGraph v1 Release Notes](https://docs.langchain.com/oss/python/releases/langgraph-v1)
- [Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api)
- [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- [Durable Execution](https://docs.langchain.com/oss/python/langgraph/durable-execution)
- [Interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts)
- [Functional API](https://docs.langchain.com/oss/python/langgraph/functional-api)
- [LangGraph 1.2.11 Source and Release](https://github.com/langchain-ai/langgraph/releases/tag/1.2.11)
