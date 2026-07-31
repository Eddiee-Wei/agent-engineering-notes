# Agent Engineering Notes

> Agent frameworks, runtimes, harnesses, and coding agents.

🌐 **在线阅读：** [Agent Engineering Notes](https://eddiee-wei.github.io/agent-engineering-notes/)

## About

一些关于 Agent 的工程笔记。内容从实际使用的 [tRPC-Agent-Go](https://github.com/trpc-group/trpc-agent-go) 展开，逐步延伸到其他 Agent Framework、Harness 和 Coding Agent。

这里会有源码阅读、应用记录、框架对照、小型实验，以及在实践中形成或改变的判断。

## Sections

- [Agent Fundamentals](agent/)
- [Agent Framework](agent-framework/)
- [Agent Application](agent-application/)
- [Agent Engineering](engineering/)

## Adding content

在下面任一目录中新建 Markdown，即可自动继承统一外观：

| 目录 | 自动归属 |
| --- | --- |
| `docs/` | Agent Fundamentals |
| `frameworks/`、`agent-framework/` | Agent Framework |
| `coding-agents/`、`agent-application/` | Agent Application |
| `engineering/` | Agent Engineering |

自动收录的 Agent 基础与 Agent 工程页面需要标题和排序值：

```yaml
---
title: Example Note
nav_title_zh: 示例笔记
nav_order: 3
---
```

Agent 基础会自动收集 `docs/`，Agent 工程会自动收集 `engineering/`；两者按 `nav_order` 排序并生成连续序号，新增内容无需修改导航。框架与应用因为包含固定分组、指定顺序和跨目录复用，统一由 [`_data/navigation.yml`](_data/navigation.yml) 管理；章节页、首页目录和侧栏会自动同步并生成连续序号。页面结构组件集中在 [`_includes/`](_includes/)。

## Scope

- 向下看 Model、Tool、Runner、Event、Session、Memory 与 Graph 等基础抽象。
- 横向看 Agno、AutoGen、CrewAI、ADK、LangChain、Langflow、LangGraph、AgentScope、DeerFlow 与 tRPC-Agent-Go 的不同选择。
- 向上看 Dify、Coze、LangGraph 如何组装 Agent 应用，以及 Codex、Claude Code、Gemini CLI、OpenCode 如何实现 Coding Agent。
- 以 Prompt、Context、Harness、Loop 的演进主线，整理 Tool、Memory、Graph、Evaluation、Safety 与 Production 等工程方法。
- 通过项目和实验验证其中的设计取舍。

## Contents

### Agent Fundamentals

- [01｜From Model Call to Agent](docs/01-agent-primer.md) — 🟢 第一版已完成
- [02｜Agent Runtime Semantics](docs/02-agent-runtime-semantics.md) — 🟢 第一版已完成
- [03｜Agent State Semantics](docs/03-agent-state-semantics.md) — 🟢 第一版已完成

### International Frameworks

- [Agno](frameworks/agno.md) — todo
- [AutoGen](frameworks/autogen.md) — todo
- [CrewAI](frameworks/crewai.md) — todo
- [ADK](frameworks/google-adk.md) — todo
- [LangChain](frameworks/langchain.md) — todo
- [Langflow](frameworks/langflow.md) — todo
- [LangGraph](frameworks/langgraph.md) — todo

### 国内大厂

- [AgentScope](frameworks/agentscope.md) — todo
- [DeerFlow](frameworks/deerflow.md) — todo
- [tRPC-Agent-Go](frameworks/trpc-agent-go.md) — todo
- 国内框架横向比较 — todo

#### tRPC-Agent-Go research

- Runner、Agent 与 Event Stream — todo
- Model 与 Tool Calling — todo
- Session、Memory、Knowledge 与 Artifact — todo
- GraphAgent 与多 Agent 编排 — todo
- MCP、A2A 与 AG-UI — todo
- Evaluation、Telemetry 与生产化 — todo

### 组装 Agent

- [Dify](agent-application/dify.md) — todo
- [Coze](agent-application/coze.md) — todo
- [LangGraph](frameworks/langgraph.md) — todo

### Coding Agents

- [Codex](coding-agents/codex.md) — todo
- [Claude Code](coding-agents/claude-code.md) — todo
- [Gemini CLI](coding-agents/gemini-cli.md) — todo
- [OpenCode](coding-agents/opencode.md) — todo
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
