# CRUD Demo 项目说明

这是一个任务管理 CRUD 全栈 demo，用于熟悉一整套前端 + 后端 + 数据库 + 容器 + Kubernetes 的开发流程。

按照本文档步骤一步步执行，你最终会得到：

- 能在本地跑通的前后端项目
- 能用 docker-compose 一键启动的容器化版本
- 能部署到 Kubernetes 的资源清单

---

## 1. 技术栈

- **前端**：React + TypeScript + Vite + React Router + Axios
- **后端**：Node.js + Express + TypeScript + Prisma
- **数据库**：MySQL 8
- **部署**：Docker / docker-compose / Kubernetes

---

## 2. 整体架构

```text
Browser
  ↓
React (Vite)        ── 端口 5173 (开发) / 80 (容器内 Nginx)
  ↓ HTTP /api
Express Backend     ── 端口 3001
  ↓ Prisma
MySQL               ── 端口 3306
```

容器化运行时：

```text
Browser → frontend (Nginx) → backend (Express) → mysql
```

Kubernetes 运行时：

```text
Browser → Ingress → frontend Service / backend Service → backend Pod → mysql Service
```

---

## 3. 目录总览

```text
curd_demo/
├── backend/         # 后端 Node.js + Express + Prisma 工程
├── frontend/        # 前端 React + Vite 工程
├── deploy/          # docker-compose 和 K8s 部署文件
├── README.md        # 本文档（项目实操指南）
├── idea.md          # 学习路线和基础概念
├── design.md        # 架构正式设计方案
├── ai_runbook.md    # 用 AI 辅助生成代码的方法论
└── full_demo_guide.md # 全套实施总指南
```

---

## 4. 后端目录详解

`backend/`

```text
backend/
├── package.json              # 依赖、npm 脚本
├── tsconfig.json             # TypeScript 编译配置
├── .env.example              # 环境变量模板（复制成 .env 使用）
├── .gitignore
├── .dockerignore
├── Dockerfile                # 后端镜像构建脚本（含 prisma 迁移）
├── prisma/
│   └── schema.prisma         # 数据模型 + MySQL datasource
└── src/
    ├── app.ts                # 入口：启动 Express，挂载中间件和路由
    ├── routes/
    │   ├── index.ts          # 总路由：/api/health + /api/tasks
    │   └── taskRoutes.ts     # 任务路由：GET/POST/PUT/DELETE /api/tasks
    ├── controllers/
    │   └── taskController.ts # 请求/响应处理层
    ├── services/
    │   └── taskService.ts    # 业务校验 + Prisma 调用
    ├── middleware/
    │   └── errorMiddleware.ts# 统一错误处理 + AppError 自定义异常
    └── utils/
        ├── prisma.ts         # Prisma Client 单例
        └── response.ts       # 统一响应格式 success / fail
```

### 关键文件说明

- `src/app.ts`：启动 Express，监听 `PORT` 端口，注入 CORS、JSON 解析和错误处理。
- `prisma/schema.prisma`：定义 `Task` 模型和 MySQL 连接。改字段就改这里，然后跑 migration。
- `services/taskService.ts`：所有真正的业务逻辑（字段校验、id 校验、CRUD 调用 Prisma）。
- `controllers/taskController.ts`：只负责拿参数、调 service、返回 JSON，本身不写业务。
- `utils/response.ts`：所有接口统一返回 `{ code, message, data }`。
- `middleware/errorMiddleware.ts`：业务错误用 `throw new AppError(code, message, status)`，会自动转 JSON。

---

## 5. 前端目录详解

`frontend/`

```text
frontend/
├── package.json
├── tsconfig.json
├── vite.config.ts            # Vite 配置 + /api 代理到后端 3001
├── index.html                # 入口 HTML
├── nginx.conf                # 生产容器内 Nginx 配置
├── Dockerfile                # 多阶段构建：node 打包 -> nginx 提供
├── .gitignore
├── .dockerignore
└── src/
    ├── main.tsx              # React 应用入口
    ├── styles.css            # 全局样式
    ├── router/
    │   └── index.tsx         # 路由表 /tasks、/tasks/new、/tasks/:id/edit
    ├── types/
    │   └── task.ts           # Task 类型、TaskInput、ApiResponse
    ├── services/
    │   ├── http.ts           # Axios 实例（baseURL = /api）
    │   └── taskService.ts    # 调用后端的 5 个 CRUD 接口
    ├── components/
    │   ├── TaskTable.tsx     # 表格组件
    │   └── TaskForm.tsx      # 表单组件（新增、编辑共用）
    └── pages/
        ├── TaskListPage.tsx  # 列表页：列出任务 + 删除
        └── TaskFormPage.tsx  # 表单页：创建模式 / 编辑模式
```

### 关键文件说明

- `vite.config.ts`：开发环境下 `/api/*` 自动代理到 `http://localhost:3001`，所以前端调用 `/api/tasks` 就能打到本地后端。
- `services/http.ts`：所有请求统一从这里走，方便后续加拦截器。
- `pages/TaskListPage.tsx`：进入页面就拉列表，删除时弹确认框，操作后重新拉取。
- `pages/TaskFormPage.tsx`：`mode="create"` 显示空表单，`mode="edit"` 先 `getTaskById` 再回填。

---

## 6. 部署目录详解

`deploy/`

```text
deploy/
├── docker-compose.yml        # 本地三件套：mysql + backend + frontend
└── k8s/
    ├── namespace.yaml        # 命名空间 crud-demo
    ├── configmap.yaml        # 非敏感配置：PORT / NODE_ENV
    ├── secret.yaml           # 敏感配置：MySQL 密码 / DATABASE_URL
    ├── mysql-deployment.yaml # MySQL Deployment + Service
    ├── backend-deployment.yaml  # 后端 Deployment + Service
    ├── frontend-deployment.yaml # 前端 Deployment + Service
    └── ingress.yaml          # 入口路由：/api -> backend，/ -> frontend
```

---

## 7. 模块视角（功能怎么穿起来的）

新增一条任务的链路：

```
浏览器表单
  → TaskFormPage.handleSubmit
  → services/taskService.createTask
  → POST /api/tasks
  → routes/taskRoutes
  → taskController.create
  → taskService.create (校验 + Prisma)
  → MySQL tasks 表 INSERT
  → 返回 { code:0, data: task }
  → 前端跳回 /tasks 列表
```

如果你看代码先从这条链路看，最容易看懂。

---

## 8. 数据模型

`Task` 表（MySQL 表名 `tasks`）：

| 字段 | 类型 | 必填 | 含义 |
|---|---|---|---|
| id | int | 是 | 主键自增 |
| title | varchar(100) | 是 | 任务标题 |
| description | text | 否 | 描述 |
| status | varchar(20) | 是 | `todo` / `doing` / `done` |
| priority | varchar(20) | 是 | `low` / `medium` / `high` |
| dueDate | datetime | 否 | 截止时间 |
| createdAt | datetime | 是 | 自动生成 |
| updatedAt | datetime | 是 | 自动刷新 |

---

## 9. 接口列表

统一前缀 `/api`，响应统一 `{ code, message, data }`：

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/tasks` | 列表 |
| GET | `/api/tasks/:id` | 详情 |
| POST | `/api/tasks` | 新增 |
| PUT | `/api/tasks/:id` | 更新 |
| DELETE | `/api/tasks/:id` | 删除 |

---

## 10. 调试步骤（严格按顺序操作）

调试总原则：**一层跑通再做下一层**。顺序是 MySQL → 后端 → 前端 → Docker → K8s。

---

### 阶段 0：准备本地工具

请确认本机有：

- Node.js 20+
- npm
- Docker Desktop（同时提供 Docker 和本地 Kubernetes，推荐）
- kubectl
- Postman 或 Apifox（接口测试）

---

### 阶段 1：启动 MySQL

最快的方式是直接用 Docker 跑一个 MySQL：

```bash
docker run -d --name crud-demo-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=root123 \
  -e MYSQL_DATABASE=crud_demo \
  mysql:8.0
```

**验证：**

```bash
docker ps | grep crud-demo-mysql
```

容器状态是 `Up` 即可。

---

### 阶段 2：本地启动后端

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

启动后看到日志：

```
[backend] listening on http://localhost:3001
```

**验证 1：健康检查**

```bash
curl http://localhost:3001/api/health
```

预期：

```json
{"code":0,"message":"success","data":{"status":"ok"}}
```

**验证 2：用 Postman/Apifox 跑完整 CRUD**

新增：

```
POST http://localhost:3001/api/tasks
Content-Type: application/json

{
  "title": "学习 Docker",
  "description": "完成容器化",
  "status": "todo",
  "priority": "high",
  "dueDate": "2026-06-10T12:00:00.000Z"
}
```

预期返回 `code: 0` 并附带 `data.id`。

然后依次验证：

- `GET /api/tasks` 列表里能看到
- `GET /api/tasks/1` 能拿到详情
- `PUT /api/tasks/1` 能更新（改个 status）
- `DELETE /api/tasks/1` 能删除

**调试要点：**
- 接口报 500 → 看后端控制台日志
- 数据库连不上 → 检查 `.env` 的 `DATABASE_URL`
- migration 失败 → 检查 mysql 容器是否真的在跑

---

### 阶段 3：本地启动前端

后端不要停。**新开一个终端：**

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 `http://localhost:5173`。

**验证：在浏览器里完成完整业务链路**

1. 看到“任务列表”页面
2. 点击右上角“+ 新增任务”
3. 填表单提交，跳回列表能看到新数据
4. 点“编辑”，状态改成 `doing`，保存后列表更新
5. 点“删除”，确认后任务消失
6. 刷新浏览器，数据状态依然正确

**调试要点：**
- 页面打开但列表空白 → 打开浏览器 Network 看 `/api/tasks` 是否 200
- 报跨域 → 检查 `vite.config.ts` 里的 proxy 是否生效
- 点了按钮没反应 → 浏览器 Console 看报错

到这一步，本地链路就完整跑通了。

---

### 阶段 4：用 docker-compose 容器化

先停掉本地的 backend/frontend/mysql（避免端口冲突）：

```bash
# 如果 MySQL 容器还在用阶段 1 的方式跑，可以先停掉
docker stop crud-demo-mysql && docker rm crud-demo-mysql
```

然后启动 compose：

```bash
cd deploy
docker compose up --build
```

第一次会拉镜像、构建前后端，需要等几分钟。

**验证：**

- `docker ps` 能看到 3 个容器：`crud-demo-mysql` / `crud-demo-backend` / `crud-demo-frontend`
- 浏览器打开 `http://localhost:8080`，能完成完整 CRUD
- `curl http://localhost:3001/api/health` 仍然正常

**调试要点：**
- 后端容器一直重启 → `docker logs crud-demo-backend`，常见问题是 MySQL 还没 ready，等几秒会自动恢复
- 前端访问报错 → `docker logs crud-demo-frontend` 看 nginx 日志
- 前端访问到了但 `/api` 报错 → 看 `frontend/nginx.conf` 里 `proxy_pass http://backend:3001`，service 名要对

完成后停止：

```bash
docker compose down       # 停容器
docker compose down -v    # 同时删 mysql 数据卷
```

---

### 阶段 5：部署到 Kubernetes

前提：

- 启用 Docker Desktop 的 Kubernetes（设置里勾选 Enable Kubernetes），或者用 minikube / kind
- 安装 ingress 控制器（Docker Desktop 自带集群可以这样装）：

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
```

构建本地镜像（让 K8s 能直接拉）：

```bash
cd backend && docker build -t crud-demo-backend:latest .
cd ../frontend && docker build -t crud-demo-frontend:latest .
```

> 如果用 minikube：先执行 `eval $(minikube docker-env)` 再构建，让镜像进 minikube。

应用所有资源：

```bash
cd ../deploy/k8s
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml -f secret.yaml
kubectl apply -f mysql-deployment.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f frontend-deployment.yaml
kubectl apply -f ingress.yaml
```

**验证 1：Pod 全部 Running**

```bash
kubectl get pods -n crud-demo
```

期望 3 个 Pod 都 `Running`。

**验证 2：后端健康检查**

```bash
kubectl port-forward -n crud-demo svc/backend 3001:3001
curl http://localhost:3001/api/health
```

**验证 3：前端可访问**

在 `/etc/hosts` 加一行：

```
127.0.0.1 crud-demo.local
```

浏览器访问 `http://crud-demo.local`，能完成完整 CRUD 即成功。

**调试要点：**
- Pod `ImagePullBackOff` → 镜像名对不上，或集群拉不到本地镜像。Docker Desktop K8s 直接用本地镜像没问题，minikube 要进它的 docker env
- Pod `CrashLoopBackOff` → `kubectl logs -n crud-demo <pod>` 看日志
- backend 报数据库连不上 → 检查 `secret.yaml` 里的 `DATABASE_URL`，host 必须是 `mysql`（service 名）不是 `localhost`
- Ingress 访问不通 → `kubectl get ingress -n crud-demo`，确认有 ADDRESS；确认 ingress-nginx 已装

---

## 11. 验收清单

- [ ] 本地后端跑通 5 个接口
- [ ] 本地前端能完整 CRUD
- [ ] docker-compose 启动后浏览器 `localhost:8080` 能完整 CRUD
- [ ] Kubernetes 部署后 3 个 Pod 全 Running，Ingress 域名能完整 CRUD

四项都打勾，就完成了这个 demo。

---

## 12. 常用命令速查

```bash
# 后端
cd backend
npm run dev                  # 本地开发
npx prisma migrate dev       # 改完 schema 后跑迁移
npx prisma studio            # 数据库可视化

# 前端
cd frontend
npm run dev                  # 开发模式
npm run build                # 生产构建

# Docker Compose
cd deploy
docker compose up --build    # 构建并启动
docker compose down -v       # 停止并清理

# Kubernetes
kubectl get pods -n crud-demo
kubectl logs -n crud-demo <pod-name>
kubectl describe pod -n crud-demo <pod-name>
kubectl port-forward -n crud-demo svc/backend 3001:3001
kubectl delete -f deploy/k8s/                # 一次性删除全部资源
```
