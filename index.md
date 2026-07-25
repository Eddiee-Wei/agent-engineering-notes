---
layout: default
title: 首页
page_class: home
description: 一个 Agent 开发工程师的日常分享。
---

<section class="hero">
  <span class="eyebrow">AGENT ENGINEERING NOTES · 持续更新</span>
  <h1>Agent Frameworks,<br>Runtimes & Coding Agents</h1>
  <p>一个 Agent 开发工程师的日常分享。</p>
  <div class="hero-actions">
    <a class="button primary" href="{{ '/frameworks/trpc-agent-go/' | relative_url }}">tRPC-Agent-Go</a>
    <a class="button" href="{{ '/ROADMAP/' | relative_url }}">Roadmap</a>
  </div>
</section>

<div class="section-heading">
  <h2>Layers</h2>
  <p>用于组织后续内容的一组简单分层。</p>
</div>

<div class="layer-flow" aria-label="Agent 技术分层">
  <span>L1 组件与协议</span>
  <span>L2 Agent Runtime</span>
  <span>L3 Workflow</span>
  <span>L4 Agent Harness</span>
  <span>L5 垂直应用</span>
  <span>L6 产品与平台</span>
</div>

<div class="card-grid">
  <a class="card featured" href="{{ '/frameworks/trpc-agent-go/' | relative_url }}">
    <span class="card-kicker">Reference Paradigm</span>
    <h3>tRPC-Agent-Go</h3>
    <p>围绕 Agent、Runner、Event、Session 与 Graph 展开的应用记录、源码阅读和实验。</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/docs/02-comparison-methodology/' | relative_url }}">
    <span class="card-kicker">Framework Lens</span>
    <h3>Framework Lens</h3>
    <p>阅读和使用框架时反复出现的抽象、状态、控制流、生产化和产品问题。</p>
    <span class="status">🟢 第一版完成</span>
  </a>
</div>

<div class="section-heading">
  <h2>Frameworks</h2>
  <p>不同框架对相似问题的不同选择。</p>
</div>

<div class="card-grid">
  <a class="card" href="{{ '/frameworks/langchain/' | relative_url }}">
    <span class="card-kicker">Ecosystem</span><h3>LangChain</h3>
    <p>Agent 工程抽象、Model 与 Tool 集成生态，以及它与 LangGraph、LangSmith、Deep Agents 的关系。</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/frameworks/langgraph/' | relative_url }}">
    <span class="card-kicker">Stateful Orchestration</span><h3>LangGraph</h3>
    <p>有状态图、Durable Execution、Checkpoint、Human-in-the-loop 与长时间任务。</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/frameworks/autogen/' | relative_url }}">
    <span class="card-kicker">Multi-Agent Runtime</span><h3>AutoGen</h3>
    <p>事件驱动 Core、AgentChat、Team、消息协作与代码执行，以及向 Microsoft Agent Framework 的演进。</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/frameworks/google-adk/' | relative_url }}">
    <span class="card-kicker">Agent Development Kit</span><h3>Google ADK</h3>
    <p>Agent、Runner、Event、Session 与 Workflow Agent；同时比较 Python 与 Go 实现。</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/frameworks/agno/' | relative_url }}">
    <span class="card-kicker">Agent Platform</span><h3>Agno</h3>
    <p>从 Agent、Team、Workflow 延伸到 API、Storage、Trace、RBAC 与 Control Plane。</p>
    <span class="status">todo</span>
  </a>
</div>

<div class="section-heading">
  <h2>Frameworks in China</h2>
  <p>AgentScope、DeerFlow 与 tRPC-Agent-Go。</p>
</div>

<div class="card-grid">
  <a class="card" href="{{ '/frameworks/agentscope/' | relative_url }}">
    <span class="card-kicker">Agent Framework</span><h3>AgentScope</h3>
    <p>ReAct、Tool、Memory、Multi-Agent Message Hub、Evaluation 与生产部署。</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/frameworks/deerflow/' | relative_url }}">
    <span class="card-kicker">SuperAgent Harness</span><h3>DeerFlow 2.0</h3>
    <p>Subagent、Memory、Sandbox、Skill 与 Message Gateway 如何组合成长任务 Harness。</p>
    <span class="status">todo</span>
  </a>
</div>

<div class="section-heading">
  <h2>Coding Agents</h2>
  <p>上下文、工具、权限、执行环境和交互方式。</p>
</div>

<div class="card-grid">
  <a class="card" href="{{ '/coding-agents/codex/' | relative_url }}">
    <span class="card-kicker">OpenAI</span><h3>Codex</h3>
    <p>CLI、IDE、App、Cloud、Sandbox、Approval、Skill、MCP 与并行任务。</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/coding-agents/claude-code/' | relative_url }}">
    <span class="card-kicker">Anthropic</span><h3>Claude Code</h3>
    <p>Terminal-first UX、Permission、Hook、Project Instructions、Skill 与 Subagent。</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/coding-agents/gemini-cli/' | relative_url }}">
    <span class="card-kicker">Google</span><h3>Gemini CLI</h3>
    <p>开源 Agent Loop、Tool、MCP、扩展机制、Sandbox 与非交互运行。</p>
    <span class="status">todo</span>
  </a>
  <a class="card" href="{{ '/coding-agents/opencode/' | relative_url }}">
    <span class="card-kicker">Open Source</span><h3>OpenCode</h3>
    <p>Provider、Session、Tool、Permission、TUI / Client-Server 架构与扩展生态。</p>
    <span class="status">todo</span>
  </a>
</div>
