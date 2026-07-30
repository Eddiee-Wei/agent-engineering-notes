---
layout: default
title: Production Engineering
nav_title_zh: 生产工程
nav_order: 13
description: Operating Agent systems with reliability, scalability, cost control, and safe releases.
---

<span class="eyebrow">04.13 · RELIABILITY</span>

<h1 data-i18n data-en="Production Engineering" data-zh="生产工程">Production Engineering</h1>

<p data-i18n data-en="Operating Agent systems with reliability, scalability, cost control, graceful degradation, and safe releases." data-zh="以可靠性、扩展性、成本控制、优雅降级和安全发布的方式运行 Agent 系统。">Operating Agent systems with reliability, scalability, cost control, graceful degradation, and safe releases.</p>

> 状态：todo。当前页面先建立主题边界与后续写作提纲。

## 为什么需要它

Agent 系统把不稳定的模型输出、外部工具和长时间任务组合在一起。进入生产后，需要面对并发、限流、模型波动、工具故障、成本突增、任务恢复和版本兼容等常规但更复杂的工程问题。

## 核心问题

- 如何定义端到端 SLO，而不是只监控模型接口可用率。
- 模型、工具和知识源失败时如何超时、重试、降级和熔断。
- 长任务如何排队、取消、恢复和限制资源。
- token、工具调用和基础设施成本如何预算与归因。
- Prompt、模型、Tool Schema 和 Graph 如何安全版本化与发布。
- 如何通过 canary、回滚和运行手册控制变更风险。

## 与其他 Engineering 的关系

Production Engineering 消化其他专题在真实环境中的运行结果：[Evaluation Engineering](evaluation-engineering.md) 提供发布证据，[Observability Engineering](observability-engineering.md) 提供线上信号，[Safety Engineering](safety-engineering.md) 限制生产权限与副作用。

## 后续提纲

- End-to-end SLO 与 capacity
- Timeout、retry、fallback 与 circuit breaker
- Queue、concurrency 与 long-running task
- Cache、budget 与 cost control
- Versioning、canary 与 rollback
- Incident response 与 operational maturity
