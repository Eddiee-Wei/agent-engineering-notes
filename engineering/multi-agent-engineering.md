---
layout: default
title: Multi-Agent Engineering
description: Designing effective delegation, communication, and coordination among multiple Agents.
---

<span class="eyebrow">04.09 · COLLABORATION</span>

<h1 data-i18n data-en="Multi-Agent Engineering" data-zh="多 Agent 工程">Multi-Agent Engineering</h1>

<p data-i18n data-en="Designing roles, delegation, communication, shared state, and coordination when one Agent is not enough." data-zh="当单个 Agent 不足以完成任务时，设计角色、委派、通信、共享状态与协作机制。">Designing roles, delegation, communication, shared state, and coordination when one Agent is not enough.</p>

> 状态：todo。当前页面先建立主题边界与后续写作提纲。

## 为什么需要它

多 Agent 只有在并行性、专业分工、独立验证或上下文隔离带来明确收益时才值得使用。否则，更多 Agent 往往只会增加通信成本、状态冲突和结果整合难度。

## 核心问题

- 任务是否真的需要多个 Agent，收益来自哪里。
- 角色按能力、上下文、权限还是责任边界拆分。
- 谁负责委派、验收、合并结果和最终决策。
- 消息、共享状态和产物如何传递，怎样避免重复工作。
- 并行任务如何处理依赖、冲突、取消和超时。
- 如何评测团队结果，而不是只评测单个 Agent 输出。

## 与其他 Engineering 的关系

多 Agent 协作通常由 [Graph Engineering](graph-engineering.md) 承载显式流程，由 [Context Engineering](context-engineering.md) 控制信息隔离，并依赖 [Evaluation Engineering](evaluation-engineering.md) 判断分工是否真正提升质量。

## 后续提纲

- Supervisor、peer-to-peer 与 swarm
- Delegation contract 与 task handoff
- Shared state 与 message protocol
- Parallelism、dependency 与 merge
- Debate、review 与 independent verification
- Cost、latency 与 team evaluation
