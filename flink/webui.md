# Flink Web UI Metrics 排查指南

本文先分层介绍 Flink Web UI 中的各类指标含义，再说明如何结合实际场景应用这些指标进行排查。

---

# 第一部分：指标分层介绍

## 1. 核心算子指标

每个算子最基础、最常用的一组指标。

### 1.1 吞吐指标

| 指标 | 含义 |
|------|------|
| `numRecordsIn` | 累计输入记录数 |
| `numRecordsInPerSecond` | 当前每秒输入速率 |
| `numRecordsOut` | 累计输出记录数 |
| `numRecordsOutPerSecond` | 当前每秒输出速率 |
| `numBytesIn` / `numBytesInPerSecond` | 累计 / 每秒输入字节数 |
| `numBytesOut` / `numBytesOutPerSecond` | 累计 / 每秒输出字节数 |

```text
xxxPerSecond  → 看当前吞吐
不带 PerSecond → 看累计量
```

### 1.2 忙闲反压指标

| 指标 | 含义 |
|------|------|
| `busyTimeMsPerSecond` | 每秒有多少毫秒在处理数据（自己忙） |
| `backPressuredTimeMsPerSecond` | 每秒有多少毫秒被下游阻塞（下游慢） |
| `idleTimeMsPerSecond` | 每秒有多少毫秒空闲等数据（上游慢/没数据） |

三者关系：

```text
busy + backpressure + idle ≈ 1000ms/s
```

各指标阈值参考：

```text
busy < 300ms/s       → 比较空闲
busy 300-700ms/s     → 有一定压力
busy 700-900ms/s     → 压力较高
busy ≈ 1000ms/s      → 基本打满
```

### 1.3 指标记法含义

```text
0.numRecordsIn
0.numRecordsInPerSecond
```

`0` 表示 subtask index = 0（第几个并行实例）。

```text
0.KeyedProcess.numRecordsIn
0.KeyedProcess.numRecordsInPerSecond
```

`KeyedProcess` 是 operator 名称。如果多个 operator chain 在同一个 task 里，带 operator 名称的指标更精确。

```text
task 级：0.numRecordsIn          → 这个 task / chain 入口的输入
operator 级：0.KeyedProcess.numRecordsIn → KeyedProcess 这个 operator 自己的输入
```

总结：

```text
0.numRecordsIn               → subtask 0 的累计输入条数
0.numRecordsInPerSecond      → subtask 0 的当前每秒输入速率
0.numRecordsOutPerSecond     → subtask 0 的当前每秒输出速率
0.busyTimeMsPerSecond        → subtask 0 的每秒忙碌毫秒数
0.backPressuredTimeMsPerSecond → subtask 0 的每秒被阻塞毫秒数
0.idleTimeMsPerSecond        → subtask 0 的每秒空闲毫秒数
```

---

## 2. BackPressure 页面

在 Web UI 中点开算子后，BackPressure 视图有以下列：

| 列 | 含义 | 简单判断 |
|----|------|----------|
| **Subtask** | 并行实例编号（0, 1, 2, ...） | 看分布是否均匀 |
| **Backpressure** | 被下游阻塞的时间占比 | 高 → 往下游找瓶颈 |
| **Idle** | 空闲等数据的时间占比 | 高 → 往上游/source 找原因 |
| **Busy** | 正在处理数据的时间占比 | 高 → 当前算子自身是瓶颈 |

示例解读：

```text
Subtask 0  Backpressure: 5%  Idle: 90%  Busy: 5%
→ 大部分时间在等数据，当前不是瓶颈
```

```text
Subtask 0  Backpressure: 80%  Idle: 0%  Busy: 20%
→ 大部分时间被下游堵住，往下游排查
```

```text
Subtask 0  Backpressure: 0%  Idle: 5%  Busy: 95%
→ 当前算子基本打满，是强瓶颈候选
```

---

## 3. 水位线与延迟指标

事件时间任务必须关注。

| 指标 | 含义 |
|------|------|
| `currentInputWatermark` | 当前算子的输入水位线 |
| `currentOutputWatermark` | 当前算子的输出水位线 |
| `watermarkLag` | 水位线延迟 |
| `currentEmitEventTimeLag` | source 发出的事件时间延迟 |
| `currentFetchEventTimeLag` | source 拉取的事件时间延迟 |

正常情况：

```text
watermark 持续向前推进
input watermark 和 output watermark 差距不大
```

异常情况：

```text
watermark 长时间不动
→ 某分区没数据、source idle 没处理好、乱序太大、上游卡住

output watermark 明显落后于 input watermark
→ 当前算子有窗口/timer/状态等待或处理延迟
```

---

## 4. Checkpoint 指标

衡量作业稳定性和状态健康度。

| 指标 | 含义 |
|------|------|
| `lastCheckpointDuration` | 最近一次 checkpoint 耗时 |
| `lastCheckpointSize` | 最近一次 checkpoint 数据大小 |
| `lastCheckpointAlignmentBuffered` | 对齐阶段缓冲的数据量 |
| `numberOfCompletedCheckpoints` | 已完成 checkpoint 次数 |
| `numberOfFailedCheckpoints` | 失败 checkpoint 次数 |

Web UI Checkpoints 页面还可看到：

```text
End to End Duration  → 端到端耗时
Alignment Duration   → 对齐耗时
State Size           → 状态大小
```

异常判断：

```text
Checkpoint duration 越来越长 → state 变大、后端存储慢、反压严重
Alignment duration 高       → 数据流反压或不同输入流速度差异大
Failed checkpoints 增加     → 作业不稳定，查异常和超时
Checkpoint size 持续上涨    → state 持续增长，可能没清理
```

---

## 5. State / RocksDB 指标

使用 Keyed State 或 RocksDB State Backend 时必须关注。

| 指标 | 含义 |
|------|------|
| `state size` / `numBytesState` | 状态总大小 |
| `rocksdb.estimate-live-data-size` | RocksDB 实际数据量估算 |
| `rocksdb.estimate-num-keys` | RocksDB 中 key 数量估算 |
| `rocksdb.block-cache-usage` | Block Cache 使用量 |
| `rocksdb.compaction-pending` | 待执行的 Compaction 数 |
| `rocksdb.num-running-compactions` | 正在执行的 Compaction 数 |
| `rocksdb.num-running-flushes` | 正在执行的 Flush 数 |

异常判断：

```text
state size 持续涨              → key 数增长、TTL 没生效、状态没清理
RocksDB compaction 高          → 状态读写压力大，可能拖慢算子
block cache usage 接近上限     → 缓存压力大，考虑增大或优化访问模式
```

---

## 6. Source 指标

以 Kafka Source 为例。

| 指标 | 含义 |
|------|------|
| `numRecordsOutPerSecond` | source 每秒输出速率 |
| `records-lag` | 消费延迟（未消费消息数） |
| `records-lag-max` | 最大分区延迟 |
| `currentOffsets` | 当前消费到的 offset |
| `committedOffsets` | 已提交的 offset |

异常判断：

```text
lag 持续上涨                             → 消费能力 < 生产速度
lag 稳定或下降                           → 消费能力足够
source numRecordsOutPerSecond 低但 lag 高 → source 并行度/分区/反序列化有瓶颈
```

---

## 7. Sink 指标

通用 sink 指标，以写入外部系统为例。

| 类别 | 指标 | 含义 |
|------|------|------|
| 吞吐 | `numRecordsInPerSecond` | sink 每秒接收速率 |
| 吞吐 | `numRecordsOutPerSecond` | sink 每秒输出速率 |
| 忙闲 | `busyTimeMsPerSecond` | sink 写入耗时 |
| 忙闲 | `backPressuredTimeMsPerSecond` | sink 被阻塞 |
| 写入 | flush latency / batch size | 批量写入延迟与大小 |
| 异常 | retry count / failed records | 重试次数 / 失败记录数 |
| 外部 | request latency / write qps | 外部系统请求延迟和写入 QPS |

异常判断：

```text
sink busy 高                → 写入慢或 flush 阻塞
sink 上游 backpressure 高   → sink 大概率是瓶颈
失败/重试增加               → 外部系统不稳定或限流
```

---

## 8. JVM / TaskManager 资源指标

TaskManager 页面查看。

| 指标 | 含义 |
|------|------|
| `CPU Load` | CPU 使用率 |
| `Heap Used` / `NonHeap Used` | 堆 / 非堆内存使用 |
| `Direct Memory Used` | 堆外直接内存使用 |
| `Metaspace Used` | 元空间使用 |
| `GC Count` / `GC Time` | GC 次数和耗时 |
| `Network Memory Used` | 网络缓冲内存使用 |
| `Managed Memory Used` | 托管内存使用（RocksDB / sort / batch 等） |

异常判断：

```text
CPU 高 + busy 高         → 算子计算压力大
GC time 高               → 对象创建多、内存压力大、堆配置不合理
Direct memory 使用高     → 网络 buffer / 序列化 / connector 占用大
Managed memory 使用高    → RocksDB / sort / batch / state backend 压力
```

---

## 9. 网络 / Buffer 指标

反压深入排查时使用。

| 指标 | 含义 |
|------|------|
| `inputQueueLength` | 输入队列长度 |
| `outputQueueLength` | 输出队列长度 |
| `inPoolUsage` / `outPoolUsage` | 输入 / 输出缓冲池使用率 |
| `floatingBuffersUsage` | 浮动缓冲使用率 |
| `exclusiveBuffersUsage` | 独占缓冲使用率 |

异常判断：

```text
output buffer 满                → 下游消费慢
input buffer 堆积               → 当前算子处理慢
buffer usage 高 + backpressure 高 → 数据链路拥塞
```

---

# 第二部分：实战应用

## 10. 按算子类型排查

### 10.1 Source 算子

```text
重点看：
  numRecordsOutPerSecond
  idleTimeMsPerSecond
  records-lag / records-lag-max
  currentOffsets / committedOffsets
```

| 现象 | 判断 |
|------|------|
| idle 高 | Kafka 没数据或 source 分区数不足 |
| busy 高 | source 读取/反序列化压力大 |
| Kafka lag 持续上涨 | 整个作业消费能力跟不上 |

### 10.2 Map / FlatMap / Process 算子

```text
重点看：
  numRecordsInPerSecond
  numRecordsOutPerSecond
  busyTimeMsPerSecond
  backPressuredTimeMsPerSecond
```

| 现象 | 判断 |
|------|------|
| busy ≈ 1000, backpressure 低 | 当前算子 CPU 或业务逻辑是瓶颈 |
| backpressure 高 | 不是它慢，是下游慢 |
| 单个 subtask 特别 busy | 数据倾斜或某类数据处理特别慢 |

### 10.3 KeyBy / Window / KeyedProcess 算子

```text
重点看：
  numRecordsInPerSecond
  numRecordsOutPerSecond
  busyTimeMsPerSecond
  state size
  checkpoint duration / size
  RocksDB 指标
```

特别说明：对于 KeyedProcess，如果每条输入只是更新 state（`ctx.timerService()`、`state.update()`），不一定每条都 `out.collect()`。所以 `in >> out` 不一定异常，要结合业务逻辑判断。

| 现象 | 判断 |
|------|------|
| in 高, out 低, busy 不高 | 可能是聚合/状态等待/timer 延迟输出，正常 |
| in 高, out 低, busy 很高 | 状态读写或业务逻辑是瓶颈 |
| 部分 subtask busy 远高于其他 | key 倾斜 |

### 10.4 Sink 算子

```text
重点看：
  numRecordsInPerSecond
  busyTimeMsPerSecond
  backPressuredTimeMsPerSecond
  flush latency / batch size / retry count / failed records
```

| 现象 | 判断 |
|------|------|
| sink busy 高 | 写入慢或 batch/flush 配置不合理 |
| sink 上游 backpressure 高 + 当前 sink busy 高 | sink 是瓶颈 |
| sink in 明显低于上游 out | sink 吞吐不够或外部系统限速 |

---

## 11. 通用排查流程

按以下顺序逐步定位：

```text
Step 1: 看 Job Graph，找到显示 backpressure 的算子
Step 2: 点开该算子 → BackPressure 页面，看 busy / backpressure / idle
Step 3: backpressure 高 → 继续往下游找（回到 Step 2）
Step 4: busy 高 → 点开 Subtasks，看是否所有 subtask 都高
        - 都高 → 整体处理能力不足，考虑加并行度或优化逻辑
        - 个别高 → 数据倾斜，查 key 分布
Step 5: 结合 numRecordsInPerSecond / numRecordsOutPerSecond 看吞吐
Step 6: 最后检查 checkpoint、source lag、sink 指标、state 指标
```

流程图：

```text
                发现 Backpressure
                      │
              ┌───────┴───────┐
              ▼               ▼
         busy 高          backpressure 高
              │               │
              ▼               ▼
      看所有 subtask     继续往下游找
      是否都高                │
      │        │              │
      ▼        ▼              │
    都高    个别高            │
      │        │              │
      ▼        ▼              │
  加并行度  查数据倾斜        │
  优化逻辑                   │
      └──────────┬───────────┘
                 ▼
        结合吞吐、checkpoint、lag 综合判断
```

---

## 12. 速查表

### 12.1 指标速查

| 想了解什么 | 看什么指标 |
|-----------|-----------|
| 当前算子的吞吐能力 | `numRecordsInPerSecond`, `numRecordsOutPerSecond` |
| 是不是自己慢 | `busyTimeMsPerSecond` |
| 是不是被下游堵 | `backPressuredTimeMsPerSecond` |
| 是不是没数据 | `idleTimeMsPerSecond` |
| 是不是数据倾斜 | 比较每个 subtask 的 in/out/busy/backpressure |
| watermark 对不对 | `currentInputWatermark`, `currentOutputWatermark` |
| checkpoint 健不健康 | `lastCheckpointDuration`, `lastCheckpointSize`, `numberOfFailedCheckpoints` |
| state 大不大 | `state size`, `rocksdb.estimate-live-data-size` |
| kafka 消费跟不跟得上 | `records-lag`, `records-lag-max` |
| sink 是不是瓶颈 | `busyTimeMsPerSecond`, `backPressuredTimeMsPerSecond`（结合上游 backpressure 一起看） |

### 12.2 口诀

```text
看处理能力：numRecordsIn/OutPerSecond
看是不是自己慢：busyTimeMsPerSecond
看是不是被下游堵：backPressuredTimeMsPerSecond
看是不是没数据：idleTimeMsPerSecond
看是不是倾斜：比较每个 subtask
```

### 12.3 最小必看指标清单

日常排查只记这一组：

```text
numRecordsInPerSecond
numRecordsOutPerSecond
busyTimeMsPerSecond
backPressuredTimeMsPerSecond
idleTimeMsPerSecond
currentInputWatermark
lastCheckpointDuration
lastCheckpointSize
numberOfFailedCheckpoints
records-lag / records-lag-max
```

### 12.4 优先级

```text
第一优先级：busy / backpressure / idle
第二优先级：numRecordsIn/OutPerSecond
第三优先级：subtask 分布
第四优先级：checkpoint
第五优先级：source lag / sink 写入指标 / state 指标
```

