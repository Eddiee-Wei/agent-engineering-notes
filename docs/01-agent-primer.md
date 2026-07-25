---
title: Agent 到底是什么
---

# 01｜Agent 到底是什么

> 状态：🟡 提纲已完成，正文开发中

## 这一章要回答什么

- Agent 与普通 Chat Completion 有什么区别？
- Agent Loop 最少需要哪些组成部分？
- Workflow、Agent、Multi-Agent 和 Agent Harness 是同一层概念吗？
- 为什么 Tool Calling 不等于 Agent？
- 一个 Demo 距离生产系统还有多远？

## 暂定结构

### 1. 从一次模型调用开始

输入、模型推理和输出构成最小的 LLM 调用，但它没有观察环境、采取行动和继续修正的闭环。

### 2. Agent Loop

暂定用以下循环建立共同语言：

```text
Goal
  ↓
Observe → Decide → Act → Observe
             ↑          ↓
             └─ State ──┘
```

需要进一步拆解：

- Model
- Instruction
- Tool
- State
- Runner
- Event
- Stop condition
- Error / retry / cancellation

### 3. Workflow 与 Agent

- Workflow：控制流主要由开发者定义。
- Agent：下一步行动更多由模型动态决定。
- 实际系统经常混合两者，而不是二选一。

### 4. Multi-Agent

待讨论：

- 什么时候拆分角色有收益？
- 什么时候只是在增加调用成本和上下文损耗？
- Handoff、Supervisor、Parallel、Debate 分别解决什么问题？

### 5. Agent Harness

Harness 不只是一个 Agent 类。它通常还负责：

- 上下文装配
- 工具与权限
- 执行环境
- 状态持久化
- 任务拆解与子 Agent
- 观测、评测与恢复
- 面向用户的交互协议

### 6. 从 Agent Framework 到 Coding Agent

Coding Agent 在通用框架之上增加了代码库理解、文件编辑、Shell、测试、补丁、Git、安全边界和面向开发者的交互体验。

## 开发中

- [ ] 补充可运行的最小 Agent Loop
- [ ] 使用 tRPC-Agent-Go 术语映射组成部分
- [ ] 加入 Workflow / Agent / Harness 对比图
- [ ] 增加生产系统失败案例
