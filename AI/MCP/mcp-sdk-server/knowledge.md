# `@modelcontextprotocol/server` 知识文档

## 1. 这个包是什么

`@modelcontextprotocol/server` 是 MCP 官方 TypeScript 服务端 SDK。

可以把它理解成：

- 它不是 MCP 协议本身
- 它是“帮你实现 MCP Server 的工具库”

一句话：

> `@modelcontextprotocol/server` 是用 TypeScript/Node.js 开发 MCP Server 的官方服务端 SDK。

---

## 2. 为什么需要这个 SDK

理论上说，你也可以自己从头实现 MCP 协议。

但这会很麻烦，因为你得自己处理：

- 协议消息格式
- 初始化流程
- 工具注册
- transport 连接
- 各种请求和响应细节

官方 SDK 的作用就是：

- 把这些底层细节封装掉
- 让你更专注在“定义工具和写业务逻辑”上

---

## 3. 这个 SDK 在天气查询案例里扮演什么角色

在天气案例里，它是整个 MCP Server 的核心骨架。

例如：

```ts
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
```

这两行代码说明：

- `McpServer`：用来创建 MCP 服务实例
- `StdioServerTransport`：用来让这个服务通过 stdio 和客户端通信

---

## 4. 最重要的几个概念

### 4.1 `McpServer`

```ts
const server = new McpServer({
  name: "weather-mcp",
  version: "1.0.0",
});
```

这表示：

- 创建一个 MCP Server 实例
- 声明这个服务的名字和版本

### 4.2 `registerTool`

```ts
server.registerTool(...)
```

这一步是在告诉 MCP：

- 我有一个工具
- 这个工具叫什么
- 接收什么参数
- 怎么执行

### 4.3 `StdioServerTransport`

```ts
const transport = new StdioServerTransport();
await server.connect(transport);
```

这表示：

- 当前服务通过标准输入输出和客户端通信

---

## 5. 一个最小 MCP Server 长什么样

```ts
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

const server = new McpServer({
  name: "demo-server",
  version: "1.0.0",
});

server.registerTool(
  "add",
  {
    title: "Add Numbers",
    description: "Add two numbers together",
    inputSchema: z.object({
      a: z.number(),
      b: z.number(),
    }),
  },
  async ({ a, b }) => {
    return {
      content: [
        {
          type: "text" as const,
          text: `Result: ${a + b}`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
```

如果只从结构看，这段代码就 4 步：

1. 创建 server
2. 注册 tool
3. 定义参数 schema
4. 用 transport 启动

---

## 6. 初学者只需要先掌握哪些 API

当前阶段只需要先掌握：

- `new McpServer(...)`
- `server.registerTool(...)`
- `new StdioServerTransport()`
- `server.connect(...)`

这 4 个基本就能支撑你写出第一个 MCP Server。

---

## 7. 这个 SDK 和 MCP 协议是什么关系

这个关系很关键：

- MCP 是协议标准
- `@modelcontextprotocol/server` 是协议的一种官方 TypeScript 实现工具

所以不要把两者混成一件事。

---

## 8. 学到这里先记住什么

你先记住这几句：

1. `@modelcontextprotocol/server` 是官方 TypeScript 服务端 SDK
2. `McpServer` 是服务实例
3. `registerTool` 用来注册工具
4. `StdioServerTransport` 用来做本地 stdio 通信
5. 学 MCP 开发时，先会用 SDK 比先死啃协议更重要
