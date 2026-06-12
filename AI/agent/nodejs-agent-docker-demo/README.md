# Node.js Agent Docker Demo

这是一个最小可运行的自建 Agent Demo，使用 Node.js 实现，并支持 Docker 部署。

它的目标不是做一个完整生产级 Agent，而是帮你快速看清楚一个自建 Agent 的最小闭环：

- 接收用户输入
- 拼装 system prompt
- 调用大模型
- 决定是否调用 tool
- 执行 tool
- 再把 tool 结果回填给模型
- 返回最终答案

这个 Demo 默认按 **OpenAI 兼容接口** 调用大模型，认证信息和模型地址都留空，你后面自己填即可。

---

## 1. 目录结构

```text
nodejs-agent-docker-demo
├── .env.example
├── Dockerfile
├── README.md
├── docker-compose.yml
├── package.json
└── src
    ├── agentRuntime.js
    ├── config.js
    ├── index.js
    ├── logger.js
    ├── modelClient.js
    └── tools.js
```

---

## 2. 这个 Demo 包含什么能力

这个 Demo 内置了 3 个最小 tool：

- `search_demo_docs`：搜索内置知识片段
- `add_numbers`：做加法
- `get_current_time`：返回当前服务器时间

你可以把它理解成一个“教学版 agent”，重点是演示 Agent 的运行机制，而不是 tool 本身有多复杂。

---

## 3. 运行原理

一次请求的大致链路如下：

```text
POST /api/chat
-> Node.js 服务收到用户输入
-> agentRuntime 拼装 system prompt + user message
-> modelClient 调用大模型
-> 如果模型返回 tool call
-> tools.js 执行对应工具
-> 工具结果再回填给模型
-> 模型生成最终答案
-> 服务返回 JSON 响应
```

这个 Demo 里最重要的一句话是：

> 大模型负责决定，程序负责执行。

---

## 4. 环境要求

- Node.js 20+
- npm 10+
- Docker
- Docker Compose

---

## 5. 本地直接运行

### 第 1 步：进入目录

```bash
cd AI/agent/nodejs-agent-docker-demo
```

### 第 2 步：复制环境变量模板

```bash
cp .env.example .env
```

### 第 3 步：填写模型配置

打开 `.env`，填写下面几个字段：

```env
MODEL_API_KEY=
MODEL_BASE_URL=
MODEL_NAME=
MODEL_API_PATH=/chat/completions
```

说明：

- `MODEL_API_KEY`：你的模型平台密钥
- `MODEL_BASE_URL`：模型服务地址，例如某个 OpenAI 兼容网关地址
- `MODEL_NAME`：你要调用的模型名
- `MODEL_API_PATH`：默认是 `/chat/completions`

如果你暂时不填，这个 Demo 仍然可以跑起来，但会进入 mock 模式，用于演示流程。

### 第 4 步：安装依赖

```bash
npm install
```

### 第 5 步：做语法检查

```bash
npm run check
```

### 第 6 步：启动服务

```bash
npm start
```

启动成功后，你应该看到类似日志：

```text
[INFO] server.started {"port":3000,"modelConfigured":false}
```

---

## 6. Docker 部署

### 第 1 步：进入目录

```bash
cd AI/agent/nodejs-agent-docker-demo
```

### 第 2 步：准备环境变量

```bash
cp .env.example .env
```

然后编辑 `.env`，把你的模型认证和模型地址填进去。

### 第 3 步：构建并启动

```bash
docker compose up --build -d
```

### 第 4 步：查看日志

```bash
docker compose logs -f
```

### 第 5 步：停止服务

```bash
docker compose down
```

---

## 7. API 说明

### 7.1 健康检查

请求：

```bash
curl http://localhost:3000/health
```

返回示例：

```json
{
  "ok": true,
  "modelConfigured": false,
  "service": "nodejs-agent-docker-demo"
}
```

### 7.2 对话接口

请求：

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"input":"请解释一下 agent 和 prompt 的关系"}'
```

返回示例：

```json
{
  "ok": true,
  "data": {
    "answer": "This is a mock response. Configure MODEL_API_KEY, MODEL_BASE_URL and MODEL_NAME to connect a real model provider.",
    "steps": 1,
    "usedTools": []
  }
}
```

---

## 8. 如何验证 Tool Call 流程

即使你还没填真实模型，也可以先验证最小 agent 流程。

### 示例 1：问时间

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"input":"现在时间是多少"}'
```

### 示例 2：让它做加法

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"input":"请帮我计算 12 + 30"}'
```

### 示例 3：问 agent 概念

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"input":"agent 和 tool 的关系是什么"}'
```

如果你看到日志里出现这些关键字，说明 Agent 的最小闭环已经打通：

- `agent.run.start`
- `model.mock_mode.active` 或 `model.request.start`
- `agent.run.tool_call`
- `tools.execute.finish`
- `http.chat.finish`

---

## 9. 真实接模型时需要注意什么

这个 Demo 默认假设你使用的是 **OpenAI 兼容接口**。

如果你接的是 OpenAI 兼容网关，一般只需要填：

- `MODEL_API_KEY`
- `MODEL_BASE_URL`
- `MODEL_NAME`

如果你接的是别的协议，例如厂商专有 SDK，那么你需要改 `src/modelClient.js`。

最需要关注的是这几个点：

- 返回结构里是否有 `choices[0].message`
- 是否支持 `tools`
- 是否支持 `tool_calls`
- `Authorization` 头是不是 Bearer
- 路径是不是 `/chat/completions`

---

## 10. 这个 Demo 里每个文件是干什么的

### `src/index.js`

- HTTP 入口
- 提供 `/health` 和 `/api/chat`

### `src/agentRuntime.js`

- Agent 主循环
- 控制模型调用和 tool 执行顺序

### `src/modelClient.js`

- 负责调用模型接口
- 没配模型时会进入 mock 模式

### `src/tools.js`

- 定义 tool schema
- 执行具体工具逻辑

### `src/config.js`

- 读取环境变量

### `src/logger.js`

- 输出统一格式日志

---

## 11. 你后面可以怎么改这个 Demo

如果你想把这个 Demo 改成自己的 Agent，最推荐按下面顺序改：

1. 先把 `MODEL_API_KEY`、`MODEL_BASE_URL`、`MODEL_NAME` 填好
2. 再确认真实模型支持 tool calling
3. 把 `tools.js` 里的 demo tool 换成你的业务 tool
4. 再调整 `SYSTEM_PROMPT`
5. 最后再接入 Web、钉钉、飞书或前端页面

比如你可以替换成：

- 查询订单状态
- 搜索知识库
- 查询数据库
- 调内部 API
- 发机器人消息

---

## 12. 常见问题

### Q1：为什么不填模型也能跑

因为这个 Demo 内置了 mock 模式。

这样你就算还没申请好密钥，也能先看到 Agent 的整体执行链路。

### Q2：为什么这是 Agent，不只是普通聊天接口

因为它不是“只把用户输入发给模型再返回”，而是：

- 会携带 system prompt
- 会暴露 tools 给模型
- 会执行 tool call
- 会把 tool 结果再回填给模型

这就是最小 Agent 闭环。

### Q3：为什么 tool 是程序写死的

因为模型不天然拥有这些能力。

真正能执行什么，是程序员预先开发好的。

模型只是在这些能力范围内决定“当前应该调用哪个能力”。

---

## 13. 最后一句总结

这个 Demo 最想让你看到的不是“怎么调某个具体厂商的模型”，而是：

> 自建 Agent 的本质，是你先写好一个具备若干能力的程序，再让大模型参与决策，决定什么时候调用这些能力，并把结果组织成最终输出。
