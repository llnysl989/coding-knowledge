# Flink 本地环境完整跟练文档

这份文档的目标不是只让你“知道 Flink 是什么”，而是让你 **亲手把一个 Flink 集群跑起来，并提交一个示例任务**。

你按这份文档走完一遍，至少会熟悉这些内容：

1. 用 Docker Compose 启动 Flink JobManager 和 TaskManager
2. 在浏览器里打开 Flink Web UI
3. 查看 Flink 容器状态和日志
4. 提交一个官方自带的 WordCount 示例任务
5. 在 Web UI 里观察作业运行情况
6. 初步理解 JobManager、TaskManager、Task Slot、并行度这些概念
7. 知道后续怎么扩展 Kafka、CDC、Paimon 等实战环境

---

## 1. 你这次练习的最终目标

练习结束时，你应该能回答这些问题：

- Flink 的 JobManager 和 TaskManager 分别负责什么
- 为什么 Flink Web UI 默认访问 `8081` 端口
- `docker compose up -d` 启动了哪些容器
- 怎么提交一个 Flink 作业
- 怎么查看作业是否执行成功
- Task Slot 和并行度大概是什么关系

如果这些问题你都能自己讲出来，说明这套环境已经真正跑通了。

---

## 2. 前置准备

先确认你已经安装并启动 Docker Desktop。

在终端执行：

```bash
docker --version
```

再执行：

```bash
docker compose version
```

如果两个命令都能正常输出版本号，说明 Docker 基础命令可用。

如果提示连不上 Docker daemon，通常说明 Docker Desktop 没启动，需要先打开 Docker Desktop。

---

## 3. 本次练习你要做什么

这次我们用一个最小可运行的 Flink Session Cluster：

```text
Docker Compose
├── jobmanager   # Flink 调度和 Web UI
└── taskmanager  # Flink 计算资源
```

整个流程是：

```text
启动容器
→ 打开 Web UI
→ 查看集群资源
→ 提交 WordCount 示例任务
→ 在 Web UI 查看作业
→ 看日志
→ 停止环境
```

这套环境适合刚开始学习 Flink，不会一次性引入 Kafka、MySQL、CDC 等额外组件。

---

## 4. 目录结构

当前目录结构应该是：

```text
flink/
├── compose.yaml
├── knowledge.md
├── practice-guide.md
└── wordcount-java/  # 你要自己打包提交的 Java WordCount 示例工程
```

其中：

- `compose.yaml`：本地 Flink 环境配置
- `knowledge.md`：Flink 基础知识说明
- `practice-guide.md`：你正在看的跟练文档
- `wordcount-java/`：Java DataStream API WordCount 示例（可打包成 jar 并提交到集群）

---

## 5. 第一步：进入 Flink 目录

在项目根目录执行：

```bash
cd flink
```

确认当前目录下有 Compose 文件：

```bash
ls
```

你应该能看到：

```text
compose.yaml
knowledge.md
practice-guide.md
```

---

## 6. 第二步：启动 Flink 环境

在 `flink/` 目录下执行：

```bash
docker compose up -d
```

第一次执行时，Docker 会尝试拉取 Flink 镜像，耗时取决于网络情况。

启动成功后，查看容器状态：

```bash
docker compose ps
```

正常情况下，你应该能看到类似：

```text
NAME                 IMAGE         STATUS          PORTS
flink-jobmanager     flink:1.20    Up              0.0.0.0:8081->8081/tcp
flink-taskmanager    flink:1.20    Up
```

这里重点看两点：

- `flink-jobmanager` 是 `Up`
- `flink-taskmanager` 是 `Up`

---

## 7. 第三步：打开 Flink Web UI

在浏览器访问：

```text
http://localhost:8081
```

如果打开成功，你会看到 Flink Dashboard。

你可以重点观察这些位置：

- Overview：集群总体状态
- Task Managers：当前有几个 TaskManager
- Task Slots：当前可用 Slot 数量
- Jobs：正在运行或已经结束的作业

如果页面打不开，先执行：

```bash
docker compose ps
```

确认 `flink-jobmanager` 是否正在运行。

---

## 8. 第四步：查看日志

查看 JobManager 日志：

```bash
docker compose logs jobmanager
```

查看 TaskManager 日志：

```bash
docker compose logs taskmanager
```

如果想持续跟踪日志，可以加 `-f`：

```bash
docker compose logs -f jobmanager
```

调试要点：

- JobManager 启动失败时，Web UI 通常打不开
- TaskManager 连不上 JobManager 时，Web UI 里看不到可用 Task Slot
- 端口冲突时，JobManager 容器可能启动失败

---

## 9. 第五步：提交官方 WordCount 示例任务

Flink 镜像里自带一些 example jar，可以直接提交。

执行：

```bash
docker compose exec jobmanager flink run examples/streaming/WordCount.jar
```

如果提交成功，你会看到类似：

```text
Job has been submitted with JobID ...
```

然后回到 Web UI：

```text
http://localhost:8081
```

在 Jobs 页面里可以看到这个作业的运行记录。

注意：

- 这个 WordCount 是官方示例，主要用于验证作业提交链路是否正常
- 不同 Flink 版本中 example jar 的具体输出可能略有差异
- 如果提示找不到 jar，可以进入容器确认 `examples/` 目录内容

---

## 9.1（推荐）打包并提交你自己的 Java WordCount 作业

前面提交的是“镜像自带的示例 jar”。这一步我们用 Java 写一个 WordCount，并把 jar 打出来提交到 Flink 集群里跑通。

### 9.1.1 打包 jar

先确认本机有 JDK（建议 11 或以上）和 Maven：

```bash
java -version
mvn -v
```

在项目根目录执行：

```bash
cd flink/wordcount-java
mvn -DskipTests package
```

打包成功后，应该能看到 shaded jar：

```bash
ls -lh target/*shaded.jar
```

### 9.1.2 把 jar 放进 JobManager 容器

回到项目根目录执行：

```bash
cd ../..
```

把 jar 拷贝到 JobManager 容器里（容器内路径用 `/tmp` 最方便）：

```bash
docker cp flink/wordcount-java/target/flink-java-wordcount-0.1.0-SNAPSHOT-shaded.jar flink-jobmanager:/tmp/wordcount.jar
```

### 9.1.3 提交作业执行

在项目根目录执行：

```bash
cd flink
docker compose exec jobmanager flink run -c com.koolearn.flink.wordcount.WordCountJob /tmp/wordcount.jar
```

你也可以传参数（多段文本 + 并行度）：

```bash
docker compose exec jobmanager flink run -c com.koolearn.flink.wordcount.WordCountJob /tmp/wordcount.jar \
  --parallelism 2 \
  --text "hello flink hello docker" \
  --text "flink wordcount"
```

### 9.1.4 在哪里看输出

这个示例用的是 `print()` 输出，结果会出现在 TaskManager 的日志里：

```bash
docker compose logs -f taskmanager
```

你也可以打开 Web UI 看作业记录：

```text
http://localhost:8081
```

### 9.1.5 你问的“用 Docker 启动 Flink，每次部署任务也要用 Docker 吗？”

不用把“部署任务”理解成“重新部署/重建 Flink 容器”。

你每次发布一个新作业，本质是在向 JobManager 提交一个 jar：

- 本地 Docker Compose 场景下，你可以用 `docker compose exec jobmanager flink run ...` 来提交（因为 Flink CLI 在容器里），或者通过 Web UI / REST API 提交
- jar 在哪里？要么像上面这样 `docker cp` 进容器，要么用挂载卷把宿主机目录映射到容器里（更适合频繁迭代）

## 10. 第六步：进入 JobManager 容器看看

执行：

```bash
docker compose exec jobmanager bash
```

进入容器后，可以执行：

```bash
pwd
```

通常会看到当前在：

```text
/opt/flink
```

再执行：

```bash
ls
```

你会看到 Flink 的目录结构，例如：

```text
bin
conf
examples
lib
log
plugins
```

几个重点目录：

- `bin/`：Flink 命令，比如 `flink`、`sql-client.sh`
- `conf/`：配置文件
- `examples/`：官方示例 jar
- `log/`：运行日志
- `lib/`：核心依赖和 connector 依赖

退出容器：

```bash
exit
```

---

## 11. 第七步：理解 Task Slot 和并行度

当前 `compose.yaml` 里配置了：

```text
taskmanager.numberOfTaskSlots: 2
```

可以先简单理解为：

> Task Slot 是 TaskManager 提供给 Flink 作业使用的计算资源槽位。

如果一个作业并行度是 2，它通常需要 2 个并行执行资源。

你可以在 Web UI 的 Task Managers 页面看到当前 Slot 情况。

刚入门时先记住：

- JobManager 负责调度
- TaskManager 负责执行
- Slot 是 TaskManager 暴露出来的执行资源
- 并行度决定一个算子可以拆成多少份并行执行

---

## 12. 可选：体验 Flink SQL Client

进入 JobManager 容器：

```bash
docker compose exec jobmanager bash
```

启动 SQL Client：

```bash
./bin/sql-client.sh
```

进入后可以先执行：

```sql
SHOW CATALOGS;
```

再执行：

```sql
SHOW DATABASES;
```

退出 SQL Client 可以输入：

```sql
QUIT;
```

再退出容器：

```bash
exit
```

说明：

- 当前环境只是最小 Flink 集群，没有额外配置 Kafka、MySQL、Paimon 等 connector
- 所以 SQL Client 主要用于熟悉入口，后续扩展 connector 后再做完整 SQL 实战

---

## 13. 停止环境

如果你只是暂停使用，可以执行：

```bash
docker compose stop
```

下次继续启动：

```bash
docker compose start
```

如果你想停止并删除容器，可以执行：

```bash
docker compose down
```

注意：

- 当前 Compose 没有配置持久化卷
- `down` 会删除容器，但不会删除这几个文档和 `compose.yaml`
- 如果后续加了 Kafka、MySQL、Paimon 数据目录，再清理时要更谨慎

---

## 14. 常见报错和排查思路

### 14.1 Docker daemon 连不上

现象：

```text
Cannot connect to the Docker daemon
```

处理：

1. 打开 Docker Desktop
2. 等待 Docker Desktop 显示 running
3. 重新执行：

```bash
docker compose ps
```

### 14.2 8081 端口被占用

现象：

```text
Bind for 0.0.0.0:8081 failed: port is already allocated
```

处理：

把 `compose.yaml` 里的端口改成：

```yaml
ports:
  - "8082:8081"
```

然后访问：

```text
http://localhost:8082
```

### 14.3 镜像拉取失败

现象：

```text
pull access denied
```

或：

```text
manifest unknown
```

处理：

1. 确认网络能访问 Docker Hub
2. 确认镜像 tag 是否存在
3. 如果 `flink:1.20` 拉取失败，可以临时改成官方存在的稳定版本，例如：

```yaml
image: flink:1.19
```

两个服务里的 `image` 都要一起改。

### 14.4 Web UI 打不开

处理顺序：

```bash
docker compose ps
```

确认容器是否是 `Up`。

再看日志：

```bash
docker compose logs jobmanager
```

如果 JobManager 没启动，优先看端口冲突和镜像启动错误。

### 14.5 TaskManager 没有注册上来

先看 Web UI 的 Task Managers 页面。

再看 TaskManager 日志：

```bash
docker compose logs taskmanager
```

重点检查：

- `jobmanager.rpc.address` 是否是 `jobmanager`
- 两个服务是否在同一个 Compose 网络里
- JobManager 是否已经启动

---

## 15. 下一步学习建议

这套环境跑通之后，建议按下面顺序继续学：

1. Flink 基础架构：JobManager、TaskManager、Slot、并行度
2. DataStream API：map、filter、keyBy、window
3. 时间语义：Processing Time、Event Time、Watermark
4. 状态：Keyed State、Operator State
5. 容错：Checkpoint、Savepoint
6. Flink SQL：Table API、SQL Client、Catalog
7. Connector：Kafka、MySQL CDC
8. 数据湖联动：Paimon、Iceberg

如果你后面要学习数据湖，可以结合仓库里的 `data-lake/knowledge.md` 一起看。Flink 常常作为实时写入和实时计算引擎，与 Paimon、Iceberg、Kafka、CDC 这些组件一起使用。
