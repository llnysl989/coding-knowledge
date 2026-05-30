# Node.js 异步编程知识文档

## 1. 为什么 Node.js 里总在讲异步

因为 Node.js 很多常见任务都不是“立刻就能完成”的。

例如：

- 读文件
- 请求接口
- 查询数据库
- 等待用户输入

这些操作往往需要一点时间。

如果程序每次都傻等，会让整体效率变差。

所以 Node.js 里异步编程非常重要。

一句话：

> 异步的核心目的，是让程序在等待某些操作完成时，不要把整个流程卡死。

---

## 2. 什么是同步，什么是异步

### 同步

可以理解成：

- 一步没做完，下一步不能开始

### 异步

可以理解成：

- 先把任务发出去
- 完成后再回来处理结果

这是一种帮助程序更高效处理等待的方式。

---

## 3. Node.js 里最常见的异步写法

### 3.1 回调函数

历史上很常见。

### 3.2 Promise

比纯回调更容易组织逻辑。

### 3.3 `async/await`

这是现在最常见、最适合初学者理解的方式。

例如：

```javascript
async function getData() {
  return "hello";
}
```

---

## 4. 一个最小异步例子

```javascript
function wait() {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("done");
    }, 1000);
  });
}

async function main() {
  const result = await wait();
  console.log(result);
}

main();
```

可以先这样理解：

- `wait()` 会在 1 秒后返回结果
- `await` 表示“等这个异步结果回来”

---

## 5. 为什么这对 Node.js 很重要

因为 Node.js 很多事情都和 I/O 有关，也就是：

- 文件
- 网络
- 数据库

这些通常都不是瞬间完成的。

所以你以后看到 Node.js 项目里大量出现：

- `Promise`
- `async`
- `await`

这是非常正常的。

---

## 6. 学到这里先记住什么

先记住这几句：

1. Node.js 里很多操作天然就适合异步处理
2. 异步的重点是“不阻塞整体流程”
3. 现在最常见的异步写法是 `async/await`
4. 文件、网络、数据库操作常常都会涉及异步
