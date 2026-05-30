# TypeScript 知识文档

## 1. TypeScript 是什么

TypeScript，简称 TS，可以理解成：

- 它是在 JavaScript 基础上增加了“类型系统”的语言
- 它不是完全推倒重来的一门新语言
- 它最终还是会被编译成 JavaScript 去运行

一句话理解：

> TypeScript = 带类型能力的 JavaScript。

---

## 2. 为什么要学 TypeScript

在写 MCP Server 时，TypeScript 的价值主要有 4 个：

1. 代码更容易读懂
2. 参数和返回值更容易约束
3. IDE 能给出更好的提示和报错
4. 复杂一些的工具逻辑更不容易写错

比如你看到下面这段代码：

```ts
async function add(a: number, b: number): Promise<number> {
  return a + b;
}
```

就可以马上知道：

- `a` 和 `b` 应该是数字
- 返回值最终也是数字
- 这是一个异步函数

---

## 3. TypeScript 和 JavaScript 的关系

可以这样理解：

- JavaScript 是浏览器和 Node.js 都能执行的脚本语言
- TypeScript 是写代码时更强的“开发形态”
- 真正运行时，TypeScript 通常要先编译成 JavaScript

典型流程是：

```text
写 .ts 文件
-> TypeScript 编译器处理
-> 生成 .js 文件
-> Node.js 运行 .js 文件
```

这就是为什么 MCP 案例里会看到：

- 源码在 `src/index.ts`
- 编译结果在 `build/index.js`

---

## 4. 先认识几个最常见的 TS 语法

### 4.1 类型标注

```ts
const name: string = "Tom";
const age: number = 18;
const isAdmin: boolean = false;
```

### 4.2 接口 `interface`

当对象结构比较复杂时，通常会单独定义接口：

```ts
interface User {
  name: string;
  age: number;
}
```

在 MCP 天气案例里，像 `AlertsResponse`、`ForecastResponse` 这些就是接口。

### 4.3 异步函数 `async/await`

```ts
async function getData(): Promise<string> {
  return "hello";
}
```

如果函数内部要请求接口、读文件、查数据库，通常都会用异步函数。

---

## 5. TypeScript 在 MCP 天气案例里扮演什么角色

在天气查询 MCP 项目中，TypeScript 主要负责：

- 写服务端主代码 `src/index.ts`
- 给参数、接口返回值、工具逻辑加类型
- 帮你在开发阶段尽早发现错误

例如：

```ts
interface ForecastPeriod {
  name?: string;
  temperature?: number;
  temperatureUnit?: string;
}
```

这一段的作用是告诉你：

- 天气预报每一项里可能有哪些字段
- 哪些字段可能为空

---

## 6. 什么是 `tsconfig.json`

`tsconfig.json` 是 TypeScript 项目的编译配置文件。

它用来告诉 TypeScript：

- 从哪里读取源码
- 把代码编译到哪里去
- 用什么模块规范
- 是否开启严格模式

你现在不用一开始就把每个字段背下来，先知道它是“编译规则文件”就够了。

---

## 7. 学到这里先记住什么

你暂时只要先牢牢记住这几点：

1. TypeScript 是带类型的 JavaScript
2. `.ts` 一般要先编译成 `.js`
3. 写 MCP Server 时，TypeScript 主要帮助你把代码写清楚、写稳
4. `interface` 和 `async/await` 是读懂案例代码的关键
