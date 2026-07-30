---
layout: default
title: Observability Engineering
nav_title_zh: 可观测性工程
nav_order: 11
description: Making Agent decisions, actions, failures, latency, and cost inspectable.
---

<span class="eyebrow">04.11 · OPERATIONS</span>

<h1 data-i18n data-en="Observability Engineering" data-zh="可观测性工程">Observability Engineering</h1>

<p data-i18n data-en="Making Agent decisions, actions, state changes, failures, latency, and cost inspectable across a task." data-zh="让 Agent 在整个任务中的决策、动作、状态变化、失败、延迟与成本都可检查。">Making Agent decisions, actions, state changes, failures, latency, and cost inspectable across a task.</p>

> 状态：todo。当前页面先建立主题边界与后续写作提纲。

## 为什么需要它

Agent 失败经常跨越模型、上下文、工具、权限和运行时。只有普通应用日志，很难回答“它为什么选择这个动作”“失败发生在哪一轮”“重试是否有效”以及“成本花在了哪里”。

## 核心问题

- Trace、span、event、message 和 state transition 如何关联。
- 模型调用、工具调用和用户审批如何共享 task identity。
- 哪些内容可以记录，哪些内容必须脱敏或禁止持久化。
- 如何定义成功率、步骤数、延迟、token 和成本指标。
- 如何从轨迹中识别循环、工具失败和上下文错误。
- 线上反馈如何回流到评测集和工程改进。

## 与其他 Engineering 的关系

Observability 为 [Loop Engineering](loop-engineering.md) 提供执行证据，为 [Evaluation Engineering](evaluation-engineering.md) 提供真实样本，也为 [Production Engineering](production-engineering.md) 的容量、成本和可靠性决策提供基础。

## 后续提纲

- Agent trace 与事件模型
- Model、tool、graph 的统一关联
- Metrics、SLO 与 cost attribution
- Sensitive data 与 trace redaction
- Failure taxonomy 与 replay
- 从生产轨迹生成 regression case
