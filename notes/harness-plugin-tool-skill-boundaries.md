---
layout: default
title: "从 Tool 到 Harness：逐步理解 MCP、Skill 与 Plugin"
nav_order: 5
description: 用修复 Issue 的假想场景，从可调用动作逐步理解接入协议、任务方法、插件生命周期与完整执行系统，再讨论三种框架的复用取舍。
last_verified: 2026-10-28
---

<span class="eyebrow">01 · NOTES · 05</span>

# 从 Tool 到 Harness：逐步理解 MCP、Skill 与 Plugin

如果希望 Agent 根据一个公开 Issue 修复代码，最先需要补什么？能读 Issue、查代码、修改文件和运行测试，似乎就够了。但随着任务变复杂，还会遇到外部系统怎样接入、修复流程怎样复用、模块怎样装卸，以及失败后怎样继续等问题。

把这些问题按出现的顺序展开，比一开始记住五个定义更容易理解。下面用同一个假想任务贯穿：**读取 Issue，定位代码，完成修复，并用测试证明结果。** 这是帮助理解的场景，不是已执行的实验；讲解顺序也不代表技术包含关系或历史演进顺序。

> 本文是公开文档阅读与设计分析，核对于 2026-10-28；没有运行教程、适配用户项目或进行性能实验。API 应按项目锁定版本再次核对。文中比较不涉及私有实现，也不代表安全性或能力排名。

## 1. 从一个动作，走到完整任务

### 第一步：Tool 让模型能够提出可执行的动作

模型可以解释 Issue，也可以生成一段修复建议。要让建议变成真实环境中的行动，宿主需要提供可调用的动作，例如读取 Issue、搜索代码、编辑文件和运行测试，这就是 Tool。

工具有名称、说明、参数契约和执行实现。模型提出调用候选，宿主解析、检查并执行，再把结果交回模型。Tool 不一定内置在内核里，也可以由插件注册，或由外部程序提供。

到这里，Agent 有了“手”，但接入来源一多，每种外部服务都写一套连接方式会变得繁琐。

### 第二步：MCP 让外部能力按共同协议接入

假设 Issue 来自一个服务，代码检索又来自另一个服务。它们可以通过 MCP 提供能力，宿主用相应 Client 与 Server 通信，把发现的工具接入自己的工具系统。

这里必须分清：**MCP 是协议，MCP Server 是提供能力的程序，Tool 是其中一种可调用能力。** 按[MCP 架构文档](https://modelcontextprotocol.io/docs/learn/architecture)，Server 还可以提供 resources 和 prompts。MCP 因而不只是“工具集合加说明”，也不替宿主决定模型循环和上下文策略。内置工具或直接 API 调用同样可以存在，不要求经过 MCP。

接入方式统一后，Agent 可以调用更多动作，但仍可能直接改代码而忘记复现问题，或者测试没跑完就宣布成功。接下来缺的是任务方法。

### 第三步：Skill 把“怎样完成这类任务”沉淀下来

可以把修复流程写成方法包：先读 Issue 和项目说明，再复现失败、定位原因、做最小修改，最后运行相关测试并交付证据。这个 Skill 可以指导模型使用已有工具，完全不新增工具。

[Agent Skills 规范](https://agentskills.io/specification)要求目录包含 `SKILL.md`，其中有 metadata 和指令正文，也可附 scripts、references 和 assets。渐进加载通常先提供名称与描述，需要时再读正文和资源，避免所有方法全文常驻上下文。

Skill 附带的测试脚本不会自动成为已注册 Tool。能否执行、通过什么工具执行，仍由宿主和运行环境决定。方法告诉模型怎么做，不能单独保证每一步都被执行。

### 第四步：Plugin 管理模块怎样装入宿主、怎样退出

如果希望把 Issue 接入、修复 Skill、配置页面或工具日志模块复用到多个环境，就需要关注分发、配置、挂载、依赖激活和卸载。这是 Plugin 这种宿主扩展单位要解决的问题，具体契约由宿主定义。

某个插件可以一起提供 tools 和 skills；另一个插件可能只增加 UI、服务或事件监听，既没有 Tool，也没有 Skill。插件可以接入 MCP Server，也可以直接注册本地能力，完全不用 MCP。因此，不能从“装了几个插件”推断“模型多了几个工具”。

### 第五步：Harness 统筹多轮执行与任务完成

现在动作、接入、方法和模块都有了，仍需要有人负责：本轮给模型哪些上下文，何时执行工具，哪些动作要审批，历史和状态怎样保存，错误后是否重试，以及测试结果是否足以证明任务完成。

这里沿用本站[Harness 进化章节](../docs/06-agent-harness-evolution.md)的工程视角：**Harness 是模型外围的执行与控制系统。** 在这个例子中，它让“读 Issue → 查代码 → 修改 → 测试 → 根据结果继续或结束”真正成为受控循环，而不只是一段流程说明。

术语没有绝对统一标准，框架也可能把这些责任放进 Runtime 或 Agent。CLI、Web、Desktop、SDK 是入口形态，同一运行层可以服务多个入口，Harness 不只服务 CLI。

走完这个例子，再回看五个概念：

| 概念 | 在修复任务中解决什么问题 | 关键边界 |
| --- | --- | --- |
| Tool | 读取 Issue、查代码、运行测试等动作 | 可调用动作，不限定来源 |
| MCP | 接入外部 Issue 或检索服务 | 通信协议；Server 是提供方程序 |
| Skill | 复现、修复、测试与交付的方法 | 可以只使用已有工具 |
| Plugin | 分发、配置、挂载和清理扩展模块 | 能力与生命周期契约由宿主定义 |
| Harness | 统筹上下文、循环、权限、状态与验收 | 是执行控制层，服务不同产品入口 |

这是读者理解问题的顺序，**不是 Tool 被包进 MCP，再包进 Skill 和 Plugin 的层层包含关系**。已有本地工具、一个 Skill 和受控循环，也能完成任务；不必为了凑齐名字引入每一种机制。下面再看真实插件接入，检验这些区分是否有用。

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
