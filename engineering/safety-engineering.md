---
layout: default
title: Safety Engineering
description: Controlling Agent capabilities, permissions, data boundaries, and high-risk actions.
---

<span class="eyebrow">04.12 · CONTROL</span>

<h1 data-i18n data-en="Safety Engineering" data-zh="安全工程">Safety Engineering</h1>

<p data-i18n data-en="Controlling what an Agent can see and do through permissions, sandboxes, approvals, and data boundaries." data-zh="通过权限、Sandbox、审批和数据边界，控制 Agent 能看到什么、能够做什么。">Controlling what an Agent can see and do through permissions, sandboxes, approvals, and data boundaries.</p>

> 状态：todo。当前页面先建立主题边界与后续写作提纲。

## 为什么需要它

Agent 会读取不可信内容、调用外部工具并产生真实副作用。安全不能只依赖 Prompt 中的一句“不要做危险操作”，而要通过能力隔离、最小权限、审批和可审计执行建立系统边界。

## 核心问题

- 如何识别并隔离不可信指令与 Prompt Injection。
- Tool 和数据权限如何按用户、任务和环境最小化。
- 哪些操作必须 Sandbox，哪些操作必须人工确认。
- 如何避免秘密、个人数据和跨租户信息泄露。
- 高风险写操作如何预览、审批、执行和回滚。
- 安全策略如何被测试、监控和持续更新。

## 与其他 Engineering 的关系

Safety 是 [Harness Engineering](harness-engineering.md) 的控制面，与 [Tool Engineering](tool-engineering.md) 的调用契约直接相连，并依赖 [Observability Engineering](observability-engineering.md) 提供审计证据。

## 后续提纲

- Threat model 与 trust boundary
- Prompt injection 与 data exfiltration
- Capability、permission 与 least privilege
- Sandbox、approval 与 human control
- Secret、PII 与 tenant isolation
- Security evaluation 与 incident response
