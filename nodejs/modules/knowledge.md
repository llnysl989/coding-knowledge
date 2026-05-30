# Node.js 模块系统知识文档

## 1. 什么是模块

模块可以简单理解成：

- 一段被独立组织、可以复用的代码

如果一个项目所有代码都写在一个文件里，通常会越来越乱。

所以大家会把代码拆成多个模块，例如：

- 一个模块负责数据库
- 一个模块负责工具函数
- 一个模块负责接口逻辑

一句话：

> 模块就是把代码拆开组织和复用的方式。

---

## 2. 为什么 Node.js 里要学模块系统

因为 Node.js 项目通常不会只有一个文件。

你会经常看到：

- `import`
- `export`
- `require`
- `module.exports`

这些都和模块系统有关。

---

## 3. 最常见的两套模块写法

### 3.1 CommonJS

这是 Node.js 里比较经典的一套写法。

例如：

```javascript
const utils = require("./utils");
```

导出可能是：

```javascript
module.exports = {
  add,
};
```

### 3.2 ESM

这是现代项目更常见的一套写法。

例如：

```javascript
import { add } from "./utils.js";
```

导出可能是：

```javascript
export function add(a, b) {
  return a + b;
}
```

---

## 4. 为什么现在经常看到 `import/export`

因为很多现代 Node.js 和 TypeScript 项目都更倾向使用 ESM。

例如在 `package.json` 中看到：

```json
{
  "type": "module"
}
```

通常就意味着：

- 项目使用 ESM 规范

---

## 5. 模块系统对你有什么实际影响

最直接的影响是：

- 你怎么拆文件
- 你怎么引入别的文件
- 你怎么导出函数和变量

如果模块系统理解不清，后面一看项目就会很容易乱。

---

## 6. 一个最小例子

`utils.js`

```javascript
export function add(a, b) {
  return a + b;
}
```

`index.js`

```javascript
import { add } from "./utils.js";

console.log(add(1, 2));
```

这表示：

- `utils.js` 导出了 `add`
- `index.js` 导入并使用了它

---

## 7. 学到这里先记住什么

先记住这几句：

1. 模块是组织和复用代码的方式
2. Node.js 常见有 CommonJS 和 ESM 两套模块写法
3. 现代项目里更常看到 `import/export`
4. `package.json` 里的 `"type": "module"` 会影响模块写法
