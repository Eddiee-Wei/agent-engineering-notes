---
layout: default
title: Knowledge Atlas
page_class: home
description: A search-first map of agent engineering, from components to production systems.
---

<section class="atlas-intro">
  <h1 data-i18n data-en="Knowledge Atlas" data-zh="知识地图">Knowledge Atlas</h1>
  <p data-i18n data-en="A search-first map of agent engineering—from components to production systems." data-zh="一张面向检索与学习的 Agent 工程地图：从组件一路通向生产系统。">A search-first map of agent engineering—from components to production systems.</p>
  <div class="atlas-actions">
    <a class="button primary" href="{{ '/agent/' | relative_url }}">
      <span data-i18n data-en="Start with Agent Introduction" data-zh="从 Agent 介绍开始">Start with Agent Introduction</span>
      <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
    </a>
    <a class="button" href="{{ '/agent-framework/' | relative_url }}" data-i18n data-en="Browse Framework Index" data-zh="浏览框架索引">Browse Framework Index</a>
  </div>
</section>

<section class="atlas-section" id="browse-by-layer">
  <h2 data-i18n data-en="Browse by layer" data-zh="按层级浏览">Browse by layer</h2>
  <p data-i18n data-en="A practical model for organizing the notes that follow." data-zh="用于组织后续内容的一套实用分层模型。">A practical model for organizing the notes that follow.</p>

  <div class="layer-index">
    <a class="layer-row" id="layer-components" data-toc-label="L1 Components &amp; Protocols" href="{{ '/docs/03-layer-model/' | relative_url }}">
      <span class="layer-code">L1</span>
      <span class="layer-name" data-i18n data-en="Components &amp; Protocols" data-zh="组件与协议">Components &amp; Protocols</span>
      <span class="material-symbols-outlined" aria-hidden="true">extension</span>
      <span class="layer-description" data-i18n data-en="Model I/O, tool protocols, data formats, connectors, and interoperability primitives." data-zh="模型输入输出、工具协议、数据格式、连接器与互操作基础。">Model I/O, tool protocols, data formats, connectors, and interoperability primitives.</span>
    </a>
    <a class="layer-row" id="layer-runtime" data-toc-label="L2 Agent Runtime" href="{{ '/docs/03-layer-model/' | relative_url }}">
      <span class="layer-code">L2</span>
      <span class="layer-name">Agent Runtime</span>
      <span class="material-symbols-outlined" aria-hidden="true">deployed_code</span>
      <span class="layer-description" data-i18n data-en="Runtime environment, state, memory, tool execution, scheduling, and concurrency." data-zh="运行环境、状态、记忆、工具执行、调度与并发。">Runtime environment, state, memory, tool execution, scheduling, and concurrency.</span>
    </a>
    <a class="layer-row" id="layer-workflow" data-toc-label="L3 Workflow" href="{{ '/docs/03-layer-model/' | relative_url }}">
      <span class="layer-code">L3</span>
      <span class="layer-name">Workflow</span>
      <span class="material-symbols-outlined" aria-hidden="true">account_tree</span>
      <span class="layer-description" data-i18n data-en="Planning, routing, branching, loops, and orchestration patterns that structure behavior." data-zh="规划、路由、分支、循环，以及用于组织行为的编排模式。">Planning, routing, branching, loops, and orchestration patterns that structure behavior.</span>
    </a>
    <a class="layer-row" id="layer-harness" data-toc-label="L4 Agent Harness" href="{{ '/docs/03-layer-model/' | relative_url }}">
      <span class="layer-code">L4</span>
      <span class="layer-name">Agent Harness</span>
      <span class="material-symbols-outlined" aria-hidden="true">security</span>
      <span class="layer-description" data-i18n data-en="Evaluation, guardrails, monitoring, tracing, permissions, and operational controls." data-zh="评测、护栏、监控、追踪、权限与运行控制。">Evaluation, guardrails, monitoring, tracing, permissions, and operational controls.</span>
    </a>
    <a class="layer-row" id="layer-applications" data-toc-label="L5 Vertical Applications" href="{{ '/docs/03-layer-model/' | relative_url }}">
      <span class="layer-code">L5</span>
      <span class="layer-name" data-i18n data-en="Vertical Applications" data-zh="垂直应用">Vertical Applications</span>
      <span class="material-symbols-outlined" aria-hidden="true">grid_view</span>
      <span class="layer-description" data-i18n data-en="Domain-specific agents and workflows that solve concrete real-world problems." data-zh="面向具体真实问题的领域 Agent 与工作流。">Domain-specific agents and workflows that solve concrete real-world problems.</span>
    </a>
    <a class="layer-row" id="layer-products" data-toc-label="L6 Products &amp; Platforms" href="{{ '/docs/03-layer-model/' | relative_url }}">
      <span class="layer-code">L6</span>
      <span class="layer-name" data-i18n data-en="Products &amp; Platforms" data-zh="产品与平台">Products &amp; Platforms</span>
      <span class="material-symbols-outlined" aria-hidden="true">layers</span>
      <span class="layer-description" data-i18n data-en="End-user products, platforms, and ecosystems built on agent technologies." data-zh="建立在 Agent 技术之上的终端产品、平台与生态。">End-user products, platforms, and ecosystems built on agent technologies.</span>
    </a>
  </div>
</section>

<section class="atlas-section" id="framework-index">
  <h2 data-i18n data-en="Framework index" data-zh="框架索引">Framework index</h2>
  <p data-i18n data-en="Popular frameworks and toolkits for building agent systems." data-zh="用于构建 Agent 系统的主流框架与工具包。">Popular frameworks and toolkits for building agent systems.</p>

  <div class="framework-index">
    <a class="framework-link" href="{{ '/frameworks/langchain/' | relative_url }}"><span>LangChain</span><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a>
    <a class="framework-link" href="{{ '/frameworks/langgraph/' | relative_url }}"><span>LangGraph</span><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a>
    <a class="framework-link" href="{{ '/frameworks/autogen/' | relative_url }}"><span>AutoGen</span><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a>
    <a class="framework-link" href="{{ '/frameworks/google-adk/' | relative_url }}"><span>Google ADK</span><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a>
    <a class="framework-link" href="{{ '/frameworks/agno/' | relative_url }}"><span>Agno</span><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a>
    <a class="framework-link" href="{{ '/frameworks/crewai/' | relative_url }}"><span>CrewAI</span><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a>
    <a class="framework-link" href="{{ '/frameworks/agentscope/' | relative_url }}"><span>AgentScope</span><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a>
    <a class="framework-link" href="{{ '/frameworks/deerflow/' | relative_url }}"><span>DeerFlow</span><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a>
    <a class="framework-link" href="{{ '/frameworks/trpc-agent-go/' | relative_url }}"><span>tRPC-Agent-Go</span><span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span></a>
  </div>
</section>

<section class="atlas-section" id="engineering-evolution">
  <h2 data-i18n data-en="Engineering evolution" data-zh="工程化演进">Engineering evolution</h2>
  <p data-i18n data-en="A working sequence for turning ideas into reliable, maintainable agent systems." data-zh="一条把想法逐步变成可靠、可维护 Agent 系统的工作主线。">A working sequence for turning ideas into reliable, maintainable agent systems.</p>

  <div class="evolution-flow">
    <a class="evolution-step" href="{{ '/engineering/prompt-engineering/' | relative_url }}">
      <strong>Prompt</strong>
      <small data-i18n data-en="Express intent and shape a single interaction." data-zh="表达意图，塑造单次交互。">Express intent and shape a single interaction.</small>
      <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
    </a>
    <a class="evolution-step" href="{{ '/engineering/context-engineering/' | relative_url }}">
      <strong>Context</strong>
      <small data-i18n data-en="Provide knowledge, state, and the right tools." data-zh="提供知识、状态与合适的工具。">Provide knowledge, state, and the right tools.</small>
      <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
    </a>
    <a class="evolution-step" href="{{ '/engineering/harness-engineering/' | relative_url }}">
      <strong>Harness</strong>
      <small data-i18n data-en="Add guardrails, tests, and observability." data-zh="加入护栏、测试与可观测性。">Add guardrails, tests, and observability.</small>
      <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
    </a>
    <a class="evolution-step" href="{{ '/engineering/loop-engineering/' | relative_url }}">
      <strong>Loop</strong>
      <small data-i18n data-en="Measure, learn, and continuously improve." data-zh="度量、学习并持续改进。">Measure, learn, and continuously improve.</small>
      <span class="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
    </a>
  </div>
</section>
