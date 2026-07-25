---
title: 我目前怎样理解 Agent
---

# 01｜我目前怎样理解 Agent

> 状态：🟡 个人经验与案例开发中

我不准备在这里重新定义一个标准的 Agent。这个词在不同框架和产品中指向不同抽象，比定义更重要的是：在我实际参与的系统里，什么时候一段模型调用开始需要被当作 Agent 工程问题处理。

## 我想记录的问题

- 我第一次遇到“普通模型调用不够用”是什么场景？
- 为什么 Tool Calling 加上循环仍然不等于可生产的 Agent？
- Runner、Event 和 Session 在真实服务中解决了什么问题？
- Workflow 与动态 Agent 的边界在项目里怎样变化？
- 哪些 Multi-Agent 设计真正带来收益，哪些只是增加复杂度？
- Demo 走向生产时，最先暴露的通常是什么问题？

## 当前理解

### 从一次模型调用到可运行系统

输入、模型推理和输出构成最小的 LLM 调用，但它没有观察环境、采取行动和继续修正的闭环。

### 2. Agent Loop

Agent Loop 可以作为理解起点，但它远不是整个系统：

```text
Goal
  ↓
Observe → Decide → Act → Observe
             ↑          ↓
             └─ State ──┘
```

在我的实践语境里，真正影响工程质量的通常还包括：

- Model
- Instruction
- Tool
- State
- Runner
- Event
- Stop condition
- Error / retry / cancellation

### Workflow 与 Agent 不是二选一

- Workflow：控制流主要由开发者定义。
- Agent：下一步行动更多由模型动态决定。
- 实际系统经常混合两者，而不是二选一。

### 我对 Multi-Agent 保持谨慎

我会重点记录：

- 什么时候拆分角色有收益？
- 什么时候只是在增加调用成本和上下文损耗？
- Handoff、Supervisor、Parallel、Debate 分别解决什么问题？

### Harness 才是很多体验差异的来源

Harness 不只是一个 Agent 类。它通常还负责：

- 上下文装配
- 工具与权限
- 执行环境
- 状态持久化
- 任务拆解与子 Agent
- 观测、评测与恢复
- 面向用户的交互协议

### 从通用框架到 Coding Agent

Coding Agent 在通用框架之上增加了代码库理解、文件编辑、Shell、测试、补丁、Git、安全边界和面向开发者的交互体验。

## 等待补充的个人材料

- [ ] 整理可以公开的实际问题与约束
- [ ] 补充 tRPC-Agent-Go 中 Runner / Event 的使用体验
- [ ] 记录一个判断发生变化的案例
- [ ] 用最小实验复现关键取舍
