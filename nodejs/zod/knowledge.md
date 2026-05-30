# Zod 知识文档

## 1. Zod 是什么

Zod 是一个 TypeScript/JavaScript 里很常见的 **数据校验和 schema 描述库**。

可以把它理解成：

- 用代码去描述“数据应该长什么样”
- 同时还能帮你检查数据是不是符合这个结构

一句话：

> Zod 用来定义和校验数据结构。

---

## 2. 为什么 MCP 项目里要用 Zod

在 MCP Server 里，tool 最关键的东西之一就是“参数定义”。

因为模型和客户端都需要知道：

- 这个工具需要什么参数
- 参数是什么类型
- 哪些参数是必填的
- 参数有没有范围限制

Zod 很适合做这件事。

例如：

```ts
inputSchema: z.object({
  state: z.string().length(2)
})
```

它表示：

- 这个工具需要一个 `state` 参数
- `state` 必须是字符串
- 长度必须为 2

---

## 3. 什么是 schema

schema 可以简单理解成：

- 数据结构说明书

比如你说“我要一个用户对象”，这还不够具体。

但如果你说：

- 必须有 `name`
- 必须有 `age`
- `name` 是字符串
- `age` 是数字

这就已经接近 schema 了。

Zod 就是用代码把这种说明写出来。

---

## 4. 最常见的 Zod 写法

### 4.1 字符串

```ts
z.string()
```

### 4.2 数字

```ts
z.number()
```

### 4.3 对象

```ts
z.object({
  name: z.string(),
  age: z.number(),
})
```

### 4.4 限制范围

```ts
z.number().min(-90).max(90)
```

### 4.5 字段描述

```ts
z.string().describe("Two-letter US state code")
```

`describe()` 的作用是给字段补充人类可读的描述。

---

## 5. Zod 在天气查询案例里怎么用

### 5.1 州代码工具

```ts
inputSchema: z.object({
  state: z
    .string()
    .length(2)
    .describe("Two-letter US state code")
})
```

### 5.2 经纬度工具

```ts
inputSchema: z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})
```

这两段代码都在表达一件事：

- 让工具输入更清晰
- 让模型更容易正确调用
- 让错误更早暴露

---

## 6. 为什么 Zod 对 MCP 特别重要

在普通后端接口里，参数校验已经很重要。

在 MCP 场景里，它更重要，因为：

- 不只是后端代码在看这个 schema
- AI 模型也会间接依赖这个 schema 去理解工具该怎么调用

所以 schema 写得越清楚：

- 客户端展示越清晰
- 模型调用越稳定
- 出错越少

---

## 7. 学到这里先记住什么

先记住这几句：

1. Zod 用来定义和校验数据结构
2. MCP 里它最常见的用途是写 `inputSchema`
3. `z.object({...})` 表示定义一个对象结构
4. `describe()` 能让参数对客户端和模型更友好
5. 参数 schema 写得越清楚，工具越容易稳定工作
