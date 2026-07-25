# Agent 技术图谱：从框架到 Coding Agent

> 以 [tRPC-Agent-Go](https://github.com/trpc-group/trpc-agent-go) 为工程参照，系统理解主流 Agent 框架，并追踪它们如何演进为 Codex、Claude Code、Gemini CLI、OpenCode 等完整应用。

## 为什么写这个项目

Agent 领域的项目很多，但名称相似、抽象层次不同，容易陷入“会调用 API，却说不清系统为什么这样设计”的状态。

这个项目不做简单的框架清单，也不按 Star 数量排名。我们从真实的 Go Agent 工程经验出发，用统一问题研究不同实现：

- Agent 的运行循环由谁驱动？
- Model、Tool、Session、Memory 和 Knowledge 如何协作？
- Graph、Workflow 与自主 Agent 的边界在哪里？
- Streaming、取消、恢复、评测和可观测性如何落地？
- 一个通用 Agent 框架还缺少什么，才能成为 Coding Agent？

## 项目主线

```text
Agent 基础概念
      ↓
tRPC-Agent-Go 参考范式
      ↓
国外通用框架对照
LangChain / LangGraph / AutoGen / Google ADK / Agno
      ↓
国内框架与 Agent Harness
AgentScope / DeerFlow / tRPC-Agent-Go
      ↓
应用层 Coding Agent
Codex / Claude Code / Gemini CLI / OpenCode
      ↓
统一实验、源码阅读与架构对比
```

## 阅读地图

### 第一部分：先建立共同语言

- [01｜Agent 到底是什么](docs/01-agent-primer.md) — 🟡 提纲已完成，正文未完待续
- [02｜统一分析框架](docs/02-comparison-methodology.md) — 🟢 第一版已完成
- [03｜从框架到 Coding Agent 的分层模型](docs/03-layer-model.md) — 🟢 第一版已完成

### 第二部分：以 tRPC-Agent-Go 建立参考坐标

- [10｜为什么以 tRPC-Agent-Go 为主线](frameworks/trpc-agent-go.md) — 🟡 框架已搭建，源码分析未完待续
- Runner、Agent 与 Event Stream — ⚪ 未开始
- Model 与 Tool Calling — ⚪ 未开始
- Session、Memory、Knowledge 与 Artifact — ⚪ 未开始
- GraphAgent 与多 Agent 编排 — ⚪ 未开始
- MCP、A2A 与 AG-UI — ⚪ 未开始
- Evaluation、Telemetry 与生产化 — ⚪ 未开始

### 第三部分：国外通用框架

- [20｜LangChain](frameworks/langchain.md) — 🟡 提纲完成，未完待续
- [21｜LangGraph](frameworks/langgraph.md) — 🟡 提纲完成，未完待续
- [22｜AutoGen](frameworks/autogen.md) — 🟡 提纲完成，未完待续
- [23｜Google ADK](frameworks/google-adk.md) — 🟡 提纲完成，未完待续
- [24｜Agno](frameworks/agno.md) — 🟡 提纲完成，未完待续
- [延伸｜Microsoft Agent Framework](frameworks/microsoft-agent-framework.md) — 🟡 用于解释 AutoGen 的后续演进
- LangChain、LangGraph 与 Deep Agents 的关系 — ⚪ 未开始

### 第四部分：国内框架与 Harness

- [30｜AgentScope](frameworks/agentscope.md) — 🟡 提纲完成，未完待续
- [31｜DeerFlow](frameworks/deerflow.md) — 🟡 提纲完成，未完待续
- 国内框架横向比较 — ⚪ 未开始

### 第五部分：Coding Agent 应用层

- [40｜Codex](coding-agents/codex.md) — 🟡 研究范围已定义，未完待续
- [41｜Claude Code](coding-agents/claude-code.md) — 🟡 研究范围已定义，未完待续
- [42｜Gemini CLI](coding-agents/gemini-cli.md) — 🟡 研究范围已定义，未完待续
- [43｜OpenCode](coding-agents/opencode.md) — 🟡 研究范围已定义，未完待续
- Coding Agent 统一架构比较 — ⚪ 未开始
- 权限、Sandbox 与 Prompt Injection — ⚪ 未开始
- Context Engineering 与长任务 — ⚪ 未开始

### 第六部分：动手验证

- 最小 Agent Loop — ⚪ 未开始
- 用 tRPC-Agent-Go 实现 Tool Agent — ⚪ 未开始
- 用 GraphAgent 实现可恢复 Workflow — ⚪ 未开始
- 同一任务的跨框架实现 — ⚪ 未开始
- Coding Agent 最小原型 — ⚪ 未开始
- 统一 Benchmark 与 Trace 对比 — ⚪ 未开始

## 内容状态

| 标记 | 含义 |
| --- | --- |
| 🟢 | 已形成可阅读的第一版 |
| 🟡 | 已有提纲，仍需研究或实验 |
| ⚪ | 未开始 |
| 🔄 | 正在更新 |

## 写作原则

1. **从问题出发，而不是从产品宣传出发。**
2. **优先引用官方文档、官方仓库和可复现实验。**
3. **明确区分事实、个人理解和推测。**
4. **所有框架使用同一套分析维度。**
5. **没有验证的章节明确写“未完待续”。**
6. **不使用或转载疑似泄露的专有源码。**
7. **项目体现真实学习过程，不伪装成已经完成的研究。**

## 当前结论

这不是一个“哪个框架最好”的项目。框架的价值取决于它选择解决哪一层问题：

- LangChain 更接近组件与集成生态。
- LangGraph 强调有状态、长时间运行的图编排。
- AutoGen 代表事件驱动、多 Agent 消息协作与分层 Runtime 的重要路线；目前已进入维护模式。
- Google ADK 强调 Agent、Runner、Event、Session 和多 Agent 组合，与本项目的 tRPC-Agent-Go 基准很适合做结构对照。
- Agno 已从单一 Agent SDK 扩展为构建、运行和管理 Agent Platform 的完整工程路线。
- AgentScope 提供 Agent、工具、记忆、多 Agent、评测与部署能力。
- DeerFlow 2.0 更接近带 Sandbox、Memory、Skill 和 Subagent 的 SuperAgent Harness。
- tRPC-Agent-Go 提供 Go 原生的 Agent Runtime、Graph、状态、协议、评测和可观测性，是本项目的工程参照。
- Codex、Claude Code、Gemini CLI 和 OpenCode 位于更上层：它们把模型、工具、执行环境、权限、交互界面和软件工程工作流组合成产品。

这些判断将在后续源码阅读和统一实验中持续修正。

## 资料与许可

- [官方资料索引](SOURCES.md)
- 文字与示例代码以仓库许可证为准。
- 各框架名称和商标属于各自权利人。
