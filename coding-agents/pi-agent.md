---
title: Pi Agent
description: Pi 如何在启动时装配 AGENTS.md、按需读取 Skill，并在调用时展开 Prompt 模板。
last_verified: 2026-09-02
---

# Pi Agent

> 资料口径：[Pi Coding Agent `main`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md)，核对于 2026-09-02。

Pi 的价值，恰好在于它没有急着把一切都藏进“智能”里。常驻项目指令、按需 Skill、用户触发的 Prompt Template 是三条清楚的路：什么应该一直在场，什么应该临时请进来，什么必须由人亲自发起，边界一目了然。

## 1. 同是 Markdown，走的是三条路

| 类型 | 默认位置 | 何时读取全文 | 进入请求的方式 |
| --- | --- | --- | --- |
| Context file | `~/.pi/agent/AGENTS.md`、祖先目录与 cwd 中的 `AGENTS.md` / `CLAUDE.md` | 启动时 | 追加到本次运行使用的 system prompt |
| Skill | `~/.pi/agent/skills`、`~/.agents/skills`、项目 `.pi/skills`、`.agents/skills` | 启动扫描元数据；模型决定使用后再读正文 | Skill 目录先进入 system prompt，正文经 `read` 工具成为后续上下文 |
| Prompt Template | `~/.pi/agent/prompts/*.md`、项目 `.pi/prompts/*.md` | 用户输入 `/name` 时 | 展开成用户本轮 Prompt，可带参数 |

普通 `xx.md` 不会被自动扫描。它只有被 Context file 引用并要求读取、被 Skill 流程引用、被用户点名，或被模型调用 `read` 后，内容才会在下一次模型调用中可见。

## 2. `AGENTS.md` / `CLAUDE.md` 的发现算法

Pi 启动时读取：

1. 全局 `~/.pi/agent/AGENTS.md`；
2. 从当前目录向上经过的父目录；
3. 当前目录。

各目录命中的 Context file 会被拼接。若某个目录存在 `AGENTS.override.md`，它会在**该目录**替代 `AGENTS.md` 或 `CLAUDE.md`；其他目录的指令仍参与拼接。CLI 的 `--no-context-files` / `-nc` 可以关闭这套发现。

这里有三个容易误读的点：

- Pi 原生名称是 `AGENTS.md`，不是单数 `agent.md`；`CLAUDE.md` 是兼容候选。
- `AGENTS.override.md` 是目录内替代，不是关闭整个祖先链。
- 官方说明是“at startup”。运行中修改文件后，不应假定旧 Session 已自动重载；重新启动运行最可靠。

Pi 还支持 `~/.pi/agent/SYSTEM.md` / `.pi/SYSTEM.md` 覆盖系统提示词，以及对应的 `APPEND_SYSTEM.md` 追加内容。CLI `--system-prompt` 会替换默认系统提示词，但 Context files 和 Skills 仍会追加；这说明“基础系统提示词”与“资源加载”在 Harness 中是两层配置。

## 3. 第一次模型请求怎样形成

可以把 Pi 的初始装配简化为：

```text
默认或自定义 SYSTEM
+ APPEND_SYSTEM
+ 从全局到 cwd 的 Context files
+ Available Skills（名称、描述、路径）
+ 当前用户消息
+ read / write / edit / bash 等工具 schema
```

不同 Provider 会把这套逻辑结构映射为各自的 system/messages/tools 字段。项目文件不会直接变成更高权限的 Provider system policy；它只是 Pi 选择加入的模型可见指令。真正的工具权限与执行行为仍由 Harness 和扩展控制。

## 4. Skill 为什么不是“另一份常驻 AGENTS.md”

Pi 按 [Skills 文档](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)扫描 `SKILL.md` 的 Front Matter，把名称、描述和路径放入 system prompt。模型先看到能力目录，任务匹配时再使用 `read` 工具加载完整 `SKILL.md`；Skill 中引用的 `references/`、脚本或资产继续按需读取或执行。

典型时序是：

```text
请求 #1：项目指令 + Skill 目录
响应 #1：read(".../skills/release/SKILL.md")
请求 #2：历史 + SKILL.md 工具结果
响应 #2：按流程继续，必要时再读 references/checklist.md
```

用户也可把 Skill 作为命令显式触发。两种入口的差别在“谁做选择”，不是正文能否进入 Context：模型自主选择适合开放式任务；用户命令适合需要确定采用某套流程的任务。

## 5. Prompt Template 的时机

[Prompt Templates](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/prompt-templates.md)在启动时被登记为斜杠命令，但模板正文只有用户执行 `/name [args]` 时才展开。它更像参数化的用户请求：

- 适合 `/review 123`、`/release v2.1` 这类显式任务；
- 不会像 `AGENTS.md` 一样自动影响每个任务；
- 也不像 Skill 那样先让模型根据描述自主判断是否加载。

## 6. 这种克制带来了什么

Pi 的分层不是功能少，而是拒绝让“自动加载”变成一团看不见的背景。常驻文件只留每次都需要的事实，专项流程交给 Skill，一次性入口交给 Prompt Template，长文档安静地待在 Reference 里。

代价也很坦率：按需读取会多一次模型—工具往返，模型也可能没有选中本该使用的 Skill。但这比把所有知识永久塞进 system prompt 更容易观察和修正。对于上下文工程，能说清楚一段文字为何在场，往往比让它永远在场更重要。

## 参考资料

- [Pi Coding Agent README：Context Files 与 CLI](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/README.md)
- [Pi Agent Skills](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/skills.md)
- [Pi Prompt Templates](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/prompt-templates.md)
- [Pi Resource Loader 源码](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/resource-loader.ts)
