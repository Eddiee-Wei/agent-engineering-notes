---
layout: default
title: Memory Engineering
description: Designing what Agents remember, retrieve, update, and forget.
---

<span class="eyebrow">04.06 · STATE</span>

<h1 data-i18n data-en="Memory Engineering" data-zh="记忆工程">Memory Engineering</h1>

<p data-i18n data-en="Designing what an Agent remembers, when it writes, how it recalls, and when it forgets." data-zh="设计 Agent 记住什么、何时写入、如何召回，以及何时遗忘。">Designing what an Agent remembers, when it writes, how it recalls, and when it forgets.</p>

> 状态：todo。当前页面先建立主题边界与后续写作提纲。

## 为什么需要它

把全部历史对话永久保存并不等于拥有有效记忆。Agent 需要区分当前工作状态、任务经验、用户偏好和长期事实，并控制写入质量、召回范围、更新冲突和隐私边界。

## 核心问题

- Working memory、episodic memory、semantic memory 和 profile 如何分层。
- 哪些信息值得写入，写入前是否需要验证或用户确认。
- 如何按任务和用户边界召回，避免串扰。
- 新旧记忆冲突时如何更新、合并或失效。
- 如何支持遗忘、过期、删除和数据可追溯。
- 如何评测召回是否真正改善任务表现。

## 与其他 Engineering 的关系

Memory 保存可复用的信息，[Context Engineering](context-engineering.md) 决定某一轮是否把它放进上下文，[Knowledge Engineering](knowledge-engineering.md) 则更关注外部、可维护和可引用的知识来源。

## 后续提纲

- Memory taxonomy 与数据模型
- Write policy 与 consolidation
- Retrieval、ranking 与 scope
- Conflict、freshness 与 forgetting
- Privacy、ownership 与 deletion
- Memory evaluation
