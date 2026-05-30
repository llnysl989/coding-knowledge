# Node.js 知识文档

## 1. Node.js 是什么

Node.js 不是一门新语言。

它是一个 **JavaScript 运行时**。

可以简单理解成：

- JavaScript 本来最早主要运行在浏览器里
- Node.js 让 JavaScript 也能在电脑终端、服务器环境中运行

一句话：

> Node.js 让 JavaScript/编译后的 TypeScript 可以脱离浏览器运行。

---

## 2. 为什么写 MCP 要用 Node.js

在天气查询 MCP 案例里：

- 你写的是 TypeScript 源码
- 编译后得到 JavaScript 文件
- 最后由 Node.js 去运行这个 JavaScript 文件

所以 Node.js 在项目里扮演的是：

- 程序执行环境
- 包管理生态入口
- 本地启动 MCP Server 的运行基础

例如你执行：

```bash
node build/index.js
```

这里真正干活的就是 Node.js。

---

## 3. Node.js 和 TypeScript 的关系

可以这样区分：

- TypeScript：你用来写代码
- Node.js：你用来运行代码

把它们连起来就是：

```text
TypeScript 负责开发体验
Node.js 负责运行程序
```

---

## 4. 什么是 `npm`

`npm` 是 Node.js 生态最常用的包管理工具。

它主要负责：

- 安装依赖
- 管理项目包信息
- 运行脚本命令

例如：

```bash
npm install zod
```

表示安装 `zod` 这个依赖。

```bash
npm run build
```

表示运行 `package.json` 里定义的 `build` 脚本。

---

## 5. 什么是 `package.json`

`package.json` 可以理解成 Node.js 项目的“项目说明书”。

它通常包含：

- 项目名
- 版本号
- 依赖
- 启动脚本
- 构建脚本

例如：

```json
{
  "name": "weather-mcp",
  "scripts": {
    "build": "tsc",
    "start": "node build/index.js"
  }
}
```

---

## 6. Node.js 在 MCP 天气案例里具体负责什么

在天气案例中，Node.js 主要负责：

1. 运行编译后的服务端程序
2. 提供命令行环境
3. 配合 `npm` 安装 SDK 和依赖
4. 让 MCP Server 以本地进程方式启动

换句话说，MCP 案例里真正跑起来的是一个 Node.js 进程。

---

## 7. 初学者最容易混淆的点

### 7.1 Node.js 不是框架

它不是 Express、NestJS 这种框架，它更底层，是运行环境。

### 7.2 Node.js 不是包管理器

很多人容易把 Node.js 和 npm 混成一个东西。

要分开：

- Node.js：运行时
- npm：包管理和脚本工具

### 7.3 Node.js 不是 TypeScript

Node.js 是运行环境；TypeScript 是开发语言层面的增强。

---

## 8. 学到这里先记住什么

你暂时先记住这几句就够了：

1. Node.js 让 JavaScript/TypeScript 程序能在本地终端和服务器中运行
2. `npm` 用来安装依赖和执行脚本
3. `package.json` 是项目配置入口
4. MCP 天气案例最终是由 Node.js 启动的本地进程
