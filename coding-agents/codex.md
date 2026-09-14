---
title: Codex
description: Codex 如何构建 AGENTS.md 指令链，并用渐进式 Skill 把流程与资源注入任务。
last_verified: 2026-09-02
---

# Codex

> 资料口径：OpenAI 官方 [AGENTS.md 文档](https://learn.chatgpt.com/zh-Hans/docs/agent-configuration/agents-md)与[自定义能力总览](https://learn.chatgpt.com/zh-Hans/docs/customization/overview)，核对于 2026-09-02。产品迭代较快，路径与默认上限仍应以本地版本为准。

Codex 对“长期知道什么”和“临时学会什么”给出了朴素的分工：`AGENTS.md` 是沿目录继承的项目秩序，Skill 是书架上的专项手册。前者在动手前就要读，后者只在任务需要时翻开。

## 1. `AGENTS.md` 的搜索与覆盖

Codex 每次运行先构建一条指令链。

### 1.1 全局层

在 Codex home（默认 `~/.codex`）中：

1. 如果 `AGENTS.override.md` 存在且非空，使用它；
2. 否则使用非空的 `AGENTS.md`；
3. 这一层只取第一份有效文件。

全局文件适合个人跨仓库偏好，不应存项目秘密或团队必须共享的唯一规则。

### 1.2 项目层

Codex 从项目根沿目录树走到当前工作目录。每一级目录按下列顺序选择**至多一份**：

1. `AGENTS.override.md`；
2. `AGENTS.md`；
3. 配置的 fallback 文件名。

最后按根 → cwd 的顺序拼接，所以更具体目录的文本更靠后。`AGENTS.override.md` 只替代同目录候选，不会清空父目录指令。项目文档总量受 `project_doc_max_bytes` 限制，默认 32 KiB；到达上限后应拆分范围或调整配置，而不是假定所有尾部内容仍可见。

`agent.md` 单数不是官方默认名。若团队必须兼容遗留文件，可把它配置为 fallback；否则它只是一份普通 Markdown。

## 2. 什么时候读取、什么时候重新读取

官方定义是：Codex 在开始工作前建立从全局到 cwd 的指令链。可把首轮逻辑理解为：

```text
OpenAI / Codex 固定系统与开发者指令
+ 全局 AGENTS 指令
+ 项目根 AGENTS 指令
+ ...
+ cwd AGENTS 指令
+ 当前用户请求
+ 当前可用工具 schema
```

当前运行不是一个持续监听所有目录的文件 watcher。修改 `AGENTS.md`、切换 cwd 或进入另一个范围后，若需要确定新链已生效，应新开运行/Session，并通过 Codex 的可见配置或测试 Prompt 核对。不要把其他产品的“读到子目录时 JIT 加载”行为套到 Codex 上。

项目文件内容由 Harness 放入模型上下文，但其权限不高于真正的 system/developer/user 指令。文本里写“允许联网”也不会改变 Sandbox 或审批策略；真正权限由 Codex Runtime 配置执行。

## 3. Skill 的渐进式加载

当前官方文档把 Skill 描述为一个以 `SKILL.md` 为入口的目录，可附带 `references/`、`scripts/`、模板和资产。常见位置是用户级 `~/.agents/skills` 与仓库级 `.agents/skills`。

加载分三层：

1. **发现层**：启动时只把 Skill 的 `name`、`description` 等元数据放入可发现目录；
2. **指令层**：用户点名 Skill，或模型根据描述判断任务命中后，读取完整 `SKILL.md`；
3. **资源层**：只在流程需要时读取关联参考文件、运行脚本或复用模板。

这和 `AGENTS.md` 的成本模型不同：`AGENTS.md` 适合每次都必须知道的短信息；Skill 适合“仅做文档、发布、评审时才执行”的长流程。

## 4. Prompt、普通文件与工具结果

用户当前输入是本轮最直接的 Prompt；`AGENTS.md` 提供稳定背景；Skill 提供被选中的复用流程。任意 `design.md`、`xx.md` 默认不会自动进入请求，除非：

- 用户直接附上或要求读取；
- `AGENTS.md` / `SKILL.md` 明确指示在特定条件下读取；
- Agent 通过文件工具读取，结果从后续模型请求开始可见。

工具本身也要分两部分：模型收到工具名、描述和参数 schema；工具实现、环境变量、账号凭据、文件系统权限都留在 Runtime。一次 Coding Agent 任务可能反复经历“请求 → tool call → 执行 → tool result → 下一次请求”，所以某份 Reference 是否生效，要看它是否已经产生 tool result。

## 5. 怎样写，才能让层级真正有用

- 根 `AGENTS.md` 写仓库结构、通用构建命令与全局验收要求。
- 子目录 `AGENTS.md` 只写该范围的差异，不重复根规则。
- 临时个人差异用全局文件或未提交的 override，团队规则提交普通 `AGENTS.md`。
- 多步骤专项流程做成 Skill，长资料下沉到 Skill reference。
- 用 Runtime 的 Sandbox、approval、network policy 强制安全边界，不依赖 Markdown 承诺。

目录层级的意义不是让同一句话出现四遍，而是让规则在最接近责任边界的地方出现。根文件负责共同语言，子目录只声明差异，Skill 保存不必人人背诵的流程。这样，Codex 读到的不是一堵越来越厚的规则墙，而是一条随工作范围逐渐收窄的路径。

## 参考资料

- [OpenAI Codex：使用 AGENTS.md 自定义指令](https://learn.chatgpt.com/zh-Hans/docs/agent-configuration/agents-md)
- [OpenAI Codex：自定义能力总览](https://learn.chatgpt.com/zh-Hans/docs/customization/overview)
