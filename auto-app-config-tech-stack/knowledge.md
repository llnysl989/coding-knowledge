# auto-app-config 架构技术栈扫盲

> 来源：`/Users/zyb/project/auto-app-config/docs/design.md`（设计稿，尚未实现）。
> 目标：看懂这套架构里每个组件是干什么的，知道至少要补哪些知识，以及它们为什么被选在一起。

## 1. 知识点简介

`auto-app-config` 是一个"新 App 接入配置平台"：业务人员在网页上维护模块、配置行和 Markdown 文档，保存到 MySQL；平台把某个版本固定下来，后续 Agent 通过只读接口取走这份固定配置。

它的技术选型刻意做得很小：**一个 Go 进程 + 一个 MySQL**。没有 Redis、没有消息队列、没有独立静态服务器、没有 ORM、没有全局状态库。前端用 React 构建后直接嵌进 Go 二进制里，部署时只拿到一个可执行文件。

所以这份文档不是让你学完整个 Go 和 MySQL，而是让你建立一张"够用的技术地图"：知道每个组件解决什么问题、在链路里站什么位置、最容易踩的坑是什么。

### 组件速查表

| 组件 | 一句话定位 | 至少要了解 |
| --- | --- | --- |
| Go | 后端唯一运行时，一个进程提供页面、管理 API、只读 API | 包与模块、错误处理、`context`、编译产物 |
| `net/http` | Go 标准库 HTTP 服务与路由 | ServeMux、Handler、中间件、JSON 编解码 |
| `database/sql` + MySQL 驱动 | 数据库访问层与连接池 | 参数化 SQL、`sql.DB` 是池、事务、超时 |
| MySQL 8.4 / InnoDB | 唯一持久化存储 | 事务、行锁、唯一键、JSON 类型、隔离级别 |
| React + TypeScript | 五个菜单的页面与编辑器 | 组件、状态、受控输入、列表 key、类型 |
| Vite | 前端开发服务器与生产构建 | 开发代理、构建产物、环境变量 |
| Ant Design | UI 组件库 | 表单、表格、弹窗、上传等基础组件 |
| `go:embed` | 把前端产物、迁移、种子打进二进制 | 编译期嵌入、`fs.FS`、构建顺序 |
| OpenAPI 3.1 | HTTP 路由与请求/响应契约 | paths、schema、错误结构、示例 |
| JSON Schema | 编辑内容的结构契约 | 类型、必填、长度、嵌套对象 |
| Idempotency-Key | 写操作防重复执行 | 唯一键、请求摘要、结果回放 |
| revision | 草稿乐观并发控制 | 版本号、CAS、冲突返回 409 |
| SHA-256 / ETag | 发布内容固定与缓存校验 | 摘要、原始字节、`If-None-Match` / 304 |
| HMAC / CSRF / Bearer | 认证与请求防护 | 签名、时间窗、Cookie、Token 摘要 |
| Playwright | 端到端页面验证 | 浏览器自动化、真实后端、窄屏用例 |

## 2. 知识地图

```text
auto-app-config 技术栈
├── 后端运行时
│   ├── Go 单进程              —— 一个二进制同时提供页面、管理 API、只读 API
│   ├── net/http + ServeMux    —— 路由、请求解析、响应输出
│   └── middleware             —— 认证、权限、限流/限大小、CSRF、日志、恢复
├── 数据持久化
│   ├── MySQL 8.4 / InnoDB     —— 唯一数据库，事务与行锁的底座
│   ├── database/sql + 驱动    —— 连接池、参数化 SQL、显式事务
│   ├── 事务与锁顺序           —— 保存/发布/归档的并发正确性
│   └── JSON 类型与规范化      —— 可编辑副本与固定发布字节要分开存
├── 前端
│   ├── React + TypeScript     —— 组件化编辑器与类型约束
│   ├── Vite                   —— 开发热更新与生产构建
│   ├── Ant Design             —— 现成表单/表格/弹窗组件
│   └── 双状态模型             —— serverDraft 与 workingContent 分离
├── 构建与交付
│   ├── go:embed               —— 前端产物、迁移、种子打进二进制
│   ├── npm ci + lockfile      —— 依赖可复现
│   └── 单二进制部署           —— 运行机不需要 Node/Go SDK
├── 契约
│   ├── OpenAPI 3.1            —— 唯一路由与 DTO 契约
│   └── JSON Schema            —— 唯一内容结构契约
├── 可靠性
│   ├── revision 乐观锁        —— 防草稿互相覆盖
│   ├── Idempotency-Key        —— 防超时重试造成重复写
│   ├── SHA-256 固定摘要       —— 发布内容不可漂移
│   └── 死锁重试/未知结果处理  —— 失败可判定、可安全重试
├── 安全
│   ├── local 模式             —— 仅回环地址的开发身份
│   ├── gateway HMAC           —— 生产网关注入并签名身份
│   ├── CSRF 防护              —— 浏览器会话写操作防跨站
│   ├── 机器 Bearer token      —— Agent 只读访问
│   └── RBAC 授权              —— workspace/app/template 分级权限
└── 验证与运维
    ├── Go 单元测试            —— 校验、替换、摘要、权限映射
    ├── MySQL 集成测试         —— 并发、事务、唯一键、幂等
    ├── Playwright E2E         —— 五菜单主流程与窄屏
    └── 健康检查/结构化日志    —— 存活、就绪、可追踪
```

## 3. 相关知识点的关系

### 3.1 先学什么后学什么

推荐顺序：

1. **Go 基础 → `net/http` → middleware**：先能写一个返回 JSON 的服务，再理解请求如何经过一层层中间件。
2. **SQL 基础 → 事务 → 行锁 → 唯一键**：这是保存、发布、幂等、修订冲突的共同底座。
3. **`database/sql` → 连接池 → `context` 超时**：把 SQL 安全地放进 Go 服务里。
4. **React/TypeScript → Vite → Ant Design**：先能写受控表单和列表，再理解构建与嵌入。
5. **`go:embed` → 单二进制交付**：知道前端产物是怎么进 Go 程序的。
6. **OpenAPI / JSON Schema**：知道前后端和 Agent 共享的"合同"长什么样。
7. **revision / 幂等 / SHA-256**：最后再学可靠性机制，因为它们依赖前面的事务和唯一键。

### 3.2 依赖与包含关系

- `revision` 乐观锁 **依赖** 数据库事务和条件更新；没有事务，检查与写入之间会产生窗口。
- `Idempotency-Key` **依赖** 唯一键和事务：占位记录必须和业务写入同生共死。
- 固定发布摘要 **依赖** SHA-256 和"保存原始字节"；只存 MySQL JSON 再做序列化会漂移。
- CSRF **依赖** 浏览器 Cookie 会话；Bearer token 请求不走浏览器自动携带，所以不适用同一套 CSRF。
- `go:embed` **依赖** Vite 先完成构建；构建顺序错了，嵌进去的就是旧产物。
- OpenAPI 与 JSON Schema 是 **并列契约**：一个管 HTTP 外形，一个管内容结构，不能互相替代。

### 3.3 常见混淆点

| 容易混淆 | 区别 |
| --- | --- |
| revision 乐观锁 vs `SELECT ... FOR UPDATE` 悲观锁 | 两者都用：行锁保证事务内串行，revision 保证"打开页面后别人改过"能被发现。 |
| Idempotency-Key vs 普通重试 | 同一个 key 必须配同一份请求体；用户改了内容就是新操作，要换新 key。 |
| MySQL JSON vs 发布 payload 字节 | JSON 列会规范化表示，不能保证读回来字节相同；固定摘要必须存 `payload_bytes`。 |
| 草稿校验 vs 发布校验 | 草稿允许不完整；发布才检查空 key、重复 key、空文档、未确认文档。 |
| OpenAPI vs JSON Schema | OpenAPI 描述路由和请求/响应；JSON Schema 描述 `content` 内部结构。 |
| CSRF token vs 登录 token | CSRF token 只证明"请求来自本站页面"，不负责识别用户身份。 |
| `go:embed` vs Docker 静态服务器 | 前者把文件编进二进制；后者需要额外进程和文件同步。 |
| 登录成功 vs 有权限 | 认证只回答"你是谁"；授权还要查 workspace/app/template 角色。 |

## 4. 详细介绍每个知识点

### 4.1 Go 单进程服务

- **如何理解**：把后端想象成一个"总服务台"。页面文件、管理接口、Agent 只读接口都由同一个 Go 程序接待，不需要再启动 Node、Nginx 或 Java 服务。
- **解决什么问题**：减少部署组件和运行环境，避免多进程之间的配置漂移；一个语言覆盖 handler、service、domain、repository 四层。
- **没有会怎么样**：前端一个服务、后端一个服务、静态资源一个服务，发布时要同步多个版本；任何一处配置不一致都会出现"页面是新的、接口是旧的"。
- **核心机制/用法**：设计约定进程内分层：

```text
handler -> service -> domain
                 \-> repository -> MySQL
```

  handler 不直接写 SQL，service 决定事务边界，domain 不依赖 HTTP 或数据库。
- **注意事项**：单进程不等于单文件；仍然要分 `internal/domain`、`internal/service`、`internal/repository/mysql`、`internal/httpapi`。首版不引入 ORM。

### 4.2 `net/http`、ServeMux 与 middleware

- **如何理解**：`net/http` 是 Go 自带的"HTTP 前台"。`ServeMux` 负责把 `/api/v1/apps` 这样的路径分给对应处理函数；middleware 像安检传送带，请求先经过它，再到业务处理。
- **解决什么问题**：不引入 Web 框架也能获得路由、请求解析、响应输出；认证、权限、请求大小、CSRF、日志等横切逻辑只写一次。
- **没有会怎么样**：每个 handler 各写一遍鉴权和错误处理，行为不一致；换一个路由就漏掉权限检查。
- **核心机制/用法**：

```go
mux := http.NewServeMux()
mux.HandleFunc("GET /healthz", healthz)
mux.Handle("GET /api/v1/apps", withAuth(withLog(listApps)))
```

  中间件本质是 `func(http.Handler) http.Handler`，按顺序包起来。
- **注意事项**：
  - SPA 回退只能用于页面路由；`/api/`、`/reader/`、`/healthz`、`/readyz` 的未知路径必须返回 HTTP 错误，不能返回 `index.html`。
  - JSON 请求要求 `Content-Type: application/json`，拒绝未知的 envelope 字段。
  - 统一限制请求体大小，超限返回 413 并指出位置，不截断。

### 4.3 `database/sql`、MySQL 驱动与连接池

- **如何理解**：`database/sql` 是 Go 访问数据库的"标准插座"，MySQL 驱动是插头。`sql.DB` 不是一条连接，而是一个连接池，每次查询借一条、用完还回去。
- **解决什么问题**：安全地拼接参数、复用连接、控制并发、设置超时；避免手写连接管理和 SQL 注入。
- **没有会怎么样**：字符串拼 SQL 导致注入；连接泄漏拖垮数据库；每个请求新建连接，延迟飙升。
- **核心机制/用法**：

```go
db, _ := sql.Open("mysql", dsn)
db.SetMaxOpenConns(10)
db.SetMaxIdleConns(5)
db.SetConnMaxLifetime(5 * time.Minute)

row := db.QueryRowContext(ctx,
  "SELECT revision FROM app_draft WHERE app_id = ?", appID)
```

- **注意事项**：
  - 永远用 `?` 参数化，不拼字符串。
  - `sql.DB` 是池，不要每次请求 `Open` 一次。
  - 查询和发布都要带 `context` 超时：设计初始值查询 5 秒、发布整体 15 秒。
  - DSN 用 `parseTime=true&charset=utf8mb4&loc=UTC`，时间统一 UTC。
  - 首版直接写清晰 SQL，不引入 ORM。

### 4.4 MySQL 8.4 / InnoDB 与事务

- **如何理解**：MySQL 是"唯一账本"，InnoDB 是支持事务的存储引擎。事务像一张草稿纸：一组读写要么全部生效，要么全部作废。
- **解决什么问题**：保证保存、发布、归档这些多表操作的原子性；用唯一键在数据库层兜底防重复。
- **没有会怎么样**：发布到一半进程挂了，出现"版本号加了但发布记录没写"的半成品；两个请求同时创建同一个 App，产生重复数据。
- **核心机制/用法**：

```sql
BEGIN;
-- 锁、检查 revision、写草稿、写发布记录、写操作记录
COMMIT;
```

  失败时必须 `ROLLBACK`；提交成功后才能返回"保存成功"。
- **注意事项**：
  - 不要用 SQLite 替代 MySQL 来验证发布事务，两者锁和隔离行为不同。
  - MySQL 的 DDL 可能隐式提交，迁移不能假设整批 DDL 都能回滚。
  - 首版读"当前发布版本"只读主实例，不从可能滞后的只读副本读。
  - 业务数据存 MySQL，Git 只存设计、源码和初始模板。

### 4.5 锁与 `SELECT ... FOR UPDATE`

- **如何理解**：乐观锁是"我先记下版本号，提交时对一下"；悲观锁是"我先把这行占住，别人等我用完"。这里两者都用：行锁负责事务内串行，revision 负责发现页面打开后被别人改过。
- **解决什么问题**：两个用户同时保存、两个请求同时发布、发布和归档同时发生时的数据竞争。
- **没有会怎么样**：两个发布请求都读到当前版本 3，都写成版本 4；或者一个请求刚检查完权限，另一个请求把 App 归档了，前者仍然写入成功。
- **核心机制/用法**：

```sql
SELECT revision FROM app_draft WHERE app_id = ? FOR UPDATE;
```

  设计约定的锁顺序：

```text
写请求：先申请自己的幂等记录
模板发布：template_head -> template_draft
App 操作：app_config -> app_draft
```

- **注意事项**：
  - 所有写路径使用同一锁顺序，降低死锁概率。
  - 锁必须命中主键或唯一键，避免全表锁。
  - 拿到锁后要重新检查权限、归档状态和 revision。
  - 死锁或短暂锁超时，只对"同一 key、同一候选"最多重试 2 次并加短随机退避；revision 冲突不自动重试。
  - 不要用一个全局互斥锁代替数据库约束。

### 4.6 MySQL JSON 类型与"字节不漂移"

- **如何理解**：MySQL 的 JSON 列像一个"会自动整理格式的收纳盒"：你放进去 `{"a":1,"b":2}`，它可能以另一种等价形式存下来。内容一样，但字节不一定一样。
- **解决什么问题**：既要灵活保存任意配置结构，又要给 Agent 一个永远不变的发布内容。
- **没有会怎么样**：发布时算的哈希是 A，读取时重新序列化得到字节 B，哈希对不上；Agent 每次拿到的内容看起来一样，校验却失败。
- **核心机制/用法**：
  - `content` JSON：保存完整可编辑副本，用于恢复和继续编辑。
  - `payload_bytes`：发布时生成一次紧凑 UTF-8 字节，原样保存。
  - 发布时计算 `sha256:<64位小写十六进制>`，读取时直接返回保存的字节。
- **注意事项**：
  - 不要"读 MySQL JSON 再重新序列化"来当作固定 payload。
  - 摘要范围覆盖所有读取字段、配置描述和文档，排除发布时间、说明、请求标识和 hash 自身。
  - 需要校验下载时，对 reader 原始响应字节算 SHA-256；完整导出 envelope 的 hash 对应内部 payload，不是 envelope 本身。

### 4.7 revision 乐观并发控制

- **如何理解**：revision 像文档右上角的"第几版"。你打开时是第 3 版，保存时必须告诉服务器"我基于第 3 版改的"；如果服务器已经是第 4 版，就拒绝并提示你。
- **解决什么问题**：多人同时编辑同一个 App 时，避免后保存的人悄悄覆盖前一个人的修改。
- **没有会怎么样**：A 和 B 同时打开草稿，A 先保存，B 后保存把 A 的内容整体覆盖；用户以为自己的修改还在，实际已经丢了。
- **核心机制/用法**：
  - `app_draft.revision` 是该 App 所有整体写操作的统一修订号。
  - 保存、发布、恢复、归档，每次成功都 `revision += 1`。
  - 请求带 `expectedRevision`，事务内比较，不匹配返回 `409 REVISION_CONFLICT`。
  - 错误里返回 `currentRevision` 和 `lastEditor`，前端保留本地副本，由人核对后重新保存。
- **注意事项**：
  - revision 不是发布版本号；发布版本号是另一套 `current_version`。
  - 冲突不自动合并、不自动重试；合并可能产生业务错误。
  - revision 检查和行锁要配合使用，不能只在应用层比较。

### 4.8 Idempotency-Key 幂等

- **如何理解**：幂等就是"同一个操作做一次和做多次，结果一样"。客户端给一次写操作生成一个唯一 key，超时重试时还带同一个 key，服务端就能认出"这是刚才那次，不要重复执行"。
- **解决什么问题**：网络超时、用户连点、客户端重试导致的重复发布、重复创建、重复归档。
- **没有会怎么样**：第一次发布其实成功了但响应丢了，客户端重试又发布一次，产生两个版本；或者创建出两个同名 App。
- **核心机制/用法**：
  - 表 `request_dedup` 对 `(principal_id, idempotency_key)` 全局唯一。
  - 在同一个事务里插入占位记录，业务成功时写入真实状态和响应。
  - 唯一键冲突时，读取已提交记录，比较操作（方法+路径）、目标范围和 `SHA256(原始请求体字节)`。
  - 完全一致就回放原状态和响应；不一致返回 `409 IDEMPOTENCY_KEY_REUSED`。
- **注意事项**：
  - 只有真正持久化的写操作才要求该键；校验、补充预览、单文件导出不写入，不带。
  - 占位记录不能先提交成 pending；否则失败后会留下"永远处理中"。
  - 新编辑是新操作，要生成新 key；重试必须复用同一份序列化请求体。
  - 首版不自动删除成功记录；未来清理要先设计过期键拒绝机制。

### 4.9 SHA-256、ETag 与缓存

- **如何理解**：SHA-256 像内容的"指纹"，内容变一点，指纹就完全不同。ETag 是 HTTP 的"指纹贴纸"，客户端问"还是这个指纹吗"，服务端说"是"就返回 304，不用重传。
- **解决什么问题**：校验发布内容没有被改动；让 Agent 少下载未变化的内容；让静态资源可以长期缓存而不串版本。
- **没有会怎么样**：Agent 无法确认拿到的配置是不是发布时那一份；每次轮询都全量下载；浏览器缓存了旧的 `index.html`，加载到已删除的 JS 文件。
- **核心机制/用法**：
  - 发布摘要格式：`sha256:<64位小写十六进制>`。
  - 读取接口返回带引号的 ETag；请求带 `If-None-Match` 且匹配时返回 304。
  - 静态资源用内容哈希文件名，长期缓存；`index.html` 不长期缓存。
  - JSON 响应禁止共享缓存；浏览器身份页不能缓存给其他用户会话。
- **注意事项**：
  - 304 之前仍然要先认证授权，不能因为"没变化"就跳过权限。
  - 不要要求前端用 `JSON.stringify` 重算摘要；前端序列化顺序不一定和服务端一致。
  - 导出文件名进入 `Content-Disposition` 前要做 UTF-8 编码并拒绝换行。

### 4.10 React + TypeScript 双状态模型

- **如何理解**：React 用组件描述页面，TypeScript 给数据加"类型说明书"。这个平台最关键的不是组件多，而是两份状态要分清楚：服务端已保存的 `serverDraft`，和页面正在改的 `workingContent`。
- **解决什么问题**：用户编辑到一半时，保存请求返回；如果直接用服务端结果覆盖页面，用户刚输入的内容就丢了。双状态让"已保存"和"正在编辑"互不打架。
- **没有会怎么样**：保存成功后页面回退到旧内容；切换模块后未保存修改消失；删除一行后 value 错位到另一行。
- **核心机制/用法**：
  - `serverDraft`：最近一次确认从服务端读取或保存成功的整体与 revision。
  - `workingContent`：页面当前修改副本；`dirty` 由编辑事件和内容比较产生。
  - 保存时固定本次 content；成功后只更新 `serverDraft`，不覆盖更新的 `workingContent`。
  - 发布期间禁用编辑和重复提交，避免候选内容漂移。
- **注意事项**：
  - 配置行用稳定的 `row.id` 作为 React key，禁止用数组索引；否则删除后输入框会串值。
  - 文档正文一改就把 `confirmed` 置 false；重新勾选表示对当前正文确认。
  - 离开页面时若 dirty 要提醒；关闭标签页用 `beforeunload`。
  - 首版不引入 Redux 等全局状态库，局部状态 + Context 足够。

### 4.11 Vite 与 Ant Design

- **如何理解**：Vite 是前端开发的"快速启动器"和打包机；Ant Design 是现成的组件仓库，表格、表单、弹窗、上传不用从零写。
- **解决什么问题**：开发时热更新、生产时压缩打包；统一交互和视觉，减少重复造组件。
- **没有会怎么样**：改一行代码等很久；每个页面自己写一套表格和弹窗，行为不一致；构建产物没有哈希，缓存容易出错。
- **核心机制/用法**：

```sh
npm ci
npm run build
# 产物复制到 internal/webassets/dist，再由 go:embed 打进二进制
```

  开发时 Vite 代理 `/api` 到本地 Go 服务。
- **注意事项**：
  - 统一用 `npm ci`，依赖锁在 `package-lock.json`，不要用 `npm install` 漂移版本。
  - 生产构建产物才嵌入；开发服务器不参与生产运行。
  - 组件库负责外观，不负责业务校验；最终校验仍以后端为准。

### 4.12 `go:embed` 与单二进制交付

- **如何理解**：`go:embed` 在编译时把文件"复印"进二进制。运行时程序从内存里的文件系统读，不依赖外部目录。
- **解决什么问题**：把前端产物、数据库迁移、初始模板一起交付，避免"二进制是新的、静态文件是旧的"。
- **没有会怎么样**：部署要同时拷二进制、`dist`、迁移 SQL、种子 JSON；漏一个就启动失败或页面 404。
- **核心机制/用法**：

```go
//go:embed all:dist
var webAssets embed.FS
```

  迁移和种子也各自 `embed`，启动时按版本执行。
- **注意事项**：
  - 嵌入发生在编译期，改了前端必须重新构建再编译 Go。
  - 嵌入的文件系统是只读的，不能往里写运行时数据；业务数据仍然进 MySQL。
  - 启动时检查迁移版本和校验和，不匹配时 readiness 失败，而不是偷偷继续跑。

### 4.13 OpenAPI 3.1 与 JSON Schema

- **如何理解**：OpenAPI 是"接口说明书"，写清楚有哪些路由、请求长什么样、响应长什么样；JSON Schema 是"内容结构说明书"，写清楚 `content` 里模块、文件、配置行怎么嵌套。
- **解决什么问题**：前端、后端、Agent 共用一份机器可读的契约，减少"字段名对不上"和"文档过期"。
- **没有会怎么样**：后端改了字段，前端和 Agent 还在用旧名字；同一个配置行类型在三个地方各维护一份，最后谁都不一致。
- **核心机制/用法**：
  - `docs/contracts/openapi.yaml`：唯一路由和 DTO 契约。
  - `docs/contracts/content.schema.json`：唯一编辑内容结构。
  - 改接口或内容类型时，同步更新 OpenAPI、Schema、示例和测试。
- **注意事项**：
  - JSON Schema 只限制结构，不负责"发布时文档必须确认"这类业务规则；业务校验在后端 service/domain。
  - Schema 的字符长度限制和服务端的字节限制都要检查，二者不是一回事。
  - 不要另写一份字段不同的类型定义。

### 4.14 local 模式与 gateway HMAC 认证

- **如何理解**：本地开发用 `local` 模式，固定身份 `user:local`，只允许监听回环地址；生产部署在公司认证网关后面，网关认证用户后，用共享密钥给身份信息签名，Go 服务验签。
- **解决什么问题**：开发时不想配登录；生产时不能相信客户端自己填的身份头。
- **没有会怎么样**：任何人伪造 `X-AAC-Principal` 就能冒充管理员；或者本地开发也要搭一套完整认证，效率极低。
- **核心机制/用法**：
  - local：`AUTH_MODE=local`，地址必须是 `127.0.0.1`，拒绝 `0.0.0.0` 或公网地址。
  - gateway：校验 `X-AAC-Principal`、`X-AAC-Timestamp`、`X-AAC-Request-Id`、`X-AAC-Signature`。
  - 签名原文包含时间戳、请求 ID、方法、转义后的路径和查询串、主体、请求体 SHA-256。
  - 只接受受信网关地址；时间误差不超过 60 秒；签名用常量时间比较。
- **注意事项**：
  - 网关必须先移除客户端伪造的身份头，再写入自己的头。
  - 共享密钥只从环境或受保护配置文件注入，不入库、不进 Git。
  - 生产缺少认证配置或仍是 local 模式，必须拒绝公网启动。

### 4.15 CSRF 与浏览器会话

- **如何理解**：CSRF 是"别的网站借你的浏览器，偷偷向本站发一个已登录请求"。防护思路是：检查来源、限制 Cookie 携带方式、再要求一个只有本站页面能拿到的 token。
- **解决什么问题**：用户登录后，恶意页面诱导浏览器向平台发发布、删除、归档请求。
- **没有会怎么样**：攻击者做一个图片链接或表单，就能让已登录用户无意中发布错误配置。
- **核心机制/用法**：
  - 校验 `Origin` 为当前服务同源。
  - 会话 nonce 放在 `HttpOnly`、`SameSite=Lax` 的 Cookie 里，8 小时过期，生产加 `Secure`。
  - CSRF token = `HMAC-SHA256(secret, "csrf\n" + principal + "\n" + nonce)`，由 session 接口返回。
  - 非 GET 请求在 `X-CSRF-Token` 带回并匹配。
- **注意事项**：
  - CSRF token 不是身份凭证，不能替代登录态。
  - Bearer 机器请求不走浏览器 Cookie，不需要 CSRF，但仍然只能只读。
  - 更换主体或过期后必须重建会话；不使用 Redis 存会话。

### 4.16 机器 Bearer token 与 RBAC

- **如何理解**：给 Agent 发一张"只读门禁卡"。CLI 生成 32 字节随机 token，明文只显示一次；数据库只存 SHA-256 摘要。请求带 `Authorization: Bearer <token>`，服务端查摘要确认身份，再查授权表确认能读哪个 App。
- **解决什么问题**：Agent 需要稳定读取固定发布版，但不应该能改配置、发布或看管理草稿。
- **没有会怎么样**：Agent 用管理员账号乱改；数据库泄露后 token 明文可直接使用；离职或撤销后 token 仍然有效。
- **核心机制/用法**：
  - 角色分层：workspace 的 `admin` / `creator`，App 的 `viewer` / `editor` / `publisher`，模板的 `viewer` / `template_admin`。
  - 机器主体只允许 `/reader/v1/*`，管理 API 一律拒绝。
  - 每个请求查 `access_grant`，撤销立即生效；首版不缓存撤销状态。
  - 看不到的资源统一返回 404，避免探测其他 App 是否存在。
- **注意事项**：
  - 登录成功不等于有全局权限；gateway 用户也必须有显式授权。
  - 模板管理员不自动获得所有 App 权限。
  - 授权基于 URL 范围和服务器对象，不依赖文件里声明的 origin 或 App 编码。
  - 日志里不能打印 token、DSN 和整段配置/文档。

### 4.17 健康检查、结构化日志与时间

- **如何理解**：`/healthz` 回答"进程还活着吗"，`/readyz` 回答"现在能正常接流量吗"。结构化日志就是每条日志都是 JSON，机器能直接检索字段。
- **解决什么问题**：负载均衡不会把流量打给一个数据库连不上、迁移版本不对的实例；出问题时能按 `requestId` 串起一次请求。
- **没有会怎么样**：进程活着但数据库挂了，仍然接流量，用户全部报错；日志是一大段文本，排查时只能肉眼翻。
- **核心机制/用法**：
  - `/readyz` 检查数据库连接和迁移版本/校验和。
  - 日志字段至少包含 `requestId`、主体、范围、动作、耗时、结果。
  - 时间统一 UTC，HTTP 响应使用 RFC3339。
- **注意事项**：
  - `/healthz`、`/readyz` 不能被 SPA 回退吞掉。
  - readiness 失败时不要自动执行破坏性迁移。
  - 日志禁止打印 DSN、token 和完整配置/文档正文。

### 4.18 测试：单元、MySQL 集成与 Playwright

- **如何理解**：单元测试验证纯逻辑；集成测试连真实 MySQL 验证事务和并发；Playwright 用真实浏览器走页面主流程。三者解决不同层的问题。
- **解决什么问题**：revision 冲突、幂等键碰撞、并发发布、事务失败注入这些行为，靠 mock 测不出来；页面输入、切换、窄屏也只能在浏览器里验证。
- **没有会怎么样**：单测全绿但生产出现两个发布版本；页面在 390px 宽度下按钮点不到；保存失败后输入丢失。
- **核心机制/用法**：
  - Go 单元测试：类型转换、key 冲突、描述-only 对比、占位值转义、来源识别、文档确认、payload 摘要、权限映射。
  - MySQL 集成测试：revision CAS、唯一键冲突、多个发布请求竞争、事务失败注入、commit 结果未知后重试、幂等键碰撞、归档竞争、种子幂等。
  - Playwright：按 PRD 38 项 AC 覆盖主流程，包含中文、换行、HTML-like 内容、`0`/`false`/空数组、390px 宽度。
- **注意事项**：
  - 集成测试只连开发或测试数据库。
  - 不能用 SQLite 替代 MySQL 做事务验证。
  - 交付时要区分"文档静态检查""原型浏览器检查""应用集成测试""真实 Agent 读取"，没跑过的不能写成已通过。

## 5. 实际案例讲解

### 场景背景

业务同学在页面上修改 `common/app.yaml` 里的 `app.name_cn`，保存草稿，然后发布；稍后一个 Agent 来读取这个固定版本。我们跟着这条链路，看每个技术组件在哪里出场。

### 目标

1. 保存不覆盖别人刚改过的草稿。
2. 网络超时重试不会产生两个发布版本。
3. Agent 拿到的内容与发布时完全一致，内容没变时返回 304。

### 步骤拆解

**第 1 步：页面编辑**

- React 组件把用户输入写进 `workingContent`，配置行用稳定的 `row.id` 作为 key。
- 修改 `app.name_cn` 时，前端同步 `content.name`。
- 此时 `workingContent` 与 `serverDraft` 不一致，页面标记 dirty。
- 对应知识点：4.10 React 双状态、4.11 Ant Design 表单。

**第 2 步：发起保存**

- 前端生成一个新的 `Idempotency-Key`，并保存本次序列化后的请求体。
- 请求带 `expectedRevision` 和 CSRF token，发到 `PUT /api/v1/...`。
- 对应知识点：4.8 幂等、4.15 CSRF。

**第 3 步：服务端接收**

- `net/http` 的 middleware 校验 Content-Type、请求大小、Origin、身份和权限。
- handler 不写 SQL，把请求交给 service；service 开启事务。
- 对应知识点：4.1 Go 单进程、4.2 `net/http`、4.3 `database/sql`。

**第 4 步：事务内保存**

```text
BEGIN
  插入幂等占位记录
  SELECT ... FOR UPDATE 锁 app_config、app_draft
  比较 expectedRevision 与数据库 revision
  写完整 content；revision += 1
  写操作记录
  把成功响应写入幂等记录
COMMIT
```

- 如果 revision 已被别人推进，返回 409，前端保留本地副本。
- 如果唯一键冲突，说明同一个 key 的请求已提交或正在提交，读取已提交记录后回放。
- 对应知识点：4.4 事务、4.5 行锁、4.7 revision、4.8 幂等。

**第 5 步：发布**

- 服务端按候选 content 做业务校验：key 非空、不重复、文档非空且已确认。
- 在同一个事务里保存候选草稿、写 `app_release`、更新当前发布指针。
- 发布时生成一次紧凑 UTF-8 payload 字节，计算 `sha256:<64hex>`，把字节存进 `payload_bytes`。
- 对应知识点：4.6 JSON 规范化、4.9 SHA-256、4.4 事务。

**第 6 步：Agent 读取**

```text
GET /reader/v1/apps/{code}/environments/{environment}/current
  -> releaseId / version / hash

GET /reader/v1/releases/{releaseId}/payload
  Authorization: Bearer <token>
  If-None-Match: "<hash>"
  -> 200 + 固定字节，或 304
```

- 服务端先认证授权，再返回保存的 `payload_bytes`，不重新序列化。
- 内容没变时返回 304，Agent 不用重复下载。
- 对应知识点：4.9 ETag、4.16 Bearer token 与 RBAC、4.17 健康检查与日志。

### 最终结果

- 页面保存的是完整草稿，不完整也能存；发布才做严格业务校验。
- 两个人同时保存时，后提交的人收到 409，而不是静默覆盖。
- 同一次发布即使客户端重试，也只会产生一个版本。
- Agent 拿到的字节与发布时一致，摘要可校验；内容未变时走 304。
- 整条链路只依赖 Go 进程和 MySQL，没有 Redis、队列或独立静态服务器。

### 这张案例图对应的知识重点

| 链路环节 | 关键技术 | 最该记住的一句话 |
| --- | --- | --- |
| 页面编辑 | React 双状态 | 服务端已保存和页面正在改必须分开 |
| 保存请求 | Idempotency-Key + CSRF | 重试复用同一 key 和同一请求体 |
| 事务处理 | 行锁 + revision | 先锁行，再比版本，最后写 |
| 发布固定 | JSON 字节 + SHA-256 | 存原始字节，不重新序列化 |
| Agent 读取 | ETag + Bearer | 先鉴权，再判断 304 |
| 整体交付 | `go:embed` | 前端、迁移、种子都在一个二进制里 |

## 6. 学习自检清单

看完后能用一句话回答下面这些问题，说明这张技术地图基本建立了：

- [ ] 为什么这个平台只需要 Go 进程和 MySQL，而不需要 Redis、队列和独立静态服务器？
- [ ] `net/http` 的 middleware 解决了哪些"每个接口都要写一遍"的问题？
- [ ] `sql.DB` 为什么不是一条连接？连接池的 `MaxOpen` / `MaxIdle` / `MaxLifetime` 分别控制什么？
- [ ] 事务里的 `BEGIN` / `COMMIT` / `ROLLBACK` 分别对应业务上的什么保证？
- [ ] `SELECT ... FOR UPDATE` 和 revision 乐观锁为什么要一起用，而不是二选一？
- [ ] 为什么不能读 MySQL JSON 后重新序列化当作固定发布内容？
- [ ] 同一个 `Idempotency-Key` 在什么情况下可以回放，什么情况下必须返回 409？
- [ ] `serverDraft` 和 `workingContent` 分别代表什么？保存成功后为什么不能直接覆盖页面内容？
- [ ] `go:embed` 嵌入发生在什么时候？改了前端为什么必须重新编译 Go？
- [ ] OpenAPI 和 JSON Schema 各自约束什么，为什么不能只留一份？
- [ ] gateway 模式下为什么必须验签，不能直接相信 `X-AAC-Principal`？
- [ ] CSRF token 和 Bearer token 分别防什么，为什么机器请求不需要 CSRF？
- [ ] 为什么 `/readyz` 不能只检查进程活着，还要检查数据库和迁移版本？
- [ ] 为什么事务和并发问题必须用真实 MySQL 集成测试，而不是 mock？

如果其中某一条还答不上来，回到第 4 部分对应的小节，优先补"解决什么问题"和"没有会怎么样"这两问。
