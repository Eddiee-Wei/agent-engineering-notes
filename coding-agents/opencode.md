---
title: OpenCode
description: OpenCode 如何选择 AGENTS.md、组合自定义 Rules，并按需加载 Skill、Agent 与 Command Markdown。
last_verified: 2026-09-02
---

# OpenCode

> 资料口径：2026-09-02 的 OpenCode 稳定版官方文档。另有 V2 preview 文档，其 instruction 行为可能不同，本文不混用两套结论。

OpenCode 的做法很务实：不试图把所有 Markdown 包装成一种神秘的“知识”。Rules 是规则，Skill 是按需能力，Command 是人触发的模板，Agent Markdown 是某个角色的配置。名字不同，是因为生命周期真的不同。

## 1. Rules：`AGENTS.md` 与兼容 fallback

稳定版 [Rules 文档](https://opencode.ai/docs/rules/)定义三类启动来源：

1. 从 cwd 向上遍历的本地规则：优先 `AGENTS.md`，没有时用 `CLAUDE.md`；
2. 全局 `~/.config/opencode/AGENTS.md`；
3. 如果全局 OpenCode 规则不存在，兼容 `~/.claude/CLAUDE.md`。

每一类取第一份命中；同一目录同时存在 `AGENTS.md` 与 `CLAUDE.md` 时只用 `AGENTS.md`。这不同于“把根到 cwd 的每级文件全部拼起来”的 Codex/Pi 模型。Claude Code 兼容可通过 `OPENCODE_DISABLE_CLAUDE_CODE` 等环境变量整体或分项关闭。

`/init` 会分析仓库并创建或改进 `AGENTS.md`，重点包括构建/测试命令、架构、项目约定和容易踩坑的操作。单数 `agent.md` 不是默认规则名。

## 2. `instructions`：显式组合任意文件与 URL

`opencode.json` 可以配置：

```json
{
  "instructions": [
    "CONTRIBUTING.md",
    "docs/guidelines.md",
    ".cursor/rules/*.md",
    "packages/*/AGENTS.md"
  ]
}
```

这些文件会与 `AGENTS.md` 合并；也可以加入远程 URL，官方实现对远程读取设置 5 秒超时。这是让任意 `xx.md` 自动生效的显式入口，同时也带来 glob 扩张、网络漂移和供应链风险，生产规则最好固定版本并限制来源。

OpenCode 的 `AGENTS.md` 本身不会自动解析 `@path` import。官方建议用 `instructions` 明确列文件；另一种做法是在规则中要求模型在满足条件时调用 `read`，但那是 Prompt 驱动的惰性行为，不是 Harness 原生 import。

## 3. Skill：目录可见，正文按需

OpenCode 在以下位置发现 `<name>/SKILL.md`：

- 项目 `.opencode/skills`、`.claude/skills`、`.agents/skills`；
- 全局 `~/.config/opencode/skills`、`~/.claude/skills`、`~/.agents/skills`。

项目发现从 cwd 向上走到 Git worktree。Harness 把可用 Skill 的名称和描述放进原生 `skill` 工具描述；模型调用 `skill({name})` 后才取得完整正文。`allow`、`deny`、`ask` 权限可按名称模式控制：deny 的 Skill 对模型隐藏，ask 会先向用户确认。

典型请求链：

```text
请求 #1：Rules + skill tool（内含 Skill 目录）
响应 #1：skill({ name: "git-release" })
Runtime：检查 skill permission，读取 SKILL.md
请求 #2：历史 + Skill tool result
响应 #2：按 Skill 执行，必要时继续 read 关联资源
```

Skill 目录中的脚本和 Reference 不会因正文加载而全部内联；模型仍需工具访问。关闭某 Agent 的 `skill` tool 后，连 `<available_skills>` 目录也会消失。

## 4. Commands 与 Agents 的 Markdown

[Commands](https://opencode.ai/docs/commands/)一般位于 `.opencode/commands/*.md`。Front Matter 配置名称、描述、Agent 或模型等，正文是模板；用户调用命令时才展开，可使用参数、shell 输出和文件引用。它是显式的一次性 Prompt 入口，不是全局 Rule。

[Agents](https://opencode.ai/docs/agents/)一般位于 `.opencode/agents/*.md`。Front Matter 定义描述、模式、模型、工具、权限等，正文成为该 Agent 的 Prompt。文件在注册阶段可被发现，但只有选中主 Agent 或委托 Subagent 时，其正文才应影响对应执行上下文。

因此不要仅凭“都是 `.md`”混用：

| 文件 | 谁触发 | 影响范围 |
| --- | --- | --- |
| `AGENTS.md` / `instructions` | OpenCode 启动装配 | 通用 Session Context |
| `skills/*/SKILL.md` | 模型调用 `skill` 或用户授权 | 后续轮次的专项流程 |
| `commands/*.md` | 用户输入命令 | 当前一次 Prompt |
| `agents/*.md` | 选择/委托 Agent | 该 Agent 的系统行为、工具与权限 |
| 普通 `xx.md` | `instructions`、Command 引用或 `read` | 被注入/读取后的请求 |

## 5. 灵活性的另一面，是输入面变宽

Rule、Agent Prompt 和 Skill 正文都是模型可见文字；真正负责 allow/deny/ask 的是 OpenCode permission。远程 instructions、Claude 兼容目录和仓库 Skill 越方便，能够影响 Agent 的来源也越多。团队应审查来源、关闭不用的兼容面，并让危险工具坚持最小权限与用户确认。

OpenCode 这套设计的启示很简单：开放生态不只意味着“能接更多东西”，也意味着必须回答“这些东西凭什么被信任”。

## 参考资料

- [OpenCode：Rules](https://opencode.ai/docs/rules/)
- [OpenCode：Agent Skills](https://opencode.ai/docs/skills/)
- [OpenCode：Commands](https://opencode.ai/docs/commands/)
- [OpenCode：Agents](https://opencode.ai/docs/agents/)
- [OpenCode：Permissions](https://opencode.ai/docs/permissions/)
