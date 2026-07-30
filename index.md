---
layout: default
title: Knowledge Atlas
nav_title_zh: 知识地图
nav_section: agent
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

  {% include layer-index.html %}
</section>

{% include content-directory.html %}
