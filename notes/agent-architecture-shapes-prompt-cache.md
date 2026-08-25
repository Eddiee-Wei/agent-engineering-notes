---
layout: default
title: "Agent 架构如何塑造 Prompt Cache"
nav_order: 2
description: 对比 Claude Code、Codex、Gemini CLI、OpenCode、Pi Agent 与 DeepSeek Harness 的上下文布局和缓存策略。
---

<span class="eyebrow">05 · NOTES · 02</span>

# Agent 架构如何塑造 Prompt Cache

模型供应商提供 Prompt Cache，Coding Agent 决定它是否好用。

供应商控制 KV 状态如何保存、前缀如何匹配、TTL 多长、缓存读写如何计费；Agent Harness 则控制 system prompt 如何组装、工具以什么顺序出现、项目上下文放在哪里、会话历史是否只追加、压缩和子 Agent 是否能够继承稳定前缀。

因此，同一个模型 API 放在不同 Coding Agent 后面，Prompt Cache 命中率可能完全不同。

本文比较六个实现：Claude Code、Codex、Gemini CLI、OpenCode、Pi Agent 和 DeepSeek Harness。对比基于 2026-08-24 的官方文档与当日开源源码快照；闭源服务没有公开的内部 token 序列，只讨论 API 字段和 Harness 可验证的组装逻辑。

如果还不熟悉 KV Cache、服务端恢复和 TTL，可以先读：[Prompt Cache：省下的不是 Token，而是重复计算](prompt-cache-reuses-computation.md)。

## 两层机制，不要混在一起

Prompt Cache 的效果来自两层配合。

### Provider 层

Provider 决定：

- 是自动缓存，还是要求 cache breakpoint。
- 是否接受 cache key 或显式 cache object。
- 缓存匹配的 token/block 粒度。
- TTL、路由、隔离、淘汰和计费。
- KV 如何进入模型推理 Scheduler。

### Harness 层

Harness 决定：

- System prompt 是否稳定。
- Tool definitions 是否稳定且顺序确定。
- 项目规则和环境状态插入前缀还是后缀。
- 历史记录是 append-only，还是每轮重写。
- Compaction 会从哪个 token 开始替换历史。
- Subagent 是继承父前缀，还是建立新的缓存域。

可以把有效命中率写成一个非严格公式：

```text
有效命中率
≈ Provider 缓存可用性
× 请求路由一致性
× Harness 前缀稳定性
× 会话时间局部性
```

Harness 无法决定 Provider 是否还保存 KV，但可以决定下一次请求有没有机会匹配它。

## 一个理想的 Agent 请求布局

从缓存角度看，信息应该从稳定到动态排列：

```text
Provider protocol
  Tool definitions
  Stable system instructions
  Project instructions and shared context
  Session bootstrap context
  User / assistant / tool history
  Runtime updates
  Current user input
```

这里是逻辑层次，不代表 JSON 属性的书写顺序就是模型最终 token 顺序。比如 Anthropic 明确把可缓存前缀规范为 `tools → system → messages`；OpenAI 和 Gemini 暴露的是分离字段，最终序列化由服务端负责。[Anthropic Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)

## 六个 Coding Agent 的总览

| Coding Agent | Provider 缓存方式 | Harness 的核心策略 | 主要缓存边界 |
| --- | --- | --- | --- |
| Claude Code | Anthropic 自动/显式 breakpoint | 固定系统层、项目层、追加式会话 | 工具、系统规则或项目上下文变化 |
| Codex | OpenAI 自动缓存 + `prompt_cache_key` | 会话级 key，测试保证下一轮保留上一轮完整 input 前缀 | 会话设置、权限或环境前缀变化 |
| Gemini CLI | Gemini 隐式缓存 | 稳定 `systemInstruction` 和 tools，首条 session context，随后追加 contents | 系统指令、工具、初始上下文或重试改写 |
| OpenCode | Provider-aware | Anthropic/Bedrock 等加 marker，OpenAI 使用 session key | Provider 适配、system transform、工具集合变化 |
| Pi Agent | Provider-aware | 单一确定性 system prompt，不同 Provider 分别处理 key/marker | 项目 context、skills、工具或 Provider 变化 |
| DeepSeek Harness | DeepSeek 自动磁盘前缀缓存 | 有序 Prompt sections、规范化 tools、append-only event log | Prompt composition、工具集合、surface replacement |

## Claude Code：把 Prompt 分成三层

Claude Code 官方文档直接给出了它的缓存布局：

```text
System prompt layer
  core instructions
  tool definitions
  output style

Project context
  CLAUDE.md
  auto memory
  unscoped rules

Conversation
  user messages
  Claude responses
  tool results
```

正常对话只在 Conversation 末尾追加，因此前两层可以持续命中。修改工具会让更后的 system、project context 和 conversation 一起失效；修改 CLAUDE.md 则从 Project context 开始失效。[Claude Code Prompt Caching](https://code.claude.com/docs/en/prompt-caching)

它还把几个常见 Agent 动作纳入缓存设计：

- 切换模型会进入不同缓存域。
- `/compact` 的总结请求先复用当前完整前缀，再追加总结指令。
- 压缩完成后的短历史需要重新建立 conversation cache，但 system 层仍可复用。
- Fork 可以继承父会话完全一致的前缀；独立 subagent 通常建立自己的缓存。

Claude Code 的特点是：缓存不是 Provider Adapter 的附属参数，而是与项目上下文、压缩和子任务生命周期一起设计的会话能力。

## Codex：用会话级 Key 守住追加式前缀

Codex 通过 OpenAI Responses API 发送 `prompt_cache_key`。源码中的默认 key 来自当前 session；内部子 Agent 还可以共享父 session 的 key，以提高相同前缀的路由概率。[Codex `prompt_cache_key` 源码](https://github.com/openai/codex/blob/339751715c64496cb86246bfb3935f40e309dd3d/codex-rs/core/src/client.rs#L486-L495)

Codex 请求的逻辑形状是：

```text
Top-level
  model
  instructions
  tools
  prompt_cache_key = session id

Input
  permissions / policy
  cached contextual user prefix
    AGENTS instructions
    environment context
  first user message
  assistant and tool history
  next user message
```

它的测试不只检查 key 是否稳定，还断言第二次请求必须以第一次请求的完整 `input` 为前缀，然后在末尾追加下一轮消息。工具集合也要跨轮保持一致。[Codex Prompt Caching 测试](https://github.com/openai/codex/blob/339751715c64496cb86246bfb3935f40e309dd3d/codex-rs/core/tests/suite/prompt_caching.rs#L274-L350)

这说明 Codex 的主要优化目标是单个长会话：

```text
Request 1 input

Request 2 input
= Request 1 input + new history
```

会话级 key 有利于顺序任务和同会话子任务，但天然不强调跨 session 的公共前缀复用。缓存收益主要来自历史持续增长时不重复 prefill，而不是把一份全局项目缓存无限共享给所有任务。

## Gemini CLI：依赖隐式缓存的稳定 Contents

Gemini CLI 没有在普通 Agent Loop 中创建显式 `cachedContent` 对象，而是每轮发送：

```text
GenerateContentConfig
  systemInstruction
  tools

GenerateContentRequest
  contents = full conversation history
```

源码中每次模型请求都会复用同一个 `systemInstruction` 和工具集合，并把处理后的完整 contents 传给 Gemini。[Gemini CLI 请求组装](https://github.com/google-gemini/gemini-cli/blob/5411f113cafae26161b4969b0237b8e1e024e2c2/packages/core/src/core/geminiChat.ts#L887-L940)

初始 history 通常从一条 session context 开始，承载日期、操作系统、临时目录、项目 memory 和可选目录结构。此后 conversation 和 tool call/result 向后追加。它依赖 Gemini 2.5+ 默认提供的隐式 prefix caching，而不是显式控制 cache object 的 TTL。[Gemini Context Caching](https://ai.google.dev/gemini-api/docs/caching)、[Gemini CLI Environment Context](https://github.com/google-gemini/gemini-cli/blob/5411f113cafae26161b4969b0237b8e1e024e2c2/packages/core/src/utils/environmentContext.ts)

这个布局的优点是简单，缺点是跨 session 复用受初始动态环境影响。日期或项目快照一旦位于较早位置，后面的 conversation 就无法跨 session 命中；在单个 session 内，这条初始消息保持不变，仍然可以形成稳定前缀。

## OpenCode：缓存策略属于 Provider Adapter

OpenCode 支持多个模型供应商，因此不能假设只有一种缓存协议。它先组装 system，再由 Provider Transform 决定具体缓存参数：

```text
agent/provider base prompt
user and project system fragments
plugin system transforms
conversation messages
provider-specific options
tools
```

当前实现会选择前面的 system messages 和最近的非 system messages，为不同 Provider 添加不同 marker：

```text
Anthropic / OpenRouter  cacheControl: ephemeral
Bedrock                 cachePoint
OpenAI-compatible       cache_control
Copilot                 copilot_cache_control
Alibaba                 cacheControl
```

对 OpenAI 类 Provider，它还会把 session ID 写入 `prompt_cache_key` 或 `promptCacheKey`。[OpenCode Cache Marker](https://github.com/anomalyco/opencode/blob/03521003fafdc6d340de6a36a189e3c121b07d40/packages/opencode/src/provider/transform.ts#L359-L385)、[OpenCode Provider Cache Key](https://github.com/anomalyco/opencode/blob/03521003fafdc6d340de6a36a189e3c121b07d40/packages/opencode/src/provider/transform.ts#L1250-L1320)

OpenCode 的架构结论是：Prompt Cache 属于 Provider Compatibility。Harness 提供统一会话，Adapter 负责把它翻译成 Anthropic breakpoint、OpenAI route key 或 Provider 自己的扩展字段。

这种方式覆盖面广，但缓存语义容易被最小公分母化。Provider 变更、插件修改 system、动态工具集合变化，都可能让前缀在用户不知情时重新建立。

## Pi Agent：统一 Agent Loop，分别优化 Provider

Pi 也采用 Provider-aware 设计，但缓存处理更贴近各家原生能力。

它先构造一个相对确定的 system prompt：

```text
Harness identity and behavior
Tool guidance
Custom system prompt
Project context files
Skills
Current working directory
```

然后把同一套 Agent State 交给不同 Provider Adapter：

- Anthropic：在 system block、最后一个 tool definition 和最近用户消息附近放置 `cache_control`。
- OpenAI Responses：使用 session ID 作为 `prompt_cache_key`。
- Gemini：传递 system instruction、tools 和完整历史，读取 Provider 返回的 cached token usage。

[Pi Anthropic Cache Control](https://github.com/badlogic/pi-mono/blob/4af9d21d3b4d664e4a29fcabfec85171077248e3/packages/ai/src/api/anthropic-messages.ts#L1295-L1362)、[Pi OpenAI Prompt Cache Key](https://github.com/badlogic/pi-mono/blob/4af9d21d3b4d664e4a29fcabfec85171077248e3/packages/ai/src/api/openai-responses.ts#L285-L302)

Pi 与 OpenCode 的共同点是 Provider-aware；差别在于 Pi 更明确地把缓存统计映射回统一 usage/cost 模型，让上层 Agent Loop 能用相同接口观察不同服务的 cache read 和 cache write。

## DeepSeek Harness：把 Prefix Stability 写进架构

DeepSeek Harness 不需要发送显式 cache-control，因为 DeepSeek API 会自动建立磁盘前缀缓存。它真正做的是让每轮模型输入保持可重放、可规范化。

System Prompt Registry 负责：

- Prompt sections 按显式 order 组装。
- Tool schemas 按配置顺序或名称字典序排列。
- 动态 runtime context 不混入静态 section，而是成为单独的 user-role snapshot。
- 相同工具集合生成 byte-identical 的 SDK 和说明文本。

[DeepSeek Harness System Prompt](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/core/system-prompt/README.md)

Session 则使用 append-only event log 作为事实源，LLM history 从事件流确定性派生。普通历史增长只追加，只有 surface replacement 或 compaction 才会从第一个被替换的 token 开始失去复用。[DeepSeek Harness Agent Loop](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/core/agent-loop/README.md)、[DeepSeek Harness Session](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/core/session/README.md)

它的 Compaction 也体现了缓存意识：总结请求重放相同 system、tools 和待压缩历史，再把 compaction instruction 放在末尾，使总结本身可以读取已经温热的前缀。[DeepSeek Harness Compaction](https://github.com/deepseek-ai/deepseek-harness/blob/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e/packages/compaction/compaction-basic/README.md)

六个实现中，DeepSeek Harness 最明确地把“第一个发生变化的 token 在哪里”当作组件设计约束，而不是只在 LLM Client 上添加一个缓存参数。

## 架构差异最终落在六个问题上

比较 Coding Agent 的 Prompt Cache，不应该只寻找 `cache_control` 字段。更有价值的是问下面六个问题。

### 1. 谁拥有 Prompt Assembly

集中式组装器更容易保证 section 顺序和 byte stability；插件可以任意插入 system message 的架构更灵活，但更容易在前缀前部产生漂移。

### 2. Tool Registry 是否确定

工具的名称、描述、参数 schema 和顺序都会进入可缓存前缀。即使语义相同，只要 object key 或 tool order 改变，就可能得到不同 token 序列。

### 3. Session 是追加还是重建

Append-only history 天然适合 prefix caching。每轮重新总结、重新排序或删除早期消息，会从首次变化的位置开始破坏后续缓存。

### 4. Runtime Context 放在哪里

时间戳、cwd、git 状态、权限和 IDE selection 都会变化。把它们放入最前面的 system prompt，可能让整段项目材料失效；作为后置 snapshot 追加，只影响新的 suffix。

### 5. Compaction 如何工作

压缩可以减少未来 Prompt 长度，却也会重写历史。好的策略会权衡：

```text
缩短上下文带来的长期收益
vs.
丢失温热前缀带来的短期成本
```

总结请求本身也应复用原始前缀，而不是先创建一份完全不同的 Prompt。

### 6. Subagent 是否共享前缀

继承相同 system、tools 和父历史的 fork 有机会复用父缓存；拥有独立 persona、工具集和会话头的 subagent 应视为新的缓存域。强行共享相同 key 不会让不同前缀变得相同。

## 三种主流架构路线

六个实现可以归纳成三类。

### Provider-native

代表：Claude Code、Codex、Gemini CLI。

它们围绕主要 Provider 的原生协议组织请求，能更充分利用特定平台能力，但缓存行为与该平台绑定更深。

### Provider-aware adapter

代表：OpenCode、Pi Agent。

它们用统一 Agent Loop 承载会话，在 Adapter 中翻译缓存协议。优点是跨模型，代价是必须维护不同 key、marker、usage 和 TTL 语义。

### Cache-stable runtime

代表：DeepSeek Harness。

它不强调显式缓存 API，而是通过确定性 Prompt Assembly、append-only event log、规范化 tool order 和 replay-safe compaction 提高任何 prefix cache 的可复用性。

这三类并不互斥。理想 Harness 应同时具备稳定 Runtime 和 Provider-aware Adapter，再根据主要模型使用原生能力。

## 对 Agent Harness 设计的启示

如果从零设计一个 Coding Agent，可以把下面这些规则当成缓存架构要求：

1. 为每次模型调用生成可检查的 canonical request。
2. 稳定 system、tools、schema 和共享项目上下文。
3. 对 tool definitions 和 Prompt sections 做确定性排序。
4. 把动态环境放到稳定前缀之后。
5. Session history 默认 append-only。
6. Provider Adapter 显式建模 cache key、breakpoint、TTL 和 usage。
7. Compaction 记录第一个被改写的位置，并评估缓存损失。
8. Subagent 根据继承的 prompt、tools、model 和 session 定义独立缓存域。
9. 同时观测 cache read、cache write、cache miss、首 token 延迟和任务总成本。
10. Cache miss 必须只影响性能，不能影响正确性。

## 结语

Prompt Cache 表面上位于模型 API，实际效果却由 Agent 的整个上下文架构共同决定。

Claude Code 用分层上下文维护稳定前缀；Codex 用会话 key 和追加式 input 服务长任务；Gemini CLI 把完整历史交给隐式缓存；OpenCode 与 Pi 在 Provider Adapter 中翻译缓存协议；DeepSeek Harness 则把可重放和前缀稳定性写进 Prompt、Tool、Session 与 Compaction 的组件边界。

所以评估一个 Coding Agent 的缓存能力，最有价值的问题不是：

```text
它有没有设置 prompt_cache_key？
```

而是：

```text
它能不能让下一轮请求在尽可能靠后的位置才第一次发生变化？
```

第一个变化 token 的位置，就是 Agent 架构为 Prompt Cache 留下的真实边界。
