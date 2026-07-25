---
title: Layers
---

# 03｜Layers

> 状态：🟢 第一版

为了避免把 LangGraph、DeerFlow 和 Codex 直接放进一张功能表，先用一组简单分层组织后续内容。

## L0：模型层

模型生成文本、结构化输出或 Tool Call。

## L1：组件与协议层

- Model Adapter
- Message
- Tool
- MCP
- Knowledge / Retriever
- Memory / Store

## L2：Agent Runtime

- Agent Loop
- Runner
- Event Stream
- Session
- Cancellation
- Error Handling

## L3：Workflow 与 Multi-Agent

- Graph
- Durable Execution
- Handoff
- Parallel / Sequential
- Checkpoint / Resume

## L4：Agent Harness

- Context Engineering
- Skill
- Sandbox
- Artifact
- Subagent
- Evaluation
- Observability
- Human Approval

## L5：垂直应用

- Coding Agent
- Research Agent
- Data Agent
- Customer Support Agent

## L6：产品与平台

- CLI / IDE / Web / App
- 身份、权限与计费
- 云端执行
- 团队协作与治理

一个项目可能覆盖多层。例如：

- LangGraph 主要位于 L2–L3。
- tRPC-Agent-Go 覆盖 L1–L4。
- DeerFlow 2.0 主要体现 L3–L5 的 SuperAgent Harness。
- Codex、Claude Code、Gemini CLI、OpenCode 重点位于 L4–L6。

后续研究会验证并修正这些初步定位。
