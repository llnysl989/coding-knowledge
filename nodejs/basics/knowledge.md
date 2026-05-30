# Node.js 基础知识文档

## 1. Node.js 是什么

Node.js 不是一门编程语言。

它是一个 **JavaScript 运行时**。

更容易理解的说法是：

- JavaScript 本来最早主要跑在浏览器里
- Node.js 让 JavaScript 也能跑在浏览器之外
- 比如终端、服务器、本地脚本环境

一句话：

> Node.js 让 JavaScript 可以在电脑终端和服务器中运行。

---

## 2. Node.js 和 JavaScript 的关系

这两个概念特别容易混。

最简单的区分方法是：

- JavaScript：语言
- Node.js：运行 JavaScript 的环境之一

可以类比成：

- 你写的是 JavaScript
- Node.js 负责把它跑起来

所以：

- 没有 Node.js，JavaScript 也可以在浏览器里跑
- 有了 Node.js，JavaScript 又多了一个很重要的运行场景

---

## 3. 为什么 Node.js 很重要

Node.js 很重要，核心原因有几个：

### 3.1 它让 JavaScript 不再只属于前端

以前很多人会觉得 JavaScript 只是网页里的脚本语言。

Node.js 出现后，JavaScript 还能用来写：

- 后端服务
- 命令行工具
- 构建脚本
- 自动化脚本

### 3.2 它让前后端技术栈更统一

比如一个团队里：

- 前端用 JavaScript / TypeScript
- 后端也可以用 JavaScript / TypeScript

这样沟通成本会下降一些。

### 3.3 它生态非常大

围绕 Node.js 的包、工具、框架非常多。

例如：

- Express
- NestJS
- Vite
- ESLint
- TypeScript 相关工具链

---

## 4. Node.js 能做什么

Node.js 常见用途包括：

### 4.1 写后端服务

例如：

- 提供 API
- 处理登录注册
- 查询数据库

### 4.2 写命令行工具

例如：

- 构建工具
- 自动化脚本
- 代码生成工具

### 4.3 做前端工程化支撑

即使你写的是前端项目，背后很多工具也跑在 Node.js 上。

例如：

- `npm`
- `vite`
- `webpack`
- `eslint`

### 4.4 运行本地开发服务

很多项目开发时，本地的 dev server 其实就是 Node.js 程序。

---

## 5. Node.js 项目通常长什么样

一个最简单的 Node.js 项目通常会看到这些内容：

```text
my-project/
├── package.json
├── node_modules/
└── index.js
```

常见文件作用：

- `package.json`：项目说明和依赖配置
- `node_modules/`：安装下来的依赖
- `index.js`：程序入口文件之一

---

## 6. 一个最小 Node.js 示例

`index.js`

```javascript
function greet(name) {
  return `Hello, ${name}`;
}

console.log(greet("Node.js"));
```

运行方式：

```bash
node index.js
```

如果能看到输出，说明 Node.js 正在执行你的 JavaScript 文件。

---

## 7. Node.js 和浏览器环境的区别

虽然它们都能运行 JavaScript，但不是同一个环境。

### 浏览器环境更偏向：

- 页面展示
- DOM 操作
- 用户交互

### Node.js 环境更偏向：

- 文件操作
- 网络服务
- 脚本执行
- 后端逻辑

所以不是所有 JavaScript 代码都能在两个环境里完全通用。

---

## 8. Node.js 初学者最容易混淆的点

### 8.1 Node.js 不是语言

语言是 JavaScript。

### 8.2 Node.js 不是框架

它不是 Express、NestJS 这种框架。

它更底层，是运行时。

### 8.3 Node.js 不是包管理器

很多人会把 Node.js 和 `npm` 混在一起。

要分清：

- Node.js：运行环境
- `npm`：包管理工具

---

## 9. 学到这里先记住什么

先记住这几句：

1. Node.js 是 JavaScript 运行时
2. 它让 JavaScript 能跑在浏览器之外
3. 它常被用来写后端、脚本和工程化工具
4. 它和 JavaScript 有关，但不等于 JavaScript 本身
