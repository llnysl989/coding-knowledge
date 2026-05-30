# npm 知识文档

## 1. `npm` 是什么

`npm` 是 Node.js 生态里最常见的包管理工具。

它主要负责三件事：

1. 安装依赖
2. 管理项目包信息
3. 运行项目脚本

一句话：

> `npm` 是 Node.js 项目里负责“装包”和“跑命令”的核心工具。

---

## 2. 为什么要有 `npm`

写项目时，很少所有功能都自己从零开始写。

你通常会依赖别人已经写好的库，比如：

- `express`
- `zod`
- `typescript`

`npm` 的作用就是帮你：

- 下载这些依赖
- 记录它们的版本
- 管理它们在项目中的使用

---

## 3. 最常见的 `npm` 命令

### 3.1 初始化项目

```bash
npm init -y
```

这通常会生成一个 `package.json`。

### 3.2 安装依赖

```bash
npm install express
```

或简写：

```bash
npm i express
```

### 3.3 安装开发依赖

```bash
npm install -D typescript
```

### 3.4 运行脚本

```bash
npm run build
```

这表示运行 `package.json` 里定义的 `build` 脚本。

---

## 4. 依赖和开发依赖有什么区别

### `dependencies`

通常表示：

- 项目运行时需要的依赖

例如：

- `express`
- `zod`

### `devDependencies`

通常表示：

- 开发和构建时需要
- 运行时不一定直接需要

例如：

- `typescript`
- `eslint`

---

## 5. `npm run` 在干什么

如果你看到：

```bash
npm run dev
```

它的意思通常是：

- 到 `package.json` 里找到 `scripts.dev`
- 然后执行对应命令

例如：

```json
{
  "scripts": {
    "dev": "node index.js"
  }
}
```

那 `npm run dev` 本质上就是在执行：

```bash
node index.js
```

---

## 6. `node_modules` 是什么

当你执行 `npm install` 后，通常会出现一个目录：

- `node_modules/`

它可以理解成：

- 当前项目下载下来的依赖仓库

很多新手第一次看到会觉得特别大，这很正常。

---

## 7. 学到这里先记住什么

先记住这几句：

1. `npm` 是 Node.js 生态里的包管理工具
2. `npm install` 用来安装依赖
3. `npm run xxx` 用来执行项目脚本
4. `dependencies` 和 `devDependencies` 是两类常见依赖
