# package.json 知识文档

## 1. `package.json` 是什么

`package.json` 可以理解成一个 Node.js 项目的“项目说明书”。

它通常负责记录：

- 项目名称
- 版本号
- 依赖
- 启动脚本
- 构建脚本
- 模块类型等配置

一句话：

> `package.json` 是 Node.js 项目的核心配置文件之一。

---

## 2. 为什么它重要

很多 Node.js 项目都离不开它，因为它决定了：

- 项目怎么安装依赖
- 项目怎么启动
- 项目有哪些脚本命令
- 项目使用什么模块规范

所以你以后看到一个 Node.js 项目，通常第一眼就会先看 `package.json`。

---

## 3. 一个最小示例

```json
{
  "name": "demo-project",
  "version": "1.0.0",
  "scripts": {
    "start": "node index.js"
  }
}
```

这段表示：

- 项目叫 `demo-project`
- 当前版本是 `1.0.0`
- 执行 `npm run start` 时，会运行 `node index.js`

---

## 4. 最常见的字段

### 4.1 `name`

项目名称。

### 4.2 `version`

项目版本号。

### 4.3 `scripts`

定义可以通过 `npm run` 执行的命令。

例如：

```json
{
  "scripts": {
    "dev": "node index.js",
    "build": "tsc"
  }
}
```

### 4.4 `dependencies`

运行时依赖。

### 4.5 `devDependencies`

开发和构建时依赖。

### 4.6 `type`

常见值之一是：

```json
{
  "type": "module"
}
```

它通常表示项目使用 ESM 模块规范。

---

## 5. 为什么经常先看 `scripts`

因为很多项目怎么启动、怎么开发、怎么构建，都是从这里看出来的。

比如看到：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  }
}
```

你就能大致知道：

- 开发环境用 `vite`
- 构建也通过 `vite` 完成

---

## 6. 学到这里先记住什么

先记住这几句：

1. `package.json` 是 Node.js 项目的配置入口之一
2. `scripts` 定义项目命令
3. `dependencies` 和 `devDependencies` 记录依赖
4. 看懂一个 Node.js 项目，先看 `package.json` 很有帮助
