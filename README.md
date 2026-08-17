# Agent Engineering Notes

> Agent frameworks, runtimes, harnesses, and coding agents.

🌐 **在线阅读：** [Agent Engineering Notes](https://eddiee-wei.github.io/agent-engineering-notes/)

## About

一些关于 Agent 的工程笔记。内容从实际使用的 [tRPC-Agent-Go](https://github.com/trpc-group/trpc-agent-go) 展开，也记录其他 Agent Framework 与 Harness 的设计取舍。

这里整理源码阅读、框架对照、小型实验，以及在实践中形成或改变的判断。

## Sections

- [Agent Fundamentals](agent/)
- [Agent Framework](agent-framework/)
- [Agent Application](agent-application/)
- [Agent Engineering](engineering/)

## Scope

- 从 Model、Tool、Runner、Event、Session、Memory、Harness、Authorization 与 Graph 等基础抽象理解 Agent。
- 对照 Agno、AutoGen、CrewAI、ADK、LangChain、Langflow、LangGraph、AgentScope、DeerFlow 与 tRPC-Agent-Go 的不同工程选择。
- 用源码、官方资料和可验证实验校准结论。

## Contents

### Agent Fundamentals

- [01｜From Model Call to Agent: Definition, Loop, and Boundaries](docs/01-agent-primer.md)
- [02｜Agent Runtime: How a Run Starts, Progresses, and Ends](docs/02-agent-runtime-semantics.md)
- [03｜Agent State Boundaries: Context, Session, Memory, and Artifacts](docs/03-agent-state-semantics.md)
- [04｜Agent Task Boundaries: Goal, Plan, Steering, and Completion](docs/04-agent-task-semantics.md)
- [05｜Multi-Agent: Delegation, Collaboration, and Team Convergence](docs/05-multi-agent-collaboration.md)
- [06｜Agent Harness Evolution: From Prompt Wrapper to a Trustworthy Execution System](docs/06-agent-harness-evolution.md)
- [07｜Agent Authorization Boundaries: Principal, Capability, Delegation, Approval, Credential, and Revocation](docs/07-agent-authorization-semantics.md)

### International Frameworks

- [Agno](frameworks/agno.md) — Agent、Team、Workflow 与 AgentOS 的连续运行栈
- [AutoGen](frameworks/autogen.md) — 0.2、0.4 分层重构与当前维护/迁移边界
- [CrewAI](frameworks/crewai.md) — 角色式 Crews 与事件式 Flows
- [Google ADK](frameworks/google-adk.md) — 多语言 Agent SDK、Runner/Event 语义与部署路径
- [LangChain](frameworks/langchain.md) — Model、Tool、Middleware 与高层 Agent 组件层
- [Langflow](frameworks/langflow.md) — 可视化 Flow、Component、LFX 与 Headless Runtime
- [LangGraph](frameworks/langgraph.md) — 状态图、Checkpoint、Interrupt 与 Durable Execution

### 国内大厂

- [AgentScope](frameworks/agentscope.md) — Agent SDK、Workspace 与 Agent-as-a-Service
- [DeerFlow](frameworks/deerflow.md) — 带 Skills、Sandbox、Memory 与 Subagent 的 Super-Agent Harness
- [tRPC-Agent-Go](frameworks/trpc-agent-go.md) — Go 原生 Runner、Event、Graph 与 Evaluation 运行栈

## Notes

- LangChain 更接近组件与集成生态。
- LangGraph 强调有状态、长时间运行的图编排。
- Langflow 把可视化 IDE、可编辑 Component 与 Headless/LFX Runtime 连接为一条交付链。
- AutoGen 代表事件驱动、多 Agent 消息协作与分层 Runtime 的重要路线；目前已进入维护模式。
- Google ADK 强调 Agent、Runner、Event、Session 和多 Agent 组合，并提供 Python、Go、Java、TypeScript 与 Kotlin 实现。
- Agno 已从单一 Agent SDK 扩展为构建、运行和管理 Agent Platform 的完整工程路线。
- CrewAI 以 Crews 组织自主的多 Agent 协作，以 Flows 提供事件驱动、有状态的精确编排。
- AgentScope 2.x 把 Agent、工具、记忆、Workspace 与 Agent-as-a-Service 组合为一体；评测模块仍处于相对 v1 的重构阶段。
- DeerFlow 2.0 更接近带 Sandbox、Memory、Skill 和 Subagent 的 SuperAgent Harness。
- tRPC-Agent-Go 提供 Go 原生的 Agent Runtime、Graph、状态、协议、评测和可观测性，是本项目的工程参照。

## 资料与许可

- [官方资料索引](SOURCES.md)
- 文字与示例代码以仓库许可证为准。
- 各框架名称和商标属于各自权利人。
