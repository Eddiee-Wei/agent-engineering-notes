---
title: Agent
---

# 01｜Agent

> 状态：🟡 开发中

Agent 在不同框架和产品中指向不同抽象。这里不急着给出统一定义，先从模型调用逐渐变成工程系统的过程开始。

## Questions

- 什么情况下普通模型调用开始不够用？
- 为什么 Tool Calling 加上循环仍然不等于可生产的 Agent？
- Runner、Event 和 Session 在真实服务中解决了什么问题？
- Workflow 与动态 Agent 的边界在项目里怎样变化？
- 哪些 Multi-Agent 设计真正带来收益，哪些只是增加复杂度？
- Demo 走向生产时，最先暴露的通常是什么问题？

## Agent Loop

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

在实际系统里，真正影响工程质量的通常还包括：

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

### Multi-Agent

重点包括：

- 什么时候拆分角色有收益？
- 什么时候只是在增加调用成本和上下文损耗？
- Handoff、Supervisor、Parallel、Debate 分别解决什么问题？

### Agent Harness

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

## 开发中

- [ ] 补充实际问题与约束
- [ ] 补充 tRPC-Agent-Go 中 Runner / Event 的使用体验
- [ ] 补充判断发生变化的案例
- [ ] 用最小实验复现关键取舍
