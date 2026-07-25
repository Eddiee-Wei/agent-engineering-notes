---
title: tRPC-Agent-Go
---

# 10｜tRPC-Agent-Go

> 状态：🟡 开发中

## Why tRPC-Agent-Go

tRPC-Agent-Go 是工作中实际使用的 Agent 框架，因此也是这组笔记最自然的起点。

内容会沿着公开框架和独立实验展开，实际经验则放在相关问题出现的位置，不单独包装成经验总结。

## 官方定位

官方仓库将它描述为用于构建生产 Agent 系统的 Go 框架，覆盖 LLM Agent、Graph Workflow、Tool、Session、Memory、Knowledge、Evaluation 和 OpenTelemetry Observability，并支持 MCP、A2A 与 AG-UI。

## Notes

1. Agent、Runner 与 Event 的职责。
2. 实际接入 Model 和 Tool 时，抽象边界是否符合预期。
3. Streaming、Context Cancellation 与服务生命周期中的问题。
4. Session、Memory、Knowledge 和 Artifact 在业务场景中的不同职责。
5. 什么时候选择 GraphAgent，什么时候保留模型的动态决策。
6. Chain / Parallel / Cycle Multi-Agent 是否真的降低了复杂度。
7. MCP、A2A、AG-UI 在系统边界中的实际价值。
8. Evaluation 与 Telemetry 怎样改变调试方式。
9. API 设计与实际使用之间的差异。

## Working Notes

- Go 的 Context、Channel 和类型系统会显著影响 Agent Runtime 的 API 形态。
- Runner 与 Agent 分离有利于统一 Session、Memory、Event 和生命周期管理。
- Event Stream 是框架连接模型、工具、服务端和 UI 的关键边界。
- GraphAgent 用确定性控制流补充 LLM Agent 的动态决策。

这些判断会随着源码阅读和实验继续修正。

## Questions

- LangChain / LangGraph 中什么抽象对应 Runner、Event 与 GraphAgent？
- AutoGen 与 Google ADK 如何表达 Runtime、Event、Workflow 和 HITL？
- AgentScope 如何组织 Agent、Message、Memory 和 Multi-Agent？
- DeerFlow 在通用 Runtime 上增加了哪些 Harness 能力？
- Coding Agent 又增加了哪些代码执行与权限边界？

## 开发中

- [ ] 整理一个可以公开复现的问题
- [ ] 锁定对应版本和 Commit
- [ ] 用公开示例复现当时关注的问题
- [ ] 绘制执行时序，而不是只贴类图
- [ ] 记录判断变化
- [ ] 明确经验的适用条件和限制
