# 24｜Agno

> 状态：🟡 提纲完成，未完待续

## 定位

Agno 当前将自己定位为构建 Agent Platform 的 SDK：不仅创建 Agent，还覆盖服务运行、Storage、Context、Trace、Schedule、RBAC、Human Approval 和 Control Plane。

因此，研究 Agno 时需要区分：

- Agent / Team / Workflow 开发抽象
- AgentOS 或 Agent Platform 运行能力
- Control Plane 与管理界面

## 核心研究路线

### 1. Agent 开发

- Model
- Tool 与 Toolkit
- Knowledge
- Memory
- Reasoning
- Structured Output

### 2. 协作与流程

- Team
- Workflow
- Agent Protocol
- Human Approval

### 3. Agent Platform

- Production API
- SSE / WebSocket
- Session、Memory、Knowledge 与 Trace Storage
- Scheduling 与 Background Job
- OpenTelemetry
- JWT、RBAC 与 Multi-tenancy
- Interface 与部署

## 与 tRPC-Agent-Go 的对照重点

- Agent Runtime 与 Platform Runtime 的边界
- Session / Memory / Knowledge 数据模型
- Team / Workflow 与 Multi-Agent Runner
- API Serving、Streaming 与 Observability
- 控制面能力是否属于框架本体

## 未完待续

- [ ] 锁定版本
- [ ] 绘制 Agent / Team / Workflow / AgentOS 关系图
- [ ] 完成最小 Agent 与 Team 示例
- [ ] 对比 Storage 与 Session
- [ ] 对比生产 API 和可观测性

