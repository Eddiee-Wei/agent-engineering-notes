---
layout: default
title: "Harness、Plugin、Tool、Skill 与 MCP：从接入能力到控制执行"
nav_order: 5
description: 从两个插件为什么只有一个工具的困惑出发，厘清扩展、协议与执行层，并讨论 Codex、DeepSeek Harness 和 tRPC-Agent-Go 的接入取舍。
last_verified: 2026-10-28
---

<span class="eyebrow">01 · NOTES · 05</span>

# Harness、Plugin、Tool、Skill 与 MCP：从接入能力到控制执行

读 Agent 框架时，一个容易产生的困惑是：已经有 Tool、Skill 和 MCP，为什么还需要 Plugin？如果 Harness 把这些东西接起来，它是不是一个更大的 CLI？进一步考虑已有 Go Agent 服务时，又容易跳到“是否应该换一套循环”。

这次概念讨论的转折来自一个很小的例子：DeepSeek Harness 的 Cordis 教程新增两个示例插件，但只新增一个工具。**扩展模块的数量，不等于模型能调用的动作数量。** 沿着“谁注册、谁看到、谁执行、谁清理”看，几个词才各自找到位置。

> 本文是公开文档阅读与设计分析，核对于 2026-10-28；没有运行教程、适配用户项目或进行性能实验。API 应按项目锁定版本再次核对。文中比较不涉及私有实现，也不代表安全性或能力排名。

## 1. 先拆开问题：动作、方法、接入与运行

这些概念没有一条统一的父子关系，更不是 Tool → Skill → Plugin → Harness 的升级链。

| 概念 | 回答的问题 | 需要保留的边界 |
| --- | --- | --- |
| Tool | 可以调用什么动作？ | 有调用契约与执行实现；可来自内置、插件注册或 MCP |
| Skill | 这类任务应怎样做？ | 方法与指令包；附带脚本不自动变成已注册工具 |
| MCP | 宿主怎样与能力提供方通信？ | 是协议；MCP Server 才是运行的提供方程序 |
| Plugin | 怎样把模块接入宿主并管理其生命周期？ | 契约由宿主定义；可以提供工具，也可以只监听事件 |
| Harness | 怎样组织并控制模型完成任务？ | 管理上下文、模型与工具循环、权限、状态、失败和完成 |

[MCP 架构文档](https://modelcontextprotocol.io/docs/learn/architecture)区分 Host、Client 与 Server；Server 可提供 tools、resources 和 prompts。因此 MCP 不能简化成“工具集合加说明”。协议也不替宿主决定怎样组织模型上下文。

[Agent Skills 规范](https://agentskills.io/specification)把 Skill 定义为包含 `SKILL.md` 的目录，可附 scripts、references 和 assets。渐进加载通常先给模型名称与描述，再按任务读取正文和资源。脚本是否可执行、通过什么工具执行，仍由宿主权限和运行环境决定。

Harness 的名称没有绝对统一标准，框架也可能把部分责任放进 Runtime 或 Agent。这里沿用本站[Harness 进化章节](../docs/06-agent-harness-evolution.md)的工程视角：它是模型外围的执行与控制系统。CLI、Web、Desktop、SDK 是入口形态，同一运行层可以服务多个入口。

## 2. 两个插件、一个工具：注册发生在宿主一侧

DeepSeek 的[接入教程](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/docs/cordis-tutorial/07-into-the-harness.md)中，`greet-tool` 向工具服务注册 `greet`；`tool-logger` 监听工具结果。后者没有因此新增一个模型可调用工具。教程手动经过工具流水线执行，没有调用模型，不能当成真实模型选工具的测试结果。

可以把一般插件接入过程画成下面这条链；具体状态与接口由各宿主定义：

```text
安装 / 配置声明
      ↓ 加载代码、等待所需服务
宿主激活插件 → 注册工具 / 服务 / 指令 / 事件监听
      ↓ 宿主选择本轮暴露的部分
模型看到工具 Schema、说明或相关上下文
      ↓ 提出调用候选
宿主检查权限与参数 → 执行 → 结果进入下一轮

卸载插件 → 撤销所属注册、执行资源清理
```

插件注册的对象是宿主，模型只看到宿主投影出来的部分。某个插件提供 UI 或日志服务时，可能完全不进入模型的工具列表。安装完成也不等于依赖满足、能力已激活，更不等于本次任务已经获准调用。

Cordis 的[生命周期教程](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/docs/cordis-tutorial/02-lifecycle-and-effects.md)说明：受其管理的注册会随插件卸载撤销；自建连接、计时器、watcher 等资源需要通过 effect 返回 disposer。这里的“撤销”针对注册和资源生命周期，**不会自动撤回此前已经发送的消息或其他外部写入**。

## 3. DeepSeek 与 Codex：比较复用位置，而不是工具数量

DeepSeek Harness（`dsh`）是官方开源项目。其[Cordis primer](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/docs/cordis-primer.md)和[架构文档](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/docs/architecture.md)展示了 everything-is-plugin 的组织方式：模型适配、工具注册、会话日志与 loop 等通过服务和插件组合，可以替换组件，也支持多模型。

这说明的是代码组合方式。插件会执行实际代码，不能把它当成沙箱。官方[安全说明](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/SAFETY.md)仍标明实验性 Developer Preview，未经过安全审计；可访问的文件、网络和凭据仍需运行环境治理。

Codex 也可以复用公开 Harness：[官方平台说明](https://developers.openai.com/blog/codex-as-a-platform)分别介绍 `codex exec`、SDK 和 app-server，覆盖非交互任务、程序化调用，以及持续会话、流式事件和审批交互。[定制文档](https://learn.chatgpt.com/docs/customization/overview)提供项目指令、Skills、MCP 和插件等扩展入口。

我的架构判断是：**Codex 的公开集成叙事更强调复用运行时与产品接口，DeepSeek 的架构更强调运行时内部的插件组合。** 这是针对这些资料的归纳，不是排他分类。不能据此说 Codex 没有插件、不可修改或只限 OpenAI 模型，也不能推出 DeepSeek 更强或更安全。公开运行时、云端托管产品与模型能力应分别评估。

站内延伸：[Codex](../coding-agents/codex.md)、[DeepSeek Harness](../coding-agents/deepseek-harness.md)。已有章节侧重具体机制，本篇只记录这次选型视角的变化。

## 4. 已有 tRPC-Agent-Go：优先补契约，不急着再套循环

tRPC-Agent-Go 已有 Runner、Session、Event 和摘要等 Harness 基础。官方[Runner 文档](https://trpc-group.github.io/trpc-agent-go/runner/)与[摘要设计](https://trpc-group.github.io/trpc-agent-go/blog/summary/)提供了可复用组件；有 Harness 需求不等于必须替换 Runner。

按当前[Plugin 文档](https://trpc-group.github.io/trpc-agent-go/plugin/)，自定义插件通过 `Name`、`Register` 注册，由 `runner.WithPlugins` 接入；常用钩子包括 Before/AfterAgent、Before/AfterModel、Before/AfterTool 和 OnEvent。单 Agent 的局部行为可以用 callbacks，Runner 范围的共同行为可以打包成 Plugin。它主要是 callback bundle，不等同于 Cordis 的服务组合体系，也不直接兼容 DeepSeek 插件。

我的设计建议是保留现有执行主线，先核对三组缺口：

| 需要补齐的契约 | 优先复用与检查什么 |
| --- | --- |
| 上下文治理 | Session、摘要、模型请求组装；大结果与历史累积分别限制 |
| 预算与策略 | 调用前钩子、工具执行边界、取消与截止时间；跨子任务共享预算 |
| 完成验收与恢复 | Event、任务状态、验收证据、外部操作回执；恢复前核查现实状态 |

不建议为接入插件再包一套模型—工具循环：两边都拥有重试、终态或历史写入权时，语义反而更难统一。只有现有扩展点无法表达所需控制契约，并且迁移成本可接受时，再考虑替换执行内核。详见站内[tRPC-Agent-Go](../frameworks/trpc-agent-go.md)和[Harness Engineering 入口](../engineering/harness-engineering.md)。

## 5. 判断落地前，还需要验证什么

读到了扩展点，只能证明存在接口，不能证明目标项目已经具备完整控制能力。

- **调用限制不等于总费用上限。** [Agent 文档](https://trpc-group.github.io/trpc-agent-go/agent/)中的 `llmagent.WithMaxLLMCalls`、`llmagent.WithMaxToolIterations` 限制 invocation 范围内的调用或工具迭代；不是跨请求、跨子 Agent 的全局费用账本，迭代次数也不等于工具调用总数。
- **观察点不等于阻断点。** OnEvent 适合观测与事件处理；其错误处理不能被假定为可靠安全门禁。策略要在相关动作实际执行前检查，并按目标版本核对短路、错误与传播语义。
- **共享插件需要并发安全。** Runner 级实例可能处理多个运行；不要把每次请求的计数、身份和临时状态无隔离地放进共享字段。
- **恢复不等于外部写入 exactly-once。** Session、摘要或 checkpoint 不能自动判定远端操作是否已执行；结果未知时先查回执，再决定继续或重试。

实施前应锁定依赖版本，对照[官方插件示例](https://github.com/trpc-group/trpc-agent-go/tree/main/examples/plugin)，验证钩子顺序、取消、并行工具、子 Agent、限制触发及恢复场景。本文没有给出可运行适配代码，也没有声称这些验收已经通过。

这次讨论最终改变的是提问顺序：先问缺的是动作、方法、接入生命周期还是执行控制，再决定扩展哪个边界。名字相同的 Plugin 未必可以移植；名字不同的 Runner 和 Harness，也可能已经承担了相近的责任。
