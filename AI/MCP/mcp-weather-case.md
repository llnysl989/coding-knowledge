# 天气查询 MCP 开发案例

## 1. 文档目标

这是一份从 0 到 1 的实战案例文档，目标是带你亲手做出一个“天气查询 MCP Server”。

阅读完并跟着做完后，你应该能掌握：

1. 如何初始化一个 MCP 项目
2. 如何使用 TypeScript 官方 SDK 编写一个 MCP Server
3. 如何注册两个天气查询工具
4. 如何在本地运行并调试这个 MCP
5. 如何把这个 MCP 接入客户端进行验证
6. 如何定位常见报错

这份案例故意选“天气查询”作为题目，因为它足够简单，又完整覆盖了 MCP 开发闭环：

- 定义工具
- 参数校验
- 调外部 API
- 返回结果
- 通过 stdio 暴露给客户端

---

## 2. 先明确：我们要做一个什么东西

我们要做一个本地运行的 MCP Server，它暴露两个工具：

1. `get-alerts`
   用来根据美国州代码查询天气预警
2. `get-forecast`
   用来根据经纬度查询天气预报

这个 server 本身不负责和用户对话，它只负责：

- 告诉客户端“我有这两个工具”
- 接收工具参数
- 请求天气 API
- 把结果返回给客户端

最终形态是这样的：

```text
用户
  -> AI 客户端（如 Trae / Cursor / Claude Code）
    -> MCP Client（客户端内部的 MCP 通信层）
      -> 你的天气查询 MCP Server
        -> 美国国家气象局 API
```

---

## 3. 这个案例里会用到什么

### 3.1 技术栈

- 语言：TypeScript
- Runtime：Node.js 20+
- MCP SDK：`@modelcontextprotocol/server`
- 参数校验：`zod`
- 传输方式：`stdio`
- 外部数据源：美国国家气象局 API（NWS API）

### 3.2 为什么选择 stdio

因为它最适合入门：

- 本地开发简单
- 不需要先部署 HTTP 服务
- 大部分本地 AI 客户端都容易接入

### 3.3 先理解一下两个天气工具

#### 工具 1：`get-alerts`

输入：

- `state`：州代码，例如 `CA`、`TX`

输出：

- 当前该州的天气预警列表

#### 工具 2：`get-forecast`

输入：

- `latitude`
- `longitude`

输出：

- 该坐标位置的天气预报

---

## 4. 项目目录规划

建议使用下面这种结构：

```text
weather-mcp/
├── package.json
├── tsconfig.json
├── .trae/
│   └── mcp.json
└── src/
    └── index.ts
```

每个文件的作用：

- `package.json`：声明依赖和构建脚本
- `tsconfig.json`：TypeScript 编译配置
- `.trae/mcp.json`：用于在 Trae 里注册 MCP Server
- `src/index.ts`：服务端主代码

---

## 5. 第一步：初始化项目

在终端里执行：

```bash
mkdir weather-mcp
cd weather-mcp
npm init -y
npm install @modelcontextprotocol/server zod @cfworker/json-schema
npm install -D typescript @types/node
mkdir src
touch src/index.ts
```

### 5.1 为什么安装这些依赖

- `@modelcontextprotocol/server`
  官方 TypeScript 服务端 SDK，用来创建 MCP Server 和注册工具

- `zod`
  用来定义工具入参 schema，让客户端和模型知道参数长什么样

- `@cfworker/json-schema`
  当前 `@modelcontextprotocol/server@2.0.0-alpha.2` 运行时会用到它，提前装上可以避免本地启动时报模块缺失

- `typescript`
  编译 TypeScript

- `@types/node`
  提供 Node.js 类型定义

---

## 6. 第二步：配置 `package.json`

把 `package.json` 改成下面这样：

```json
{
  "name": "weather-mcp",
  "version": "1.0.0",
  "description": "A weather MCP server example",
  "type": "module",
  "bin": {
    "weather-mcp": "./build/index.js"
  },
  "scripts": {
    "build": "tsc && chmod 755 build/index.js",
    "start": "node build/index.js"
  },
  "files": ["build"],
  "dependencies": {
    "@cfworker/json-schema": "^4.1.1",
    "@modelcontextprotocol/server": "2.0.0-alpha.2",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 6.1 重点解释

- `"type": "module"`
  让项目使用 ESM 模块规范

- `"build": "tsc && chmod 755 build/index.js"`
  编译 TypeScript 并让输出文件可执行

- `"start": "node build/index.js"`
  用来本地启动已经编译好的服务

> 注意：这里的 `@modelcontextprotocol/server` 目前 npm 上可用版本是 `2.0.0-alpha.2`。如果后续官方发布了新版本，以你本地 `npm install` 的实际结果为准。

---

## 7. 第三步：配置 `tsconfig.json`

新建 `tsconfig.json`：

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
    "forceConsistentCasingInFileNames": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### 7.1 这份配置在干什么

- `target: ES2022`
  生成较新的 JavaScript 代码

- `module: Node16`
  按 Node.js ESM 方式处理模块

- `outDir: ./build`
  编译结果输出到 `build` 目录

- `rootDir: ./src`
  说明源码都在 `src` 目录下

- `strict: true`
  开启严格模式，减少类型错误

---

## 8. 第四步：编写 MCP Server 主代码

下面是完整可运行的 `src/index.ts`。

这份代码特意加了较完整注释，建议你先整体复制，再逐段理解。

```ts
import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

// 美国国家气象局 API 的基础地址。
// 这个案例用它作为天气数据来源。
const NWS_API_BASE = "https://api.weather.gov";

// User-Agent 是许多公共 API 都建议携带的标识信息。
// 真实项目里建议改成你的应用名或团队名。
const USER_AGENT = "weather-mcp-example/1.0";

// 创建 MCP Server 实例。
// 这里的 name 和 version 会在 MCP 初始化阶段暴露给客户端。
const server = new McpServer({
  name: "weather-mcp",
  version: "1.0.0",
});

// =========================
// 一、定义接口类型
// =========================

// 天气预警返回数据中的单条预警结构。
interface AlertFeature {
  properties: {
    event?: string;
    areaDesc?: string;
    severity?: string;
    status?: string;
    headline?: string;
  };
}

// 天气预警接口返回体。
interface AlertsResponse {
  features: AlertFeature[];
}

// 坐标查询接口返回体，用于拿 forecast URL。
interface PointsResponse {
  properties?: {
    forecast?: string;
  };
}

// 单个天气预报周期，例如“Tonight”“Monday”等。
interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
  windSpeed?: string;
  windDirection?: string;
  shortForecast?: string;
}

// 天气预报接口返回体。
interface ForecastResponse {
  properties?: {
    periods?: ForecastPeriod[];
  };
}

// =========================
// 二、封装通用请求函数
// =========================

// 这个函数负责向 NWS API 发请求，并统一处理异常。
// 之所以单独封装，是因为多个工具都会复用。
async function makeNWSRequest<T>(url: string): Promise<T | null> {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });

    // 如果 HTTP 状态码不是 2xx，这里主动抛错。
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    // 注意：stdio 模式下不要使用 console.log。
    // 标准输出 stdout 是给 MCP 协议消息使用的，乱写会污染通信通道。
    // 所以调试日志要写到 stderr，也就是 console.error。
    console.error("Error making NWS request:", error);
    return null;
  }
}

// =========================
// 三、封装数据格式化函数
// =========================

// 把单条预警对象格式化成更适合直接展示给模型的文本。
function formatAlert(feature: AlertFeature): string {
  const props = feature.properties;

  return [
    `Event: ${props.event || "Unknown"}`,
    `Area: ${props.areaDesc || "Unknown"}`,
    `Severity: ${props.severity || "Unknown"}`,
    `Status: ${props.status || "Unknown"}`,
    `Headline: ${props.headline || "No headline"}`,
    "---",
  ].join("\n");
}

// 把单条天气预报格式化成文本。
function formatForecastPeriod(period: ForecastPeriod): string {
  return [
    `${period.name || "Unknown"}:`,
    `Temperature: ${period.temperature ?? "Unknown"}°${period.temperatureUnit || "F"}`,
    `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || ""}`.trim(),
    `${period.shortForecast || "No forecast available"}`,
    "---",
  ].join("\n");
}

// =========================
// 四、注册工具：get-alerts
// =========================

server.registerTool(
  "get-alerts",
  {
    title: "Get Weather Alerts",
    description: "Get active weather alerts for a US state by its two-letter code",
    inputSchema: z.object({
      state: z
        .string()
        .length(2)
        .describe("Two-letter US state code, such as CA, NY, or TX"),
    }),
  },
  async ({ state }) => {
    // 统一把州代码转成大写，避免用户传入 ca、tx 之类时出问题。
    const stateCode = state.toUpperCase();

    // NWS 提供按州查询预警的接口。
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await makeNWSRequest<AlertsResponse>(alertsUrl);

    // 如果请求失败，返回明确的错误提示。
    if (!alertsData) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to retrieve weather alerts for state ${stateCode}.`,
          },
        ],
      };
    }

    const features = alertsData.features || [];

    // 没有预警不是错误，是正常情况。
    if (features.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No active alerts for ${stateCode}.`,
          },
        ],
      };
    }

    const formattedAlerts = features.map(formatAlert).join("\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Active alerts for ${stateCode}:\n\n${formattedAlerts}`,
        },
      ],
    };
  }
);

// =========================
// 五、注册工具：get-forecast
// =========================

server.registerTool(
  "get-forecast",
  {
    title: "Get Weather Forecast",
    description: "Get weather forecast for a location by latitude and longitude",
    inputSchema: z.object({
      latitude: z
        .number()
        .min(-90)
        .max(90)
        .describe("Latitude of the location, for example 37.7749"),
      longitude: z
        .number()
        .min(-180)
        .max(180)
        .describe("Longitude of the location, for example -122.4194"),
    }),
  },
  async ({ latitude, longitude }) => {
    // 第一步不是直接查 forecast，而是先查 points 接口。
    // 因为 NWS 需要先根据经纬度映射到具体的 forecast URL。
    const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsData = await makeNWSRequest<PointsResponse>(pointsUrl);

    if (!pointsData) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to retrieve grid point data for coordinates ${latitude}, ${longitude}. The location may be unsupported by the API.`,
          },
        ],
      };
    }

    const forecastUrl = pointsData.properties?.forecast;

    // 如果没拿到 forecast 地址，说明上游返回不完整。
    if (!forecastUrl) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to get forecast URL for coordinates ${latitude}, ${longitude}.`,
          },
        ],
      };
    }

    // 第二步才是真正获取天气预报。
    const forecastData = await makeNWSRequest<ForecastResponse>(forecastUrl);

    if (!forecastData) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to retrieve forecast data for coordinates ${latitude}, ${longitude}.`,
          },
        ],
      };
    }

    const periods = forecastData.properties?.periods || [];

    if (periods.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No forecast periods available for coordinates ${latitude}, ${longitude}.`,
          },
        ],
      };
    }

    const formattedForecast = periods.map(formatForecastPeriod).join("\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast}`,
        },
      ],
    };
  }
);

// =========================
// 六、启动 server
// =========================

async function main() {
  // stdio transport 表示客户端会通过标准输入输出和当前进程通信。
  const transport = new StdioServerTransport();

  // 建立 MCP 连接，开始监听请求。
  await server.connect(transport);

  // 依然强调：日志写 stderr，不写 stdout。
  console.error("Weather MCP server is running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
```

---

## 9. 第五步：理解上面这份代码到底做了什么

如果你感觉代码能看懂但脑子里还没形成整体图，按下面的顺序理解就够了。

### 9.1 创建 server

```ts
const server = new McpServer({
  name: "weather-mcp",
  version: "1.0.0",
});
```

这一步是“创建 MCP 服务本体”。

可以理解成：

- 开一个服务实例
- 告诉客户端我是谁、版本是什么

### 9.2 注册工具

```ts
server.registerTool(...)
```

这一步就是“把函数暴露成 MCP tool”。

每个 tool 要有三部分：

1. 名称
2. 配置
3. 实现逻辑

### 9.3 用 `zod` 定义参数 schema

```ts
inputSchema: z.object({
  state: z.string().length(2)
})
```

这个 schema 非常重要，因为它决定：

- 客户端怎么展示参数信息
- 模型怎么理解这个工具要什么参数
- 参数类型怎么校验

### 9.4 处理业务逻辑

工具函数里面做的就是普通后端逻辑：

- 拼 URL
- 发 HTTP 请求
- 校验结果
- 格式化输出

所以从工程角度看，MCP Server 本质上并不神秘。

### 9.5 返回结果

```ts
return {
  content: [
    {
      type: "text" as const,
      text: "..."
    }
  ]
};
```

这表示工具调用成功后，返回一段文本内容给客户端和模型。

对于入门案例，这种返回方式最稳。

### 9.6 用 stdio 跑起来

```ts
const transport = new StdioServerTransport();
await server.connect(transport);
```

这一步表示：

- 当前进程开始通过 stdin/stdout 和 MCP 客户端通信

---

## 10. 第六步：构建项目

执行：

```bash
npm run build
```

如果成功，你会看到 `build/index.js`。

### 10.1 为什么一定要先 build

因为很多客户端注册 MCP Server 时，实际运行的是编译后的 JavaScript 文件，而不是 TypeScript 源码。

---

## 11. 第七步：本地启动测试

执行：

```bash
node build/index.js
```

如果正常，你会看到类似日志：

```text
Weather MCP server is running on stdio
```

然后进程会挂在那里等待输入。

这不是卡住了，而是正常状态，说明它正在等 MCP Client 连接。

### 11.1 如果你看到进程秒退

优先检查：

- 是否已经 `npm run build`
- `build/index.js` 是否存在
- Node 版本是否足够新
- 导入路径是否正确

---

## 12. 第八步：接入 Trae 验证

先在 Trae 里打开：

- `Settings > MCP`
- 打开 `Enable Project MCP`

然后在项目根目录创建 `.trae/mcp.json`：

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["./build/index.js"]
    }
  }
}
```

### 12.1 这份配置是什么意思

- `weather`
  这是你给 server 取的本地名字

- `"command": "node"`
  表示由 Node 来启动 server

- `"args": ["./build/index.js"]`
  表示运行编译后的主程序

> 如果 Trae 没有在项目根目录拉起命令，导致相对路径找不到文件，可以把 `args` 改成绝对路径，例如 `"/Users/zyb/project/coding-knowledge/AI/MCP/weather-mcp/build/index.js"`。

### 12.2 接入后的验证动作

你可以在 Trae 里检查：

1. Server 是否被识别
2. `get-alerts` 和 `get-forecast` 是否出现
3. 能否正常触发调用

你可以尝试类似提示：

```text
What are the active weather alerts in Texas?
```

```text
What's the weather forecast for San Francisco?
```

> 注意：这个 API 面向美国地区，非美国坐标可能会失败，这是正常的。

---

## 13. 第九步：怎么调试这个 MCP

### 13.1 最重要的一条

在 stdio 模式下：

- 不要使用 `console.log`
- 只使用 `console.error`

原因是：

- `stdout` 是 MCP 协议通道
- `stderr` 才适合打印调试日志

### 13.2 推荐加哪些日志

在真实开发里，你可以加这些日志：

```ts
console.error("Calling get-forecast with:", { latitude, longitude });
```

```ts
console.error("Forecast URL:", forecastUrl);
```

### 13.3 如何判断工具有没有被真正调用

如果客户端里工具出现了，但你不确定有没有调用到服务端，可以在工具函数开头打印：

```ts
console.error("get-alerts invoked");
```

或：

```ts
console.error("get-forecast invoked with params:", { latitude, longitude });
```

只要 stderr 里看到了这些内容，就说明调用确实到达了 server。

---

## 14. 第十步：这个案例里有哪些设计点值得学

### 14.1 参数校验前置

例如：

```ts
state: z.string().length(2)
```

它带来的好处是：

- 约束调用参数
- 帮模型理解输入要求
- 减少错误请求

### 14.2 封装通用请求函数

```ts
async function makeNWSRequest<T>(url: string): Promise<T | null>
```

封装以后：

- 多个 tool 可以复用
- 错误处理可以统一
- 代码更清晰

### 14.3 格式化函数单独拆出

例如：

- `formatAlert`
- `formatForecastPeriod`

这样做的好处是：

- 工具主逻辑更简洁
- 输出格式更容易维护
- 后续改展示格式时不用动主流程

### 14.4 错误信息尽量具体

例如：

```text
Failed to retrieve forecast data for coordinates 37.7749, -122.4194.
```

比只返回 `failed` 更有价值。

---

## 15. 第十一步：常见报错与排查方式

### 15.1 报错：工具没有显示出来

排查顺序：

1. 确认 `.trae/mcp.json` 路径正确
2. 确认 Trae 里已经打开 `Enable Project MCP`
3. 确认 `build/index.js` 存在
4. 确认 `node build/index.js` 可以正常启动
5. 重新加载 Trae 窗口，确保新配置被识别

### 15.2 报错：server 启动后立刻退出

常见原因：

- 构建失败
- Node 版本过低
- 代码里有语法错误
- 依赖未安装完整

建议先执行：

```bash
npm install
npm run build
node build/index.js
```

### 15.3 报错：客户端连接了，但一调用就失败

常见原因：

- 参数不符合 schema
- 外部天气 API 请求失败
- 传入的坐标不在美国范围内

### 15.4 报错：输出通道被污染

最常见的原因就是：

- 你在 stdio 模式下用了 `console.log`

解决方式：

- 全部改成 `console.error`

---

## 16. 第十二步：如何把这个案例扩展成更真实的项目

当你把这个天气查询案例跑通后，可以继续这样扩展。

### 16.1 增加更多工具

例如：

- `get-hourly-forecast`
- `get-weather-by-city`
- `compare-two-cities-weather`

### 16.2 增加缓存

因为天气查询可能重复调用，你可以给请求结果加短时缓存，减少频繁访问外部 API。

### 16.3 增加结构化输出

第一版返回文本最稳；
后续如果客户端生态支持得更好，可以补充结构化输出，方便模型进一步消费。

### 16.4 增加 HTTP transport

本地跑通后，可以继续扩展成远程服务，让多个客户端复用。

---

## 17. 第十三步：把这个案例迁移到你自己的业务

天气查询只是一个练手题，本质结构可以直接迁移到业务场景。

映射关系如下：

### 17.1 把天气 API 换成业务 API

例如把：

- `https://api.weather.gov`

换成：

- 订单系统 API
- 工单系统 API
- CRM API
- 知识库搜索 API

### 17.2 把工具名换成业务动作

例如：

- `get_order_status`
- `list_user_tickets`
- `search_project_docs`

### 17.3 保留开发骨架

开发骨架其实完全一样：

1. 创建 server
2. 注册 tool
3. 定义 schema
4. 写请求逻辑
5. 格式化结果
6. 启动 transport
7. 客户端验证

所以这个天气案例的真正价值不是“查天气”，而是帮你掌握一个通用模板。

---

## 18. 一份最短开发清单

如果你后面想不看全文快速重做一次，可以只看这个清单。

### 18.1 初始化

```bash
mkdir weather-mcp
cd weather-mcp
npm init -y
npm install @modelcontextprotocol/server zod
npm install -D typescript @types/node
```

### 18.2 配置

- 写 `package.json`
- 写 `tsconfig.json`

### 18.3 开发

- 在 `src/index.ts` 创建 `McpServer`
- 注册 `get-alerts`
- 注册 `get-forecast`
- 用 `StdioServerTransport` 启动

### 18.4 构建

```bash
npm run build
```

### 18.5 验证

- 本地执行 `node build/index.js`
- Trae 注册 `.trae/mcp.json`
- 在 AI 客户端里测试调用

---

## 19. 你可以直接抄用的项目文件汇总

### 19.1 `package.json`

```json
{
  "name": "weather-mcp",
  "version": "1.0.0",
  "description": "A weather MCP server example",
  "type": "module",
  "bin": {
    "weather-mcp": "./build/index.js"
  },
  "scripts": {
    "build": "tsc && chmod 755 build/index.js",
    "start": "node build/index.js"
  }
}
```

### 19.2 `tsconfig.json`

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
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

### 19.3 `.trae/mcp.json`

```json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["./build/index.js"]
    }
  }
}
```

### 19.4 `src/index.ts`

请直接使用本文件第 8 节里的完整代码。

---

## 20. 最终总结

这个天气查询案例本质上完成了一个最小 MCP Server 的完整闭环：

1. 用 TypeScript 官方 SDK 创建 server
2. 用 `zod` 定义工具参数
3. 注册两个天气查询工具
4. 调用外部 API 获取真实数据
5. 返回模型和客户端可读的文本结果
6. 用 `stdio` 跑起来并接到客户端里验证

如果你能把这个案例独立跑通，再把天气 API 换成你自己的业务 API，那么你就已经不是“理解 MCP 概念”，而是真正具备“开发 MCP”的能力了。

---

## 21. 建议你接下来立刻做的事

最推荐按下面顺序继续：

1. 先把这个案例完整敲一遍
2. 跑通 `get-alerts`
3. 跑通 `get-forecast`
4. 在客户端里确认能实际调用
5. 再把天气 API 改成你自己的业务接口

这样你会非常快地从“知道 MCP 是什么”，进入“我已经能自己写一个 MCP”。
