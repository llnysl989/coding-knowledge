# Flink 常用命令速查

这份文档只放本地 Flink 环境的常用操作命令，方便后面实操时快速复制。

完整跟练说明见：

```text
practice-guide.md
```

基础知识说明见：

```text
knowledge.md
```

---

## 1. 进入 Flink 目录

在项目根目录执行：

```bash
cd flink
```

---

## 2. 启动环境

```bash
docker compose up -d
```

说明：

- 第一次启动会自动拉取 Flink 镜像
- 当前环境会启动 JobManager 和 TaskManager
- Web UI 默认端口是 `8081`

---

## 3. 查看容器状态

```bash
docker compose ps
```

正常情况下应该看到：

```text
flink-jobmanager    Up
flink-taskmanager   Up
```

---

## 4. 访问 Flink Web UI

浏览器打开：

```text
http://localhost:8081
```

如果 8081 端口被占用，可以把 `compose.yaml` 里的端口改成：

```yaml
ports:
  - "8082:8081"
```

然后访问：

```text
http://localhost:8082
```

---

## 5. 查看 Flink Web UI 配置接口

```bash
curl http://localhost:8081/config
```

如果想格式化 JSON：

```bash
curl -s http://localhost:8081/config | python3 -m json.tool
```

---

## 6. 查看日志

查看 JobManager 日志：

```bash
docker compose logs jobmanager
```

查看 TaskManager 日志：

```bash
docker compose logs taskmanager
```

持续跟踪 JobManager 日志：

```bash
docker compose logs -f jobmanager
```

持续跟踪 TaskManager 日志：

```bash
docker compose logs -f taskmanager
```

---

## 7. 提交官方 WordCount 示例任务

```bash
docker compose exec jobmanager flink run examples/streaming/WordCount.jar
```

提交成功后，会看到类似：

```text
Job has been submitted with JobID ...
Program execution finished
```

然后可以去 Web UI 查看作业记录。

---

## 8. 查看作业列表接口

```bash
curl http://localhost:8081/jobs/overview
```

格式化 JSON：

```bash
curl -s http://localhost:8081/jobs/overview | python3 -m json.tool
```

---

## 9. 进入 JobManager 容器

```bash
docker compose exec jobmanager bash
```

进入后常用命令：

```bash
pwd
ls
ls examples/streaming
```

退出容器：

```bash
exit
```

---

## 10. 进入 TaskManager 容器

```bash
docker compose exec taskmanager bash
```

退出容器：

```bash
exit
```

---

## 11. 启动 SQL Client

进入 JobManager 容器：

```bash
docker compose exec jobmanager bash
```

启动 SQL Client：

```bash
./bin/sql-client.sh
```

常用 SQL：

```sql
SHOW CATALOGS;
SHOW DATABASES;
```

退出 SQL Client：

```sql
QUIT;
```

退出容器：

```bash
exit
```

也可以一条命令直接启动：

```bash
docker compose exec jobmanager ./bin/sql-client.sh
```

---

## 12. 暂停环境

```bash
docker compose stop
```

说明：

- 容器会停止
- 容器还保留
- 下次可以用 `docker compose start` 继续启动

---

## 13. 重新启动环境

```bash
docker compose start
```

---

## 14. 停止并删除容器

```bash
docker compose down
```

注意：

- 会停止并删除当前 Flink 容器
- 不会删除 `compose.yaml` 和文档
- 当前环境没有配置持久化卷，所以容器内临时数据会丢失

---

## 15. 重新拉起完整环境

如果你执行过 `docker compose down`，想重新启动：

```bash
docker compose up -d
```

---

## 16. 查看本地 Flink 镜像

```bash
docker images | grep flink
```

---

## 17. 手动拉取 Flink 镜像

```bash
docker pull flink:2.2.1
```

如果这个 tag 不可用，可以临时改用官方存在的稳定版本，例如：

```bash
docker pull flink:1.20
```

同时要把 `compose.yaml` 里的两个 `image` 都改成相同版本。

---

## 18. 常用排查命令

查看 Compose 最终配置：

```bash
docker compose config
```

查看所有容器：

```bash
docker ps -a
```

查看端口占用，Mac 上可以执行：

```bash
lsof -i :8081
```

检查 Docker 是否可用：

```bash
docker info
```

---

## 19. 最常用的一组命令

如果只是日常学习，最常用的是这几条：

```bash
cd flink
docker compose up -d
docker compose ps
```

浏览器打开：

```text
http://localhost:8081
```

提交示例任务：

```bash
docker compose exec jobmanager flink run examples/streaming/WordCount.jar
```

学习结束后暂停：

```bash
docker compose stop
```
