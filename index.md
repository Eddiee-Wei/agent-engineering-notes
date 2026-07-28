---
layout: default
title: Home
page_class: home
description: Notes from the day-to-day work of an Agent engineer.
---

<section class="hero">
  <span class="eyebrow" data-i18n data-en="AGENT ENGINEERING NOTES · CONTINUOUSLY UPDATED" data-zh="AGENT ENGINEERING NOTES · 持续更新">AGENT ENGINEERING NOTES · CONTINUOUSLY UPDATED</span>
  <h1>
    <span data-lang="en">Agent Systems,<br>Applications &amp; Engineering</span>
    <span data-lang="zh">Agent 系统、应用<br>与工程方法</span>
  </h1>
  <p data-i18n data-en="Notes from the day-to-day work of an Agent engineer." data-zh="一个 Agent 开发工程师的日常分享。">Notes from the day-to-day work of an Agent engineer.</p>
  <div class="hero-actions">
    <a class="button primary" href="{{ '/agent/' | relative_url }}" data-i18n data-en="Agent Introduction" data-zh="Agent 介绍">Agent Introduction</a>
    <a class="button" href="{{ '/agent-framework/' | relative_url }}" data-i18n data-en="Agent Framework" data-zh="Agent 框架">Agent Framework</a>
    <a class="button" href="{{ '/agent-application/' | relative_url }}" data-i18n data-en="Agent Application" data-zh="Agent 应用">Agent Application</a>
    <a class="button" href="{{ '/engineering/' | relative_url }}" data-i18n data-en="Agent Engineering" data-zh="Agent 工程">Agent Engineering</a>
  </div>
</section>

<div class="section-heading">
  <h2 data-i18n data-en="Layers" data-zh="分层">Layers</h2>
  <p data-i18n data-en="A simple model for organizing the notes that follow." data-zh="用于组织后续内容的一组简单分层。">A simple model for organizing the notes that follow.</p>
</div>

<div class="layer-flow" aria-label="Agent 技术分层">
  <span data-i18n data-en="L1 Components &amp; Protocols" data-zh="L1 组件与协议">L1 Components &amp; Protocols</span>
  <span>L2 Agent Runtime</span>
  <span>L3 Workflow</span>
  <span>L4 Agent Harness</span>
  <span data-i18n data-en="L5 Vertical Applications" data-zh="L5 垂直应用">L5 Vertical Applications</span>
  <span data-i18n data-en="L6 Products &amp; Platforms" data-zh="L6 产品与平台">L6 Products &amp; Platforms</span>
</div>

<div class="card-grid">
  <a class="card featured" href="{{ '/frameworks/trpc-agent-go/' | relative_url }}">
    <span class="card-kicker">Reference Paradigm</span>
    <h3>tRPC-Agent-Go</h3>
    <p data-i18n data-en="Application notes, source reading, and experiments around Agent, Runner, Event, Session, and Graph." data-zh="围绕 Agent、Runner、Event、Session 与 Graph 展开的应用记录、源码阅读和实验。">Application notes, source reading, and experiments around Agent, Runner, Event, Session, and Graph.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/docs/02-comparison-methodology/' | relative_url }}">
    <span class="card-kicker">Framework Lens</span>
    <h3>Framework Lens</h3>
    <p data-i18n data-en="Recurring questions about abstractions, state, control flow, production, and product design." data-zh="阅读和使用框架时反复出现的抽象、状态、控制流、生产化和产品问题。">Recurring questions about abstractions, state, control flow, production, and product design.</p>
    <span class="status" data-i18n data-en="v1 complete" data-zh="第一版完成">v1 complete</span>
  </a>
</div>

<div class="section-heading">
  <h2 data-i18n data-en="Engineering Evolution" data-zh="工程化演进">Engineering Evolution</h2>
  <p data-i18n data-en="A working map from better inputs to reliable autonomous execution." data-zh="从更好的输入，到可靠的自治执行。">A working map from better inputs to reliable autonomous execution.</p>
</div>

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

<p class="timeline-note" data-i18n data-en="This is a working timeline for organizing the notes, not a claim of a universally agreed industry boundary." data-zh="这是用于组织笔记的阶段性观察，不代表行业已有统一断代。">This is a working timeline for organizing the notes, not a claim of a universally agreed industry boundary.</p>

<div class="section-heading">
  <h2 data-i18n data-en="Frameworks" data-zh="框架">Frameworks</h2>
  <p data-i18n data-en="Different engineering choices for similar problems." data-zh="不同框架对相似问题的不同选择。">Different engineering choices for similar problems.</p>
</div>

<div class="card-grid">
  <a class="card" href="{{ '/frameworks/langchain/' | relative_url }}">
    <span class="card-kicker">Ecosystem</span><h3>LangChain</h3>
    <p data-i18n data-en="Agent abstractions, the model and tool ecosystem, and its relationship with LangGraph, LangSmith, and Deep Agents." data-zh="Agent 工程抽象、Model 与 Tool 集成生态，以及它与 LangGraph、LangSmith、Deep Agents 的关系。">Agent abstractions, the model and tool ecosystem, and its relationship with LangGraph, LangSmith, and Deep Agents.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/frameworks/langgraph/' | relative_url }}">
    <span class="card-kicker">Stateful Orchestration</span><h3>LangGraph</h3>
    <p data-i18n data-en="Stateful graphs, durable execution, checkpoints, human-in-the-loop, and long-running tasks." data-zh="有状态图、Durable Execution、Checkpoint、Human-in-the-loop 与长时间任务。">Stateful graphs, durable execution, checkpoints, human-in-the-loop, and long-running tasks.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/frameworks/autogen/' | relative_url }}">
    <span class="card-kicker">Multi-Agent Runtime</span><h3>AutoGen</h3>
    <p data-i18n data-en="Event-driven Core, AgentChat, teams, message collaboration, code execution, and the move toward Microsoft Agent Framework." data-zh="事件驱动 Core、AgentChat、Team、消息协作与代码执行，以及向 Microsoft Agent Framework 的演进。">Event-driven Core, AgentChat, teams, message collaboration, code execution, and the move toward Microsoft Agent Framework.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/frameworks/google-adk/' | relative_url }}">
    <span class="card-kicker">Agent Development Kit</span><h3>Google ADK</h3>
    <p data-i18n data-en="Agent, Runner, Event, Session, and Workflow Agent, with notes on both the Python and Go implementations." data-zh="Agent、Runner、Event、Session 与 Workflow Agent；同时比较 Python 与 Go 实现。">Agent, Runner, Event, Session, and Workflow Agent, with notes on both the Python and Go implementations.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/frameworks/agno/' | relative_url }}">
    <span class="card-kicker">Agent Platform</span><h3>Agno</h3>
    <p data-i18n data-en="From Agent, Team, and Workflow to APIs, storage, traces, RBAC, and the control plane." data-zh="从 Agent、Team、Workflow 延伸到 API、Storage、Trace、RBAC 与 Control Plane。">From Agent, Team, and Workflow to APIs, storage, traces, RBAC, and the control plane.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/frameworks/crewai/' | relative_url }}">
    <span class="card-kicker">Multi-Agent Automation</span><h3>CrewAI</h3>
    <p data-i18n data-en="Role-based agents and tasks organized through autonomous Crews and event-driven, stateful Flows." data-zh="以角色化 Agent 与 Task 为基础，通过自主协作的 Crews 和事件驱动、有状态的 Flows 组织多 Agent 自动化。">Role-based agents and tasks organized through autonomous Crews and event-driven, stateful Flows.</p>
    <span class="status">todo</span>
  </a>
</div>

<div class="section-heading">
  <h2>Frameworks in China</h2>
  <p data-i18n data-en="AgentScope, DeerFlow, and tRPC-Agent-Go." data-zh="AgentScope、DeerFlow 与 tRPC-Agent-Go。">AgentScope, DeerFlow, and tRPC-Agent-Go.</p>
</div>

<div class="card-grid">
  <a class="card" href="{{ '/frameworks/agentscope/' | relative_url }}">
    <span class="card-kicker">Agent Framework</span><h3>AgentScope</h3>
    <p data-i18n data-en="ReAct, tools, memory, the multi-agent message hub, evaluation, and production deployment." data-zh="ReAct、Tool、Memory、Multi-Agent Message Hub、Evaluation 与生产部署。">ReAct, tools, memory, the multi-agent message hub, evaluation, and production deployment.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/frameworks/deerflow/' | relative_url }}">
    <span class="card-kicker">SuperAgent Harness</span><h3>DeerFlow 2.0</h3>
    <p data-i18n data-en="How subagents, memory, sandboxes, skills, and message gateways form a harness for long-running tasks." data-zh="Subagent、Memory、Sandbox、Skill 与 Message Gateway 如何组合成长任务 Harness。">How subagents, memory, sandboxes, skills, and message gateways form a harness for long-running tasks.</p>
    <span class="status">todo</span>
  </a>
</div>

<div class="section-heading">
  <h2>Coding Agents</h2>
  <p data-i18n data-en="Context, tools, permissions, execution environments, and interaction models." data-zh="上下文、工具、权限、执行环境和交互方式。">Context, tools, permissions, execution environments, and interaction models.</p>
</div>

<div class="card-grid">
  <a class="card" href="{{ '/coding-agents/codex/' | relative_url }}">
    <span class="card-kicker">OpenAI</span><h3>Codex</h3>
    <p data-i18n data-en="CLI, IDE, app, cloud, sandbox, approvals, skills, MCP, and parallel tasks." data-zh="CLI、IDE、App、Cloud、Sandbox、Approval、Skill、MCP 与并行任务。">CLI, IDE, app, cloud, sandbox, approvals, skills, MCP, and parallel tasks.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/coding-agents/claude-code/' | relative_url }}">
    <span class="card-kicker">Anthropic</span><h3>Claude Code</h3>
    <p data-i18n data-en="Terminal-first UX, permissions, hooks, project instructions, skills, and subagents." data-zh="Terminal-first UX、Permission、Hook、Project Instructions、Skill 与 Subagent。">Terminal-first UX, permissions, hooks, project instructions, skills, and subagents.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/coding-agents/gemini-cli/' | relative_url }}">
    <span class="card-kicker">Google</span><h3>Gemini CLI</h3>
    <p data-i18n data-en="An open-source agent loop with tools, MCP, extensions, sandboxing, and non-interactive execution." data-zh="开源 Agent Loop、Tool、MCP、扩展机制、Sandbox 与非交互运行。">An open-source agent loop with tools, MCP, extensions, sandboxing, and non-interactive execution.</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/coding-agents/opencode/' | relative_url }}">
    <span class="card-kicker">Open Source</span><h3>OpenCode</h3>
    <p data-i18n data-en="Providers, sessions, tools, permissions, TUI and client-server architecture, and the extension ecosystem." data-zh="Provider、Session、Tool、Permission、TUI / Client-Server 架构与扩展生态。">Providers, sessions, tools, permissions, TUI and client-server architecture, and the extension ecosystem.</p>
    <span class="status">todo</span>
  </a>
</div>
