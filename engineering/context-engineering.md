---
layout: default
title: Context Engineering
description: Building the dynamic information environment an Agent needs for each decision.
---

<span class="eyebrow">04.02 · EVOLUTION</span>

<h1 data-i18n data-en="Context Engineering" data-zh="上下文工程">Context Engineering</h1>

<p data-i18n data-en="Selecting, assembling, compressing, and isolating the information an Agent needs at each step of a task." data-zh="在任务的每一步选择、组装、压缩和隔离 Agent 真正需要的信息。">Selecting, assembling, compressing, and isolating the information an Agent needs at each step of a task.</p>

> 状态：todo。当前页面先建立主题边界与后续写作提纲。

## 为什么需要它

真实任务的有效信息来自用户消息、历史对话、文件、工具结果、记忆、知识库和运行时状态。上下文窗口有限，信息也有时效性和权限边界，因此关键问题不再只是“Prompt 怎么写”，而是“此刻应该让模型看到什么”。

## 核心问题

- 如何区分稳定指令、任务状态、历史记录和外部知识。
- 如何按当前决策动态选择上下文，而不是无差别拼接全部内容。
- 长任务中如何做摘要、压缩、分层和按需回读。
- 如何处理上下文污染、冲突、过期信息和来源可信度。
- 多用户、多任务与多 Agent 之间如何隔离上下文。
- 如何度量 token、延迟、成本与任务质量的平衡。

## 与其他 Engineering 的关系

[Prompt Engineering](prompt-engineering.md) 负责显式指令，[Memory Engineering](memory-engineering.md) 决定跨步骤和跨会话保存什么，[Knowledge Engineering](knowledge-engineering.md) 提供可检索的外部事实。Context Engineering 把这些来源组装成当前推理所需的信息环境，并继续走向 [Harness Engineering](harness-engineering.md) 的完整执行环境。

## 后续提纲

- Context sources 与优先级
- Context selection、packing 与 compression
- Long-horizon task 的滚动上下文
- 文件、代码库与工具结果的按需加载
- Context isolation 与安全边界
- Context quality 的评测方法
