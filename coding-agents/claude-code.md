---
title: Claude Code
description: Claude Code 如何组合 CLAUDE.md、Rules、Auto Memory 与按需 Agent Skills。
last_verified: 2026-09-02
---

# Claude Code

> 资料口径：Claude Code 官方 [Memory](https://code.claude.com/docs/en/memory) 与 [Skills](https://code.claude.com/docs/en/skills) 文档，核对于 2026-09-02。

Claude Code 的成熟之处，不是支持了多少种 Markdown，而是承认上下文本来就有不同的寿命。组织规则要长久，个人偏好要私有，模块规范应等走进目录后再出现，专项流程只在任务命中时展开，模型自己学到的经验则进入另一套 Memory。它们不该挤在同一份 `CLAUDE.md` 里。

## 1. `CLAUDE.md` 的四级作用域

官方加载顺序从宽到窄：

| 作用域 | 位置 | 典型内容 |
| --- | --- | --- |
| Managed policy | macOS `/Library/Application Support/ClaudeCode/CLAUDE.md`；Linux/WSL `/etc/claude-code/CLAUDE.md`；Windows 安装目录 | 组织统一规则 |
| User | `~/.claude/CLAUDE.md` | 个人跨项目偏好 |
| Project | `./CLAUDE.md` 或 `./.claude/CLAUDE.md` | 团队共享的架构、命令与规范 |
| Local | `./CLAUDE.local.md` | 当前项目的个人环境信息，通常 gitignore |

启动时，Claude Code 读取 cwd 及其祖先目录中的 `CLAUDE.md` / `CLAUDE.local.md`。广泛作用域先进入 Context，更具体指令随后进入。

`CLAUDE.md` 是 Claude Code 原生名称；`AGENTS.md` 不是持续原生发现文件。需要共享一套内容时，可以在 `CLAUDE.md` 中 `@AGENTS.md` 导入，或使用符号链接；`/init` 可能一次性参考其他 Agent 配置生成建议，但这不等于以后每次原生读取 `AGENTS.md`。

## 2. 子目录与 imports 何时加载

与只在启动时冻结祖先链的实现不同，Claude Code 在读取某个子目录的文件时，会按需加载该目录相关的 `CLAUDE.md`。这让 Monorepo 的局部规则直到实际进入模块才占用 Context。

`CLAUDE.md` 还支持 `@path` import：

- 路径相对当前指令文件解析，也可以引用其他位置；
- import 在加载指令文件时展开，递归深度最多 4 层；
- 首次引用项目外文件会要求用户批准；
- HTML comment 会从注入内容中移除。

普通 `xx.md` 只有被 import 或文件工具读取才会生效。仅写一段人类看得懂的路径，不代表 Harness 会自动展开。

## 3. `.claude/rules`：按主题和路径拆分

项目可把规则拆到 `.claude/rules/*.md`。没有 `paths` Front Matter 的规则在启动时加载；带路径范围的规则在 Claude 读取匹配文件时才进入 Context。它比在一个超长 `CLAUDE.md` 中堆所有语言规范更节省 token，也更清楚地表达适用范围。

这里的“按路径加载”仍是 Context 行为，不是权限系统。若某路径禁止编辑，应再配置 Hook、settings、Sandbox 或外部检查强制执行。

## 4. Auto Memory 不是项目指令

Auto Memory 由 Claude 自动维护，按仓库存放在 `~/.claude/projects/<project>/memory`，跨 worktree 共享。每个 Session 会加载前 200 行或 25 KiB。它适合保存模型从纠正中学到的偏好和难以从代码推导的项目知识，而不是替代团队审阅的 `CLAUDE.md`。

二者主要差异：

- `CLAUDE.md` 由人编写，作用域可为组织、用户、项目和本地；
- Auto Memory 由 Claude 更新，按仓库保存；
- 两者都在 Session 开始进入 Context，也都消耗 token；
- 敏感信息、时效性事实和必须强制的 Policy 都不应无审查地交给 Auto Memory。

## 5. Agent Skills 的读取时机

Skill 是任务触发的能力包。Claude Code 先利用 Front Matter 中的名称和描述判断是否相关；命中后才加载完整 `SKILL.md`。Skill 可以由 Claude 自主调用，也可以由用户执行 `/skill-name`；正文能引用支持文件和脚本，后者继续按需读取或执行。

对比：

```text
CLAUDE.md / 无路径 Rule：每个 Session 的基础上下文
路径 Rule：读取匹配文件时加入
Skill 元数据：用于发现
SKILL.md 正文：任务命中或用户调用时加入
普通 Reference：被 import 或 read 后加入
```

如果一段内容是“任何任务都必须知道的 5 条规则”，放 `CLAUDE.md`；如果是“发布版本时执行的 30 步流程”，放 Skill；如果只是 200 行 API 说明，让 Skill 或常驻规则在需要时指向 Reference。

## 6. Agent 定义与请求装配

Claude Code 的自定义 Subagent Markdown 还会用 Front Matter 声明名称、描述、工具、模型等，正文作为该 Agent 的系统指令。它只在对应 Agent 被选择/委托时使用，不会因为文件存在就注入主 Agent 每一轮。

一次请求的逻辑组成是：Claude Code 固定系统指令 + 当前 Agent 指令 + 已生效的 CLAUDE/Rule/Memory 内容 + 对话历史 + 当前用户消息 + 当前工具 schema。工具结果在 Runtime 执行完成后加入后续请求。长 Session 发生压缩时，旧内容可能以摘要而不是原文继续存在。

## 7. 最后一条边界：记得住，不代表管得住

官方明确说明 `CLAUDE.md` 是 Context，不是强制配置。仓库规则、Skill、import 和 Auto Memory 都可能过时，也可能带着恶意文本；工具 allow/deny、Hook、Sandbox、凭据与代码审查才是可执行边界。

Claude Code 把外部 import 交给用户审批，其实揭示了一个更普遍的原则：**模型能理解一份材料，不代表系统已经授权它读取；模型记住一条禁令，也不代表系统已经执行这条禁令。**

## 参考资料

- [Claude Code：How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Claude Code：Extend Claude with skills](https://code.claude.com/docs/en/skills)
- [Claude Code：Create custom subagents](https://code.claude.com/docs/en/sub-agents)
