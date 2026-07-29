# Agent Engineering Notes

> Agent frameworks, runtimes, harnesses, and coding agents.

🌐 **在线阅读：** [Agent Engineering Notes](https://eddiee-wei.github.io/agent-engineering-notes/)

## About

一些关于 Agent 的工程笔记。内容从实际使用的 [tRPC-Agent-Go](https://github.com/trpc-group/trpc-agent-go) 展开，逐步延伸到其他 Agent Framework、Harness 和 Coding Agent。

这里会有源码阅读、应用记录、框架对照、小型实验，以及在实践中形成或改变的判断。

## Sections

- [Agent Introduction](agent/)
- [Agent Framework](agent-framework/)
- [Agent Application / Coding Agent](agent-application/)
- [Agent Engineering](engineering/)

## Scope

- 向下看 Model、Tool、Runner、Event、Session、Memory 与 Graph 等基础抽象。
- 横向看 LangChain、LangGraph、AutoGen、CrewAI、Google ADK、Agno、AgentScope 与 DeerFlow 的不同选择。
- 向上看 Codex、Claude Code、Gemini CLI、OpenCode 如何把框架能力变成可用的 Coding Agent。
- 以 Prompt、Context、Harness、Loop 的演进主线，整理 Tool、Memory、Graph、Evaluation、Safety 与 Production 等工程方法。
- 通过项目和实验验证其中的设计取舍。

## Contents

### Agent

- [01｜From Model Call to Agent](docs/01-agent-primer.md) — 🟢 第一版已完成
- [02｜Framework Lens](docs/02-comparison-methodology.md) — 🟢 第一版已完成
- [03｜Layers](docs/03-layer-model.md) — 🟢 第一版已完成

### tRPC-Agent-Go

- [10｜为什么以 tRPC-Agent-Go 为主线](frameworks/trpc-agent-go.md) — todo
- Runner、Agent 与 Event Stream — todo
- Model 与 Tool Calling — todo
- Session、Memory、Knowledge 与 Artifact — todo
- GraphAgent 与多 Agent 编排 — todo
- MCP、A2A 与 AG-UI — todo
- Evaluation、Telemetry 与生产化 — todo

### Frameworks

- [20｜LangChain](frameworks/langchain.md) — todo
- [21｜LangGraph](frameworks/langgraph.md) — todo
- [22｜AutoGen](frameworks/autogen.md) — todo
- [23｜Google ADK](frameworks/google-adk.md) — todo
- [24｜Agno](frameworks/agno.md) — todo
- [25｜CrewAI](frameworks/crewai.md) — todo
- [延伸｜Microsoft Agent Framework](frameworks/microsoft-agent-framework.md) — todo
- LangChain、LangGraph 与 Deep Agents 的关系 — todo

### Frameworks in China

- [30｜AgentScope](frameworks/agentscope.md) — todo
- [31｜DeerFlow](frameworks/deerflow.md) — todo
- 国内框架横向比较 — todo

### Coding Agents

- [40｜Codex](coding-agents/codex.md) — todo
- [41｜Claude Code](coding-agents/claude-code.md) — todo
- [42｜Gemini CLI](coding-agents/gemini-cli.md) — todo
- [43｜OpenCode](coding-agents/opencode.md) — todo
- Coding Agent 统一架构比较 — todo
- 权限、Sandbox 与 Prompt Injection — todo
- Context Engineering 与长任务 — todo

### Agent Engineering

#### Evolution

- [50｜Prompt Engineering](engineering/prompt-engineering.md) — todo
- [51｜Context Engineering](engineering/context-engineering.md) — todo
- [52｜Harness Engineering](engineering/harness-engineering.md) — todo
- [53｜Loop Engineering](engineering/loop-engineering.md) — todo

#### Capabilities, Orchestration, and Operations

- [54｜Tool Engineering](engineering/tool-engineering.md) — todo
- [55｜Memory Engineering](engineering/memory-engineering.md) — todo
- [56｜Knowledge Engineering](engineering/knowledge-engineering.md) — todo
- [57｜Graph Engineering](engineering/graph-engineering.md) — todo
- [58｜Multi-Agent Engineering](engineering/multi-agent-engineering.md) — todo
- [59｜Evaluation Engineering](engineering/evaluation-engineering.md) — todo
- [60｜Observability Engineering](engineering/observability-engineering.md) — todo
- [61｜Safety Engineering](engineering/safety-engineering.md) — todo
- [62｜Production Engineering](engineering/production-engineering.md) — todo

### Experiments

- 最小 Agent Loop — todo
- 用 tRPC-Agent-Go 实现 Tool Agent — todo
- 用 GraphAgent 实现可恢复 Workflow — todo
- 同一任务的跨框架实现 — todo
- Coding Agent 最小原型 — todo
- 统一 Benchmark 与 Trace 对比 — todo

## 内容状态

| 标记 | 含义 |
| --- | --- |
| 🟢 | 已形成可阅读的第一版 |
| todo | 待补充或正在整理 |
| 🔄 | 正在更新 |

## Notes

- LangChain 更接近组件与集成生态。
- LangGraph 强调有状态、长时间运行的图编排。
- AutoGen 代表事件驱动、多 Agent 消息协作与分层 Runtime 的重要路线；目前已进入维护模式。
- Google ADK 强调 Agent、Runner、Event、Session 和多 Agent 组合，与本项目的 tRPC-Agent-Go 基准很适合做结构对照。
- Agno 已从单一 Agent SDK 扩展为构建、运行和管理 Agent Platform 的完整工程路线。
- CrewAI 以 Crews 组织自主的多 Agent 协作，以 Flows 提供事件驱动、有状态的精确编排。
- AgentScope 提供 Agent、工具、记忆、多 Agent、评测与部署能力。
- DeerFlow 2.0 更接近带 Sandbox、Memory、Skill 和 Subagent 的 SuperAgent Harness。
- tRPC-Agent-Go 提供 Go 原生的 Agent Runtime、Graph、状态、协议、评测和可观测性，是本项目的工程参照。
- Codex、Claude Code、Gemini CLI 和 OpenCode 位于更上层：它们把模型、工具、执行环境、权限、交互界面和软件工程工作流组合成产品。

这些是阶段性记录，会随着源码阅读和实践继续修正。

## 资料与许可

- [官方资料索引](SOURCES.md)
- 文字与示例代码以仓库许可证为准。
- 各框架名称和商标属于各自权利人。
