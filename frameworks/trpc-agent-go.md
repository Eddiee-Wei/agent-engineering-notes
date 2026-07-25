---
title: tRPC-Agent-Go
---

# 10｜我在 tRPC-Agent-Go 实践中关注什么

> 状态：🟡 工作经验、源码阅读与实验持续整理中

## 为什么从它开始

tRPC-Agent-Go 是我在真实工作中使用的 Agent 框架。它不是因为“功能最多”而成为这个项目的中心，而是因为我的问题、经验和判断首先从它产生。

我希望把能够公开的实践整理出来：哪些抽象在项目里真正重要，哪些设计一开始没有理解，哪些问题只有进入服务化、流式输出、状态管理和故障处理之后才会暴露。

这部分不会涉及公司内部代码、数据或非公开架构，只讨论可以从公开框架、通用场景和独立实验中验证的工程经验。

## 官方定位

官方仓库将它描述为用于构建生产 Agent 系统的 Go 框架，覆盖 LLM Agent、Graph Workflow、Tool、Session、Memory、Knowledge、Evaluation 和 OpenTelemetry Observability，并支持 MCP、A2A 与 AG-UI。

## 我准备整理的实践线索

1. 第一次使用框架时，我怎样理解 Agent、Runner 与 Event。
2. 实际接入 Model 和 Tool 时，抽象边界是否符合预期。
3. Streaming、Context Cancellation 与服务生命周期中的问题。
4. Session、Memory、Knowledge 和 Artifact 在业务场景中的不同职责。
5. 什么时候选择 GraphAgent，什么时候保留模型的动态决策。
6. Chain / Parallel / Cycle Multi-Agent 是否真的降低了复杂度。
7. MCP、A2A、AG-UI 在系统边界中的实际价值。
8. Evaluation 与 Telemetry 怎样改变调试方式。
9. 哪些设计我会继续使用，哪些地方我希望有不同选择。

## 我当前的几个判断

- Go 的 Context、Channel 和类型系统会显著影响 Agent Runtime 的 API 形态。
- Runner 与 Agent 分离有利于统一 Session、Memory、Event 和生命周期管理。
- Event Stream 是框架连接模型、工具、服务端和 UI 的关键边界。
- GraphAgent 用确定性控制流补充 LLM Agent 的动态决策。

这些只是现阶段的判断。我会补充它们来自什么场景、证据是什么，以及后来有没有被推翻。

## 阅读其他框架时，我会带着这些问题

- LangChain / LangGraph 中什么抽象对应 Runner、Event 与 GraphAgent？
- AutoGen 与 Google ADK 如何表达 Runtime、Event、Workflow 和 HITL？
- AgentScope 如何组织 Agent、Message、Memory 和 Multi-Agent？
- DeerFlow 在通用 Runtime 上增加了哪些 Harness 能力？
- Coding Agent 又增加了哪些代码执行与权限边界？

## 正在整理

- [ ] 选择第一段可以公开讲述的实际使用经历
- [ ] 锁定对应版本和 Commit
- [ ] 用公开示例复现当时关注的问题
- [ ] 绘制执行时序，而不是只贴类图
- [ ] 记录最初判断与现在判断的差异
- [ ] 明确经验的适用条件和限制
