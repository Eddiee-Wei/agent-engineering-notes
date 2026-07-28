---
layout: default
title: Graph Engineering
description: Engineering explicit stateful workflows for durable and controllable Agent execution.
---

<span class="eyebrow">04.08 · ORCHESTRATION</span>

<h1 data-i18n data-en="Graph Engineering" data-zh="图编排工程">Graph Engineering</h1>

<p data-i18n data-en="Engineering explicit state, nodes, transitions, checkpoints, and recovery paths for durable Agent workflows." data-zh="为可持久、可控制的 Agent 工作流设计显式状态、节点、转移、Checkpoint 与恢复路径。">Engineering explicit state, nodes, transitions, checkpoints, and recovery paths for durable Agent workflows.</p>

> 状态：todo。当前页面先建立主题边界与后续写作提纲。

## 为什么需要它

复杂任务仅靠自由循环很难解释和恢复。Graph 将关键步骤、状态变化、条件分支、人工决策和失败路径显式化，使长任务能够暂停、恢复、审计和局部重试。

## 核心问题

- Graph state 的 schema、所有权和演进方式。
- Node 的职责粒度以及纯计算与外部副作用的分离。
- 条件边、动态路由、并行分支和汇合怎样表达。
- Checkpoint 在哪里保存，恢复时如何保证一致性。
- Human-in-the-loop 如何暂停并重新进入流程。
- Graph 版本变化时，运行中的实例如何兼容。

## 与其他 Engineering 的关系

[Loop Engineering](loop-engineering.md) 关注执行如何形成闭环并最终收敛；Graph Engineering 关注如何用显式控制结构承载这个闭环。Graph 中可以包含 Agent Loop，Loop 也可以在需要时把关键状态提升为 Graph 节点。

## 后续提纲

- State、node、edge 与 command
- Deterministic workflow 与 Agent node
- Checkpoint、durable execution 与 resume
- Parallel branch、join 与 cancellation
- Human-in-the-loop
- Graph testing、migration 与 visualization
