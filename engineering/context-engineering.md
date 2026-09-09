---
layout: default
title: Context Engineering
nav_title_zh: Context Engineering
nav_order: 2
description: 把指令、历史、工具、记忆与外部资料编译成 Agent 每次决策所需的 Context Frame。
last_verified: 2026-09-07
---

<h1 data-i18n data-en="Context Engineering" data-zh="上下文工程">Context Engineering</h1>

模型不会持续看见整个仓库、完整对话或所有外部系统。每次调用之前，Agent Harness 都要重新决定：这一刻应该让模型看见什么，以什么顺序和身份出现，又有哪些内容必须留在模型之外。

这项工作就是 Context Engineering。它不是把 Prompt 写长一点，而是把分散的信息源编译成一次可解释、可重建、受预算约束的 **Context Frame**。

> 如果你关心的是 `AGENTS.md`、`CLAUDE.md`、`SOUL.md`、`MEMORY.md`、`SKILL.md` 和普通 Markdown 分别怎样被读取，请直接阅读主题随记：[Agent 为什么会读这些 Markdown](../notes/agent-markdown-files-context-loading.md)。本文只保留上下文工程的概念骨架。

## 1. Context 是一次决策的投影

Context 不是文件系统，也不是数据库里保存的全部 Session。它是某次 Model Turn 真正可见的输入：

```text
Context Frame
  = 稳定的 Harness / Agent 指令
  + 当前作用域的项目规则
  + 已激活的 Skill
  + 经预算处理的对话历史
  + 检索命中的 Memory / Knowledge
  + 当前用户输入
  + Tool Call 与 Observation
  + 当前可用的 Tool Schema
```

“系统里有这份数据”和“模型此刻看见这份数据”是两回事。本地 Run State、数据库连接、密钥和工具实现可以被 Runtime 使用，却不应原样交给模型；一份 Markdown 即使躺在 cwd，也要经过发现和读取才会进入 Context。

因此，Context 应当满足两个基本条件：

- **可追溯**：知道每段内容来自哪份文件、哪次检索或哪个 Tool Result；
- **可重建**：丢失当前请求后，仍能从更权威的 Session、Memory、Artifact 或外部系统重新装配。

更完整的状态边界见 [Agent 的状态边界](../docs/03-agent-state-semantics.md)。

## 2. Context Compiler

可以把 Harness 的上下文装配理解成一条编译流水线：

```text
Sources
  -> Discovery
  -> Scope / Precedence
  -> Selection
  -> Read / Normalize
  -> Budget / Render
  -> Context Frame
  -> Provider Request
  -> Response / Tool Observation
  -> 下一次 Context Frame
```

这条流水线里，最常被忽略的是前四步。文件名只参与 Discovery；目录位置决定 Scope；产品规则决定 Precedence；任务相关性和 token 预算决定 Selection。真正到了 Render 阶段，原始文件可能已经经过 import 展开、去重、截断、路径标注、敏感信息过滤或摘要。

## 3. 信息源有不同的加载节奏

| 信息源 | 发现方式 | 进入 Context 的时机 | 适合内容 |
| --- | --- | --- | --- |
| System / Developer Instruction | 应用固定配置 | 每次相关调用 | 产品身份、协议与高层约束 |
| 项目指令文件 | 启动时按路径扫描 | 首轮；部分产品在目录访问后增量加载 | 项目事实、命令和长期规则 |
| Skill | 启动发现元数据 | 任务命中后加载正文，资源继续按需读取 | 某类任务的可复用流程 |
| Prompt / Command | 启动登记名称 | 用户显式调用时展开 | 一次性、可参数化任务入口 |
| Memory / Knowledge | 按身份、Scope 和 Query 检索 | 召回、重排和裁剪后 | 跨任务事实与外部证据 |
| 普通文件 | 文件工具、import 或 MCP Resource | 读取后的下一次模型调用 | 低频长资料和当前工作对象 |
| Tool Schema | Tool Registry 与权限计算 | 调用前放入 Provider 的 tools 字段 | 告诉模型可以请求什么动作 |
| Tool Result | Runtime 实际执行 | 下一次调用作为 Observation | 外部世界的返回值与副作用回执 |

常驻内容用持续 token 换稳定，按需内容用额外一次 Tool Round Trip 换安静。Context Engineering 的工作不是把所有资料都放进去，而是让加载成本与使用频率相称。

## 4. Provider Request 不只是一段 Prompt

一次现代模型请求通常至少包含指令、消息和工具定义：

```json
{
  "instructions": "...",
  "input": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "tool_calls": ["..."]},
    {"role": "tool", "content": "..."}
  ],
  "tools": [
    {"name": "read_file", "input_schema": {}}
  ]
}
```

同一段文字放在 system/developer instruction、user message 或 tool result 中，权限语义、压缩方式与缓存位置可能不同。项目文件被拼在后面，不代表它能越过 Provider 的 system 指令；Tool Schema 告诉模型接口存在，也不代表模型已经拥有执行权。

模型发出 Tool Call 后，Runtime 在模型之外检查权限、执行工具，再把结果放进下一次请求。Agent 因此不是“一次很长的思考”，而是一串不断重建 Context Frame 的模型调用。

## 5. Context、Session、Memory 和 Cache 不要混用

- **Session** 保存一段交互的连续关系，内容是否进入当前请求仍受窗口与压缩策略影响。
- **Memory** 保存经筛选、准备跨任务复用的信息，只有检索命中的片段才影响本轮。
- **Compaction** 用摘要替换长历史，是有损表示，不是新的事实源。
- **Checkpoint** 保存恢复执行所需的切面，不等于回滚外部世界。
- **Prompt Cache** 复用相同前缀的推理计算，不增加任何语义内容。
- **RAG** 检索外部知识和证据，可以与 Memory 共用技术，但 Scope、权威性和删除规则不同。

Memory 的读写与治理见 [Memory Engineering](memory-engineering.md)；Prompt Cache 的计算原理见 [Prompt Cache：省下的不是 Token，而是重复计算](../notes/prompt-cache-reuses-computation.md)。

## 6. 设计时真正要定下来的东西

一套可维护的 Context Compiler 至少应明确：

1. 自动发现哪些来源，搜索边界和信任边界在哪里；
2. 全局、仓库、目录、Agent 与 Skill 指令怎样合并；
3. 每类来源以什么消息角色进入 Provider Request；
4. 单文件、单来源和整帧分别有多少 token / byte 预算；
5. 文件修改、目录访问、Skill 激活和 Session 恢复分别何时触发重载；
6. 如何记录来源、版本、截断和摘要，让某次请求可以解释；
7. 哪些规则只是给模型看的软指令，哪些必须由 Permission、Sandbox、Hook 或 CI 强制；
8. Compaction 后如何重新物化关键指令，Prompt Cache miss 时如何保持正确性。

好的 Context 不是内容最多的那一帧，而是删掉任何一段都会有明确损失、保留任何一段都有明确理由的那一帧。

## 延伸阅读

- [Agent 为什么会读这些 Markdown](../notes/agent-markdown-files-context-loading.md)
- [Agent 的状态边界](../docs/03-agent-state-semantics.md)
- [Memory Engineering](memory-engineering.md)
- [Agent 架构如何塑造 Prompt Cache](../notes/agent-architecture-shapes-prompt-cache.md)
- [MCP Server Primitives](https://modelcontextprotocol.io/specification/2026-07-28/server/index)
