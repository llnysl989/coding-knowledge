# MCP 学习笔记

## 1. 这份文档解决什么问题

目标有两个：

1. 让我快速知道什么是 MCP，它解决了什么问题
2. 让我具备自己开发一个最小可用 MCP Server 的能力

阅读完后，应该能回答这几个问题：

- MCP 和普通 API / function calling 有什么区别
- MCP 里 host、client、server 分别是什么
- tools、resources、prompts 分别怎么理解
- 一个 MCP Server 从 0 到 1 怎么写、怎么接到客户端里
- 开发时最常见的坑有哪些

---

## 2. 什么是 MCP

MCP，全称 **Model Context Protocol**，中文常译为“模型上下文协议”。

可以把它理解成：

- 它是一套 **让 AI 应用和外部工具/数据源标准化通信** 的协议
- 它像 AI 世界里的“USB-C 接口”
- 以前每个 AI 客户端都要单独适配每个工具；有了 MCP 之后，工具只要按协议暴露一次，多个支持 MCP 的客户端就都能接入

它解决的核心问题是：

- 大模型本身不知道你的本地文件、数据库、内部 API、业务系统
- 如果每个 AI 客户端都手写一套集成逻辑，成本非常高
- MCP 提供统一的协议、能力声明、调用方式和传输方式，降低集成成本

一句话总结：

> MCP 是 AI 客户端与外部工具/上下文之间的标准协议，核心目标是“统一接入、统一发现、统一调用”。

---

## 3. MCP 为什么重要

### 3.1 没有 MCP 时

假设你有：

- 3 个 AI 客户端：Claude、Cursor、VS Code Copilot
- 4 个工具系统：文件系统、数据库、工单系统、知识库

没有 MCP 时，通常会变成很多套重复对接：

- Claude 接数据库一套
- Cursor 接数据库一套
- VS Code 接数据库一套
- 每个系统都要重复做权限、参数校验、调用协议转换

这就是典型的 **N x M 集成问题**。

### 3.2 有了 MCP 之后

你只需要：

- 为数据库做一个 MCP Server
- 为知识库做一个 MCP Server
- 客户端只需要支持 MCP 协议

结果就是：

- 工具侧做一次接入
- 客户端侧做一次协议支持
- 之后可以复用

这也是 MCP 被快速采用的原因之一。

---

## 4. MCP 的核心架构

MCP 的通信角色通常分为三层：

### 4.1 Host

Host 是最终承载 AI 能力的应用，例如：

- Claude Desktop / Claude Code
- VS Code + Copilot
- Cursor
- ChatGPT 等支持 MCP 的应用

Host 负责：

- 发起连接
- 管理用户授权
- 决定把哪些工具暴露给模型
- 处理工具调用确认、日志、权限边界

### 4.2 Client

Client 是 Host 内部负责对接 MCP 的那一层连接器。

可以简单理解为：

- Host 是整个应用
- Client 是应用里专门负责和 MCP Server 通信的模块

### 4.3 Server

Server 是你自己写的服务，它向客户端暴露能力，例如：

- 文件读取
- 搜索文档
- 查询数据库
- 创建工单
- 调业务 API

Server 不负责“大模型推理”，它负责：

- 声明自己有什么能力
- 接收参数
- 执行逻辑
- 返回结果

### 4.4 一张脑图理解

```text
用户
  -> AI Host（Claude / Cursor / VS Code）
    -> MCP Client（Host 内部连接器）
      -> MCP Server（你开发的服务）
        -> 文件 / 数据库 / API / 内部系统
```

---

## 5. MCP 的三个核心能力

MCP Server 最常见的三类能力：

### 5.1 Tools

Tools 是“可执行动作”，最常见，也最重要。

比如：

- `query_order(order_id)`
- `create_issue(title, description)`
- `read_file(path)`
- `get_weather(city)`

特点：

- 更像“函数调用”
- 通常会执行逻辑，甚至有副作用
- 大模型可以根据上下文决定是否调用

适合场景：

- 查数据
- 调接口
- 执行动作
- 自动化流程

### 5.2 Resources

Resources 是“可读取的数据资源”，更像“只读上下文”。

比如：

- `file:///docs/design.md`
- `db://table/orders/schema`
- `kb://faq/refund-policy`

特点：

- 更像 GET 资源
- 主要用于给模型补充上下文
- 理想情况下不应产生副作用

适合场景：

- 文档内容
- 配置项
- 表结构说明
- 知识库页面

### 5.3 Prompts

Prompts 是“可复用的提示模板”。

比如：

- 代码评审模板
- PR 总结模板
- 故障排查模板

特点：

- 不是执行外部动作
- 是把常用交互模板标准化
- 可带参数

适合场景：

- 固定格式工作流
- 面向用户的快捷操作
- 标准化提示词入口

### 5.4 如何记忆

- `Tools`：让 AI 去“做事”
- `Resources`：让 AI 去“读东西”
- `Prompts`：让 AI 按“模板工作”

如果你是初学者，**先学 tools 就够了**。大多数自建 MCP Server 的第一版，都是以 tools 为主。

---

## 6. MCP 和普通 API / Function Calling 的区别

### 6.1 和普通 REST API 的区别

REST API 是通用系统接口；
MCP 是专门为“AI 与工具协作”设计的协议。

MCP 在 REST 之上额外解决了这些问题：

- 工具发现：客户端可以先问“你有哪些工具”
- 输入 Schema：参数结构可标准化描述
- 能力协商：客户端和服务端可以声明各自支持的能力
- 统一消息格式：基于 JSON-RPC
- 更适合 AI 客户端把工具、安全、上下文整合起来

### 6.2 和模型原生 function calling 的区别

function calling 通常是：

- 某个模型厂商自己的接口能力
- 工具定义和调用过程绑定在该模型平台里

MCP 的优势是：

- 更开放
- 更偏标准协议
- 更适合跨客户端复用
- 工具和具体模型供应商解耦

一句话：

- `function calling` 更像“某个模型平台内部的工具调用机制”
- `MCP` 更像“多个 AI 客户端都能接的外部工具协议”

---

## 7. MCP 的协议基础

### 7.1 底层协议

MCP 使用 **JSON-RPC 2.0** 作为消息格式。

你可以把它理解成：

- 双方通过 JSON 消息通信
- 有 request / response / notification 三类消息

基本结构大致像这样：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

返回结果类似：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": []
  }
}
```

### 7.2 通信不是“无状态 HTTP 调一次就完”

MCP 更强调：

- 建立连接
- 初始化
- 能力协商
- 持续对话
- 过程中可以通知、取消、上报进度、打日志

因此它比“单次 HTTP 接口”更适合 agent/tool 场景。

---

## 8. MCP 的连接生命周期

一个典型 MCP 连接流程可以理解为：

```text
1. Host/Client 启动或连接 Server
2. Client 发送 initialize
3. Server 返回自身信息和 capabilities
4. Client 发送 initialized 通知
5. 双方开始正常通信
6. Client 发现 tools/resources/prompts
7. Client 触发调用，例如 tools/call
8. Server 返回结果
9. 连接关闭或进程退出
```

初学者要重点记住 3 件事：

1. **先初始化，再调用**
2. **先发现能力，再执行能力**
3. **客户端不是直接瞎调函数，而是按协议发消息**

---

## 9. 常见传输方式

### 9.1 STDIO

即通过标准输入输出和子进程通信。

这类方式最常见于本地开发，例如：

- Claude Desktop 拉起本地 server
- VS Code / Cursor 拉起本地 server
- 命令行工具本地集成

优点：

- 实现简单
- 本地开发方便
- 不需要自己先部署 HTTP 服务

缺点：

- 主要适合本地进程型接入
- 调试时要特别注意 stdout 不能乱打印

### 9.2 Streamable HTTP

即通过 HTTP 暴露 MCP 服务，适合远程部署或共享服务。

优点：

- 易于部署到服务器
- 多客户端可复用
- 更适合团队级 / 平台级能力

缺点：

- 需要考虑认证、网络、跨域、网关、安全策略

### 9.3 关于 SSE

你会在一些旧资料里看到 SSE。

需要知道的是：

- 早期资料或兼容模式里会提到 SSE
- 当前主线资料里更推荐关注 **stdio** 和 **streamable HTTP**
- 学习和入门阶段，优先掌握这两种即可

---

## 10. 开发一个 MCP Server，本质上在做什么

如果只从工程角度看，开发一个 MCP Server 的本质就是 4 步：

1. 创建 server 实例
2. 注册能力（通常先注册 tools）
3. 编写业务逻辑和参数校验
4. 用某种 transport 跑起来，让客户端连上

所以你不需要一开始就把 MCP 想得特别神秘。

它本质上像：

- 一个带标准协议包装层的工具服务
- 一个为 AI 客户端准备的“函数与上下文提供器”

---

## 11. 最推荐的新手开发路径

对于“我想自己开发一个 MCP”的目标，最推荐的路径是：

1. **先只做 tool，不做 resources/prompts**
2. **先做本地 stdio 版**
3. **先做一个无副作用工具**
4. **先接一个本地客户端验证**
5. **最后再扩展到 HTTP / 认证 / 多工具**

建议的第一个练手项目：

- 天气查询
- 本地文档搜索
- 读取指定目录文件
- 数据库只读查询
- Jira/飞书/Notion 查询类工具

不建议一上来就做：

- 自动删库
- 自动改代码并提交
- 带复杂 OAuth 的远程服务
- 多租户生产级平台

---

## 12. 用 TypeScript 开发一个最小 MCP Server

下面给出一个偏当前主流、适合入门的 TypeScript 版本。

### 12.1 初始化项目

```bash
mkdir my-mcp-server
cd my-mcp-server
npm init -y
npm install @modelcontextprotocol/server zod
npm install -D typescript @types/node
mkdir src
touch src/index.ts
```

### 12.2 `package.json` 建议

```json
{
  "name": "my-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "my-mcp-server": "./build/index.js"
  },
  "scripts": {
    "build": "tsc && chmod 755 build/index.js"
  },
  "files": ["build"]
}
```

### 12.3 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### 12.4 最小可运行示例

`src/index.ts`

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
    description: "Return the sum of two numbers",
    inputSchema: z.object({
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    }),
  },
  async ({ a, b }) => {
    const result = a + b;

    return {
      content: [
        {
          type: "text" as const,
          text: `Result: ${result}`,
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP server is running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

### 12.5 构建

```bash
npm run build
```

### 12.6 为什么这个例子值得背下来

因为它已经覆盖了 MCP Server 的最小闭环：

- 创建 server
- 注册 tool
- 用 schema 描述参数
- 返回 tool result
- 通过 stdio 暴露给客户端

只要你把 `add` 换成自己的业务逻辑，本质上就已经是一个可用的 MCP Server。

---

## 13. 用 Python 开发一个最小 MCP Server

如果你更熟悉 Python，官方生态里 `FastMCP` 也很适合入门。

### 13.1 安装

```bash
uv init my-mcp-python
cd my-mcp-python
uv add "mcp[cli]"
touch server.py
```

### 13.2 最小示例

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("demo-server")

@mcp.tool()
def add(a: int, b: int) -> int:
    """Return the sum of two numbers."""
    return a + b

if __name__ == "__main__":
    mcp.run()
```

这段代码的含义非常直接：

- `FastMCP("demo-server")`：创建服务
- `@mcp.tool()`：把函数注册成 tool
- 类型注解会参与 schema 生成
- `mcp.run()`：启动服务

如果你想快速做 PoC，Python 版本通常更快。

---

## 14. 如何把“最小例子”改成自己的业务 Server

把一个 demo tool 改造成业务 tool，通常只需要替换 3 个部分。

### 14.1 改 tool 名称

例如：

- `search_docs`
- `query_user_order`
- `create_ticket`

tool 名最好满足：

- 动宾结构
- 可读
- 不歧义

### 14.2 改输入参数 schema

输入参数一定要清晰，因为大模型要依赖它理解如何调用。

好的 schema 应该做到：

- 参数名准确
- 类型明确
- 描述具体
- 必填项明确

错误示例：

```ts
inputSchema: z.object({
  data: z.any(),
})
```

更好的示例：

```ts
inputSchema: z.object({
  orderId: z.string().describe("Business order id"),
  includeItems: z.boolean().default(false).describe("Whether to include line items"),
})
```

### 14.3 改工具内部逻辑

比如：

- 调数据库
- 调内部 HTTP API
- 读取文件
- 组合多个系统结果

建议第一版保持：

- 单一职责
- 返回文本清晰
- 错误信息明确

---

## 15. MCP Tool 设计最佳实践

### 15.1 一个 tool 只做一件事

不要把一个 tool 做成“万能入口”。

不推荐：

- `system_operator(action, payload)`

更推荐：

- `get_user_profile`
- `list_user_orders`
- `create_jira_issue`

### 15.2 名称要让模型一眼看懂

tool 名称和描述会直接影响模型会不会正确调用。

例如：

- 好：`search_project_docs`
- 差：`handle_data`

### 15.3 参数 schema 比代码本身还重要

对 MCP 来说，很多时候模型能不能正确调起工具，不取决于你逻辑写得多花，而取决于：

- 名字是否准确
- 描述是否清楚
- schema 是否约束合理

### 15.4 返回值尽量稳定

即使只是返回文本，也尽量保持结构统一，例如：

```text
Order Summary
- order_id: xxx
- status: paid
- amount: 199.00
```

如果 SDK 支持并且客户端能消费结构化输出，可以进一步返回结构化结果。

### 15.5 错误信息要可读

不要只返回：

```text
failed
```

更推荐：

```text
Query failed: order `A12345` does not exist
```

---

## 16. 开发时最容易踩的坑

### 16.1 在 stdio 模式下乱用 `console.log`

这是最经典的坑。

原因：

- stdio 模式下，`stdout` 是协议消息通道
- 你随手 `console.log("debug")`，可能会把 JSON-RPC 通道污染掉

建议：

- Node.js 里用 `console.error()`
- 或者写到日志文件

### 16.2 tool 描述写得太烂

表现为：

- 模型不知道什么时候该调它
- 调了也传错参数

解决方式：

- 名称明确
- 描述具体
- schema 完整

### 16.3 一个 tool 权限太大

例如：

- 可写任意目录
- 可执行任意 shell
- 可访问无限制数据库

这会带来严重风险。

建议：

- 做最小权限
- 限定目录
- 限定表
- 限定命令白名单
- 高风险操作需要用户确认

### 16.4 把 resources 和 tools 混着设计

判断方法：

- 只读、上下文型内容，用 resource
- 会执行动作、计算、查询逻辑，用 tool

如果你分不清，第一版先统一做 tool 也可以，但脑子里要知道二者概念不同。

### 16.5 一上来就做远程部署

建议先本地跑通：

- 本地 server
- 本地客户端接入
- 本地看到工具出现
- 本地能调用成功

等闭环打通后再做 HTTP 化、认证、部署。

---

## 17. 一个完整的自研 MCP 开发流程

下面这个流程基本适合大多数场景。

### 17.1 第一步：定义目标

先回答 3 个问题：

1. 这个 MCP 要给 AI 提供什么能力
2. 它更适合做 tool、resource 还是 prompt
3. 风险边界是什么

例如：

- 目标：让 AI 查询订单状态
- 形态：tool
- 边界：只读订单信息，不允许改订单

### 17.2 第二步：设计接口

至少要设计清楚：

- tool name
- description
- input schema
- output格式
- 错误返回

### 17.3 第三步：实现逻辑

实现内容包括：

- 参数校验
- 调外部依赖
- 异常处理
- 返回结果

### 17.4 第四步：本地验证

验证点：

- Server 能启动
- 客户端能识别到工具
- 模型能正确调用
- 返回结果可读
- 错误时信息清晰

### 17.5 第五步：加安全控制

例如：

- 用户确认
- 目录白名单
- API 权限隔离
- 审计日志
- 限流与超时

### 17.6 第六步：再考虑部署与复用

当本地版本稳定后，再考虑：

- npm / PyPI 发布
- 团队共享
- HTTP 化
- 认证接入

---

## 18. 如何接入客户端进行验证

### 18.1 在 VS Code 中验证

可以在项目根目录创建 `.vscode/mcp.json`：

```json
{
  "servers": {
    "demo-server": {
      "type": "stdio",
      "command": "node",
      "args": ["./build/index.js"]
    }
  }
}
```

然后：

1. 打开支持 MCP 的 VS Code 环境
2. 确认 server 被识别
3. 在 Agent 模式下查看 tools
4. 直接用自然语言触发调用

### 18.2 在 Claude Code 中验证

如果你的 server 是 HTTP 方式运行，例如本地监听 `http://localhost:8000/mcp`，可用类似方式接入：

```bash
claude mcp add --transport http my-server http://localhost:8000/mcp
```

如果是 stdio 模式，则通常以命令方式注册本地 server。

### 18.3 最低验证标准

你至少要确认这 4 件事：

1. 工具能被客户端发现
2. 工具能被模型正确调用
3. 参数传递正确
4. 返回结果能被模型理解

---

## 19. 什么时候该用 MCP，什么时候不该用

### 19.1 适合用 MCP 的场景

- 希望让多个 AI 客户端复用同一批工具
- 希望工具由 AI 自动发现和调用
- 希望把“外部系统能力”标准化暴露给 AI
- 希望做 Agent 工作流

### 19.2 不一定要用 MCP 的场景

- 只是一个单一后端接口，不需要给 AI 客户端通用接入
- 工具只服务某个固定模型平台，且不会迁移
- 没有工具发现、上下文标准化、协议复用的需求

简单判断：

- 如果你在做“AI 通用工具接入层”，优先考虑 MCP
- 如果你只是写普通业务接口，REST/gRPC 可能更直接

---

## 20. 安全与边界控制

MCP 很强，但危险也很真实。

尤其是以下类型的工具：

- 文件写入
- Shell 执行
- 数据删除
- 发消息 / 发邮件
- 创建和修改线上资源

最基本的安全原则：

### 20.1 最小权限

只给它必须的权限，不要给“全盘访问”。

### 20.2 用户可见、可控

高风险动作最好：

- 明确展示工具要做什么
- 要求人工确认

### 20.3 参数白名单

例如：

- 只允许访问某个目录
- 只允许访问某些表
- 只允许执行某几个动作

### 20.4 做审计日志

至少记录：

- 谁调用了
- 调了哪个 tool
- 参数是什么
- 结果是什么
- 是否失败

### 20.5 设置超时和异常处理

避免因为外部系统异常把整个交互拖死。

---

## 21. 你可以马上动手做的 3 个练习

### 练习 1：计算器 MCP

目标：

- 暴露 `add`、`subtract`、`multiply`

你会学到：

- 如何注册多个 tool
- 如何写 schema
- 如何返回结果

### 练习 2：本地文档搜索 MCP

目标：

- 输入关键词，返回指定目录下匹配文档

你会学到：

- 如何读文件
- 如何限制目录权限
- 如何把搜索结果组织成模型易读文本

### 练习 3：业务查询 MCP

目标：

- 输入订单号，查询订单状态

你会学到：

- 如何调内部 API
- 如何做错误处理
- 如何设计更真实的业务 tool

这 3 个做完，基本就不是“只会看概念”了。

---

## 22. 我自己对 MCP 的理解框架

为了便于记忆，可以用下面这套心智模型：

### 22.1 从产品视角看

MCP 是 AI 客户端的“工具接入标准”。

### 22.2 从协议视角看

MCP 是基于 JSON-RPC 的“能力发现 + 能力调用 + 生命周期管理”协议。

### 22.3 从工程视角看

MCP Server 就是一个：

- 有清晰 schema
- 能暴露工具
- 能被 AI 客户端发现和调用
- 带一定安全边界

的服务。

### 22.4 从学习路径看

学 MCP 不要从“规范全文”开始死啃，效率很低。

更有效的顺序是：

1. 先理解它解决什么问题
2. 再理解三大能力
3. 再做一个最小 tool server
4. 再接客户端验证
5. 最后再补协议和高级能力

---

## 23. 5 分钟复盘版

如果只看一页，记住下面这些就够了。

### 23.1 MCP 是什么

- 是 AI 应用连接外部工具和数据源的标准协议

### 23.2 MCP 里最重要的是什么

- `Tools`

### 23.3 MCP Server 是什么

- 你开发的、向 AI 暴露能力的服务

### 23.4 最适合新手怎么学

- 先做本地 stdio tool server

### 23.5 最小开发步骤

```text
创建 server
-> 注册 tool
-> 写 schema 和逻辑
-> 启动 transport
-> 接入客户端测试
```

### 23.6 最大的坑

- stdio 模式下往 stdout 乱打印日志

---

## 24. 下一步行动建议

如果我要真正“能自己开发一个 MCP”，建议按下面顺序做：

1. 先照着 TypeScript 最小示例跑通一个 `add` 工具
2. 再把 `add` 改成一个你自己的真实业务工具
3. 在客户端里确认它能被发现和调用
4. 给它补上错误处理、权限边界、日志
5. 再考虑扩展 resources / prompts / HTTP 部署

如果只能做一件事，那就做：

> 写出一个本地可运行、客户端可识别、能成功执行一次的 MCP tool server。

这一步一旦成功，你对 MCP 的理解会比只看十篇文章都更扎实。

---

## 25. 参考资料

以下资料建议优先看官方：

- MCP 介绍：<https://modelcontextprotocol.io/introduction>
- MCP 最新规范：<https://modelcontextprotocol.io/specification/latest/index>
- TypeScript SDK Quickstart：<https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server-quickstart.md>
- Python SDK 文档：<https://github.com/modelcontextprotocol/python-sdk/blob/main/README.md>

---

## 26. 一句话结论

> MCP = 面向 AI 工具接入的标准协议；学会它的最快方式，不是背规范，而是亲手写一个最小 tool server 并接到客户端里跑通。

---

## 27. 补充 FAQ

### 27.1 怎么保证一个 MCP Server 能兼容多个 AI 客户端

先说结论：

> 兼容多个客户端的关键，不是给每个客户端单独适配，而是尽量只依赖 MCP 的公共标准能力。

也就是说，你的 server 要尽量写成：

- 一个符合 MCP 协议的标准 server
- 而不是某个 AI 客户端的“私有插件”

#### 要点 1：优先遵循标准，不依赖私有行为

要兼容多个客户端，第一原则是：

- 初始化流程按标准来
- 能力声明按标准来
- `tools/list`、`tools/call` 等能力按标准来
- 消息格式遵循 `JSON-RPC 2.0`

不要假设：

- 某个客户端一定会自动确认高风险操作
- 某个客户端一定会支持你自定义的字段
- 某个客户端一定会按你想象的方式渲染结果

#### 要点 2：优先实现最通用的能力

从兼容性角度，推荐优先级是：

1. `tools`
2. `resources`
3. `prompts`

原因很简单：

- 大多数客户端对 `tools` 的支持最成熟
- `resources` 和 `prompts` 的支持情况可能因客户端不同而有差异

所以如果你想“先让多个客户端都能用”，第一版先把核心能力放在 `tools` 上最稳。

#### 要点 3：工具定义要清晰

客户端兼容是一层，模型能不能正确使用又是另一层。

一个 tool 如果想更容易在不同客户端里都表现稳定，建议做到：

- `name` 清楚
- `description` 清楚
- `inputSchema` 清楚
- 返回结果稳定

例如，不要定义这种工具：

```text
tool name: handle_data
description: process something
```

更推荐：

```text
tool name: get_order_status
description: Query the current status of an order by order id
```

#### 要点 4：返回值尽量简单、稳定、可读

不同客户端对结果展示方式可能不同，因此第一版最好：

- 先返回清晰文本
- 或返回标准结构化结果
- 不依赖某个客户端特有的渲染能力

例如：

```text
Order Summary
- order_id: A123
- status: paid
- amount: 199.00
```

这类结果在不同客户端里通常都比较稳。

#### 要点 5：同时考虑常见 transport

如果你想覆盖不同类型客户端，建议这样做：

- 本地型客户端：优先支持 `stdio`
- 远程型或共享型场景：再补 `streamable HTTP`

很多本地 AI 工具更容易接 `stdio`；
很多平台化、团队化场景更适合 `HTTP`。

#### 要点 6：做最基本的多客户端验证

真正的兼容，最后还是要靠验证。

至少建议测两类客户端：

- 一个偏本地开发工具类客户端
- 一个偏通用 AI 助手类客户端

最低验证标准：

1. 能发现 server
2. 能看到 tools
3. 能正确传参调用
4. 能稳定返回结果
5. 不依赖客户端私有扩展

#### 最常见的不兼容来源

- 只在一个客户端上测过
- 依赖客户端私有扩展
- tool 描述太模糊，导致模型在不同客户端里调用不稳定
- `stdio` 模式下往 `stdout` 乱打印日志
- 返回格式过于花哨或夹带客户端私货

#### 一句话理解

- 想兼容多个 AI 客户端，就把 MCP Server 写成“标准服务”
- 少依赖客户端特性，多依赖 MCP 公共协议

### 27.2 MCP 的通信角色到底怎么理解

很多人第一次看 MCP，最容易混淆的是这三个词：

- `Host`
- `Client`
- `Server`

可以先记一句最短的话：

> Host 是用户看到的 AI 应用，Client 是 Host 里负责 MCP 通信的模块，Server 是你开发的能力提供方。

#### 角色 1：Host

Host 是用户真正使用的 AI 应用。

例如：

- Claude Desktop
- Claude Code
- Cursor
- VS Code 里的 AI 助手

Host 负责：

- 跟用户交互
- 展示结果
- 处理确认框、权限提示、安全控制

#### 角色 2：Client

Client 是 Host 内部负责和 MCP Server 通信的连接器。

它通常不直接给用户看，但它很关键。

它负责：

- 建立连接
- 发送初始化请求
- 拉取 tools/resources/prompts
- 发起 `tools/call`
- 接收 server 返回结果

可以把它理解成：

- Host 里的“协议通信层”

#### 角色 3：Server

Server 就是你开发的 MCP 服务。

它负责：

- 声明自己提供哪些能力
- 接收客户端请求
- 执行业务逻辑
- 返回结果

例如你写了一个订单查询 MCP，那么这个 server 可能提供：

- `get_order_status`
- `list_user_orders`
- `query_refund_progress`

#### 一个真实例子：查询订单状态

假设你在一个支持 MCP 的编辑器里接了一个“订单查询 MCP”。

角色对应关系如下：

- `Host`：Cursor
- `Client`：Cursor 内部的 MCP 连接模块
- `Server`：你自己写的 `order-mcp-server`

当你输入一句话：

```text
帮我查一下订单 A123 的状态
```

背后发生的事情可以理解为：

1. 你在 `Host` 里提问，也就是在 Cursor 里提问
2. Host 内部的模型判断，这个问题可能需要调用工具
3. `Client` 已经知道你的 `Server` 暴露了 `get_order_status`
4. Client 按 MCP 协议向 Server 发起调用
5. `Server` 收到请求后，去查数据库或业务 API
6. Server 把结果返回给 Client
7. Client 再把结果交还给 Host
8. Host 最终把自然语言答案展示给你

#### 把上面翻译成一句人话

不是你直接在调 server。

而是：

- 你对 AI 应用说话
- AI 应用内部的 MCP Client 再去调用你的 MCP Server

#### 用“餐厅”类比更容易懂

可以这样类比：

- `Host`：餐厅前台服务员
- `Client`：服务员手里的点单系统
- `Server`：后厨
- 用户：顾客

流程就是：

1. 顾客告诉服务员要吃什么
2. 服务员通过点单系统下单
3. 后厨做菜
4. 菜做好后返回
5. 服务员把菜端给顾客

映射到 MCP：

- 顾客不会直接对后厨喊话
- 用户也不会直接和 MCP Server 通信
- 中间一定隔着 Host 和它内部的 Client

#### 再给一个本地文档搜索例子

假设你自己写了一个 `search_docs` MCP Server，用来搜索本地项目文档。

角色如下：

- `Host`：Claude Code
- `Client`：Claude Code 内部的 MCP 连接器
- `Server`：你写的本地文档搜索 server

当你说：

```text
帮我找项目里和支付回调有关的文档
```

背后流程是：

1. Claude Code 接收你的请求
2. 它内部的模型判断需要用 `search_docs`
3. MCP Client 调用你的 server
4. 你的 server 在指定目录里搜索文件
5. 返回命中的文档路径和摘要
6. Claude Code 把这些结果组织成最终回答给你

#### 为什么要拆成这三个角色

因为这三件事本来就不同：

- `Host` 负责用户体验
- `Client` 负责协议通信
- `Server` 负责能力提供

把它们拆开，才能做到：

- AI 应用和工具服务解耦
- 一个 server 被多个 host 复用
- 协议层和业务层分离

#### 最短记忆法

- `Host`：用户看到的 AI 应用
- `Client`：Host 里面负责 MCP 通信的模块
- `Server`：你开发的工具服务

---

## 28. 什么是 MCP Server

在学 MCP 的时候，最容易有一个误区：

- 以为 MCP 是一个“聊天产品”
- 或者以为 MCP Server 本身会直接和用户对话

其实不是。

一句话先说清楚：

> MCP Server 本质上是一个“按 MCP 协议暴露能力的服务”，它负责提供工具、资源或提示模板，不直接承担最终用户交互。

### 28.1 从职责上看，MCP Server 在做什么

一个 MCP Server 通常负责 4 件事：

1. 告诉客户端“我有哪些能力”
2. 接收客户端发来的调用请求
3. 执行业务逻辑
4. 把结果按协议返回

比如一个天气查询 MCP Server，可能提供：

- `get-alerts`
- `get-forecast`

当客户端要调用这些工具时，MCP Server 才会真正去请求天气 API，然后把结果返回。

### 28.2 从工程上看，MCP Server 像什么

如果你先不看“AI”这层，单从工程视角看，MCP Server 很像：

- 一个本地工具服务
- 一个带标准协议包装的函数集合
- 一个专门给 AI 客户端调用的后端服务

只是它和普通后端接口不同的地方在于：

- 它按 MCP 协议工作
- 它强调“能力发现”和“标准化调用”
- 它通常会被 AI 客户端动态发现并调用

### 28.3 用天气案例理解 MCP Server

在天气案例中，MCP Server 并不负责“理解用户自然语言”。

它负责的是：

- 暴露 `get-alerts`
- 暴露 `get-forecast`
- 校验参数
- 请求天气 API
- 返回结果

而真正负责和用户聊天的，是：

- Claude Code
- Cursor
- VS Code 里的 AI 助手

这些是 `Host`。

### 28.4 MCP Server 和普通 API 服务的区别

普通 API 服务更像：

- 你手动定义接口
- 前端或后端按固定方式调用

MCP Server 更像：

- 先声明自己有哪些工具
- 由 AI 客户端先发现能力
- 再由模型决定要不要调用

所以 MCP Server 更像“面向 AI 客户端的标准工具服务”。

---

## 29. 开发一个 MCP Server 时，这些前置技术分别在干什么

你在天气案例里会看到这些词：

- TypeScript
- Node.js 20+
- `@modelcontextprotocol/server`
- Zod
- stdio

如果不把它们拆开，很容易全混在一起。

所以这里把角色一次讲清楚。

### 29.1 TypeScript：写代码的语言层

TypeScript 主要负责：

- 让代码更清晰
- 给参数和返回值加类型
- 帮你更早发现错误

在项目里，你写的是：

- `src/index.ts`

也就是说：

- TypeScript 是你开发 MCP Server 时使用的主要代码语言

### 29.2 Node.js：运行代码的环境层

Node.js 主要负责：

- 运行编译后的 JavaScript
- 提供 `npm`
- 启动本地 MCP Server 进程

你最终运行的通常是：

```bash
node build/index.js
```

所以：

- TypeScript 负责“写”
- Node.js 负责“跑”

### 29.3 `@modelcontextprotocol/server`：MCP 服务端 SDK

这个包主要负责：

- 创建 MCP Server
- 注册 tool
- 处理 transport
- 帮你按 MCP 方式启动服务

最核心的几个 API 往往是：

- `new McpServer(...)`
- `server.registerTool(...)`
- `new StdioServerTransport()`
- `server.connect(...)`

所以它相当于：

- MCP 协议在 TypeScript 里的官方服务端开发工具

### 29.4 Zod：参数结构和校验层

Zod 主要负责：

- 描述工具参数长什么样
- 约束参数类型
- 帮客户端和模型理解输入结构

例如：

```ts
inputSchema: z.object({
  state: z.string().length(2)
})
```

这表示：

- `state` 必须是长度为 2 的字符串

所以 Zod 是：

- 工具输入结构的“说明书”

### 29.5 stdio：本地通信层

stdio 主要负责：

- 让客户端和本地 MCP Server 通过标准输入输出通信

它最常见于：

- Claude Code 拉起本地 server
- VS Code 拉起本地 server
- Cursor 拉起本地 server

你会看到类似代码：

```ts
const transport = new StdioServerTransport();
await server.connect(transport);
```

所以 stdio 是：

- 本地模式下的通信通道

### 29.6 把它们串成一张图

```text
TypeScript：负责写代码
  ->
Zod：负责定义工具输入结构
  ->
@modelcontextprotocol/server：负责搭建 MCP Server
  ->
Node.js：负责运行编译后的服务
  ->
stdio：负责让本地客户端和 server 通信
```

如果把天气案例代进去，可以这样理解：

```text
你用 TypeScript 写天气查询服务
-> 用 Zod 定义 get-alerts / get-forecast 的参数
-> 用 @modelcontextprotocol/server 注册这些工具
-> 用 Node.js 启动这个本地服务
-> 用 stdio 让客户端和这个服务对接
```

---

## 30. 如果我完全是新手，应该先学什么

如果你当前阶段的状态是：

- 还没搞清楚 TypeScript
- 还不理解 Node.js
- 看不懂 `z.object(...)`
- 不知道为什么不能 `console.log`

那最推荐的学习顺序是：

1. 先学 TypeScript
2. 再学 Node.js
3. 再学 Zod
4. 再学 stdio
5. 最后学 `@modelcontextprotocol/server`
6. 然后回头看天气查询案例

因为这个顺序最符合你真正开发时的依赖关系。

---

## 31. 对应的前置知识文档入口

为了配合这部分学习，我已经把前置知识拆成了独立文档，建议按顺序看：

- `mcp-basics/README.md`
- `mcp-basics/typescript/knowledge.md`
- `mcp-basics/nodejs/knowledge.md`
- `mcp-basics/zod/knowledge.md`
- `mcp-basics/stdio/knowledge.md`
- `mcp-basics/mcp-sdk-server/knowledge.md`

建议学习路径：

```text
先看前置知识
-> 再看本篇 MCP 学习笔记
-> 最后看天气查询 MCP 实战案例
```
