---
title: CrewAI
description: Notes on CrewAI agents, tasks, crews, processes, and flows.
---

<h1>CrewAI</h1>

<blockquote><p data-i18n data-en="Status: todo" data-zh="状态：todo">Status: todo</p></blockquote>

<h2 data-i18n data-en="Positioning" data-zh="定位">Positioning</h2>

<p data-i18n data-en="CrewAI is a Python framework for multi-agent automation. Its design separates autonomous collaboration through Crews from precise, event-driven orchestration through Flows." data-zh="CrewAI 是一个面向多 Agent 自动化的 Python 框架。它把通过 Crews 完成的自主协作，与通过 Flows 完成的精确、事件驱动编排区分开来。">CrewAI is a Python framework for multi-agent automation. Its design separates autonomous collaboration through Crews from precise, event-driven orchestration through Flows.</p>

<h2 data-i18n data-en="Two Core Abstractions" data-zh="两个核心抽象">Two Core Abstractions</h2>

<ul>
  <li data-i18n data-en="Crews combine role-based Agents, Tasks, and Processes for autonomous collaboration." data-zh="Crews 将角色化的 Agent、Task 与 Process 组合起来，完成偏自主的协作。">Crews combine role-based Agents, Tasks, and Processes for autonomous collaboration.</li>
  <li data-i18n data-en="Flows provide event-driven control, state management, routing, persistence, and the ability to embed Crews." data-zh="Flows 提供事件驱动控制、状态管理、路由、持久化，并且可以在流程中嵌入 Crews。">Flows provide event-driven control, state management, routing, persistence, and the ability to embed Crews.</li>
</ul>

<h2 data-i18n data-en="Questions to Explore" data-zh="准备关注的问题">Questions to Explore</h2>

<ul>
  <li data-i18n data-en="The boundaries between Agent, Task, Crew, and Process." data-zh="Agent、Task、Crew 与 Process 的职责边界。">The boundaries between Agent, Task, Crew, and Process.</li>
  <li data-i18n data-en="Control models for sequential and hierarchical processes." data-zh="Sequential 与 Hierarchical Process 的控制方式。">Control models for sequential and hierarchical processes.</li>
  <li data-i18n data-en="State, routers, persistence, and resume behavior in Flows." data-zh="Flow 的 State、Router、Persistence 与 Resume。">State, routers, persistence, and resume behavior in Flows.</li>
  <li data-i18n data-en="Tools, memory, knowledge, guardrails, and human-in-the-loop." data-zh="Tool、Memory、Knowledge、Guardrail 与 Human-in-the-loop。">Tools, memory, knowledge, guardrails, and human-in-the-loop.</li>
  <li data-i18n data-en="Tracing, observability, and production deployment." data-zh="Trace、Observability 与生产部署。">Tracing, observability, and production deployment.</li>
  <li data-i18n data-en="Comparisons with AutoGen, LangGraph, Agno, and tRPC-Agent-Go." data-zh="与 AutoGen、LangGraph、Agno 和 tRPC-Agent-Go 的对照。">Comparisons with AutoGen, LangGraph, Agno, and tRPC-Agent-Go.</li>
</ul>

<h2 data-i18n data-en="Experiments" data-zh="实验">Experiments</h2>

<ul>
  <li data-i18n data-en="☐ Build a minimal Crew in which two Agents complete research and verification." data-zh="☐ 最小 Crew：两个 Agent 完成一次研究与校验。">☐ Build a minimal Crew in which two Agents complete research and verification.</li>
  <li data-i18n data-en="☐ Implement the same task once with a Crew and once with a Flow." data-zh="☐ 使用 Crew 与 Flow 分别实现同一任务。">☐ Implement the same task once with a Crew and once with a Flow.</li>
  <li data-i18n data-en="☐ Record state recovery, failure retries, and traces." data-zh="☐ 记录状态恢复、失败重试和 Trace。">☐ Record state recovery, failure retries, and traces.</li>
  <li data-i18n data-en="☐ Compare the boundaries of autonomous collaboration and deterministic orchestration." data-zh="☐ 对照自主协作与确定性编排的适用边界。">☐ Compare the boundaries of autonomous collaboration and deterministic orchestration.</li>
</ul>

<h2 data-i18n data-en="Official Sources" data-zh="官方资料">Official Sources</h2>

- [CrewAI Documentation](https://docs.crewai.com/)
- [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI)
