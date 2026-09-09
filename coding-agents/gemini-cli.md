---
title: Gemini CLI
description: Gemini CLI 如何分层加载 GEMINI.md、即时发现目录指令，并经确认激活 Skill。
last_verified: 2026-09-02
---

# Gemini CLI

> 资料口径：Google 官方 Gemini CLI 文档，核对于 2026-09-02；`GEMINI.md` 页面标注最后更新于 2026-06-18，实验性能力仍应按本地版本验证。

Gemini CLI 最值得留意的不是文件名，而是它把“走进一个目录”也当成了上下文事件。`GEMINI.md` 提供持续背景，更深目录的规则等工具真正触达时才出现；Skill 还要经过一次明确同意，Custom Command 则始终由用户亲自发起。Context 随工作半径展开，而不是在开场一次性倾倒。

## 1. `GEMINI.md` 的三级层级

官方 [Project context 文档](https://geminicli.com/docs/cli/gemini-md/)给出的加载顺序是：

1. **Global**：`~/.gemini/GEMINI.md`，对所有项目生效；
2. **Environment / Workspace**：配置的 workspace 目录及其父目录中的 `GEMINI.md`；
3. **JIT context**：工具访问某个文件或目录时，从该位置向上扫描至 trusted root，发现更具体的 `GEMINI.md`。

所有已加载文件会被拼接，并随每个 Prompt 发给模型。CLI footer 会显示已加载 Context file 数量；`/memory show` 能展示当前拼接结果，`/memory reload` 强制重新扫描。

这里的 `memory` 命令名容易误导：它展示的是层级项目 Context，不等于长期向量记忆。Gemini CLI 的 Auto Memory 是另一项能力。

## 2. JIT 指令怎样进入后续请求

假设从 Monorepo 根启动，初始只装入全局和 workspace 链。模型随后读取 `packages/mobile/src/app.ts`：

```text
请求 #1
  全局 GEMINI.md + workspace GEMINI.md + 用户任务
响应 #1
  tool call: read_file(packages/mobile/src/app.ts)

Runtime
  读取文件
  扫描 app.ts 所在目录到 trusted root
  发现 packages/mobile/GEMINI.md

请求 #2
  既有历史 + 文件结果 + 新的 JIT context
```

这样局部规则只在 Agent 真正进入相应范围后付 token。trusted root 既是扫描终点也是信任边界；不能假定工具访问任意外部路径都会把沿途指令全部加载。

## 3. Import 与自定义文件名

`GEMINI.md` 支持 `@file.md` 导入相对或绝对路径，导入在 Context file 处理阶段展开。长指令可拆成 `@./rules/typescript.md`，但要考虑循环、外部路径信任与总上下文大小。

`context.fileName` 可以是一个名字或名字列表，例如：

```json
{
  "context": {
    "fileName": ["AGENTS.md", "CONTEXT.md", "GEMINI.md"]
  }
}
```

因此 Gemini CLI 可以读取 `AGENTS.md`，但这是配置出来的候选名。单数 `agent.md` 或任意 `xx.md` 仍不会自动生效，除非也显式配置、import 或用工具读取。

## 4. Skill：发现、同意、注入、再取资源

官方 [Agent Skills](https://geminicli.com/docs/cli/skills/)给出完整生命周期：

1. Session 开始扫描 Skill，只把启用 Skill 的名称和描述注入 system prompt；
2. 模型判断匹配后调用 `activate_skill`；
3. UI 显示 Skill 目的和即将开放的目录，等待用户同意；
4. 同意后，完整 `SKILL.md` 与目录结构进入对话历史；
5. Skill 目录加入允许读取的文件路径，模型随后按需读取资产。

发现优先级从低到高为：内置 → Extension → 用户 `~/.gemini/skills` / `~/.agents/skills` → Workspace `.gemini/skills` / `.agents/skills`。同一层级中 `.agents/skills` alias 优先；同名 Skill 取更高层级版本。

这是一种把 Context disclosure 与 filesystem consent 绑定起来的设计：加载正文和开放资源目录发生在同一次用户可见确认后。资源不会仅因列在目录中就全部塞进 Context。

## 5. Custom Command 与系统提示词

[Custom Commands](https://geminicli.com/docs/cli/custom-commands/)用于可参数化的斜杠命令。CLI 启动时登记命令，用户执行时才渲染模板并作为本轮输入；它不会像 `GEMINI.md` 一样每轮常驻，也不让模型自主选择。

Gemini CLI 另有系统提示词 override 能力。它改变基础 Agent 行为，而 `GEMINI.md`、Skill、历史和工具 schema 是在请求装配中继续组合的其他来源。配置系统提示词不能代替 Policy Engine 或 Sandbox，文字“禁止”仍只是模型指令。

## 6. 选择机制，也是在选择谁拥有主动权

| 需求 | 使用机制 |
| --- | --- |
| 所有项目都适用的个人偏好 | 全局 `GEMINI.md` |
| 仓库通用命令与规范 | workspace `GEMINI.md` |
| 某模块/文件类型的局部规则 | 子目录 `GEMINI.md`，让 JIT discovery 触发 |
| 某类复杂任务的完整流程 | Agent Skill |
| 用户明确发起、可带参数的一次操作 | Custom Command |
| 偶尔阅读的长架构说明 | 普通 Markdown，由 import 或文件工具读取 |

这张表背后还有一层分工：`GEMINI.md` 的主动权在项目，Skill 的主动权由模型判断和用户同意共同决定，Custom Command 的主动权完全在人。把内容放在哪里，也是在决定谁有资格让它进入下一轮。

## 参考资料

- [Gemini CLI：Provide context with GEMINI.md files](https://geminicli.com/docs/cli/gemini-md/)
- [Gemini CLI：Agent Skills](https://geminicli.com/docs/cli/skills/)
- [Gemini CLI：Custom Commands](https://geminicli.com/docs/cli/custom-commands/)
- [Gemini CLI：Policy Engine](https://geminicli.com/docs/reference/policy-engine/)
