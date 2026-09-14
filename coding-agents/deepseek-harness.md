---
title: DeepSeek Harness
description: DeepSeek Harness 如何把工作区指令做成可回放的 Session 内容，并在文件触达后增量刷新。
last_verified: 2026-09-02
---

# DeepSeek Harness

> 资料口径：[DeepSeek Harness `master`](https://github.com/deepseek-ai/deepseek-harness)，核对于 2026-09-02。项目仍标注为 Developer Preview，当前包契约不应被理解成永久稳定 API。

DeepSeek Harness 做了一个少见却很重要的选择：它不把工作区指令当成每轮临时拼接的幕后文字，而把它们当成 **durable conversation content**。初始 `AGENTS.md` / `CLAUDE.md` 链带着来源进入 Session；后来发现、修改或删除一份指令，也会留下新的历史记录。Context 不再是一团无法追溯的“当前值”，而是一串解释得出变化原因的事件。

## 1. 默认会发现哪些文件

官方 [`dsh-agent-instructions`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/context/agent-instructions/README.md) 默认配置是：

| 作用域 | 候选文件 | 行为 |
| --- | --- | --- |
| 用户全局 | `$DSH_HOME/AGENTS.md`，`DSH_HOME` 默认 `~/.dsh` | 放在项目链之前；没有全局 local overlay |
| 项目每级目录 | `AGENTS.md`、`CLAUDE.md` | 都是 base candidate；同目录裁剪后内容完全相同则只渲染一次 |
| 项目每级目录 | `AGENTS.local.md`、`CLAUDE.local.md` | 作为 additive local overlay，在 base 后加载 |
| 项目根 | 默认由 `.git` 标记 | 从根到 Session cwd，按宽到窄排列 |

候选名、根标记、`dshHome` 与预算都能配置。小写文件名、`.claude/rules/` 和 `@path` import 默认**不会**被解释。

## 2. 第一轮：Baseline 如何进入请求

在 Session 的第一个 eligible `agent/pre-step`，插件组合全局文件与“项目根 → cwd”指令链，把它折叠到进入批次中，紧跟已认领的用户消息。模型看到的是一个 `<system-reminder>` 包装的普通 `user/message`，其中明确说明更具体指令优先，但不能覆盖 system、developer 或直接用户指令。

```text
Session durable history
  用户任务
  user-role workspace baseline
    ~/.dsh/AGENTS.md
    <repo>/AGENTS.md
    <repo>/packages/CLAUDE.md

每个 step 的 system-prompt assembly
  Harness identity + persona + 动态 runtime context + tool guidance

Provider Request
  system prompt + derived history + 当前工具 schema
```

这与“把仓库文本拼进最高权限 system message”不同。Baseline 会随历史回放、压缩和恢复，并带 typed source 供 Runtime 重建可见状态。

## 3. 目录触达后的即时增量加载

首次请求只包含 cwd 祖先链。成功的第一方 `read`、`write`、`edit` 工具如果触达更深目录，会在当前 step 持久化后触发 reconcile；下一次模型请求再加入：

- 新目录适用的指令；
- 已变化文件的替换内容；
- 文件消失或变成重复候选时的 removal notice。

未变化且 digest 相同的路径不会重复注入。`bash` 中的 `cd` 不触发发现，因为每次 shell 是独立进程，解析任意 shell 语法也不是可靠的文件系统边界。系统没有文件 watcher；外部编辑要等下一次成功文件触达或恢复时 reconcile 才可见。

这套时序意味着：

```text
请求 #1：根目录 baseline
响应 #1：read("packages/web/src/app.ts")
Runtime：工具成功，并发现 packages/web/AGENTS.md
请求 #2：历史 + 新的 scoped instruction message + 文件结果
```

## 4. 预算、截断与 Prompt Cache

`dsh-base` 默认给完整指令 Baseline 65,536 bytes，单源默认上限 1,048,576 bytes。超过总预算时先丢弃更宽泛的完整文件，最后才截断最具体文件，并向模型显示被省略/截断的路径。

Baseline 作为追加的 durable history 消息存在。新增、变更与移除也继续追加到历史尾部，因此既有请求前缀可保持稳定；压缩后则由 Session 的可见状态与 baseline identity 协助恢复。这里的缓存友好性来自 append-only 位置，不代表 Provider 一定提供或命中 Prompt Cache。

## 5. System Prompt、Tool schema 与 Skill 是另外三条管线

[`dsh-system-prompt`](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/system-prompt/README.md) 在每个 step 调一次 `assemble()`：

- 固定 Harness identity、部署 persona、动态 cwd/model 等变量按 order 渲染；
- Plugin 可注册静态或动态 section；
- 当前有效工具的 schema 同步装配；
- Agent-scoped contribution 可遮蔽同名 global contribution。

因此项目指令的 durable user message 与每步重建的 system prompt 不应混为一谈。

Skill 也采用渐进式发现：[`Skills subsystem`](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/skills.md)先提供名称与描述目录，模型通过 Skill 工具取得正文；关联资源再按需使用。普通 `xx.md` 则需文件引用 Context、Skill 或工具明确读取后，才能成为下一轮 Observation。

## 6. 真正的收益是可追溯

仓库可控制的指令依然是不可信输入。DeepSeek Harness 会转义可能提前关闭 `<system-reminder>` 的字面文本，但候选文件的最终符号链接仍可能伸出信任边界；不可信仓库仍需 filesystem policy gate 或 OS Sandbox。

这套设计更深的价值不只是“支持嵌套 AGENTS.md”，而是让 Context 也拥有来源、digest、预算和生效轮次。模型为何在某一步改变行为，不必只靠猜 Prompt；系统可以回到那一刻，回答究竟是哪份指令刚刚进入了它的世界。

## 参考资料

- [DeepSeek Harness：Agent Instructions](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/context/agent-instructions/README.md)
- [DeepSeek Harness：Context Group](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/context/README.md)
- [DeepSeek Harness：System Prompt Assembly](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/system-prompt/README.md)
- [DeepSeek Harness：Skills Subsystem](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/skills.md)
