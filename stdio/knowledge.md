# stdio 知识文档

## 1. stdio 是什么

`stdio` 是 `standard input/output` 的缩写，通常可以翻译成：

- 标准输入
- 标准输出

在程序开发里，经常还会一起提到：

- `stdin`：标准输入
- `stdout`：标准输出
- `stderr`：标准错误输出

一句话：

> stdio 是程序和外部环境进行数据流通信的一种基础方式。

---

## 2. 把它理解成人和程序的“管道”

可以简单类比：

- `stdin`：别人往程序里塞信息
- `stdout`：程序把正常结果往外吐
- `stderr`：程序把错误或调试信息往外吐

很多命令行程序、脚本工具、本地服务，都会用这套机制。

---

## 3. MCP 为什么会用 stdio

在本地开发 MCP Server 时，很多客户端会直接：

- 启动一个本地进程
- 通过它的输入输出和它通信

这个时候用 stdio 很方便，因为：

- 不需要先起 HTTP 服务
- 不需要端口
- 本地接入简单
- 很适合一个客户端拉起一个 server 子进程

所以很多本地 MCP 场景里会看到：

- `StdioServerTransport`

---

## 4. 在 MCP 里，stdio 是怎么工作的

可以简单理解成：

```text
客户端启动你的 MCP Server 进程
-> 客户端往 stdin 写协议消息
-> 你的 server 从 stdin 收到请求
-> 你的 server 把响应写到 stdout
-> 客户端从 stdout 读取响应
```

注意，这里传递的不是普通聊天文本，而是 MCP 协议消息。

---

## 5. 为什么 `console.log` 会有问题

这是 MCP 初学者最容易踩的坑之一。

因为在 stdio 模式下：

- `stdout` 是协议消息通道

如果你在代码里写：

```ts
console.log("debug")
```

这行日志可能会直接写到 `stdout`。

结果就是：

- 客户端本来在等协议 JSON
- 结果却读到一行普通调试文本
- 通信被污染，MCP 连接可能直接出错

所以在 stdio 模式下通常建议：

- 不要用 `console.log`
- 改用 `console.error`

因为 `console.error` 默认写到 `stderr`。

---

## 6. `stderr` 为什么更适合打日志

因为：

- `stderr` 和 `stdout` 是分开的
- `stdout` 留给 MCP 协议通信
- `stderr` 用来写调试信息更安全

所以天气查询案例里你会看到：

```ts
console.error("Weather MCP server is running on stdio");
```

这不是随便写的，而是有明确原因的。

---

## 7. stdio 和 HTTP 有什么区别

### stdio

更适合：

- 本地开发
- 本地工具集成
- 客户端直接拉起本地进程

### HTTP

更适合：

- 远程部署
- 多客户端共享服务
- 统一网络接入

所以初学 MCP 时，通常建议：

- 先学 stdio
- 再学 HTTP

---

## 8. 学到这里先记住什么

先记住这几句：

1. stdio 是程序通信的一种基础方式
2. MCP 本地模式常用 stdio 让客户端和 server 通信
3. `stdout` 在 stdio MCP 里通常是协议通道
4. 不要用 `console.log` 污染 `stdout`
5. 调试日志优先写到 `stderr`，也就是 `console.error`
