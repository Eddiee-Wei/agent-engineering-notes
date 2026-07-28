---
layout: default
title: Prompt Engineering
description: Engineering instructions, constraints, examples, and output contracts for reliable model interactions.
---

<span class="eyebrow">04.01 · EVOLUTION</span>

<h1 data-i18n data-en="Prompt Engineering" data-zh="提示词工程">Prompt Engineering</h1>

<p data-i18n data-en="Designing instructions, constraints, examples, and output contracts so a model can reliably understand and perform a bounded task." data-zh="设计指令、约束、示例与输出契约，让模型能够稳定理解并完成一个边界清晰的任务。">Designing instructions, constraints, examples, and output contracts so a model can reliably understand and perform a bounded task.</p>

> 状态：todo。当前页面先建立主题边界与后续写作提纲。

## 为什么需要它

模型能力不会自动变成稳定的任务行为。Prompt Engineering 负责把人的意图翻译成模型可执行的任务说明，并明确成功条件、禁止事项、输入结构和输出协议。

## 核心问题

- System、Developer、User 等不同层级的指令如何分工。
- 角色、背景、任务、约束和验收标准怎样组织。
- 何时使用 few-shot 示例，怎样避免示例带来错误偏置。
- 如何设计结构化输出、错误响应和不确定性表达。
- Prompt 如何版本化、评测和回归，而不是依赖手工试用。

## 与其他 Engineering 的关系

Prompt 主要控制一次交互中的显式指令；[Context Engineering](context-engineering.md) 进一步决定任务运行时究竟向模型提供哪些动态信息。两者共同构成 Agent 的输入面，但不能替代工具、状态和执行环境。

## 后续提纲

- Prompt anatomy 与指令优先级
- Zero-shot、few-shot 与模板化
- Structured output 与协议约束
- Prompt injection 的边界
- Prompt 测试集、版本和回归
- 从 Prompt Engineering 走向 Context Engineering
