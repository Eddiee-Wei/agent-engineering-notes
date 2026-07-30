---
layout: default
title: Harness Engineering
nav_title_zh: Agent Harness 工程
nav_order: 3
description: Engineering the runtime, tools, state, permissions, and feedback systems around an Agent.
---

<span class="eyebrow">04.03 · EVOLUTION</span>

<h1 data-i18n data-en="Harness Engineering" data-zh="Agent Harness 工程">Harness Engineering</h1>

<p data-i18n data-en="Engineering the execution and control environment around a model: tools, runtime, files, state, memory, permissions, sandboxes, and feedback." data-zh="围绕模型构建完整的执行与控制环境：工具、运行时、文件、状态、记忆、权限、Sandbox 与反馈机制。">Engineering the execution and control environment around a model: tools, runtime, files, state, memory, permissions, sandboxes, and feedback.</p>

> 状态：todo。当前页面先建立主题边界与后续写作提纲。

## 为什么需要它

一个能够回答问题的模型，不等于一个能够完成真实任务的 Agent。Agent 需要读取环境、调用工具、修改状态、处理失败、请求审批并向用户反馈。Harness 是把模型能力接入这些现实约束的系统层。

## 核心问题与组成

- **Runtime**：承载模型调用、事件流、会话和任务生命周期。
- **Tools**：提供外部操作能力及清晰的输入输出契约。
- **Workspace**：文件系统、代码库、浏览器或其他可操作环境。
- **State & Memory**：保存当前进度和跨步骤需要复用的信息。
- **Permissions & Sandbox**：限制能力边界，并把高风险操作交给审批。
- **Feedback**：将工具结果、错误、验证和用户输入重新送回执行过程。

## 与其他 Engineering 的关系

Harness 不是 [Tool Engineering](tool-engineering.md) 的别名。Tool 只是能力入口；Harness 还负责运行时、状态、权限、可观测性和交互控制。Context 决定模型看到什么，Harness 决定模型能够在哪里、以什么权限做什么，[Loop Engineering](loop-engineering.md) 再把这些能力组织成持续执行。

## 后续提纲

- Agent Harness 的最小组成
- Runtime、Session、Event 与 Workspace
- Tool registry、Skill 与扩展机制
- Sandbox、Approval 与 capability boundary
- Durable state、resume 与长任务
- Coding Agent Harness 横向比较
- Harness 与 Agent Framework 的边界
