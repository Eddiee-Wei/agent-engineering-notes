---
layout: default
title: Tool Engineering
nav_title_zh: 工具工程
nav_order: 5
description: Designing safe, understandable, and recoverable tool contracts for Agents.
---

<span class="eyebrow">04.05 · CAPABILITY</span>

<h1 data-i18n data-en="Tool Engineering" data-zh="工具工程">Tool Engineering</h1>

<p data-i18n data-en="Designing tools that an Agent can discover, select, call, interpret, and recover from safely." data-zh="设计让 Agent 能够发现、选择、调用、理解结果并安全恢复的工具。">Designing tools that an Agent can discover, select, call, interpret, and recover from safely.</p>

> 状态：todo。当前页面先建立主题边界与后续写作提纲。

## 为什么需要它

工具是 Agent 影响外部世界的主要接口。模糊的名称、过宽的参数、不可判定的返回值或缺少幂等性，都会把模型的小误差放大成真实副作用。

## 核心问题

- Tool name、description 和 schema 是否足以支持正确选择。
- 输入约束、默认值和枚举如何减少歧义。
- 返回值如何区分成功、可重试失败和永久失败。
- 读操作、写操作和高风险操作如何分级授权。
- 幂等键、超时、重试和取消如何设计。
- 工具数量增长后如何做检索、分组和按需暴露。

## 与其他 Engineering 的关系

Tool 是 [Harness Engineering](harness-engineering.md) 的能力入口；[Safety Engineering](safety-engineering.md) 约束它能做什么，[Observability Engineering](observability-engineering.md) 记录它实际做了什么，[Loop Engineering](loop-engineering.md) 决定失败后下一步怎么走。

## 后续提纲

- Function calling 与 Tool Schema
- Tool selection 与 routing
- Error model、retry 与 idempotency
- MCP、远程工具与协议边界
- Approval-aware tool
- Tool evaluation 与 contract test
