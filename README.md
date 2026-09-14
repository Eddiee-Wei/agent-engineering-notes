# Agent Engineering Notes

> Agent frameworks, runtimes, harnesses, and coding agents.

🌐 **在线阅读：** [Agent Engineering Notes](https://eddiee-wei.github.io/agent-engineering-notes/)

## About

一些关于 Agent 的工程笔记，记录不同 Agent Framework 与 Harness 的设计取舍。

这里整理源码阅读、框架对照、小型实验，以及在实践中形成或改变的判断。

## Sections

<!-- AUTO-GENERATED:SECTIONS:START -->
- [01 · 随记](notes/index.md)
- [02 · Agent 基础](agent/index.md)
- [03 · Agent 框架](agent-framework/index.md)
- [04 · Agent 应用](agent-application/index.md)
- [05 · Agent 工程](engineering/index.md)
<!-- AUTO-GENERATED:SECTIONS:END -->

## Scope

- 从 Model、Tool、Runner、Event、Session、Memory、Harness、Authorization 与 Graph 等基础抽象理解 Agent。
- 对照 Agno、AutoGen、CrewAI、ADK、LangChain、Langflow、LangGraph、AgentScope、DeerFlow 与 tRPC-Agent-Go 的不同工程选择。
- 用源码、官方资料和可验证实验校准结论。

## Contents

<!-- AUTO-GENERATED:CONTENTS:START -->
### [01 · 随记](notes/index.md)

- [01｜Prompt Cache：省下的不是 Token，而是重复计算](notes/prompt-cache-reuses-computation.md) — 从 Attention、KV Cache、Prefill 与跨请求前缀复用，理解 Prompt Cache 的原理、质量边界和工程实践。
- [02｜Agent 架构如何塑造 Prompt Cache](notes/agent-architecture-shapes-prompt-cache.md) — 对比 Claude Code、Codex、Gemini CLI、OpenCode、Pi Agent 与 DeepSeek Harness 的上下文布局和缓存策略。
- [03｜Agent 为什么会读这些 Markdown：从 AGENTS.md、SOUL.md 到 SKILL.md](notes/agent-markdown-files-context-loading.md) — 逐一拆解 AGENTS.md、CLAUDE.md、GEMINI.md、SOUL.md、MEMORY.md、SKILL.md 与普通 xx.md，理解它们怎样被发现、加载并进入模型请求。

### [02 · Agent 基础](agent/index.md)

- [01｜从模型调用到 Agent：定义、闭环与边界](docs/01-agent-primer.md) — 从一次模型调用出发，理解 Agent 的最小判定、执行闭环与工程边界。
- [02｜Agent Runtime：一次运行如何开始、推进与结束](docs/02-agent-runtime-semantics.md) — 从 Trigger、Activation、Run、Attempt、Step、Event 到暂停、取消与终态，理解一次 Agent 运行如何被激活、推进与结束。
- [03｜Agent 的状态边界：Context、Session、Memory 与 Artifact](docs/03-agent-state-semantics.md) — 区分观察、声明、决策输入、连续性、恢复与产物，理解 Agent 如何保存状态并判断什么可以相信。
- [04｜Agent 的任务边界：Goal、Plan、Steering 与 Completion](docs/04-agent-task-semantics.md) — 区分 Request、Task Definition、Plan、Steering 与 Completion，理解 Agent 任务如何形成、变更和被证据验收。
- [05｜Multi-Agent：委派、协作与团队收敛](docs/05-multi-agent-collaboration.md) — 从采用门槛、委派语义、协作拓扑、隔离边界到合并验收，理解多个 Agent 怎样共同完成一个父任务。
- [06｜Agent Harness 的进化：从 Prompt Wrapper 到可托付的执行系统](docs/06-agent-harness-evolution.md) — 从 Prompt Wrapper、Tool Loop、Runtime、Workspace、状态连续性、治理到评测闭环，理解 Agent Harness 为什么演化成完整执行系统。
- [07｜Agent 的授权边界：Principal、Capability、Delegation、Approval、Credential 与 Revocation](docs/07-agent-authorization-semantics.md) — 从 Principal、Policy、Capability、Credential 到 Approval、Delegation 与 Revocation，建立 Agent 行动授权的统一工程模型。

### [03 · Agent 框架](agent-framework/index.md)

#### 国外框架

- [01｜Agno](frameworks/agno.md) — Agno 2.x 的 Agent、Team、Workflow、AgentOS 运行时语义与生产工程边界。
- [02｜AutoGen](frameworks/autogen.md) — AutoGen 0.2、0.4 分层重构与维护期的运行时、状态、多 Agent 和迁移边界。
- [03｜CrewAI](frameworks/crewai.md) — CrewAI 1.x 的 Agent、Task、Crew、Flow、状态恢复与生产扩展边界。
- [04｜ADK](frameworks/google-adk.md) — Google ADK 多语言 SDK 的 Event Loop、Agent、Workflow、Session、Plugin、恢复机制、部署与高并发生产实践。
- [05｜LangChain](frameworks/langchain.md) — LangChain v1 的 Agent 组件、Middleware、状态、工具、流式接口、Multi-Agent 与高并发生产实践。
- [06｜Langflow](frameworks/langflow.md) — Langflow 1.11 的可视化 Flow、Component、Agent、Workflow API、LFX、HITL、部署与高并发生产实践。
- [07｜LangGraph](frameworks/langgraph.md) — LangGraph 1.2 的状态图、Pregel 执行、Checkpoint、Interrupt、Durable Execution、并行与生产扩展实践。

#### 国内大厂

- [08｜AgentScope](frameworks/agentscope.md) — AgentScope v2.0.6 的运行时、状态、工具、服务化与版本演进
- [09｜DeerFlow](frameworks/deerflow.md) — DeerFlow 2.0 的 super-agent harness、运行时边界与 1.0→2.0 演进
- [10｜tRPC-Agent-Go](frameworks/trpc-agent-go.md) — tRPC-Agent-Go v1.11.1 的 Go 原生运行时、Graph、多 Agent 与版本演进

### [04 · Agent 应用](agent-application/index.md)

#### Coding Agent

- [01｜Pi Agent](coding-agents/pi-agent.md) — Pi 如何在启动时装配 AGENTS.md、按需读取 Skill，并在调用时展开 Prompt 模板。
- [02｜DeepSeek Harness](coding-agents/deepseek-harness.md) — DeepSeek Harness 如何把工作区指令做成可回放的 Session 内容，并在文件触达后增量刷新。
- [03｜Codex](coding-agents/codex.md) — Codex 如何构建 AGENTS.md 指令链，并用渐进式 Skill 把流程与资源注入任务。
- [04｜Claude Code](coding-agents/claude-code.md) — Claude Code 如何组合 CLAUDE.md、Rules、Auto Memory 与按需 Agent Skills。
- [05｜Gemini CLI](coding-agents/gemini-cli.md) — Gemini CLI 如何分层加载 GEMINI.md、即时发现目录指令，并经确认激活 Skill。
- [06｜OpenCode](coding-agents/opencode.md) — OpenCode 如何选择 AGENTS.md、组合自定义 Rules，并按需加载 Skill、Agent 与 Command Markdown。

#### 组装 Agent

- [07｜Dify](agent-application/dify.md) — Notes on assembling and operating Agent applications with Dify.
- [08｜Coze](agent-application/coze.md) — Notes on assembling and operating Agent applications with Coze.
- [09｜LangGraph](frameworks/langgraph.md) — LangGraph 1.2 的状态图、Pregel 执行、Checkpoint、Interrupt、Durable Execution、并行与生产扩展实践。

### [05 · Agent 工程](engineering/index.md)

- [01｜Prompt Engineering](engineering/prompt-engineering.md) — Engineering instructions, constraints, examples, and output contracts for reliable model interactions.
- [02｜Context Engineering](engineering/context-engineering.md) — 把指令、历史、工具、记忆与外部资料编译成 Agent 每次决策所需的 Context Frame。
- [03｜Agent Harness](engineering/harness-engineering.md) — Engineering the runtime, tools, state, permissions, and feedback systems around an Agent.
- [04｜Agent Loop](engineering/loop-engineering.md) — Designing Agent loops that plan, act, observe, verify, recover, and converge.
- [05｜Tool Engineering](engineering/tool-engineering.md) — Designing safe, understandable, and recoverable tool contracts for Agents.
- [06｜Memory Engineering](engineering/memory-engineering.md) — 从 MEMORY.md 到长期记忆服务：理解 Agent 如何形成、检索、使用、更正与遗忘记忆。
- [07｜Knowledge Engineering](engineering/knowledge-engineering.md) — Building trustworthy knowledge sources, retrieval pipelines, and evidence for Agents.
- [08｜Graph Engineering](engineering/graph-engineering.md) — Engineering explicit stateful workflows for durable and controllable Agent execution.
- [09｜Multi-Agent Engineering](engineering/multi-agent-engineering.md) — Designing effective delegation, communication, and coordination among multiple Agents.
- [10｜Evaluation Engineering](engineering/evaluation-engineering.md) — Building repeatable evidence for Agent quality, regressions, and release decisions.
- [11｜Observability Engineering](engineering/observability-engineering.md) — Making Agent decisions, actions, failures, latency, and cost inspectable.
- [12｜Safety Engineering](engineering/safety-engineering.md) — Controlling Agent capabilities, permissions, data boundaries, and high-risk actions.
- [13｜Production Engineering](engineering/production-engineering.md) — Operating Agent systems with reliability, scalability, cost control, and safe releases.
<!-- AUTO-GENERATED:CONTENTS:END -->

> 上述栏目和目录由网站导航及文章 Front Matter 生成。修改正文后运行 `ruby scripts/sync_readme_navigation.rb`，CI 会检查两者是否一致。

## Observations

- LangChain 更接近组件与集成生态。
- LangGraph 强调有状态、长时间运行的图编排。
- Langflow 把可视化 IDE、可编辑 Component 与 Headless/LFX Runtime 连接为一条交付链。
- AutoGen 代表事件驱动、多 Agent 消息协作与分层 Runtime 的重要路线；目前已进入维护模式。
- Google ADK 强调 Agent、Runner、Event、Session 和多 Agent 组合，并提供 Python、Go、Java、TypeScript 与 Kotlin 实现。
- Agno 已从单一 Agent SDK 扩展为构建、运行和管理 Agent Platform 的完整工程路线。
- CrewAI 以 Crews 组织自主的多 Agent 协作，以 Flows 提供事件驱动、有状态的精确编排。
- AgentScope 2.x 把 Agent、工具、记忆、Workspace 与 Agent-as-a-Service 组合为一体；评测模块仍处于相对 v1 的重构阶段。
- DeerFlow 2.0 更接近带 Sandbox、Memory、Skill 和 Subagent 的 SuperAgent Harness。

## 资料与许可

- [官方资料索引](SOURCES.md)
- 文字与示例代码以仓库许可证为准。
- 各框架名称和商标属于各自权利人。
