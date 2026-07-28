---
layout: default
title: Agent Engineering
description: A working map of Prompt, Context, Harness, Loop, and the engineering disciplines around production Agent systems.
---

<span class="eyebrow">04 · AGENT ENGINEERING</span>

<h1 data-i18n data-en="Agent Engineering" data-zh="Agent 工程">Agent Engineering</h1>

<p data-i18n data-en="A working map of the methods used to make Agent systems controllable, capable, observable, and reliable." data-zh="整理让 Agent 系统变得可控、可用、可观察、可持续演进的工程方法。">A working map of the methods used to make Agent systems controllable, capable, observable, and reliable.</p>

<p data-i18n data-en="The main thread follows Prompt, Context, Harness, and Loop Engineering. Supporting topics cover tools, memory, knowledge, graphs, collaboration, evaluation, observability, safety, and production." data-zh="主线从 Prompt、Context、Harness 走向 Loop Engineering；支撑专题覆盖工具、记忆、知识、图、多 Agent、评测、可观测性、安全与生产化。">The main thread follows Prompt, Context, Harness, and Loop Engineering. Supporting topics cover tools, memory, knowledge, graphs, collaboration, evaluation, observability, safety, and production.</p>

> 这里的四阶段是用于组织内容的阶段性观察，不代表行业已有统一断代。后一个阶段也不会取代前一个阶段，而是逐层扩大工程控制面。

## Evolution

<div class="engineering-flow" aria-label="Agent Engineering 演进阶段">
  <a class="engineering-stage" href="{{ '/engineering/prompt-engineering/' | relative_url }}">
    <span class="stage-time">2023</span>
    <strong>Prompt</strong>
    <small>Engineering</small>
  </a>
  <a class="engineering-stage" href="{{ '/engineering/context-engineering/' | relative_url }}">
    <span class="stage-time" data-i18n data-en="2025 H1" data-zh="2025 上半年">2025 H1</span>
    <strong>Context</strong>
    <small>Engineering</small>
  </a>
  <a class="engineering-stage" href="{{ '/engineering/harness-engineering/' | relative_url }}">
    <span class="stage-time" data-i18n data-en="2025 H2–2026 Early" data-zh="2025 下半年–2026 年初">2025 H2–2026 Early</span>
    <strong>Harness</strong>
    <small>Engineering</small>
  </a>
  <a class="engineering-stage" href="{{ '/engineering/loop-engineering/' | relative_url }}">
    <span class="stage-time" data-i18n data-en="2026 Mid" data-zh="2026 年中">2026 Mid</span>
    <strong>Loop</strong>
    <small>Engineering</small>
  </a>
</div>

<p class="timeline-note" data-i18n data-en="Prompt shapes a single interaction. Context builds the information environment. Harness provides an execution environment. Loop turns those capabilities into sustained, observable execution." data-zh="Prompt 塑造单次交互，Context 构建信息环境，Harness 提供可操作的执行环境，Loop 再把这些能力组织成持续、可观察的执行闭环。">Prompt shapes a single interaction. Context builds the information environment. Harness provides an execution environment. Loop turns those capabilities into sustained, observable execution.</p>

## Capability Foundations

<div class="card-grid">
  <a class="card" href="{{ '/engineering/tool-engineering/' | relative_url }}">
    <span class="card-kicker">Capability</span>
    <h3>Tool Engineering</h3>
    <p data-i18n data-en="Schemas, selection, execution contracts, errors, permissions, and idempotency." data-zh="工具 Schema、选择、执行契约、错误处理、权限与幂等性。">Schemas, selection, execution contracts, errors, permissions, and idempotency.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/engineering/memory-engineering/' | relative_url }}">
    <span class="card-kicker">State</span>
    <h3>Memory Engineering</h3>
    <p data-i18n data-en="What to remember, when to write, how to recall, and when to forget." data-zh="记住什么、何时写入、如何召回，以及何时遗忘。">What to remember, when to write, how to recall, and when to forget.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/engineering/knowledge-engineering/' | relative_url }}">
    <span class="card-kicker">Knowledge</span>
    <h3>Knowledge Engineering</h3>
    <p data-i18n data-en="Sources, indexing, retrieval, citations, freshness, and evidence quality." data-zh="知识来源、索引、检索、引用、时效性与证据质量。">Sources, indexing, retrieval, citations, freshness, and evidence quality.</p>
    <span class="status">todo</span>
  </a>
</div>

## Orchestration &amp; Collaboration

<div class="card-grid">
  <a class="card" href="{{ '/engineering/graph-engineering/' | relative_url }}">
    <span class="card-kicker">Control Flow</span>
    <h3>Graph Engineering</h3>
    <p data-i18n data-en="Explicit state, nodes, branches, checkpoints, recovery, and human decisions." data-zh="显式状态、节点、分支、Checkpoint、恢复与人工决策。">Explicit state, nodes, branches, checkpoints, recovery, and human decisions.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/engineering/multi-agent-engineering/' | relative_url }}">
    <span class="card-kicker">Collaboration</span>
    <h3>Multi-Agent Engineering</h3>
    <p data-i18n data-en="Roles, delegation, communication, shared state, conflicts, and parallel work." data-zh="角色、委派、通信、共享状态、冲突处理与并行工作。">Roles, delegation, communication, shared state, conflicts, and parallel work.</p>
    <span class="status">todo</span>
  </a>
</div>

## Quality, Safety &amp; Production

<div class="card-grid">
  <a class="card" href="{{ '/engineering/evaluation-engineering/' | relative_url }}">
    <span class="card-kicker">Quality</span>
    <h3>Evaluation Engineering</h3>
    <p data-i18n data-en="Datasets, rubrics, regression tests, judges, and online evaluation." data-zh="数据集、Rubric、回归测试、Judge 与在线评测。">Datasets, rubrics, regression tests, judges, and online evaluation.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/engineering/observability-engineering/' | relative_url }}">
    <span class="card-kicker">Operations</span>
    <h3>Observability Engineering</h3>
    <p data-i18n data-en="Traces, events, logs, metrics, cost, latency, and failure attribution." data-zh="Trace、Event、日志、指标、成本、延迟与失败归因。">Traces, events, logs, metrics, cost, latency, and failure attribution.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/engineering/safety-engineering/' | relative_url }}">
    <span class="card-kicker">Control</span>
    <h3>Safety Engineering</h3>
    <p data-i18n data-en="Permissions, sandboxes, injection defenses, approvals, and data boundaries." data-zh="权限、Sandbox、注入防护、审批与数据边界。">Permissions, sandboxes, injection defenses, approvals, and data boundaries.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/engineering/production-engineering/' | relative_url }}">
    <span class="card-kicker">Reliability</span>
    <h3>Production Engineering</h3>
    <p data-i18n data-en="Reliability, scalability, budgets, fallbacks, releases, and operations." data-zh="可靠性、扩展性、预算、降级、发布与运营。">Reliability, scalability, budgets, fallbacks, releases, and operations.</p>
    <span class="status">todo</span>
  </a>
</div>
