# Flink 资源相关

## 1. 知识点简介

Apache Flink 是一个分布式计算引擎，而"资源"决定了它能跑多快、能处理多少数据。Flink 的资源管理涉及四个核心维度：**内存、CPU、Slot、并行度**。

你可以把 Flink 集群想象成一个工厂：

- **TaskManager** = 工厂里的车间（JVM 进程）
- **Slot** = 车间里的工位（线程资源单元）
- **CPU** = 机床（真正干活的算力）
- **内存** = 工作台和储物架（存放数据和状态）
- **并行度** = 工人数量（同时处理数据的能力）

这些概念之间存在强关联：TaskManager 划分出自己的内存和 CPU 给 Slot，Slot 承载并行任务实例，并行度决定了需要多少 Slot。而并行度又和上游数据源（如 Kafka 分区数）存在联动关系——设置不当会导致资源浪费或数据处理不均衡。

掌握 Flink 资源相关知识的目的是：**用最合理的资源跑出最优的性能，不浪费钱，也不让任务跑崩。**

## 2. 知识地图

```
Flink 资源相关
├── 1. 内存模型
│   ├── Framework Heap      —— 框架自身 JVM 堆内存
│   ├── Framework Off-Heap   —— 框架自身堆外内存
│   ├── Task Heap            —— 用户代码对象、Heap State Backend
│   ├── Task Off-Heap        —— 用户代码堆外内存
│   ├── Network Buffer       —— 网络传输数据缓冲（Shuffle）
│   ├── Managed Memory       —— 批处理排序/哈希、RocksDB 可选
│   ├── JVM Metaspace        —— 类元数据
│   ├── JVM Overhead         —— 线程栈、直接内存、JNI 开销
│   └── State Backend        —— Heap 后端 / RocksDB 后端
│
├── 2. 内存配置
│   ├── 总控方式             —— taskmanager.memory.process.size 设置总内存
│   ├── Task Heap 和 Managed 的决策
│   ├── Network Buffer 数量与并行度正相关
│   └── RocksDB 使用宿主机堆外内存（特殊机制）
│
├── 3. CPU 资源
│   ├── Slot 不含强 CPU 隔离  —— 多 Slot 共享同一 CPU
│   ├── cpu.cores             —— 控制 JVM 可用核数
│   ├── ResourceGroup         —— 资源组绑核（1.14+）
│   └── 计算密集型 vs IO 密集型策略不同
│
├── 4. Slot 机制
│   ├── Slot 是资源子集单元   —— 内存均分 + CPU 共享
│   ├── SlotSharingGroup      —— 多算子共享同一 Slot
│   ├── 均匀分片 round-robin   —— Slot 均匀分配到 TaskManager
│   └── Slot 数量 = 单机最大并行度
│
├── 5. Slot 资源调优
│   ├── evenly-spread-out-slots  —— 均匀分配策略
│   ├── slot.request.timeout     —— 超时保护
│   ├── fine-grained             —— 细粒度资源管理
│   └── Operator Chain           —— 算子链减少序列化
│
├── 6. 并行度
│   ├── 算子级并行度 setParallelism()
│   ├── 并行度设置优先级
│   ├── 并行度 vs Slot 数关系
│   └── SlotSharingGroup 下 Slot 需求计算
│
└── 7. 并行度与 Kafka 分区
    ├── Flink source 并行度 ≤ Kafka 分区数
    ├── Round-Robin 分区分配到 subtask
    ├── partition.discovery 分区发现
    ├── Kafka 消息顺序保证（单分区内有序）
    ├── 空闲 subtask 与 Watermark 停滞（withIdleness）
    └── 数据倾斜与 Exactly-Once 语义
```

## 3. 相关知识点的关系

### 前置依赖

学习 Flink 资源管理之前，建议先了解：

- **JVM 内存结构**：堆内存、直接内存、Metaspace 的基本概念
- **Kafka 消费组**：分区分配、消费者线程模型
- **Flink 基础架构**：JobManager / TaskManager / Task / OperatorChain 的运行模型
- **Flink State 基础**：Keyed State / Operator State、RocksDB 的基本认识

### 包含关系

- **内存模型** 包含 Task Heap、Managed Memory、Network Buffer 等多个子区域
- **Slot 机制** 是 CPU 和内存的统一抽象，CPU 和内存通过 Slot 关联到 Task
- **并行度** 决定了 Slot 消耗量，同时也决定了资源总需求

### 对比关系

| 概念 | 本质 | 粒度 | 可配置性 |
|------|------|------|----------|
| TaskManager | JVM 进程 | 进程级 | 进程内存/CPU 总量 |
| Slot | 线程资源单元 | TaskManager 内部 | 数量、共享组 |
| 并行度 | 算子实例数 | 算子级别 | 每个算子独立设置 |

### 常见混淆点

- **Slot 不等于线程**：Slot 是资源子集的抽象，一个 Slot 内部可以有多个线程（如 source 线程、chained operator 线程）
- **并行度不等于 Slot 数**：并行度 ≤ 总 Slot 数，多个算子可以通过 SlotSharingGroup 共享同一个 Slot
- **Managed Memory 不等于 RocksDB 内存**：RocksDB 默认使用 TaskManager 的堆外内存（非 Managed），Managed Memory 主要用于批处理排序/哈希

## 4. 详细介绍每个知识点

### 4.1 Flink 内存模型

- **如何理解**：Flink TaskManager 是一个 JVM 进程，它的内存被分成了几个有明确用途的"区块"，就像一套房子有卧室、厨房、客厅，各司其职。这些区块包括：框架自己用的内存（Framework Heap/Off-Heap）、用户代码用的内存（Task Heap/Off-Heap）、网络传输用的缓冲区（Network Buffer）、批处理或 RocksDB 用的托管内存（Managed Memory）、以及 JVM 自身的元空间和直接内存开销。

- **解决什么问题**：如果不划分内存区域，任务代码可能撑爆 JVM 堆导致 TaskManager OOM，或者网络流量挤占 RocksDB 内存导致 State 操作失败。分区管理可以让每种用途有独立上限，互不干扰。

- **没有会怎么样**：所有内存在一个池子里混用，一个区域出问题全进程崩溃。例如网络流量突增吃掉大量内存，导致 RocksDB 无内存可用，State 读写超时，Checkpoint 失败，最终任务挂掉。

- **核心机制 / 内存区域详解**：

  **TaskManager 内存层级结构（FLIP-49 / 1.10+）**：

  | 层级 | 内存区域 | 用途 |
  |------|----------|------|
  | 进程总内存 | Total Process Memory | TaskManager 进程的所有内存 |
  | └─ Flink 框架内存 | Framework Heap | JobManager/TaskManager 框架自身 |
  | └─ Flink 框架内存 | Framework Off-Heap | 框架自身堆外内存 |
  | └─ Task 内存 | Task Heap | 用户代码对象、Heap State Backend |
  | └─ Task 内存 | Task Off-Heap | 用户代码堆外内存 |
  | └─ 网络缓冲 | Network Buffer | 网络传输数据缓冲（Shuffle、上下游） |
  | └─ 托管内存 | Managed Memory | 批处理排序/哈希、RocksDB（可选） |
  | └─ JVM 开销 | JVM Metaspace | 类元数据 |
  | └─ JVM 开销 | JVM Overhead | 线程栈、直接内存、JNI、其他本机开销 |

  **配置参数对照**：

  | 内存区域 | 配置项 | 关键默认值 |
  |----------|--------|-----------|
  | Framework Heap | `taskmanager.memory.framework.heap.size` | 128MB |
  | Task Heap | `taskmanager.memory.task.heap.size` | 无默认，按比例推导 |
  | Network Buffer | `taskmanager.memory.network.fraction` | 0.1（Flink Total Memory 的 10%） |
  | Managed Memory | `taskmanager.memory.managed.fraction` | 0.4（流处理默认，通常偏大） |
  | JVM Metaspace | `taskmanager.memory.jvm-metaspace.size` | 256MB |
  | JVM Overhead | `taskmanager.memory.jvm-overhead.fraction` | 0.1 |

- **注意事项**：

  - **总控优先**：推荐使用 `taskmanager.memory.process.size` 总控方式（设置进程总内存，各区域按比例自动推导），避免手动调整各区域导致总和超出物理内存
  - **Task Heap 最关键**：用户代码对象分配在 Task Heap，如果 State 使用 Heap Backend，State 也在 Task Heap，是 OOM 最常见的原因
  - **Managed Memory 流批差异大**：流处理默认 0.4 比例，但大部分流任务用不到，可以适当调小（如 0.1），留给 Task Heap。批处理则需要大量 Managed Memory
  - **Network Buffer 和并行度正相关**：每个 input channel 至少需要 1 个 buffer，并行度越高 buffer 需求越大，计算公式不满足时会直接启动失败

### 4.2 CPU 资源

- **如何理解**：Flink 的 CPU 管理不像内存那样有严格的"分区"概念。Slot 只是逻辑资源单元，**不提供 CPU 隔离**——多个 Slot 在同一个 TaskManager 里共享 CPU。Flink 提供了几个手段来间接控制 CPU 使用：设置 TaskManager 可用的 CPU 核数、通过资源组绑核、以及区分计算密集型和 IO 密集型任务。

- **解决什么问题**：合理配置 CPU 避免资源争抢。比如一个 TaskManager 跑 4 个计算密集的 Slot，但只配了 2 核，那每个 Slot 实际只有一半算力，吞吐上不去。反过来 CPU 配太多但 Slot 太少，CPU 就闲着浪费钱。

- **没有会怎么样**：不关注 CPU 配置会导致两种典型问题——CPU 不足时 Slot 之间争抢，任务延迟飙升、Checkpoint 超时；CPU 过剩时资源浪费、成本虚高。

- **核心机制**：

  - **cpu.cores**：设置 TaskManager 的 JVM 可用 CPU 核数（通过 `taskmanager.cpu.cores`），影响 JVM 内部线程池的大小和 GC 线程数
  - **ResourceGroup**：Flink 1.14+ 支持通过 `ssCpu` 为特定算子绑定 CPU 资源，在 K8s 环境下可以配合 cgroup 做到真实隔离
  - **计算密集型 vs IO 密集型**：
    - 计算密集型（大量序列化、聚合、窗口计算）：建议 Slot 数 = CPU 核数，每个 Slot 独占一核
    - IO 密集型（大量等待 Kafka/DB 网络 IO）：可以 Slot 数 = CPU 核数 × 2~4，充分利用 CPU 等待时间

- **注意事项**：

  - Slot 不隔离 CPU，一个 Slot 中的 CPU 密集型算子可能抢占其他 Slot 的 CPU 时间
  - K8s 部署时需确保 `cpu.cores` 与实际分配的 CPU limit 一致，否则 JVM 线程池可能分配不合理的线程数
  - CPU 核数影响 Network Buffer 和 Task Heap 的默认推导，改动后需确认内存配置是否依然合理

### 4.3 Slot 机制

- **如何理解**：Slot 是 Flink 最核心的资源抽象，它是 TaskManager 提供给 JobManager 调度的"资源子集"。每个 Slot 拥有 TaskManager 总内存的一个等分份额和共享的 CPU。一个 Slot 可以运行一个或多个算子（通过 Operator Chain 或 SlotSharingGroup）。

  类比：TaskManager 是一间大办公室，Slot 就是办公室里的几个工位，每个工位有独立的工作台（内存份额），但空调和电源（CPU）是共享的。并行任务实例（subtask）就是分配到工位上干活的人。

- **解决什么问题**：Slot 将 TaskManager 的资源切分成标准的、可调度的单元。JobManager 不需要关心每个 TaskManager 还有多少剩余内存，只需要知道"还剩几个 Slot"，大大简化了调度逻辑。同时，SlotSharingGroup 机制让多个算子共享一个 Slot，显著减少网络传输开销。

- **没有会怎么样**：没有 Slot 抽象，JobManager 需要为每个 subtask 精确计算资源需求并匹配合适的 TaskManager，调度复杂度爆炸。而且算子之间如果必须跨进程通信，序列化/反序列化开销巨大，性能急剧下降。

- **核心机制**：

  - **Slot 数量**：`taskmanager.numberOfTaskSlots`，通常设置为 CPU 核数。单个 TaskManager 的 Slot 数决定了它能同时运行的 subtask 数量上限
  - **SlotSharingGroup**：默认所有算子在一个共享组，意味着一个 Slot 可以容纳不同算子的 subtask（如 source + map + sink 全在一个 Slot 里），称为"流水线式共享"
  - **均匀分配**：`slotmanager.number-of-slots.max` 配合 `evenly-spread-out-slots` 策略（Flink 1.10+），让 Slot 尽量均匀分布到不同 TaskManager，避免热点
  - **Slot 不足时的行为**：JobManager 等待空闲 Slot，超时时间由 `slot.request.timeout` 控制，超时后抛出 `NoResourceAvailableException`

- **注意事项**：

  - **Slot 数不是越大越好**：Slot 太多每个 Slot 分到的内存太少，可能导致 OOM；Slot 太少 CPU 闲置
  - **SlotSharingGroup 不是银弹**：如果某个算子特别吃内存（如大 State 的 KeyedProcessFunction），应将其独立放在单独的 SharingGroup，配合 `fine-grained` 资源管理给它更多内存
  - **Operator Chain 优先于 SlotSharingGroup**：同 Slot 内能 chain 的先 chain，剩下的才走 Slot 内线程切换或跨 Slot 网络传输

### 4.4 任务的资源并发度

- **如何理解**：任务的"资源并发度"指的是**在给定资源下，任务能同时处理数据的能力上限**。它由三个因素共同决定：总 Slot 数、每个算子的并行度、SlotSharingGroup 的配置。

  关键公式：

  - 任务可运行条件：每个 SlotSharingGroup 中 `max(各算子并行度)` ≤ 该 Group 可用 Slot 数
  - 任务总并行度 = `sum(各算子并行度)`
  - 任务实际占用 Slot 数 = `max(Group1 需求, Group2 需求, ...)`

  简单说，**并行度决定了你"想"开多少并行实例，Slot 决定了你"能"开多少**。

- **解决什么问题**：让用户在有限的集群资源下，合理分配每个任务的并行度，做到既不超配导致任务无法启动，也不低配导致资源闲置。

- **没有会怎么样**：可能出现两种情况——并行度设得太大，Slot 不够，任务提交后一直处于 CREATED 状态无法启动；或者 Slot 够但内存不足，启动后 OOM。又或者并行度设得太小，数据积压严重，上游 Kafka 消费滞后。

- **核心机制**：

  - **并行度设置优先级**（高到低）：
    1. 算子级别 `setParallelism()`
    2. 执行环境级别 `env.setParallelism()`
    3. 提交参数 `-p`
    4. 配置文件默认值 1
  - **SlotSharingGroup 优化**：默认所有算子共享一个 Group，此时 `需要的 Slot 数 = max(各算子并行度)`。例如 source=4, map=8, sink=4，默认 Group 下只需要 8 个 Slot（不是 4+8+4=16）
  - **Operator Chain 影响**：能 chain 到一条链上的算子共享一个线程，减少线程切换和序列化开销。禁用 chain 会增加 Slot 需求

- **注意事项**：

  - 并行度提高不一定是线性加速——存在网络 shuffle、序列化、反压等瓶颈
  - 对于有 Keyed State 的算子，并行度变化需要从 Savepoint 恢复，涉及 State 重分布
  - K8s 环境下，`taskmanager.numberOfTaskSlots` 通常设为 1（每个 Pod 一个 Slot），利用 K8s 原生调度来做弹性扩缩

### 4.5 Flink 并行度和 Kafka 分区关系

- **如何理解**：Flink 从 Kafka 消费数据时，Kafka 的分区是天然的并行度上限。Kafka 的一个分区同时只能被消费组中的一个消费者消费，而 Flink 的每个 source subtask 就是这个"消费者"。核心约束：

  ```
  Flink source 并行度  ≤  Kafka Topic 分区数
  ```

  如果 source 并行度 > 分区数，多余的 subtask 空闲等待；如果 source 并行度 < 分区数，Kafka 会将分区分配给现有的 subtask，一个 subtask 可能负责多个分区。

- **解决什么问题**：合理匹配并行度和分区数，避免消费者空转浪费 Slot，也避免消费者过载导致消费滞后。同时理解分区分配机制，才能正确设计消息顺序和数据倾斜的处理策略。

- **没有会怎么样**：

  | 情况 | 后果 |
  |------|------|
  | Source 并行度 > 分区数 | 闲置 subtask 空占 Slot 不干活，浪费资源 |
  | Source 并行度 < 分区数 | 某些 subtask 消费多个分区，负载不均，可能成为瓶颈 |
  | Kafka 分区变更后未感知 | 新增分区无消费者导致数据积压，或减少分区导致消费者报错 |

- **核心机制**：

  - **Kafka 分区分配**：Flink 使用 `KafkaSource`（新 API）或 `FlinkKafkaConsumer`（旧 API），内部通过 `KafkaPartitionAssigner` 将 Kafka 分区均匀分配给 source subtask，采用 round-robin 策略
  - **分区发现**：`partition.discovery.interval` 控制定期检查 Kafka 新增分区的时间间隔（默认关闭）。打开后 Flink 会自动将新分区分配给空闲的 subtask
  - **消息顺序保证**：Kafka 只能保证**单个分区内有序**。如果业务需要全局有序，只能设 Kafka 为单分区 + Flink source 并行度=1，但这样吞吐量极低
  - **Source 线程模型**：`KafkaSource` 使用独立的 Kafka Consumer 线程，每个 source subtask 内部有一个或多个 consumer 线程。通过 `setBounded(OffsetsInitializer)` 可配置为有界流

- **注意事项**：

  - **用水位线时的分区对齐**：如果 source 并行度 > 分区数，空闲 subtask 的 Watermark 会停滞（因为没有数据流入），导致下游窗口永远不触发。需用 `withIdleness()` 配置空闲超时
  - **Kafka Topic 规划应先于 Flink 任务设计**：先确定 Kafka 分区数，再决定 Flink source 并行度。通常 source 并行度 = 分区数，做到每个 subtask 一个分区
  - **数据倾斜**：即使 source 并行度 = 分区数，如果某个分区数据量特别大（如热点 key），下游 keyBy 后仍会倾斜。这需要在业务层面解决（如加盐、两阶段聚合）
  - **端到端 Exactly-Once**：Kafka 到 Kafka 的端到端 Exactly-Once 需要 Kafka 0.11+ 且配置 `Semantic.EXACTLY_ONCE`，利用 Kafka 事务实现

## 5. 实际案例讲解

### 场景：实时大屏广告点击统计

**背景**：公司需要做一个实时大屏，统计每个广告位的点击量（PV）、独立访客数（UV），数据从 Kafka 来。Kafka Topic 有 **20 个分区**，每秒约 10 万条点击事件。

**目标**：合理配置 Flink 任务资源，满足吞吐要求，同时控制成本。

**步骤拆解**：

1. **确定 Source 并行度**：Kafka 分区 = 20，source 并行度设为 20（一个 subtask 负责一个分区，最佳实践）
2. **确定中间算子并行度**：keyBy 后做 PV/UV 聚合，考虑到数据量和聚合计算量，并行度可设为 40（配合 SlotSharingGroup，所有算子共享 Slot）
3. **计算 Slot 需求**：所有算子在默认 SlotSharingGroup，`需要的 Slot 数 = max(20, 40) = 40`
4. **配置 TaskManager**：每个 TaskManager 配 4 个 Slot，需要 10 个 TaskManager。每个 TM 给 4 核 CPU + 8GB 内存
5. **细化内存配置**：
   - 总进程内存 8GB
   - Task Heap：约 4GB（主要用于 Window State，使用 RocksDB Backend）
   - Network Buffer：0.1 × 8GB = 800MB（每个 Slot 约 200MB，40 并行度足够）
   - Managed Memory：0.1 × 8GB = 800MB（RocksDB 使用）

**对应知识点**：

- source 并行度 = 分区数 → 知识点 4.5
- Slot 共享组 → 知识点 4.3
- 资源并发度计算 → 知识点 4.4
- 内存划分 → 知识点 4.1

**最终结果**：10 个 TaskManager × 4 Slot = 40 Slot，刚好满足 40 并行度。内存够用不浪费，CPU 利用率满载不闲置。如果后续流量翻倍，Kafka 分区先扩到 40，再调整 source 并行度到 40，中间算子并行度到 80，Slot 扩到 80（增加 TaskManager）。

## 6. Demo 指导

### 前置准备

- 本地 Docker 环境（用于启动 Kafka + Flink）
- 已安装 Java 11、Maven
- 一个可用的 Kafka Topic（如 `click-events`，分区数 3）

### 步骤

#### Step 1：启动本地 Kafka 和 Flink

使用项目已有的 `compose.yaml` 启动：

```bash
cd /Users/zyb/project/coding-knowledge/flink
docker compose up -d
```

验证 Kafka 可用：

```bash
# 创建测试 topic，3 个分区
docker exec -it flink-kafka-1 kafka-topics.sh \
  --create --topic click-events \
  --bootstrap-server localhost:9092 \
  --partitions 3 --replication-factor 1
```

#### Step 2：写一个简单测试程序

在 `flink/wordcount-java` 项目基础上，新建 `src/main/java/com/koolearn/flink/resourcedemo/KafkaToPrintJob.java`：

```java
package com.koolearn.flink.resourcedemo;

import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.common.serialization.SimpleStringSchema;
import org.apache.flink.connector.kafka.source.KafkaSource;
import org.apache.flink.connector.kafka.source.enumerator.initializer.OffsetsInitializer;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.streaming.api.datastream.DataStream;

public class KafkaToPrintJob {
    public static void main(String[] args) throws Exception {
        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

        // 设置并行度 = Kafka 分区数 = 3
        env.setParallelism(3);

        KafkaSource<String> source = KafkaSource.<String>builder()
                .setBootstrapServers("localhost:9092")
                .setTopics("click-events")
                .setGroupId("resource-demo-group")
                .setStartingOffsets(OffsetsInitializer.earliest())
                .setValueOnlyDeserializer(new SimpleStringSchema())
                .build();

        DataStream<String> stream = env.fromSource(
                source, WatermarkStrategy.noWatermarks(), "Kafka Source");

        // 中间算子并行度改为 6（大于 source 并行度）
        stream.map(String::toUpperCase).setParallelism(6).print();

        env.execute("Resource Demo Job");
    }
}
```

#### Step 3：配置 TaskManager 内存

在 `flink-conf.yaml`（Docker 挂载的配置）中添加：

```yaml
taskmanager.memory.process.size: 2048m          # 总进程 2GB
taskmanager.memory.task.heap.size: 1024m        # Task Heap 1GB
taskmanager.memory.managed.fraction: 0.1        # Managed 10%
taskmanager.memory.network.fraction: 0.1        # Network 10%
taskmanager.numberOfTaskSlots: 4                # 每个 TM 4 个 Slot
taskmanager.cpu.cores: 2                        # 分配 2 核
```

#### Step 4：观察资源使用

提交任务后，打开 Flink Web UI（`http://localhost:8081`），观察：

1. **Job Graph**：查看 source（并行度=3）和 map（并行度=6）的实例分布
2. **TaskManager 页面**：查看每个 TM 的 Slot 使用情况、内存使用图表
3. **Metrics**：查看 `numRecordsInPerSecond` 吞吐指标

#### Step 5：验证并行度与分区关系

尝试修改 source 并行度：

- **设为 2**（小于分区数 3）：观察有 1 个 subtask 消费了 2 个分区，另一个消费 1 个分区
- **设为 6**（大于分区数 3）：观察有 3 个 subtask 空闲，数据全由前 3 个消费

### 验证方式

- Flink Web UI 的 Running Job 页面可直观看到每个算子的并行实例数和 Slot 分布
- 查看 TM 日志确认内存配置是否生效：`grep "memory" taskmanager.log`
- 向 Kafka 生产测试数据：`kafka-console-producer.sh --topic click-events --bootstrap-server localhost:9092`
- 观察控制台输出确认消费正常

### 完成后应该看到

- 3 个 source subtask 均匀分布在 TaskManager 的 Slot 中
- map 算子（并行度=6）共享 Slot，占用 2 个 TaskManager 的全部 6 个 Slot
- 内存使用稳定在配置范围内，不会 OOM
- 修改 source 并行度后，Web UI 中可直观看到空闲 subtask（并行度 > 分区数时）
