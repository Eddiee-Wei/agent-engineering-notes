---
layout: default
title: Agent Framework
description: 十个 Agent 框架的源码阅读、运行时语义、版本演进与生产选型地图。
---

<span class="eyebrow">02 · AGENT FRAMEWORK</span>

<h1 data-i18n data-en="Agent Framework" data-zh="Agent 框架">Agent Framework</h1>

<p data-i18n data-en="Notes on the engineering choices different Agent frameworks make around runtime behavior, state, workflows, tool calling, and production readiness." data-zh="记录不同 Agent 框架在运行时、状态、工作流、工具调用和生产化方面的工程选择。">Notes on the engineering choices different Agent frameworks make around runtime behavior, state, workflows, tool calling, and production readiness.</p>

{% include section-note-directory.html section_id="frameworks" %}

## 这是一张工程地图，不是排行榜

十个框架都能让模型调用工具，但它们解决的首要问题并不相同：有的从模型与工具集成出发，有的把状态转换和恢复做成 Runtime，有的围绕角色协作或可视化开发，有的已经把 Workspace、Sandbox、API 与产品界面组合成 Harness。

因此，“哪个框架最好”不是一个完整问题。更有用的问法是：

1. 你的主控制流是开放式 Agent loop，还是显式 Graph / Workflow？
2. 一次 Run、一次 Attempt、一个 Session 和长期 Memory 分别存在哪里？
3. 暂停、崩溃、重试和部署升级后，哪些状态可以恢复？
4. 外部写操作怎样授权、幂等、对账和补偿？
5. 并发发生在单个 Run 内、单进程、多副本，还是下游模型与工具？

本节所有页面都按这组问题阅读稳定 Release、官方文档和对应源码，不根据 Star 数、营销吞吐或单次演示给框架排位。

## 十个框架各自最鲜明的设计中心

| 框架 | 最有辨识度的设计中心 | 适合作为起点的问题 |
| --- | --- | --- |
| [Agno](../frameworks/agno.md) | `Agent → Team → Workflow → AgentOS` 的连续抽象 | 希望从小型 Agent 平滑走向显式流程、HITL、追踪和 API 服务 |
| [AutoGen](../frameworks/autogen.md) | AgentChat 高层团队与 Core 消息/事件 Runtime 两级编程面 | 维护既有 AutoGen 系统，或研究 AgentId、Topic、Handoff 与团队通信；新项目同时评估 MAF 迁移路线 |
| [CrewAI](../frameworks/crewai.md) | 角色式 Crew 与确定性 Flow 并列为一等概念 | 开放式角色协作需要嵌入审批、路由、重试和副作用边界 |
| [Google ADK](../frameworks/google-adk.md) | Agent、Runner、Event、Session 的清晰协议，以及多语言实现与 Google Cloud 部署路径 | 需要 Python、Go、Java、TypeScript 或 Kotlin 团队共享 Agent 心智模型，或接入 Google 生态 |
| [LangChain](../frameworks/langchain.md) | Model、Message、Tool、Runnable 与 Middleware 的标准组件层 | 需要快速接入异构模型/工具，并把摘要、路由、审批和 Guardrail 软件化 |
| [Langflow](../frameworks/langflow.md) | 类型化可视画布、可编辑 Python Component、Flow JSON 与 LFX/Headless Runtime | 产品、数据和工程人员要围绕同一份可执行拓扑协作并交付 |
| [LangGraph](../frameworks/langgraph.md) | State + Reducer + Pregel + Checkpoint + Interrupt | 长时任务需要显式分支、并行合并、人工暂停、恢复与 Time Travel |
| [AgentScope](../frameworks/agentscope.md) | Agent SDK、Workspace 与 Agent-as-a-Service 的一体化 | Agent 需要文件/命令工作区、类型化事件和可直接服务化的运行面 |
| [DeerFlow](../frameworks/deerflow.md) | Skills、Sandbox、Memory、Subagent、Artifact 与 Web/Gateway/IM 组成的 Super-Agent Harness | 希望交付可直接工作的研究、编码和内容生产型桌面 Agent |
| [tRPC-Agent-Go](../frameworks/trpc-agent-go.md) | 小型 `Agent.Run → Event channel` 契约贯穿 Runner、Graph、Team、协议与 Evaluation | 已有 Go 服务体系需要强类型 Tool、`context` 取消、BSP/DAG Graph 与 OTel |

这些“设计中心”描述的是不同入口，不是能力互斥。例如 LangChain Agent 编译到 LangGraph；DeerFlow 又在 LangChain/LangGraph 之上提供产品 Harness。选型前先确认比较的是 SDK、Runtime、部署平台还是完整应用。

## 按主问题选择阅读路径

| 你的主问题 | 建议优先阅读 | 继续对照 |
| --- | --- | --- |
| 模型、工具和 Provider 集成很多 | LangChain | Google ADK、Agno |
| 需要可恢复的长任务与显式状态图 | LangGraph | tRPC-Agent-Go Graph、CrewAI Flow |
| 角色分工与自然语言任务契约最重要 | CrewAI | AutoGen AgentChat、Agno Team |
| 需要低层消息驱动的多 Agent 拓扑 | AutoGen Core | tRPC-Agent-Go Event、Google ADK Event |
| 需要可视化共创和独立 Runtime 交付 | Langflow | LangGraph、LangChain |
| 需要 Workspace、Sandbox 与文件产物 | AgentScope、DeerFlow | tRPC-Agent-Go Workspace、Google ADK Artifacts |
| 需要 Go 原生服务集成 | tRPC-Agent-Go | Google ADK Go |
| 需要多语言 SDK 或 Google Cloud 路径 | Google ADK | tRPC-Agent-Go、Agno AgentOS |
| 希望从 SDK 一路走到服务控制面 | Agno | AgentScope AaaS、Google ADK Deployment |
| 希望从可运行的 Super-Agent 产品底座开始 | DeerFlow | AgentScope、Langflow |

真正的 PoC 应固定相同模型、提示、工具 schema、测试数据和基础设施，再比较完成率、最终状态、恢复行为、成本与尾延迟。只比较最终文本，无法看见运行时差异。

## 网上常见评价，哪些经得住验证

| 常见说法 | 核验结论 | 证据与工程含义 |
| --- | --- | --- |
| “Agent 越多效果越好” | 不成立 | [Google Research](https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/) 的 180 组配置显示：可并行分解任务可能受益，强顺序依赖任务可能退化；协调结构还会影响错误放大。先量化可分解性，再决定是否 Fan-out。 |
| “多 Agent 最适合所有长任务” | 过度概括 | [Anthropic 的生产复盘](https://www.anthropic.com/engineering/multi-agent-research-system)强调它尤其适合 breadth-first、相互独立的探索；共享上下文、强依赖和高协调成本仍需谨慎。 |
| “同一 Agent 定义换个框架，行为应该相同” | 不成立 | [CAIS 2026 的跨框架研究](https://dl.acm.org/doi/10.1145/3786335.3813130)从同一声明式规格出发，LangGraph、CrewAI、AutoGen 与 WayFlow 仍在准确率、延迟和执行行为上出现差异。Runtime 语义是实验变量。 |
| “支持 async / streaming / Go，就自然支持海量请求” | 信息不足 | async 改善 I/O 等待，streaming 改善反馈，Go 降低并发执行开销；它们都没有自动提供持久队列、租约、共享限流、同 Session 串行和副作用幂等。每个框架页都单独核对了这些边界。 |
| “可视化框架只能做 Demo” | 太绝对 | Langflow 可以把 IDE 与 Headless/LFX Runtime 分离，并将审核后的 Flow 作为不可变交付物；但编辑器能运行 Python，生产隔离和多 Worker Queue 仍必须显式配置。 |
| “有 Checkpoint 就是 Exactly-once” | 不成立 | Checkpoint 通常只覆盖框架状态。邮件、支付、工单和数据库写入仍要使用业务幂等键、effect receipt、outbox 或补偿。 |
| “AutoGen 已经不可用” | 不准确 | AutoGen 当前进入维护与社区管理阶段，仍适合固定版本维护既有系统和复现实验；官方只是把新功能投资与新用户路线转向 Microsoft Agent Framework。 |

[Auto-SLURP](https://aclanthology.org/2025.findings-emnlp.596/)等端到端工具执行基准也提示：可靠的多 Agent 助手仍是进行中的工程问题。单个公开榜单只能说明特定模型、任务、提示和运行环境，不能代替你的工作负载验收。

## 高并发要拆成五层

| 层次 | 框架通常能提供什么 | 仍需应用或平台补齐什么 |
| --- | --- | --- |
| 一次模型响应内 | 多 Tool Call、异步 Tool | 并发安全声明、资源 key 互斥、超时与批次失败策略 |
| 单个 Run 内 | Graph Fan-out、Parallel Agent、Subagent | 最大分支数、Join 规则、Token/成本预算、取消传播 |
| 单进程多 Run | async、goroutine、线程/任务池 | Admission、Semaphore、CPU 隔离、连接池与背压 |
| 多副本 | 外部 Session/Checkpoint backend、可选部署产品 | Durable Queue、Lease/Fencing、Run Owner、事件重放、同 Session 单写者 |
| 外部副作用 | Tool schema、HITL、Callback | AuthN/AuthZ、幂等键、事务/Outbox、效果查询与补偿 |

一个通用生产拓扑可以概括为：

```text
API / authentication / admission
  -> durable queue（tenant, run_id, attempt_id, deadline, idempotency_key）
  -> stateless or leased workers
  -> shared Session / Checkpoint / Run store
  -> object store for large Artifacts
  -> provider-aware model/tool limiters
  -> replayable events + traces + final-status API
```

容量估算可先用 Little's Law 建立量级感：

```text
同时在途 Run ≈ 峰值请求率 × P95 Run 时长
```

随后用真实工作负载分别压测 Queue Wait、首事件、最终完成、Checkpoint、模型/工具限流、慢消费者、取消回收和重复副作用。框架没有给出与你的模型、工具、上下文长度和租户分布无关的通用 QPS。

## 国内三套框架的升级主线

| 框架 | 演进 | 新版本带来的主要收益 | 迁移时必须承认的边界 |
| --- | --- | --- | --- |
| AgentScope | 0.x → 1.0 → 2.0.6 | 1.0 完成 async、Session/State、OTel、MCP 与评测等工程化；2.x 再把 Workspace、结构化输出和 AaaS 收进核心运行面 | 2.0 是重要重构，v1 的 evaluation 等模块不能直接当作 v2.0.6 API；旧代码要按状态、工具和事件契约迁移 |
| DeerFlow | 1.x → 2.0.0 | 从专用 Deep Research 图重写为通用 Super-Agent Harness，统一 Skills、Sandbox、Memory、Subagent、Artifact 与 Gateway | 2.0 与 1.x 不共享代码；当前 Gateway 官方默认单 Worker，Subagent 与实时流仍有进程内所有权 |
| tRPC-Agent-Go | v0.x/v1.1 → v1.7 → v1.11.1 | 逐步加入 DAG Engine、观测/评测、PromptIter、Workspace、TaskRun、独立成员 Session、Dynamic Workflow、演进与并发治理 | 不是一次 1.0 大重写；新开 DAG、并行 Tool 或动态代码前，要分别复测 Checkpoint、事件归因、Sandbox 与副作用顺序 |

三者的升级都带来更完整的运行能力，但“组件更多”也意味着状态迁移、隔离、恢复和运维面同步扩大。章节分别给出源码锚点、迁移影响和当前缺口。

## 最后用运行事实做决定

框架名只是架构的起点。最终设计评审至少应产出：

- 一张 Run / Attempt / Session / Memory / Artifact 生命周期图；
- 一份模型、Tool、Agent 与 Human 的责任边界；
- 一套暂停、恢复、重试、取消和发布升级语义；
- 一份每层并发预算与下游容量表；
- 一条 Tool Call 候选、授权、执行、最终效果与审计证据链；
- 一组固定版本、可重复运行的真实任务与故障注入测试。

做到这些，框架各自的长处才会变成系统能力，而不是只停留在 API 名称上。
