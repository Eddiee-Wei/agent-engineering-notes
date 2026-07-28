---
layout: default
title: Evaluation Engineering
description: Building repeatable evidence for Agent quality, regressions, and release decisions.
---

<span class="eyebrow">04.10 · QUALITY</span>

<h1 data-i18n data-en="Evaluation Engineering" data-zh="评测工程">Evaluation Engineering</h1>

<p data-i18n data-en="Building repeatable datasets, rubrics, judges, and experiments that turn Agent quality into evidence." data-zh="构建可重复的数据集、Rubric、Judge 与实验，把 Agent 质量转化为可比较的证据。">Building repeatable datasets, rubrics, judges, and experiments that turn Agent quality into evidence.</p>

> 状态：todo。当前页面先建立主题边界与后续写作提纲。

## 为什么需要它

Agent 输出具有随机性，任务又常常包含多个步骤和外部副作用。只看最终文本或少量演示，无法判断系统是否真的更好，也无法保护已有能力不被后续改动破坏。

## 核心问题

- 评测样本是否覆盖真实任务、边界场景和失败模式。
- 最终结果、过程轨迹、工具调用和成本分别如何评分。
- 规则、程序化检查、LLM-as-Judge 与人工评审如何组合。
- 如何控制 Judge 偏差、数据污染和评测不稳定性。
- 离线评测、Shadow、A/B 和线上反馈怎样衔接。
- 发布门槛和回归基线如何进入开发流程。

## 与其他 Engineering 的关系

Evaluation 为 Prompt、Context、Tool、Loop 等所有工程改动提供比较标准；[Observability Engineering](observability-engineering.md) 则提供线上真实轨迹和失败证据，两者共同形成持续改进闭环。

## 后续提纲

- Task suite、dataset 与 coverage
- Outcome、trajectory 与 tool-call evaluation
- Rubric 与 deterministic checker
- LLM-as-Judge calibration
- Regression、variance 与 statistical confidence
- Online evaluation 与 release gate
