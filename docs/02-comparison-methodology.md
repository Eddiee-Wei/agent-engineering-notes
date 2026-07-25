---
title: Framework Lens
---

# 02｜Framework Lens

> 状态：🟢 第一版

阅读源码、使用框架和体验 Coding Agent 时反复出现的一些问题，用来保持对照的一致性。

## A. 核心抽象

- Agent 的接口是什么？
- Runner 与 Agent 是否分离？
- 输入输出是 Message、Event、State 还是其他对象？
- 同步、异步和 Streaming 如何表达？

## B. 模型与工具

- 如何接入不同模型提供商？
- Tool Schema 如何生成和校验？
- 工具执行是串行、并行还是可调度？
- 是否支持 MCP？
- 错误、超时、重试和权限由谁处理？

## C. 状态与上下文

- Session 与对话历史如何保存？
- Working Memory 与 Long-term Memory 如何区分？
- 是否有 Artifact、Knowledge、Store 或 Checkpoint？
- 上下文裁剪、摘要和缓存如何实现？

## D. 控制流

- 是否支持 Graph / Workflow？
- 条件、循环、并发和子图如何表达？
- 能否中断、恢复和回放？
- Agent 与确定性节点能否组合？

## E. Multi-Agent

- 支持哪些协作模式？
- Handoff 与共享状态如何实现？
- 子 Agent 的上下文和权限是否隔离？
- 如何避免循环、冲突和重复劳动？

## F. 生产化

- Cancellation 与 Backpressure
- Persistence 与 Durable Execution
- Evaluation 与 Benchmark
- Trace、Metric 与 Log
- 部署、伸缩和多租户
- Human-in-the-loop

## G. 开发体验

- 语言与类型系统
- API 稳定性
- 调试工具
- 文档与示例
- 生态集成
- 二次开发成本

## H. Coding Agent 扩展

- 文件搜索与代码理解
- Patch / Edit 模型
- Shell 与 Sandbox
- Git 与 Worktree
- 权限审批
- Project Instructions / Skills / MCP
- 长任务、并行任务和上下文治理

## 证据等级

| 等级 | 证据 |
| --- | --- |
| A | 官方源码与可重复实验 |
| B | 官方文档与维护者说明 |
| C | Issue、Discussion、公开演讲 |
| D | 第三方文章或个人推测 |

重要结论应尽量达到 A 或 B。
