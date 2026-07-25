# 10｜tRPC-Agent-Go：本项目的参考范式

> 状态：🟡 框架已搭建，源码分析未完待续

## 为什么从它开始

tRPC-Agent-Go 是一个 Go 原生的生产级 Agent 框架，也是本项目作者在真实工作中使用的框架。以它作为参考坐标，可以让对比建立在工程实践上，而不是只比较 Quickstart。

## 官方定位

官方仓库将它描述为用于构建生产 Agent 系统的 Go 框架，覆盖 LLM Agent、Graph Workflow、Tool、Session、Memory、Knowledge、Evaluation 和 OpenTelemetry Observability，并支持 MCP、A2A 与 AG-UI。

## 研究目录

1. 仓库模块与核心抽象
2. `agent`、`runner`、`event` 的执行链路
3. Model 与 Tool Calling
4. Streaming 与 Context Cancellation
5. Session、Memory、Knowledge、Artifact
6. GraphAgent
7. Chain / Parallel / Cycle Multi-Agent
8. MCP、A2A、AG-UI
9. Evaluation 与 Telemetry
10. Skills 与 Self-Evolution
11. 生产环境中的设计经验

## 第一组假设

- Go 的 Context、Channel 和类型系统会显著影响 Agent Runtime 的 API 形态。
- Runner 与 Agent 分离有利于统一 Session、Memory、Event 和生命周期管理。
- Event Stream 是框架连接模型、工具、服务端和 UI 的关键边界。
- GraphAgent 用确定性控制流补充 LLM Agent 的动态决策。

这些是假设，不是最终结论；后续通过源码与实验验证。

## 与其他框架对比时的基准问题

- LangChain / LangGraph 中什么抽象对应 Runner、Event 与 GraphAgent？
- Microsoft Agent Framework 如何表达 Workflow、Checkpoint 和 HITL？
- AgentScope 如何组织 Agent、Message、Memory 和 Multi-Agent？
- DeerFlow 在通用 Runtime 上增加了哪些 Harness 能力？
- Coding Agent 又增加了哪些代码执行与权限边界？

## 未完待续

- [ ] 锁定分析版本和 Commit
- [ ] 绘制执行时序图
- [ ] 完成最小 Tool Agent
- [ ] 分析取消、错误和 Event Drain
- [ ] 完成 GraphAgent 示例
- [ ] 增加真实工程经验与限制

