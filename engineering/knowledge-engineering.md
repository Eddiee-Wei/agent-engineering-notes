---
layout: default
title: Knowledge Engineering
description: Building trustworthy knowledge sources, retrieval pipelines, and evidence for Agents.
---

<span class="eyebrow">04.07 · KNOWLEDGE</span>

<h1 data-i18n data-en="Knowledge Engineering" data-zh="知识工程">Knowledge Engineering</h1>

<p data-i18n data-en="Building maintainable sources, indexes, retrieval pipelines, and evidence that Agents can use and cite." data-zh="构建 Agent 能够检索、使用和引用的可维护知识源、索引、检索链路与证据。">Building maintainable sources, indexes, retrieval pipelines, and evidence that Agents can use and cite.</p>

> 状态：todo。当前页面先建立主题边界与后续写作提纲。

## 为什么需要它

外部知识并不是把文档切块后放进向量库就结束。工程系统还要处理来源权限、结构、版本、时效性、检索失败、证据冲突和引用可追溯性。

## 核心问题

- 如何选择权威来源并保留来源元数据。
- 文档解析、分块、结构化和索引策略怎样匹配任务。
- 关键词、向量、图和结构化查询如何组合。
- 如何做 query rewriting、rerank 和 evidence packing。
- 过期、冲突和缺失知识如何显式暴露。
- 输出如何绑定引用并支持用户回查。

## 与其他 Engineering 的关系

Knowledge 提供外部事实，[Context Engineering](context-engineering.md) 把检索结果放进当前决策环境，[Memory Engineering](memory-engineering.md) 保存任务或用户经历形成的信息。三者需要清晰区分来源、生命周期和权限。

## 后续提纲

- Source governance 与 ingestion
- Chunking、indexing 与 metadata
- Hybrid retrieval 与 reranking
- Structured data、knowledge graph 与 RAG
- Citation、freshness 与 conflict
- Retrieval evaluation
