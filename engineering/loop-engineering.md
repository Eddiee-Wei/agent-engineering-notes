---
layout: default
title: Loop Engineering
description: Designing Agent loops that plan, act, observe, verify, recover, and converge.
---

<span class="eyebrow">04.04 · EVOLUTION</span>

<h1 data-i18n data-en="Loop Engineering" data-zh="Agent 循环工程">Loop Engineering</h1>

<p data-i18n data-en="Designing execution loops that can plan, act, observe, verify, recover, and stop with a defensible result." data-zh="设计能够规划、执行、观察、校验、恢复，并以可信结果停止的执行循环。">Designing execution loops that can plan, act, observe, verify, recover, and stop with a defensible result.</p>

> 状态：todo。当前页面先建立主题边界与后续写作提纲。

## 为什么需要它

当 Agent 从单次工具调用进入多步骤任务，最大的风险不再只是某一步答错，而是循环不收敛、错误不断累积、预算失控或在没有证据时过早宣布完成。Loop Engineering 关注整个执行闭环的行为质量。

## 核心问题：一个基本闭环

`Goal → Plan → Act → Observe → Verify → Update State → Continue / Stop`

这个闭环需要明确：

- 每轮根据什么状态选择下一步。
- 工具结果怎样转换为新的证据和状态。
- 失败后重试、换方案、回滚或请求人工介入的条件。
- 如何设置完成标准、停止条件、步数和成本预算。
- 最终答案如何绑定验证证据，而不是只依赖模型自信。

## 与其他 Engineering 的关系

Loop 是“持续执行与收敛”的行为闭环；[Graph Engineering](graph-engineering.md) 是把状态、节点、分支和恢复路径显式化的控制结构。简单任务可以使用动态 Loop，复杂、长时间或高风险任务通常需要 Graph、Checkpoint 和 Human-in-the-loop 提供更强约束。

## 后续提纲

- ReAct、plan-and-execute 与反思循环
- Stop condition 与 completion contract
- Retry、fallback、rollback 与 escalation
- Budget-aware loop
- Verification-driven execution
- Loop trace 与 failure taxonomy
- 从动态循环到显式 Graph
