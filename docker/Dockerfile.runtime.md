# Dockerfile.runtime 逐行解析

## 概览

这是一个用于构建 **Codex + Multica 运行时容器** 的 Dockerfile，基于 Debian 系基础镜像（默认 `node` 用户），集成了 OpenAI Codex CLI、Python 虚拟环境（UDA 相关）以及 multica 多代理守护进程，最终以非 root 用户 `runtime` 运行。

---

## 逐行解析

### 1. 构建参数 (ARG)

```dockerfile
ARG CODEX_VERSION=0.145.0
ARG RUNTIME_UID=1000
ARG RUNTIME_GID=1000
```

| 行号 | 指令 | 含义 |
|------|------|------|
| 1 | `ARG CODEX_VERSION=0.145.0` | 定义构建参数 `CODEX_VERSION`，默认值为 `0.145.0`。用于指定要安装的 `@openai/codex` npm 包的版本。可在 `docker build --build-arg CODEX_VERSION=xxx` 时覆盖。 |
| 2 | `ARG RUNTIME_UID=1000` | 定义构建参数 `RUNTIME_UID`，默认值为 `1000`。用于指定运行用户的 UID。 |
| 3 | `ARG RUNTIME_GID=1000` | 定义构建参数 `RUNTIME_GID`，默认值为 `1000`。用于指定运行用户组的 GID。 |

---

### 2. 环境变量 (ENV) — 非交互式安装

```dockerfile
ENV DEBIAN_FRONTEND=noninteractive
```

| 行号 | 指令 | 含义 |
|------|------|------|
| 5 | `ENV DEBIAN_FRONTEND=noninteractive` | 设置环境变量，使 `apt-get` 在安装软件包时不弹出交互式配置界面（如时区选择），避免构建过程卡住。 |

---

### 3. 安装系统依赖

```dockerfile
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        openssh-client \
        python3 \
        python3-venv \
        tini \
    && rm -rf /var/lib/apt/lists/*
```

| 行号 | 指令 | 含义 |
|------|------|------|
| 7 | `RUN apt-get update` | 更新 apt 软件包索引。 |
| 8 | `&& apt-get install -y --no-install-recommends \` | 安装软件包，`-y` 自动确认，`--no-install-recommends` 不安装"推荐"的冗余包，减小镜像体积。 |
| 9 | `ca-certificates` | 安装 CA 证书包，使容器能验证 HTTPS 连接的证书链。 |
| 10 | `curl` | 安装 curl，用于命令行 HTTP 请求。 |
| 11 | `git` | 安装 Git 版本控制工具，Codex 等工具需要它来操作代码仓库。 |
| 12 | `openssh-client` | 安装 SSH 客户端，用于 Git 通过 SSH 协议克隆仓库。 |
| 13 | `python3` | 安装 Python 3 解释器。 |
| 14 | `python3-venv` | 安装 Python 虚拟环境模块，用于创建隔离的 Python 环境。 |
| 15 | `tini` | 安装 tini，一个轻量级 init 进程，用于正确处理容器内的信号转发和僵尸进程回收。 |
| 16 | `&& rm -rf /var/lib/apt/lists/*` | 清理 apt 缓存，减小镜像体积。 |

---

### 4. 安装 OpenAI Codex CLI

```dockerfile
RUN npm install -g "@openai/codex@${CODEX_VERSION}" \
    && npm cache clean --force
```

| 行号 | 指令 | 含义 |
|------|------|------|
| 18-19 | `RUN npm install -g "@openai/codex@${CODEX_VERSION}"` | 全局安装指定版本的 OpenAI Codex CLI 工具，使用前面定义的 `CODEX_VERSION` 构建参数。安装后 `codex` 命令可用。 |
| 19 | `&& npm cache clean --force` | 清理 npm 缓存，减小镜像体积。 |

---

### 5. 创建 Python 虚拟环境并安装 httpx

```dockerfile
RUN python3 -m venv /opt/uda-venv \
    && /opt/uda-venv/bin/pip install --no-cache-dir httpx
```

| 行号 | 指令 | 含义 |
|------|------|------|
| 21 | `RUN python3 -m venv /opt/uda-venv` | 在 `/opt/uda-venv` 路径下创建一个 Python 3 虚拟环境。`uda` 可能代表某个内部工具或平台。 |
| 22 | `&& /opt/uda-venv/bin/pip install --no-cache-dir httpx` | 在该虚拟环境中安装 `httpx`（Python 异步 HTTP 客户端库），`--no-cache-dir` 不缓存下载的包，减小镜像体积。 |

---

### 6. 复制 multica 二进制文件

```dockerfile
COPY multica /usr/local/bin/multica
```

| 行号 | 指令 | 含义 |
|------|------|------|
| 24 | `COPY multica /usr/local/bin/multica` | 将构建上下文中的 `multica` 可执行文件复制到容器的 `/usr/local/bin/multica` 路径，使其在 `PATH` 中可用。`multica` 可能是内部的多代理/工作区管理守护进程。 |

---

### 7. 用户配置与目录初始化

```dockerfile
RUN chmod 755 /usr/local/bin/multica \
    && groupmod \
        --non-unique \
        --gid "${RUNTIME_GID}" \
        --new-name runtime \
        node \
    && usermod \
        --non-unique \
        --uid "${RUNTIME_UID}" \
        --gid runtime \
        --home /home/runtime \
        --move-home \
        --login runtime \
        node \
    && mkdir -p \
        /workspaces \
        /home/runtime/.multica \
        /home/runtime/.codex \
        /home/runtime/.ssh \
        /home/runtime/.cache \
    && chown -R runtime:runtime \
        /workspaces \
        /home/runtime
```

| 行号 | 指令 | 含义 |
|------|------|------|
| 26 | `RUN chmod 755 /usr/local/bin/multica` | 赋予 multica 可执行权限（所有者可读写执行，组和其他用户可读执行）。 |
| 27-30 | `groupmod --non-unique --gid "${RUNTIME_GID}" --new-name runtime node` | 将基础镜像中已有的 `node` 用户组重命名为 `runtime`，并设置 GID 为构建参数指定的值。`--non-unique` 允许 GID 不唯一。 |
| 31-36 | `usermod ... node` | 将基础镜像中已有的 `node` 用户修改为 `runtime`：设置 UID、主组为 `runtime`、家目录为 `/home/runtime`、移动旧家目录内容、登录名改为 `runtime`。 |
| 37-42 | `mkdir -p /workspaces /home/runtime/.multica /home/runtime/.codex /home/runtime/.ssh /home/runtime/.cache` | 创建运行时需要的目录：`/workspaces` 工作区根目录、`.multica` 配置目录、`.codex` Codex 配置目录、`.ssh` SSH 密钥目录、`.cache` 缓存目录。 |
| 43-45 | `chown -R runtime:runtime /workspaces /home/runtime` | 将 `/workspaces` 和 `/home/runtime` 的所有权递归赋予 `runtime:runtime`，确保运行时用户有读写权限。 |

---

### 8. 切换运行用户

```dockerfile
USER runtime
```

| 行号 | 指令 | 含义 |
|------|------|------|
| 47 | `USER runtime` | 将后续所有指令（以及容器启动后的默认用户）切换为 `runtime` 非 root 用户，提高安全性。 |

---

### 9. 运行时环境变量

```dockerfile
ENV HOME=/home/runtime
ENV PATH=/opt/uda-venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENV MULTICA_WORKSPACES_ROOT=/workspaces
ENV MULTICA_CODEX_PATH=/usr/local/bin/codex
```

| 行号 | 指令 | 含义 |
|------|------|------|
| 49 | `ENV HOME=/home/runtime` | 设置 `HOME` 环境变量为 runtime 用户的家目录。 |
| 50 | `ENV PATH=...` | 设置 `PATH`，将 `/opt/uda-venv/bin` 放在最前面，确保 Python 虚拟环境中的可执行文件优先被找到。 |
| 51 | `ENV MULTICA_WORKSPACES_ROOT=/workspaces` | 设置 multica 的工作区根目录为 `/workspaces`。 |
| 52 | `ENV MULTICA_CODEX_PATH=/usr/local/bin/codex` | 指定 Codex CLI 的可执行文件路径，供 multica 调用。 |

---

### 10. 工作目录

```dockerfile
WORKDIR /workspaces
```

| 行号 | 指令 | 含义 |
|------|------|------|
| 54 | `WORKDIR /workspaces` | 设置容器启动后的默认工作目录为 `/workspaces`。 |

---

### 11. 入口点与启动命令

```dockerfile
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["multica", "daemon", "start", "--foreground", "--no-auto-update"]
```

| 行号 | 指令 | 含义 |
|------|------|------|
| 56 | `ENTRYPOINT ["/usr/bin/tini", "--"]` | 使用 `tini` 作为容器的 init 进程（PID 1）。`--` 后面的参数会传给 tini 作为子进程命令。tini 能正确处理信号转发和僵尸进程回收。 |
| 58 | `CMD ["multica", "daemon", "start", "--foreground", "--no-auto-update"]` | 容器启动时默认执行的命令：以守护进程模式启动 multica，`--foreground` 前台运行（不后台化），`--no-auto-update` 禁用自动更新。 |

---

## 整体架构总结

```
┌──────────────────────────────────────────────────┐
│                  Dockerfile.runtime               │
├──────────────────────────────────────────────────┤
│  基础镜像 (node 用户)                             │
│    │                                              │
│    ├─ 系统依赖: curl, git, ssh, python3, tini    │
│    ├─ OpenAI Codex CLI (npm 全局安装)             │
│    ├─ Python venv (/opt/uda-venv) + httpx        │
│    ├─ multica 二进制                              │
│    ├─ 用户重命名: node → runtime (UID/GID 可配)   │
│    ├─ 目录: /workspaces, ~/.codex, ~/.multica 等 │
│    │                                              │
│    └─ 启动: tini → multica daemon start          │
│         (前台运行, 禁用自动更新)                    │
└──────────────────────────────────────────────────┘
```

- **multica**：多代理/工作区管理守护进程，通过 `MULTICA_CODEX_PATH` 调用 Codex CLI。
- **Codex**：OpenAI 的终端编码代理，用于在 `/workspaces` 下执行代码任务。
- **UDA venv**：内部 Python 工具环境，依赖 `httpx` 进行 HTTP 通信。
- **tini**：确保容器内信号正确传递，避免僵尸进程。