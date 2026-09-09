---
layout: default
title: Memory Engineering
nav_title_zh: Memory Engineering
nav_order: 6
description: 从 MEMORY.md 到长期记忆服务：理解 Agent 如何形成、检索、使用、更正与遗忘记忆。
last_verified: 2026-09-04
---

<h1 data-i18n data-en="Memory Engineering" data-zh="记忆工程">Memory Engineering</h1>

人们常说，要给 Agent 加一个 Memory。接下来出现的往往是一张向量表、一个 `MEMORY.md`，或者把全部聊天记录保存下来。它们都可能有用，却都还不等于记忆。

真正的 Memory System 要回答一组更难的问题：什么值得留下，谁说的，适用于谁，什么时候过期，冲突时相信哪一条，怎样进入下一轮模型请求，以及用户说“忘掉它”以后，系统能否真的找不到它。

**`MEMORY.md` 是一种介质；Memory 是一套治理过的信息复用流程。** 读取记忆会改变这一轮 Context，写入记忆会改变未来的行为。后者的风险通常更大。

> 如果还分不清 Context、Run State、Session、Store、Checkpoint 与 Artifact，先读 [Agent 的状态边界](../docs/03-agent-state-semantics.md)。本文只把其中的 Memory 拆开，沿着一次真实的读写链路继续向下。

> 如果问题是 `MEMORY.md` 与 `AGENTS.md`、`SOUL.md`、`CLAUDE.md`、`SKILL.md` 在**文件加载时机**上有什么区别，请读主题随记：[Agent 为什么会读这些 Markdown](../notes/agent-markdown-files-context-loading.md)。

## 1. 先把“记住了”拆成八件不同的事

在产品界面里，这八件事都可能表现为“它还记得”。工程上却不能混用。

| 技术 | 它真正保存或复用什么 | 典型作用域 | 会不会直接进入模型 Context | 最容易产生的误解 |
| --- | --- | --- | --- | --- |
| Context Window | 当前这次请求可见的 token | 单次 Model Turn | 它本身就是 Context | 看得见就等于永久记住 |
| Conversation / Session | 一段对话的消息、事件与临时状态 | Thread / Session | 按预算重放、裁剪或摘要后进入 | 保存了历史就等于长期记忆 |
| Compaction / Summary | 长历史的有损表示 | Session / Run | 作为旧历史的替代物进入 | 摘要可以替代原始事实源 |
| Long-term Memory | 经筛选、可跨 Session 复用的信息 | User / App / Project / 自定义 Namespace | 检索命中后才进入 | 数据持久化就自然成为 Memory |
| Knowledge / RAG | 面向多个任务的外部知识与证据 | Corpus / Tenant / Organization | 检索命中后进入 | 都用向量检索，所以与 Memory 相同 |
| Checkpoint | 恢复执行所需的状态切面与控制位置 | Run / Graph / Step | 恢复后再编译 Context | 能恢复 Runtime 就能回滚真实世界 |
| Prompt Cache | 相同 Prompt 前缀的计算结果 | Provider 缓存键与保留期 | 不增加任何语义内容 | Cache 命中代表模型记得用户 |
| Model Weights | 训练写入参数的统计规律 | 模型版本 | 通过模型本身起作用 | 可以像数据库记录一样追溯和删除 |

[OpenAI 的 Conversation State](https://developers.openai.com/api/docs/guides/conversation-state)解决多轮输入怎样连续传递，[Compaction](https://developers.openai.com/api/docs/guides/compaction)解决长对话怎样在窗口预算内继续，[Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)解决稳定前缀怎样少做重复计算。这三者都与“连续性”有关，却都没有替你完成长期记忆的筛选、授权与遗忘。

这里有个很实用的检验：**如果换一个全新的 Session，系统还能按用户身份找回这条信息，它才可能属于长期 Memory；如果只是旧消息仍在上下文里，那只是历史还没离场。**

## 2. Memory 不是一个库，而是两条管线

记忆系统一半负责“形成记忆”，另一半负责“在需要时想起来”。只有存储，没有这两条管线，得到的只是一个耐久的杂物间。

```text
写入路径
Session / Tool Result / 用户显式输入
  -> Memory Candidate
  -> 抽取与规范化
  -> 证据、冲突、权限与敏感性检查
  -> 决定 Scope / TTL / Version
  -> Upsert / Merge / Supersede / Reject
  -> Memory Store + 审计记录

读取路径
当前任务 + 用户身份 + 项目范围
  -> 构造检索 Query
  -> Namespace 与权限过滤
  -> 关键词 / 向量 / 结构化 / 时间检索
  -> 去重、重排、时效与冲突处理
  -> Context Budget 裁剪
  -> 带来源注入当前 Model Request
  -> 使用反馈、纠错或遗忘
```

这两条管线并不对称。读错一条记忆，通常污染一次回答；写错一条长期记忆，可能在此后的很多 Session 里反复污染回答。于是，Memory Write 更接近一次小型的事实发布，而不是日志追加。

## 3. 从一句话到一条记忆，中间发生了什么

假设用户在一次结对开发中说：

> 这个仓库的 Plan 请一直用中文写；但英文开源仓库不用。

把整句对话直接塞进向量库很容易，真正可复用的表示却至少需要这些字段：

```json
{
  "subject": "user:eddie",
  "predicate": "prefers_plan_language",
  "value": "zh-CN",
  "scope": {"repository": "agent-engineering-notes"},
  "type": "explicit_preference",
  "source": {"session_id": "...", "event_id": "..."},
  "created_at": "2026-09-04T...+08:00",
  "valid_from": "2026-09-04T...+08:00",
  "expires_at": null,
  "confidence": 1.0,
  "status": "active",
  "supersedes": null
}
```

这不是为了把数据库设计得庄严，而是为了保住原话里的边界。若只抽成“用户喜欢中文”，系统会在英文开源项目、英文邮件甚至代码标识符上过度泛化。记忆最危险的错误，往往不是完全虚构，而是把一句局部的话扩大成永久真理。

### 3.1 先成为 Candidate，再决定是否发布

Session 里出现过的信息只能先叫 **Memory Candidate**。它可能是：

- 用户明确陈述的稳定偏好；
- 只对当前任务有效的临时要求；
- Agent 根据行为做出的推断；
- Tool 返回的外部事实；
- 一次偶然成功的操作轨迹；
- Prompt Injection 诱导写入的恶意内容。

候选进入长期 Store 前，至少要经过相关性、稳定性、作用域、来源、敏感性和冲突检查。高风险权限尤其不应从自然语言历史里自动晋升：一句“这次可以发布”不能被记成“以后都允许发布”。

### 3.2 Profile 与 Collection 是两种不同的账本

[LangGraph 的 Memory Overview](https://docs.langchain.com/oss/python/concepts/memory)把长期记忆常见表示分成两类：

- **Profile**：围绕一个实体维护一份结构化画像，例如用户偏好 JSON。整体读取容易，更新时却要小心覆盖、漏字段与并发冲突。
- **Collection**：每条事实或经历是独立文档。新增容易、召回率通常更好，但去重、冲突、更正和检索更复杂。

两者不是非此即彼。实践中常用 Collection 保存带来源的事实，用 Profile 保存经归并的当前视图。Profile 是投影，Collection 才保留“为什么会得到这个结论”的历史。

### 3.3 Hot Path 与 Background Write

Memory 可以在主链路里写，也可以后台整理。

| 写入方式 | 好处 | 代价 | 适合内容 |
| --- | --- | --- | --- |
| Hot Path | 立即生效；可当场让用户确认 | 增加延迟；模型要一边完成任务一边判断该记什么 | 用户显式说“请记住”、即时纠错、关键偏好 |
| Background | 不拖慢回答；可跨多轮归并、去重和评估 | 新记忆不会立刻可见；调度、幂等和一致性更复杂 | Session 结束后的总结、经验抽取、周期清理 |

最稳妥的做法通常是混合：显式记忆和纠错走 Hot Path，隐式候选在后台合并。无论哪条路径，都要给写入操作稳定 ID，防止重试生成重复记忆。

## 4. 语义、情节与程序记忆：别只按存储介质分类

向量库、关系库和 Markdown 是介质；语义、情节与程序才是在回答“记住了什么”。这套分类来自认知科学，在 Agent 工程里只能当类比，但很有启发性。[LangGraph 文档](https://docs.langchain.com/oss/python/concepts/memory)与 [CoALA 论文](https://arxiv.org/abs/2309.02427)都沿用了这组区分。

| 类型 | 回答的问题 | Agent 中的例子 | 常见使用方式 |
| --- | --- | --- | --- |
| Semantic Memory | 什么是真的或被认为是真的 | 用户偏好、项目事实、术语定义 | 结构化 Profile、事实 Collection、检索后作为背景 |
| Episodic Memory | 以前发生过什么 | 某次 Debug 轨迹、一次工具调用如何成功 | 检索相似经历，作为 Few-shot 示例或决策参考 |
| Procedural Memory | 这类事通常怎样做 | 操作步骤、检查清单、工具使用规则 | Prompt、代码、Policy、Skill |

第三类最值得警惕。一次成功经历可以成为 Skill 的候选材料，却不能自动变成 `SKILL.md`。经历只证明“当时成功过”，没有证明它在别的版本、权限和环境下仍然安全。Memory 可以帮助提出流程，Skill 的发布仍需要去敏、评测、审查、版本化与回滚。

换句话说：**Agent 可以从经验里学到建议，但不能趁人不注意把建议升级成权限。**

## 5. `MEMORY.md` 到底是什么

`MEMORY.md` 的优势很朴素：人能读、能改、能进版本控制，也能清楚看见 Agent 以后可能拿什么当背景。它适合小规模、精选、变化不频繁的记忆。

它并没有自带任何 Runtime 语义。究竟是每个 Session 自动加载、仅主私聊加载、先检索再读取，还是根本没人读，完全取决于 Harness。正如 `AGENTS.md` 需要 Coding Agent 解释，`MEMORY.md` 也需要 Memory Loader 解释。

常见的文件式设计有两种：

```text
MEMORY.md
  精选、稳定、体积很小的长期事实

memory/
  2026-09-03.md       # 日志或事件
  2026-09-04.md
  decisions.md        # 经整理的决策
  preferences.md      # 经确认的偏好
```

一种做法是首轮加载 `MEMORY.md`，其余文件用搜索或文件工具按需读取；另一种做法是启动时只为这些文件建立索引，检索命中后再把片段注入。前者透明简单，后者更省 Context，却必须补上检索质量、来源标注和删除同步。

文件式 Memory 的真正限制也很明确：细粒度 ACL、跨用户隔离、并发更新、TTL、冲突合并与“删除后所有索引同步消失”都不好做。规模上来以后，Markdown 更适合作为人工可审阅的投影，而不是唯一事实源。

## 6. Memory 怎样进入一次模型请求

长期记忆不会隔空进入模型。它仍要走 [Context Compiler](context-engineering.md) 的选择与装配流程。

```text
用户：继续昨天那个 Plan，还是用之前的习惯。

Runtime 在模型调用前：
1. 从身份与 cwd 得到 namespace = user/eddie/repo/agent-engineering-notes
2. 以“Plan + 语言偏好 + 当前仓库”构造查询
3. 召回候选，过滤已过期和别的项目记忆
4. 选择“此仓库 Plan 使用中文”，附上来源与时间
5. 把它渲染进本轮 Context Frame
```

模型实际收到的可能近似：

```text
<relevant_memories>
- [explicit preference; repo scoped; source=session/.../event/...]
  本仓库的计划文档使用中文。英文开源仓库不适用。
</relevant_memories>

<user>
继续昨天那个 Plan，还是用之前的习惯。
</user>
```

Memory 的消息位置因 Harness 而异：可以拼进 system/developer context，可以作为隐藏的应用消息，也可以由 `search_memory` 工具在下一轮返回。位置会影响优先级、可观测性、压缩和 Prompt Cache，却不会改变一个基本事实：**只有被选中并物化进 Context 的记忆，才会影响这一轮模型。**

[Google ADK 的 MemoryService](https://adk.dev/sessions/memory/)很好地展示了这种分离：Session 保存当前对话的 Events 与 State；MemoryService 负责摄取 Session、事件或显式 MemoryEntry，并通过搜索让 Agent 找回相关片段。存进去与用起来是两个独立动作。

## 7. Memory 与 RAG：同一把检索工具，两种责任

Memory 与 RAG 经常共享 Embedding、向量索引、混合检索和 Reranker。共享基础设施，不代表共享语义。

| 维度 | Memory | Knowledge / RAG |
| --- | --- | --- |
| 主要来源 | 用户与 Agent 的交互、经历、反馈 | 文档、数据库、网页、知识库 |
| 主要目的 | 维持个体或应用的跨任务连续性 | 为当前问题提供外部事实与证据 |
| 典型 Scope | User / App / Project | Corpus / Tenant / Organization |
| 权威性 | 常含偏好、推断与经验，必须标类型 | 应尽量回到可引用的事实源 |
| 更新方式 | 抽取、合并、纠错、遗忘 | 文档摄取、切块、重建索引、版本更新 |
| 主要风险 | 隐私泄漏、错误固化、跨 Scope 串用 | 检索错误、旧文档、来源不可追溯 |

[RAG 原始论文](https://arxiv.org/abs/2005.11401)把可检索的外部语料称为 non-parametric memory，这是模型架构语境里的用词。在 Agent 产品语境中，我们仍应区分“关于这个用户的记忆”和“关于这个世界的知识”。前者要回答谁允许保存，后者要回答证据来自哪里。

一个查询可以同时取两者：Memory 告诉 Agent“用户偏好简洁中文”，Knowledge 告诉 Agent“当前 API 的字段定义”。它们最后都进入 Context，但标签、权威性和删除规则不同。

## 8. 检索不只是向量相似度

只按 Embedding 相似度取 Top-K，很容易想起“意思相近但已经过期”的东西。成熟的读取路径通常同时考虑：

```text
final_score =
  semantic_similarity
  + keyword_match
  + scope_match
  + recency_or_validity
  + source_quality
  + task_relevance
  - conflict_penalty
  - staleness_penalty
```

这不是要求一定写成一个线性公式，而是提醒检索器别把所有判断外包给向量距离。常见步骤包括：

1. **Query Rewrite**：从当前任务提取实体、意图、时间和项目范围，而非直接拿整段用户 Prompt 搜索。
2. **Hard Filter**：先按 User、Tenant、Project、权限和有效期过滤；隔离不能依赖相似度。
3. **Hybrid Recall**：关键词负责精确名称，向量负责语义近似，结构化查询负责时间和状态。
4. **Rerank**：结合当前任务重新排序，处理近义重复和互相冲突的候选。
5. **Budgeting**：宁可注入三条可解释的记忆，也不要把二十条近似片段塞满 Context。
6. **Attribution**：把来源、类型、时间与 Scope 一起交给装配器，而不是只交一段脱离出处的文本。

好的召回指标也不只是 Recall@K。Memory 更看重 **useful precision**：被注入的每一条是否真的改变了判断，并且改变得正确。召回不到一条偏好，用户可能再说一次；召回一条错误权限，系统可能做出不该做的动作。

## 9. 更正和遗忘不是清理工作，而是核心能力

如果一套 Memory 只能新增、不能更正和删除，它迟早会变成一套持续老化的 Prompt Injection 系统。

“我现在改用英文 Plan”不应简单追加一条相反事实，让检索器碰运气。系统需要显式表示：

```text
old memory: active -> superseded
new memory: active, supersedes=old_memory_id
```

删除也不只是删主表记录。还要处理向量索引、全文索引、Profile 投影、缓存、备份保留策略、离线评测集和已经生成的派生 Memory。若一条记忆曾被提升为 Skill 候选或用户画像字段，派生关系必须可追踪、可撤销。

值得保留的元数据至少包括：

- `source`：原始 Session、Event、Tool 或用户显式输入；
- `subject` 与 `scope`：属于谁，在哪个 App、Tenant、Project 生效；
- `type`：事实、偏好、推断、经历，还是外部知识；
- `valid_from`、`expires_at` 与 `last_verified_at`；
- `confidence` 与验证主体；
- `supersedes`、`derived_from` 与删除传播关系；
- `sensitivity`、保留策略与访问审计。

记忆系统的成熟，不体现在它能留下多少，而体现在它能否有根据地少记、改记和忘记。

## 10. MCP、Skill 与 Memory 在哪里相遇

[MCP 规范](https://modelcontextprotocol.io/specification/2026-07-28/server/index)把 Server 能力分成 Prompts、Resources 与 Tools：Prompt 通常由用户选择，Resource 由应用管理为上下文，Tool 由模型请求执行。Memory 可以借这三种原语接入，但 MCP 本身并不替你定义长期记忆语义。

| 接入方式 | 例子 | 何时进入 Context | 注意点 |
| --- | --- | --- | --- |
| Resource | `memory://user/profile` | Host 选择附加或模型请求读取时 | 适合只读、可定位内容；仍需 ACL 与时效 |
| Tool | `search_memory(query)`、`save_memory(fact)` | Tool result 在下一次模型请求中出现 | 适合动态检索和显式写入；写工具风险更高 |
| Prompt | “回顾我的项目偏好”模板 | 用户选择模板时 | 只是触发工作流，不是 Memory Store |

Skill 则是另一层：它告诉 Agent 在什么任务里怎样调用这些 Memory 工具、怎样验证结果、怎样处理冲突。MCP 提供接口，Skill 提供操作方法，Memory 保存可复用信息，Context Compiler 决定这次给模型看什么。四者相连，却不能互相代替。

## 11. 设计一套 Memory，先回答这些问题

### 写入

- 什么事件会产生 Candidate：用户显式要求、Session 结束、Tool 成功，还是后台批处理？
- 谁拥有发布权：用户、应用规则、模型，还是人工审核？
- 怎样区分事实、偏好、推断与权限？
- 同一条事实怎样幂等写入，冲突怎样合并或保留分支？

### 读取

- 检索 Query 由谁构造，是否包含时间、实体与 Project Scope？
- Namespace 和 ACL 是否在检索前硬过滤？
- 召回结果怎样去重、重排、标注来源并适配 Context Budget？
- 模型能否知道某条内容只是推断，而不是用户确认的事实？

### 生命周期

- 哪些记忆必须有 TTL，哪些需要定期重新验证？
- 用户怎样查看、修改、导出与删除自己的记忆？
- 主存、索引、缓存、备份和派生数据怎样传播删除？
- 模型版本、Embedding 版本或 Schema 变化后怎样迁移和重建？

### 评测

- 应记而未记、误记、不该记却记下，分别怎样测？
- Recall、Precision、Freshness、Scope Isolation 与 Conflict Resolution 是否有独立测试？
- 注入记忆以后，任务质量是否真的提高，还是只增加 token 和确认偏误？
- 能否回放“这条记忆为何在这一轮被选中”？

## 12. 一条不容易走偏的阅读路线

这些资料不是同一件事的重复说明，而是从不同层面拼出 Memory 的完整轮廓：

1. [Agent 的状态边界](../docs/03-agent-state-semantics.md)：先分清 Context、Session、Memory、Checkpoint、Store 与 Artifact。
2. [LangGraph Memory Overview](https://docs.langchain.com/oss/python/concepts/memory)：看短期/长期、Profile/Collection、三类记忆和 Hot Path/Background Write。
3. [Google ADK MemoryService](https://adk.dev/sessions/memory/)：看 Session 如何被摄取，Memory 如何通过工具搜索回来，以及不同 Store 实现的取舍。
4. [CoALA：Cognitive Architectures for Language Agents](https://arxiv.org/abs/2309.02427)：看认知架构如何把工作、情节、语义和程序记忆映射到 Language Agent。
5. [RAG 原始论文](https://arxiv.org/abs/2005.11401)：理解参数内知识、外部可检索语料与生成之间的关系。
6. [OpenAI Conversation State](https://developers.openai.com/api/docs/guides/conversation-state) 与 [Compaction](https://developers.openai.com/api/docs/guides/compaction)：理解“延续一段长对话”为何不等于长期记忆。
7. [OpenAI Prompt Caching](https://developers.openai.com/api/docs/guides/prompt-caching)：理解计算复用为何不增加任何语义记忆。
8. [MCP Server Primitives](https://modelcontextprotocol.io/specification/2026-07-28/server/index)：理解 Memory 怎样通过 Resource、Tool 或 Prompt 暴露给 Host。

## 结语

Memory 的本质不是让 Agent 永远不忘，而是让它有选择地延续。选择意味着它不仅要会保存，也要会怀疑；不仅要会检索，也要会拒绝；不仅要能积累，还要能承认旧信息已经不再成立。

如果只能记住一句，可以记住这句：

> **历史是发生过的东西，记忆是经过选择、准备影响未来的东西。**

正因为它准备影响未来，每一条记忆都应该带着来源、范围、时效与退出方式进入下一次 Context。
