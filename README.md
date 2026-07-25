# Agent 工程实践与研究手记

> 从我在工作中使用 [tRPC-Agent-Go](https://github.com/trpc-group/trpc-agent-go) 的经验出发，记录对 Agent Runtime、框架设计与 Coding Agent 产品的理解、实验和反思。

🌐 **在线阅读：** [Agent 工程实践与研究手记](https://eddiee-wei.github.io/agent-tech-share/)

## 这是什么

这不是 Agent 教程、百科或“从零到一”课程。网上已经有很多更完整的入门资料，我不准备重复它们。

这是我的个人工程档案。我会把工作中真实接触到的问题、使用框架时形成的判断、读源码后的新认识，以及不同 Coding Agent 带来的产品启发持续写下来。

这里更关心：

- 我实际遇到了什么问题？
- 当时为什么选择这种实现？
- tRPC-Agent-Go 的抽象给我的工作带来了什么帮助或限制？
- 其他框架采取了什么不同路线？
- 哪些设计值得借鉴，哪些只适合特定场景？
- 我的判断经过实验或实践后发生了什么变化？

## 我的观察路径

我会从最熟悉的 tRPC-Agent-Go 开始，向两侧扩展：

- 向下看 Model、Tool、Runner、Event、Session、Memory 与 Graph 等基础抽象。
- 横向看 LangChain、LangGraph、AutoGen、Google ADK、Agno、AgentScope 与 DeerFlow 的不同选择。
- 向上看 Codex、Claude Code、Gemini CLI、OpenCode 如何把框架能力变成可用的 Coding Agent。
- 最后回到自己的项目与工作场景，用实验验证判断。

## 研究记录

### 第一部分：我目前怎样理解 Agent

- [01｜我目前怎样理解 Agent](docs/01-agent-primer.md) — 🟡 经验与案例开发中
- [02｜我观察 Agent 框架的几个维度](docs/02-comparison-methodology.md) — 🟢 第一版已完成
- [03｜我目前对 Framework、Harness 与产品的分层理解](docs/03-layer-model.md) — 🟢 第一版已完成

### 第二部分：我的 tRPC-Agent-Go 实践

- [10｜为什么以 tRPC-Agent-Go 为主线](frameworks/trpc-agent-go.md) — 🟡 框架已搭建，源码分析开发中
- Runner、Agent 与 Event Stream — 🟡 开发中
- Model 与 Tool Calling — 🟡 开发中
- Session、Memory、Knowledge 与 Artifact — 🟡 开发中
- GraphAgent 与多 Agent 编排 — 🟡 开发中
- MCP、A2A 与 AG-UI — 🟡 开发中
- Evaluation、Telemetry 与生产化 — 🟡 开发中

### 第三部分：外部框架带给我的参照

- [20｜LangChain](frameworks/langchain.md) — 🟡 提纲已完成，内容开发中
- [21｜LangGraph](frameworks/langgraph.md) — 🟡 提纲已完成，内容开发中
- [22｜AutoGen](frameworks/autogen.md) — 🟡 提纲已完成，内容开发中
- [23｜Google ADK](frameworks/google-adk.md) — 🟡 提纲已完成，内容开发中
- [24｜Agno](frameworks/agno.md) — 🟡 提纲已完成，内容开发中
- [延伸｜Microsoft Agent Framework](frameworks/microsoft-agent-framework.md) — 🟡 用于解释 AutoGen 的后续演进
- LangChain、LangGraph 与 Deep Agents 的关系 — 🟡 开发中

### 第四部分：国内框架与 Harness 观察

- [30｜AgentScope](frameworks/agentscope.md) — 🟡 提纲已完成，内容开发中
- [31｜DeerFlow](frameworks/deerflow.md) — 🟡 提纲已完成，内容开发中
- 国内框架横向比较 — 🟡 开发中

### 第五部分：Coding Agent 使用与产品观察

- [40｜Codex](coding-agents/codex.md) — 🟡 研究范围已定义，内容开发中
- [41｜Claude Code](coding-agents/claude-code.md) — 🟡 研究范围已定义，内容开发中
- [42｜Gemini CLI](coding-agents/gemini-cli.md) — 🟡 研究范围已定义，内容开发中
- [43｜OpenCode](coding-agents/opencode.md) — 🟡 研究范围已定义，内容开发中
- Coding Agent 统一架构比较 — 🟡 开发中
- 权限、Sandbox 与 Prompt Injection — 🟡 开发中
- Context Engineering 与长任务 — 🟡 开发中

### 第六部分：我的实验与项目

- 最小 Agent Loop — 🟡 开发中
- 用 tRPC-Agent-Go 实现 Tool Agent — 🟡 开发中
- 用 GraphAgent 实现可恢复 Workflow — 🟡 开发中
- 同一任务的跨框架实现 — 🟡 开发中
- Coding Agent 最小原型 — 🟡 开发中
- 统一 Benchmark 与 Trace 对比 — 🟡 开发中

## 内容状态

| 标记 | 含义 |
| --- | --- |
| 🟢 | 已形成可阅读的第一版 |
| 🟡 | 开发中：已有提纲或正在研究、实验 |
| 🔄 | 正在更新 |

## 每篇记录尽量包含

1. **场景**：我为什么会注意到这个问题。
2. **经验**：在工作、项目或工具使用中具体发生了什么。
3. **判断**：我目前怎样理解其中的设计取舍。
4. **证据**：源码、官方资料、Trace 或可重复实验。
5. **局限**：结论在哪些条件下可能不成立。
6. **变化**：新的实践怎样修正了之前的看法。

涉及公司和工作经历时，只记录可以公开的通用工程经验，不公开内部代码、数据、架构细节或其他敏感信息。

## 当前工作假设

下面不是教学结论，而是我当前阶段的观察，后续可能被源码阅读和实践推翻：

- LangChain 更接近组件与集成生态。
- LangGraph 强调有状态、长时间运行的图编排。
- AutoGen 代表事件驱动、多 Agent 消息协作与分层 Runtime 的重要路线；目前已进入维护模式。
- Google ADK 强调 Agent、Runner、Event、Session 和多 Agent 组合，与本项目的 tRPC-Agent-Go 基准很适合做结构对照。
- Agno 已从单一 Agent SDK 扩展为构建、运行和管理 Agent Platform 的完整工程路线。
- AgentScope 提供 Agent、工具、记忆、多 Agent、评测与部署能力。
- DeerFlow 2.0 更接近带 Sandbox、Memory、Skill 和 Subagent 的 SuperAgent Harness。
- tRPC-Agent-Go 提供 Go 原生的 Agent Runtime、Graph、状态、协议、评测和可观测性，是本项目的工程参照。
- Codex、Claude Code、Gemini CLI 和 OpenCode 位于更上层：它们把模型、工具、执行环境、权限、交互界面和软件工程工作流组合成产品。

我会保留判断变化的过程，而不是把旧观点悄悄改成一个看似一直正确的答案。

## 资料与许可

- [官方资料索引](SOURCES.md)
- 文字与示例代码以仓库许可证为准。
- 各框架名称和商标属于各自权利人。
