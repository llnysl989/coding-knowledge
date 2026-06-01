# CRUD Demo AI 生成与调试操作手册

## 1. 文档目标

这份文档不是设计方案，而是一份可以直接照着执行的操作手册。

你的目标是：

- 按顺序生成前后端代码
- 分阶段验证每一层是否正常
- 完成前后端联调
- 完成 Docker 启动
- 完成 Kubernetes 部署

这份文档的核心原则是：

- 一次只解决一层问题
- 每做完一步就验证
- 不要前后端、数据库、Docker、K8s 一起上
- 先本地跑通，再容器化，再上 K8s

---

## 2. 最终目标链路

你最后要跑通的是这条链路：

```text
浏览器
  -> React 前端
  -> Node.js 后端 API
  -> MySQL 数据库
  -> Docker 容器运行
  -> Kubernetes 部署访问
```

所以你的操作顺序也必须严格按这条链路来。

---

## 3. 你需要准备的工具

在开始之前，先确保你本机具备：

- Node.js
- npm 或 pnpm
- MySQL 或 Docker Desktop
- Git
- Postman 或 Apifox
- Docker
- kubectl
- 一个本地 K8s 环境，例如 minikube / kind / Docker Desktop Kubernetes

如果暂时没有本地 MySQL，也没关系，可以先通过 Docker 启动 MySQL。

---

## 4. 执行总顺序

你整个项目请严格按这个顺序推进：

1. 先生成项目目录骨架
2. 先做后端 + 数据库
3. 先把后端接口测通
4. 再做前端页面
5. 再做前后端联调
6. 再做 Docker
7. 最后做 Kubernetes

不要跳步。

---

## 5. 第 1 阶段：生成项目骨架

## 5.1 目标

先把目录和基础工程生成出来，不急着写业务。

目标是得到：

```text
curd_demo/
├── frontend/
├── backend/
└── deploy/
```

---

## 5.2 建议你让 AI 做的事

你可以让 AI 先生成：

### 前端骨架
- React + TypeScript + Vite 项目
- React Router
- Axios 封装
- 基础页面目录结构

### 后端骨架
- Node.js + Express + TypeScript 项目
- 路由目录
- controller/service 目录
- Prisma 初始化
- 环境变量读取

### 部署骨架
- Dockerfile 占位文件
- docker-compose.yml 占位文件
- k8s yaml 占位目录

---

## 5.3 这一阶段的验证标准

这一步先不要求功能，只要求：

- frontend 目录能安装依赖
- backend 目录能安装依赖
- Prisma 能初始化
- 工程结构清晰

如果这一步都没稳定，不要往下走。

---

## 6. 第 2 阶段：先打通后端和数据库

## 6.1 为什么先做后端

因为前端只是消费 API。

如果 API 没有先稳定下来，前端调试时你会分不清是页面问题、接口问题，还是数据库问题。

所以一定先把：

- 数据库
- Prisma
- 后端 CRUD 接口

这三层打通。

---

## 6.2 这一阶段要完成什么

### 数据库侧
- 启动 MySQL
- 创建数据库
- 配置连接串

### Prisma 侧
- 写 `schema.prisma`
- 定义 `Task` 模型
- 执行 migration
- 生成 Prisma Client

### 后端侧
- 创建任务路由
- 创建 controller
- 创建 service
- 实现 CRUD API
- 加基础错误处理

---

## 6.3 建议你让 AI 按这个顺序生成

### 第一步：生成 Prisma 模型
让 AI 只做一件事：
- 定义 `Task` 模型
- 配置 MySQL datasource

### 第二步：生成后端 app 基础能力
让 AI 做：
- Express 启动文件
- 路由注册
- JSON 解析
- CORS
- 健康检查接口 `/api/health`

### 第三步：生成 tasks CRUD API
让 AI 做：
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`

### 第四步：生成统一响应格式
让 AI 做：
- 成功响应封装
- 错误响应封装

---

## 6.4 这一阶段你必须手工验证什么

每完成一个点，就验证一次。

### 验证 1：服务能否启动
检查：
- 后端端口是否正常监听
- `/api/health` 是否能返回成功

### 验证 2：数据库连接是否正常
检查：
- Prisma 是否成功连接 MySQL
- migration 是否成功执行

### 验证 3：CRUD 是否真实可用
用 Postman/Apifox 测：
- 新增一条任务
- 查询任务列表
- 修改任务状态
- 删除任务

只有这四个动作都成功，你才进入下一阶段。

---

## 6.5 这一阶段常见错误

### 1）数据库连不上
排查顺序：
- MySQL 是否启动
- host/port/user/password 是否正确
- `DATABASE_URL` 是否正确

### 2）Prisma migration 失败
排查顺序：
- schema 是否正确
- 数据库用户是否有权限
- 数据库名是否存在

### 3）接口 500
排查顺序：
- 看后端控制台日志
- 看请求参数是否为空
- 看 Prisma 调用是否报错

### 4）接口路径不对
排查顺序：
- route 是否注册
- app 是否挂载 `/api`
- 方法是否写错，例如 GET/POST 混用

---

## 7. 第 3 阶段：生成前端页面

## 7.1 这一阶段目标

当后端 API 稳定后，再开始做前端。

目标是完成：

- 列表页
- 新增页
- 编辑页
- 删除按钮
- 与后端接口联动

---

## 7.2 建议你让 AI 按这个顺序生成

### 第一步：生成路由骨架
- `/tasks`
- `/tasks/new`
- `/tasks/:id/edit`

### 第二步：生成 API 请求层
- 封装 axios 实例
- 封装 tasks API 方法

### 第三步：生成列表页
- 页面加载时请求任务列表
- 展示表格
- 提供编辑、删除按钮

### 第四步：生成表单页
- 新增模式
- 编辑模式
- 表单提交

### 第五步：加基础交互
- loading 状态
- 提交中状态
- 删除确认
- 成功/失败提示

---

## 7.3 这一阶段你必须手工验证什么

### 验证 1：页面能打开
检查：
- React 应用是否启动成功
- 路由是否正常跳转

### 验证 2：列表是否真能显示数据库数据
检查：
- 打开 `/tasks`
- 是否成功调用 `GET /api/tasks`
- 页面是否渲染真实数据

### 验证 3：新增是否可用
检查：
- 表单提交后是否成功新增
- 新增后是否返回列表页
- 列表中是否能看到新数据

### 验证 4：编辑是否可用
检查：
- 编辑页是否能回填旧数据
- 提交后数据库是否真的变化

### 验证 5：删除是否可用
检查：
- 点击删除后是否成功删除
- 页面是否刷新

---

## 7.4 这一阶段常见错误

### 1）前端请求不到后端
排查顺序：
- 后端是否启动
- 前端 axios baseURL 是否正确
- 是否有跨域问题

### 2）页面空白
排查顺序：
- 浏览器 console 是否报错
- 路由组件是否正确导出
- React Router 配置是否正确

### 3）提交成功但列表不更新
排查顺序：
- 提交后是否重新请求列表
- 是否正确跳转回列表页
- 后端是否真的写入数据库

### 4）编辑页拿不到数据
排查顺序：
- 路由参数 id 是否正确
- `GET /api/tasks/:id` 是否正常
- 回填逻辑是否写对

---

## 8. 第 4 阶段：前后端联调标准

到这里，你需要把“页面能显示”升级为“完整链路通了”。

你要验证的是：

- 页面上的操作能触发真实 API
- API 能操作真实数据库
- 数据变化能回到页面

### 联调通过标准

你需要完整演练一次：

1. 打开任务列表页
2. 新增一条任务
3. 看到列表出现新数据
4. 编辑这条任务
5. 刷新页面后仍能看到修改结果
6. 删除这条任务
7. 刷新页面后确认它不存在

如果这 7 步都通了，说明本地前后端链路已经打通。

---

## 9. 第 5 阶段：Docker 化

## 9.1 这一阶段目标

把“本地直接运行”升级成“容器运行”。

目标是：

- frontend 有 Dockerfile
- backend 有 Dockerfile
- mysql 用官方镜像
- 通过 docker-compose 一次启动

---

## 9.2 建议的顺序

### 第一步：只容器化 backend
先确认：
- backend 容器能启动
- backend 容器能连上 mysql

### 第二步：再容器化 frontend
确认：
- frontend 构建成功
- 页面能被访问
- 页面能调到 backend

### 第三步：写 docker-compose.yml
让三者一起启动：
- frontend
- backend
- mysql

---

## 9.3 Docker 阶段验证标准

### 验证 1：mysql 容器正常
检查：
- 容器是否启动
- 数据库是否能连接

### 验证 2：backend 容器正常
检查：
- 容器日志是否正常
- `/api/health` 是否可访问
- CRUD API 是否可访问

### 验证 3：frontend 容器正常
检查：
- 页面能访问
- 页面能正常请求 backend

### 验证 4：整套 compose 正常
检查：
- `docker compose up` 后整套服务都能起来
- 浏览器能完成一次完整 CRUD

---

## 9.4 Docker 阶段常见错误

### 1）容器能启动但服务访问不到
排查顺序：
- Dockerfile 启动命令是否正确
- 端口是否暴露
- compose 端口映射是否正确

### 2）backend 连不上 mysql
排查顺序：
- compose 内数据库 host 不应该写 localhost
- 应写 mysql service 名称
- mysql 是否真正 ready

### 3）frontend 请求地址错误
排查顺序：
- 容器环境中的 API 地址是否还是本地地址
- 是否需要区分开发环境和容器环境

---

## 10. 第 6 阶段：Kubernetes 部署

## 10.1 这一阶段目标

把 docker-compose 运行模式升级为 Kubernetes 资源部署。

目标是：

- frontend Deployment + Service
- backend Deployment + Service
- mysql Deployment + Service
- ConfigMap
- Secret
- Ingress

---

## 10.2 建议顺序

### 第一步：先部署 mysql
验证：
- Pod 是否 Running
- Service 是否正常

### 第二步：部署 backend
验证：
- backend Pod 是否 Running
- backend 是否能连 mysql
- `/api/health` 是否可访问

### 第三步：部署 frontend
验证：
- frontend Pod 是否 Running
- 页面是否能访问

### 第四步：部署 Ingress
验证：
- 浏览器能通过统一入口访问

---

## 10.3 K8s 阶段必须检查的点

### 1）Pod 状态
检查：
- 是否 Running
- 是否 CrashLoopBackOff
- 是否 ImagePullBackOff

### 2）日志
检查：
- backend 日志是否有数据库连接错误
- frontend 是否正常启动
- mysql 是否初始化成功

### 3）Service 通信
检查：
- backend 能否通过 service 名称访问 mysql
- Ingress 能否转发到 frontend/backend

### 4）环境变量
检查：
- Secret 是否注入成功
- ConfigMap 是否注入成功
- `DATABASE_URL` 是否正确

---

## 10.4 K8s 阶段常见错误

### 1）Pod 起不来
排查顺序：
- 镜像名是否正确
- 启动命令是否正确
- 环境变量是否缺失

### 2）backend 无法连接 mysql
排查顺序：
- mysql Service 名称是否正确
- 数据库用户名密码是否正确
- mysql Pod 是否 ready

### 3）Ingress 访问不到
排查顺序：
- Ingress Controller 是否安装
- 路由规则是否正确
- Service 端口是否正确

---

## 11. 推荐你给 AI 下任务的方式

为了让 AI 更稳定地产出代码，不要一次让它“把整个项目全做完”。

你应该这样拆：

### 好的提问方式
- 先帮我生成 backend 的 Express + TypeScript 基础工程
- 继续帮我生成 Prisma 的 Task 模型和 migration
- 继续帮我生成 tasks CRUD 的 routes/controller/service
- 继续帮我生成 frontend 的任务列表页
- 继续帮我生成 frontend 的任务表单页
- 继续帮我生成 backend Dockerfile
- 继续帮我生成 docker-compose.yml
- 继续帮我生成 k8s backend deployment

### 不好的提问方式
- 帮我把整个全栈项目一次性全部做完

因为一次性生成太多内容，你会很难定位错误。

---

## 12. 推荐你每一步都输出什么结果

每做完一步，最好要求 AI 给你：

- 改了哪些文件
- 启动命令是什么
- 如何验证成功
- 常见报错怎么排查

你要把每一步都变成“可验证的小闭环”。

---

## 13. 最终验收清单

当你做到最后时，按这个顺序验收：

### 本地工程验收
- backend 本地启动成功
- MySQL 本地连接成功
- Prisma migration 成功
- Postman/Apifox 能完成 CRUD
- frontend 本地启动成功
- 前后端联调成功

### Docker 验收
- frontend 镜像构建成功
- backend 镜像构建成功
- docker-compose 可启动整套服务
- 浏览器可完成 CRUD

### Kubernetes 验收
- mysql Deployment 正常
- backend Deployment 正常
- frontend Deployment 正常
- Ingress 可访问
- 浏览器可完成 CRUD

---

## 14. 你真正要记住的一条原则

你的整个执行顺序只能是：

```text
项目骨架
-> 后端 + 数据库
-> 接口测试
-> 前端页面
-> 前后端联调
-> Docker
-> Kubernetes
```

只要你严格按这个顺序做，排查问题会非常清楚。

一旦跳步，比如 API 还没稳定就去做 Docker，或者本地没跑通就去做 K8s，调试成本会立刻变高很多。

---

## 15. 一句话总结

这份手册的核心不是教你“一次做完”，而是教你“分阶段生成、分阶段验证、逐层打通”。

你后面只要按照这份文档顺序操作，就能比较稳地把 React + Node.js + MySQL + Docker + Kubernetes 这条链路完整跑通。
