---
title: Google ADK
---

# 23｜Google ADK

> 状态：🟡 提纲完成，未完待续

## 官方定位

Google Agent Development Kit（ADK）是开源、Code-first 的 Agent 开发框架，用于构建、评测和部署 Agent。它针对 Gemini 生态做了优化，但官方将其描述为 Model-agnostic 和 Deployment-agnostic。

ADK 有 Python、Go 和 Java 实现。本项目会以 Python 版理解完整生态，同时重点补充 Go ADK 与 tRPC-Agent-Go 的对照。

## 为什么值得重点比较

ADK 的核心术语与 tRPC-Agent-Go 非常接近：

- Agent
- Runner
- Event
- Session
- Memory
- Tool
- Multi-Agent
- Evaluation

这使它适合做结构级比较，而不只是比较功能数量。

## 核心研究路线

### 1. Agent 类型

- LlmAgent
- SequentialAgent
- ParallelAgent
- LoopAgent
- Custom Agent

### 2. 执行模型

- Runner 如何驱动 Reason–Act Loop
- Session 与 Event 如何流转
- Tool 执行与 Callback
- Streaming 与异步 Runtime

### 3. Multi-Agent

- Parent / Sub-agent hierarchy
- Agent Transfer
- Agent as Tool
- Workflow Agent

### 4. 工程化

- Session Service 与 Memory Service
- Built-in Evaluation
- Development UI
- Tool Confirmation / HITL
- MCP 与 A2A
- Cloud Run / Vertex AI Agent Engine

## 与 tRPC-Agent-Go 的对照重点

- Runner、Event 和 Session 的职责边界
- Workflow Agent 与 GraphAgent
- Go ADK 与 tRPC-Agent-Go 的 API 风格
- Tool Confirmation 与权限控制
- Evaluation 与部署路径

## 未完待续

- [ ] 锁定 Python / Go 分析版本
- [ ] 绘制 Runner 执行时序
- [ ] 实现相同 Tool Agent
- [ ] 对比 Session 与 Event
- [ ] 对比 Multi-Agent 组合方式
