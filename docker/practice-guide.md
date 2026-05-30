# Docker 完整跟练文档

这份文档的目标不是只让你“看懂概念”，而是让你 **亲手走完整个 Docker 基本流程**。

你按这份文档走完一遍，至少会熟悉这些内容：

1. 写一个最简单的 Node.js 服务
2. 写一个 `Dockerfile`
3. 用 `docker build` 构建镜像
4. 用 `docker run -p` 启动容器
5. 在浏览器里访问页面
6. 查看容器、日志、进入容器
7. 用 `docker compose` 再加一个 MySQL 服务
8. 最后把环境清理掉

---

## 1. 你这次练习的最终目标

练习结束时，你应该能回答这些问题：

- Docker 到底是怎么把程序跑起来的
- 镜像和容器到底是什么关系
- `Dockerfile` 每一行在干什么
- 为什么要做端口映射
- 为什么代码改了之后通常需要重新 build
- `docker compose` 为什么适合管理多个服务

如果这些问题你都能自己讲出来，说明这次练习就值了。

---

## 2. 前置准备

先确认你已经安装好 Docker。

如果你是 Mac，通常安装的是 Docker Desktop。

先在终端执行：

```bash
docker --version
```

```bash
docker compose version
```

如果两个命令都能正常输出版本号，说明基础环境没问题。

再执行一次：

```bash
docker run hello-world
```

如果能看到类似成功提示，说明 Docker 已经能正常拉镜像并启动容器。

---

## 3. 本次练习你要做什么

这次我们不搞复杂项目，就做一个最小可运行练习。

你会先做一个最简单的 Node.js HTTP 服务，然后：

```text
写代码
→ 写 Dockerfile
→ 构建镜像
→ 启动容器
→ 浏览器访问
→ 看日志 / 进容器
→ 再用 compose 起 app + mysql
```

整个流程非常适合第一次熟悉 Docker。

---

## 4. 新建练习目录

你可以在任意地方新建一个目录，比如：

```text
docker-practice/
```

最终目录结构会长这样：

```text
docker-practice/
├── index.js
├── package.json
├── Dockerfile
├── .dockerignore
└── compose.yaml
```

先不要急着一次性全建完，跟着下面步骤一点点来。

---

## 5. 第一步：写一个最简单的 Node.js 服务

新建 `package.json`：

```json
{
  "name": "docker-practice",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  }
}
```

再新建 `index.js`：

```javascript
const http = require("http");

const port = 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      message: "Hello Docker",
      path: req.url,
      time: new Date().toISOString()
    })
  );
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
```

这个程序的作用很简单：

- 启动一个 HTTP 服务
- 监听 `3000` 端口
- 当你访问它时，返回一段 JSON

你现在先记住一点：

> 后面 Docker 只是把这个程序装进容器里运行，本质上跑的还是这个 Node.js 服务。

---

## 6. 第二步：先本地跑一次

在这个目录下执行：

```bash
node index.js
```

如果终端输出：

```text
Server is running on port 3000
```

说明程序本身是正常的。

然后你可以在浏览器访问：

```text
http://localhost:3000
```

你应该会看到类似这样的 JSON：

```json
{"message":"Hello Docker","path":"/","time":"2026-05-29T..."}
```

这一步的意义是：

- 先确认不是程序本身有问题
- 后面如果 Docker 跑不起来，你就知道问题在容器流程，不在代码本身

访问完成后，按：

```text
Ctrl + C
```

把本地服务停掉。

---

## 7. 第三步：写第一个 Dockerfile

新建 `Dockerfile`：

```dockerfile
FROM node:20

WORKDIR /app

COPY package.json ./
COPY index.js ./

CMD ["node", "index.js"]
```

你先这样理解：

### `FROM node:20`

表示：

- 这份镜像基于 Node.js 20 官方镜像构建

也就是说，容器里会先有一个 Node.js 环境。

### `WORKDIR /app`

表示：

- 后续操作都在容器里的 `/app` 目录下进行

### `COPY package.json ./`

表示：

- 把你本地的 `package.json` 复制到容器里的当前目录

### `COPY index.js ./`

表示：

- 把服务代码复制进去

### `CMD ["node", "index.js"]`

表示：

- 容器启动后默认执行 `node index.js`

你此时要建立的核心理解是：

> Dockerfile 本质上是在描述“怎么准备运行环境，以及容器启动后跑什么命令”。

---

## 8. 第四步：补一个 `.dockerignore`

新建 `.dockerignore`：

```text
node_modules
npm-debug.log
.DS_Store
```

它的作用类似 `.gitignore`。

意思是：

- 这些文件不要在构建镜像时复制进去

虽然这个练习里还没有 `node_modules`，但从习惯上最好加上。

---

## 9. 第五步：构建你的第一个镜像

在练习目录下执行：

```bash
docker build -t docker-practice:v1 .
```

你先理解这个命令：

- `docker build`：构建镜像
- `-t docker-practice:v1`：给镜像起名字和标签
- `.`：表示使用当前目录作为构建上下文

构建成功后，再执行：

```bash
docker images
```

你应该能看到类似：

```text
docker-practice   v1
```

这说明镜像已经在本地了。

---

## 10. 第六步：启动你的第一个容器

执行：

```bash
docker run --name docker-practice-container -p 3000:3000 docker-practice:v1
```

你先拆开理解：

- `docker run`：基于镜像启动容器
- `--name docker-practice-container`：给容器取名字
- `-p 3000:3000`：宿主机端口映射到容器端口
- `docker-practice:v1`：使用哪个镜像启动

如果终端里出现：

```text
Server is running on port 3000
```

说明容器已经把你的服务启动起来了。

---

## 11. 第七步：在浏览器访问容器里的服务

打开浏览器，访问：

```text
http://localhost:3000
```

如果你能看到 JSON 返回，说明这条链路已经打通：

```text
你的浏览器
→ 访问你电脑的 3000 端口
→ Docker 把请求转发给容器的 3000 端口
→ 容器里的 Node.js 服务处理请求
→ 返回结果给浏览器
```

这一刻你要真正理解“端口映射”是干什么的。

如果没有 `-p 3000:3000`，容器内部服务虽然可能已经启动，但你电脑外面通常访问不到。

---

## 12. 第八步：学会查看容器状态

新开一个终端窗口，执行：

```bash
docker ps
```

你应该能看到正在运行的容器。

再执行：

```bash
docker ps -a
```

这个会显示所有容器，包括已经停止的。

你现在要形成两个直觉：

- `docker images` 看镜像
- `docker ps` 看容器

不要把它们混了。

---

## 13. 第九步：查看日志

执行：

```bash
docker logs docker-practice-container
```

你应该能看到启动日志。

如果你多访问几次页面，再看日志，你也可以顺便理解：

- 容器里跑的应用，日志也是可以通过 Docker 查看的

后面你排查问题时，这个命令会很常用。

---

## 14. 第十步：进入容器内部看看

执行：

```bash
docker exec -it docker-practice-container sh
```

进入后可以执行：

```bash
pwd
```

```bash
ls
```

你应该能看到：

- 当前目录大概率是 `/app`
- 里面有 `index.js` 和 `package.json`

这一步的意义非常大。

你会第一次直观看到：

- 你的本地文件被复制进镜像
- 镜像启动后形成容器
- 程序是在容器内部执行的

看完后输入：

```bash
exit
```

退出容器。

---

## 15. 第十一步：停止并删除容器

先按当前运行方式停掉前台容器，通常可以直接在运行窗口按：

```text
Ctrl + C
```

然后执行：

```bash
docker ps -a
```

再删除容器：

```bash
docker rm docker-practice-container
```

这一刻你要理解：

- 容器删掉了
- 但镜像通常还在

你可以再执行：

```bash
docker images
```

确认镜像还在本地。

---

## 16. 第十二步：修改代码，再重新构建一次

把 `index.js` 里的返回内容稍微改一下：

```javascript
const http = require("http");

const port = 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(
    JSON.stringify({
      message: "Hello Docker v2",
      path: req.url,
      time: new Date().toISOString()
    })
  );
});

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
```

然后重新构建：

```bash
docker build -t docker-practice:v2 .
```

再启动：

```bash
docker run --name docker-practice-container-v2 -p 3000:3000 docker-practice:v2
```

再访问浏览器。

如果你看到了：

```json
{"message":"Hello Docker v2", ...}
```

说明你已经理解了一个非常重要的事实：

> 代码改了以后，通常需要重新 build，新的镜像才会带上新代码。

这就是镜像“像打包产物”的感觉。

---

## 17. 第十三步：清理单容器练习环境

先停止容器，然后执行：

```bash
docker rm docker-practice-container-v2
```

如果你愿意，也可以把镜像删掉：

```bash
docker rmi docker-practice:v1
```

```bash
docker rmi docker-practice:v2
```

这样你会更清楚：

- 删除容器和删除镜像是两回事

---

## 18. 第十四步：开始练 `docker compose`

前面你已经练过“单个容器怎么跑”。

现在开始练“多个服务一起跑”。

这次我们起两个服务：

1. `app`：你的 Node.js 服务
2. `db`：一个 MySQL 服务

这里先不要求你把 app 真正连上 MySQL。

这一步的重点是理解：

- Compose 怎么统一管理多个服务
- 一个配置文件怎么一次拉起多套容器

---

## 19. 第十五步：写 `compose.yaml`

在同一个目录下新建 `compose.yaml`：

```yaml
services:
  app:
    build: .
    container_name: docker-practice-app
    ports:
      - "3000:3000"
    depends_on:
      - db

  db:
    image: mysql:8
    container_name: docker-practice-db
    environment:
      MYSQL_ROOT_PASSWORD: 123456
      MYSQL_DATABASE: practice_db
    ports:
      - "3307:3306"
    volumes:
      - mysql_data:/var/lib/mysql

volumes:
  mysql_data:
```

你先理解几个重点：

### `app`

表示你的 Node.js 服务。

### `build: .`

表示 `app` 服务不是直接拉现成镜像，而是用当前目录的 `Dockerfile` 自己构建。

### `db`

表示数据库服务。

### `image: mysql:8`

表示直接使用 MySQL 8 官方镜像。

### `environment`

表示给 MySQL 容器传启动所需环境变量。

### `ports`

这里把宿主机的 `3307` 映射到容器的 `3306`。

之所以不用 `3306:3306`，是为了减少和你本机已有 MySQL 冲突的概率。

### `volumes`

表示把 MySQL 数据做持久化。

如果没有这个卷，数据库容器删掉后，数据通常也会一起没掉。

---

## 20. 第十六步：启动 compose 环境

执行：

```bash
docker compose up --build
```

这个命令会做几件事：

1. 构建 `app` 镜像
2. 拉取 `mysql:8` 镜像（如果本地没有）
3. 启动 `app` 容器
4. 启动 `db` 容器
5. 把它们放进同一个 compose 管理环境里

第一次运行 MySQL 时，初始化通常会稍微慢一点。

---

## 21. 第十七步：验证两个服务都起来了

新开一个终端，执行：

```bash
docker compose ps
```

你应该能看到两个服务。

再访问：

```text
http://localhost:3000
```

确认 app 服务正常。

再验证 MySQL：

```bash
docker compose exec db mysql -uroot -p123456 -e "SHOW DATABASES;"
```

如果输出里能看到：

- `information_schema`
- `mysql`
- `performance_schema`
- `practice_db`

说明 MySQL 也成功启动了。

这一步非常关键。

因为你已经从“单容器练习”进阶到了“多服务编排”。

---

## 22. 第十八步：理解这时候发生了什么

到这里，你其实已经完成了一个非常典型的小型环境：

```text
浏览器
→ app 容器
→ db 容器
```

虽然当前 app 还没有真正访问 db，但你已经理解了：

- 一个项目通常不止一个容器
- 应用服务和数据库服务可以分开
- Compose 能统一管理它们

这就是后面学前后端项目部署时最重要的基础感觉。

---

## 23. 第十九步：停止并清理 compose 环境

停止并删除容器：

```bash
docker compose down
```

如果你连数据卷也想一起删掉：

```bash
docker compose down -v
```

你要注意这两个命令的区别：

- `docker compose down`：停服务并删容器/网络
- `docker compose down -v`：连卷也删掉

如果删了卷，MySQL 数据也会一起清掉。

---

## 24. 这次练习你应该重点体会什么

走完一遍后，不要只记命令。

你更应该抓住这些理解：

### 24.1 Dockerfile 是“构建说明书”

它定义镜像怎么做出来。

### 24.2 镜像是打包结果

代码和环境被装进镜像后，镜像可以反复启动容器。

### 24.3 容器是运行中的实例

镜像本身不运行，运行的是容器。

### 24.4 `-p` 让外部访问容器服务

没有端口映射，浏览器通常访问不到容器内部服务。

### 24.5 Compose 是多服务管理工具

单容器时用 `docker run` 很直接；多服务时用 Compose 更合适。

---

## 25. 建议你再做第二遍时重点观察什么

第二遍练习时，建议你重点观察这些问题：

1. 如果不写 `CMD` 会发生什么
2. 如果不做 `-p 3000:3000` 会发生什么
3. 如果代码变了但不重新 build 会发生什么
4. 如果删掉容器但不删镜像，会剩下什么
5. 如果 `docker compose down -v`，MySQL 数据为什么会没了

当你能自己回答这些问题，你对 Docker 的理解会更扎实。

---

## 26. 常见报错和排查思路

### 26.1 `port is already allocated`

说明端口被占用了。

比如：

- 你本机已经有服务占用 `3000`
- 或者已经有一个容器在占用这个端口

处理方式：

- 换一个宿主机端口，比如 `3001:3000`
- 或者先停掉占用端口的程序

### 26.2 `docker: command not found`

说明 Docker 没安装好，或者终端环境没有识别到。

### 26.3 MySQL 启动很慢

第一次初始化数据库时，稍微慢一点很正常。

可以先执行：

```bash
docker compose logs db
```

看数据库是否还在初始化。

### 26.4 浏览器访问不到页面

优先检查：

1. 容器有没有启动成功
2. 端口映射是否正确
3. 程序是否真的监听了 `3000`
4. `docker logs` 有没有报错

---

## 27. 这份练习走完以后你下一步该学什么

如果这份文档你已经顺利走完，建议下一步继续补这几个方向：

1. 学会 `docker logs`、`docker exec`、`docker inspect`
2. 学会给 Node.js 项目加依赖并在镜像里安装
3. 学会把 app 真正连接到 MySQL
4. 学会用 Nginx 反向代理前后端服务
5. 学会区分开发环境 Compose 和生产环境 Compose

---

## 28. 最后给你的使用建议

第一次走这份文档时，不要追求快。

建议你每做一步，都问自己这三个问题：

1. 我刚刚执行的命令干了什么
2. 这一步操作的是镜像，还是容器，还是 compose 服务
3. 如果这一步失败，我应该去看哪里排查

你只要不是“抄命令过一遍”，而是每一步都带着这三个问题去做，Docker 的基础流程就会很快建立起来。