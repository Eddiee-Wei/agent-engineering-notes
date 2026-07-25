# 22｜AutoGen

> 状态：🟡 提纲完成，未完待续

## 为什么仍然研究 AutoGen

AutoGen 对 Multi-Agent 领域影响很大。它把 Agent 间对话、消息传递、团队协作和代码执行带入了大量开发者的视野。

需要同时说明当前状态：官方仓库已将 AutoGen 标记为维护模式，新项目被建议考虑 Microsoft Agent Framework。因此本章既研究其设计价值，也记录它的演进边界。

## 核心研究路线

### 1. 分层架构

- Core API：消息传递、事件驱动 Agent、本地与分布式 Runtime
- AgentChat API：更高层、更具观点的 Multi-Agent API
- Extensions API：Model Client、Code Execution 等集成

### 2. Multi-Agent 范式

- Agent as Tool
- Two-agent conversation
- Group Chat
- Team
- Handoff 与协作终止条件

### 3. 工程能力

- Streaming Event
- MCP Workbench
- Code Execution
- Memory
- GraphFlow
- AutoGen Studio
- AutoGen Bench

## 与 tRPC-Agent-Go 的对照重点

- Event-driven Core 与 Go Event Stream
- Runtime 与 Runner
- AgentChat Team 与 Chain / Parallel / Cycle Agent
- Code Executor 与 Tool / Sandbox 边界
- Python/.NET 跨语言与 Go 原生类型系统

## 演进关系

本项目会单独记录：

```text
AutoGen
   ↓ 设计经验与迁移
Microsoft Agent Framework
```

这不是简单的版本升级，需要比较抽象、API 稳定性和生产化目标的变化。

## 未完待续

- [ ] 锁定 AutoGen 分析版本
- [ ] 绘制 Core / AgentChat / Extensions 分层图
- [ ] 实现最小双 Agent 协作
- [ ] 分析事件与终止机制
- [ ] 记录迁移到 Microsoft Agent Framework 的变化

