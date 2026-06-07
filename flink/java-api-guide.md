# Flink Java API 开发思路指南

这份文档以 `wordcount-java/` 项目中的实际代码为例，讲清楚用 Java API 写 Flink 任务的思路、每一步在干什么、以及各个类和类之间的关系。

---

## 1. 全局概览：一个 Flink Java 任务长什么样

```
pom.xml          # Maven 配置：依赖 + 打包
├── WordCountJob.java   # 主任务：环境 → 数据流 → 算子链 → 执行
└── WordCount.java      # POJO：输出的数据结构
```

一个 Flink Java 程序的核心逻辑只有 **5 步**：

```java
// 第 1 步：创建执行环境
StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

// 第 2 步：从某个地方读取数据（Source）
DataStream<String> lines = env.fromElements("hello world", "hello flink");

// 第 3 步：做一系列转换（Transformation）
DataStream<WordCount> result = lines
    .flatMap(new SplitToWords())      // 拆单词
    .map(new WordToOne())             // (单词, 1)
    .keyBy(new WordKey())             // 按单词分组
    .reduce(new SumCounts());         // 累加计数

// 第 4 步：输出结果（Sink）
result.print();

// 第 5 步：触发执行
env.execute("my-job");
```

这 5 步是整个 Java API 的核心骨架。所有 Flink Java 任务都逃不出这个结构。

---

## 2. 深入理解每一步

### 2.1 StreamExecutionEnvironment —— 执行环境

```java
StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
```

**它是什么：**

它是 Flink 程序的入口。你可以把它理解为"作业的配置中心 + 执行器"。

**它做了什么：**

- 获取运行环境的配置（本地运行 or 集群运行）
- 配置并行度、Checkpoint 时间间隔、状态后端等
- 最后 `env.execute()` 时会把所有算子组装成 JobGraph 并提交

**本地跑 vs 集群跑：**

```java
// 本地 IDE 里跑（自动检测本地环境）
StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();

// 本地开发时也可以用 createLocalEnvironment()
StreamExecutionEnvironment env = StreamExecutionEnvironment.createLocalEnvironment(2); // 2并行度

// 集群运行时，上面这行代码不用改！Flink 会自动根据上下文判断
// 在集群上执行时 getExecutionEnvironment() 返回的是远程集群的环境
```

**常见配置：**

```java
env.setParallelism(4);                          // 全局并行度
env.enableCheckpointing(10000);                 // 10秒做一次 Checkpoint
env.setStateBackend(new HashMapStateBackend());  // 状态存内存
```

### 2.2 Source —— 数据从哪来

```java
// 项目中的写法（有界数据，用于测试）：
DataStream<String> lines = env.fromCollection(jobArgs.textLines);
```

**`fromCollection` vs `fromElements` vs 其他：**

| 方法 | 适用 | 生产环境用吗 |
|------|------|-------------|
| `fromElements("a", "b")` | 几个固定值 | ❌ 仅测试 |
| `fromCollection(list)` | 一个 Java 集合 | ❌ 仅测试/本地 |
| `readTextFile(path)` | 读文件 | ⚠️ 仅离线批处理 |
| `addSource(new FlinkKafkaConsumer<>(...))` | 从 Kafka 读 | ✅ 生产常用 |
| `fromSource(new KafkaSource<>(...), ...)` | 新 Kafka Source API | ✅ 推荐 |
| `addSource(new MySourceFunction())` | 自定义 Source | ✅ 按需 |

**生产环境最常见的 Source 模式：**

```java
// 从 Kafka 读取
KafkaSource<String> kafkaSource = KafkaSource.<String>builder()
    .setBootstrapServers("kafka:9092")
    .setTopics("order-events")
    .setGroupId("flink-order-consumer")
    .setStartingOffsets(OffsetsInitializer.latest())
    .setValueOnlyDeserializer(new SimpleStringSchema())
    .build();

DataStream<String> sourceStream = env.fromSource(kafkaSource,
    WatermarkStrategy.noWatermarks(), "kafka-source");
```

### 2.3 Transformation —— 数据怎么转换

这是你最关心的部分。来看项目里的代码：

```java
DataStream<WordCount> wordCounts =
    lines
        .flatMap(new SplitToWords())           // ① 每行拆成多个单词
        .assignTimestampsAndWatermarks(...)    // ② 时间/水位线（这里无水印）
        .map(new WordToOne())                  // ③ 每个单词包装成 (word, 1)
        .keyBy(new WordKey())                  // ④ 按 word 字段分组
        .reduce(new SumCounts());              // ⑤ 对同一个 word 累加
```

#### ① FlatMap —— 一条变多条

```java
private static final class SplitToWords implements FlatMapFunction<String, String> {
    @Override
    public void flatMap(String value, Collector<String> out) {
        String[] tokens = value.trim().split("\\s+");
        for (String token : tokens) {
            if (!token.isEmpty()) {
                out.collect(token);   // ← 每调用一次 collect，就输出一条
            }
        }
    }
}
```

**核心思路：**
- `flatMap` 的签名是 `输入类型 → 输出类型`，这里 `String → String`
- `Collector<String> out` 是 Flink 给你的"发射器"，想输出几条就 `out.collect()` 几次
- 如果不想输出任何数据（比如输入是空行），直接 `return` 即可——这是 `flatMap` 和 `map` 的最大区别

**和 `map` 的区别：**

```java
// map: 一条输入 → 一条输出（1对1）
.map(s -> s.toUpperCase())        // "hello" → "HELLO"

// flatMap: 一条输入 → 0条或多条输出（1对N）
.flatMap((s, out) -> {
    for (String word : s.split(" ")) {
        out.collect(word);          // "hello world" → "hello" 和 "world" 两条
    }
})
```

#### ② Watermark —— 时间语义

```java
.assignTimestampsAndWatermarks(WatermarkStrategy.noWatermarks())
```

**为什么这里用 `noWatermarks()`？**

因为项目的输入是从 `fromCollection` 来的有界数据，不是持续不断到来的实时流，也没有事件时间字段需要提取。所以这里直接用 `noWatermarks()` —— 不需要 Event Time 语义。

**生产环境里通常会这样写：**

```java
.assignTimestampsAndWatermarks(
    WatermarkStrategy
        .<OrderEvent>forBoundedOutOfOrderness(Duration.ofSeconds(5))
        .withTimestampAssigner((event, recordTimestamp) -> event.getCreateTime())
)
```

意思是：允许数据乱序到达最多 5 秒，按 `event.getCreateTime()` 字段作为事件时间。

#### ③ Map —— 一对一转换

```java
private static final class WordToOne implements MapFunction<String, WordCount> {
    @Override
    public WordCount map(String value) {
        return new WordCount(value, 1L);   // 每个单词初始计数为 1
    }
}
```

**核心思路：**
- `map` 就是 `输入 → 输出` 的一对一转换
- 这里把 `String` 转成了 `WordCount` 对象

#### ④ KeyBy —— 按 Key 分组（重分区）

```java
private static final class WordKey implements KeySelector<WordCount, String> {
    @Override
    public String getKey(WordCount value) {
        return value.getWord();   // 按 word 字段分组
    }
}
```

**KeyBy 做了什么：**

```
输入流: (hello,1), (flink,1), (hello,1), (docker,1), (flink,1)
         ↓
     keyBy(word)
         ↓
按 hash(word) 重分区 →
  并行子任务 0 收到: (hello,1), (hello,1)     ← 所有 hello 都去同一个子任务
  并行子任务 1 收到: (flink,1), (flink,1)     ← 所有 flink 都去同一个子任务
  并行子任务 2 收到: (docker,1)               ← 所有 docker 都去同一个子任务
```

**关键点：KeyBy 保证同一个 key 的所有数据都进入同一个并行子任务。** 这就是为什么后面的 reduce 能正确地对这个 key 做聚合。

KeyBy 会导致 **网络 shuffle**（数据需要重新分配），所以它会打断算子链优化。

#### ⑤ Reduce —— 聚合

```java
private static final class SumCounts implements ReduceFunction<WordCount> {
    @Override
    public WordCount reduce(WordCount left, WordCount right) {
        return new WordCount(left.getWord(), left.getCount() + right.getCount());
    }
}
```

**Reduce 的工作原理：**

```
同一个 key (hello) 的数据到达同一个 SubTask:

第一次收到 (hello, 1):  没有历史状态 → 直接作为初始值存储
第二次收到 (hello, 1):  reduce((hello, 1), (hello, 1)) → (hello, 2)
第三次收到 (hello, 1):  reduce((hello, 2), (hello, 1)) → (hello, 3)
```

**Reduce 的特点：**
- 输入输出类型必须相同（`WordCount → WordCount`）
- 每次新数据到达，就和之前的累积结果做一次运算
- 结果既是输出，也会作为新的状态保存下来

**如果输入输出类型不同怎么办？**

用 `aggregate()` 或 `process()`：

```java
// AggregateFunction: 输入、累加器、输出可以是不同类型
.aggregate(new AggregateFunction<OrderEvent, Double, Double>() {
    @Override
    public Double createAccumulator() { return 0.0; }
    @Override
    public Double add(OrderEvent value, Double accumulator) { return accumulator + value.getAmount(); }
    @Override
    public Double getResult(Double accumulator) { return accumulator; }
    @Override
    public Double merge(Double a, Double b) { return a + b; }
})
```

### 2.4 Sink —— 结果输出到哪里

```java
wordCounts.name("wordcount-result").print().name("stdout-sink");
```

**`print()` 做了什么：**

把每条结果打印到 TaskManager 的 **标准输出日志** 中。在集群上查看输出需要看 TaskManager 的日志：

```bash
docker compose logs -f taskmanager
```

**生产环境常见的 Sink：**

```java
// 写入 Kafka
result.sinkTo(KafkaSink.<String>builder()
    .setBootstrapServers("kafka:9092")
    .setRecordSerializer(new KafkaRecordSerializationSchema<>(...))
    .build());

// 写入 MySQL
result.addSink(new JdbcSink<>(...));

// 写入 ClickHouse
result.addSink(new ClickHouseSink(...));

// 写入 Paimon / Iceberg 数据湖
result.sinkTo(...);

// 自定义 Sink
result.addSink(new MySinkFunction());
```

### 2.5 execute —— 触发执行

```java
env.execute("java-wordcount");
```

**这一行才是真正触发生成 JobGraph 并提交的时刻。**

在 `execute()` 之前，所有的 `flatMap`、`map`、`keyBy`、`reduce` 都只是**构建了一个逻辑执行图**（StreamGraph），并没有真正执行任何数据处理。

你可以把这个过程理解为：

```
env.fromElements(...)   →  在内存里画了一个图：Source 节点
    .flatMap(...)       →  图上加了 FlatMap 节点
    .map(...)           →  图上加了 Map 节点
    .keyBy(...)         →  图上加了 KeyBy 边（需要 shuffle）
    .reduce(...)        →  图上加了 Reduce 节点
    .print()            →  图上加了 Sink 节点

env.execute("name")     →  把这个图提交给执行引擎，数据开始流动
```

---

## 3. POJO 类 WordCount 的作用

```java
public class WordCount {
    private String word;
    private long count;

    public WordCount() {}                          // ← 无参构造函数（Flink 需要）
    public WordCount(String word, long count) { ... }
    public String getWord() { ... }                // ← Getter（Flink 识别字段用）
    public void setWord(String word) { ... }       // ← Setter
    public long getCount() { ... }
    public void setCount(long count) { ... }
    // equals, hashCode, toString
}
```

**为什么用 POJO 而不是 record 或 Tuple？**

1. **Flink 类型识别**：Flink 能识别 POJO 的字段（通过 getter/setter），做更高效的序列化。如果用 record，Flink 可能退化为 Generic 类型，用 Java 序列化，性能下降。
2. **可读性**：`wordCount.getWord()` 比 `tuple.f0` 清晰得多。
3. **生产习惯**：真实项目里数据结构通常更复杂，POJO 更方便扩展。

**为什么必须有 `public WordCount() {}` 无参构造函数？**

Flink 在反序列化和某些内部操作中需要调用无参构造函数来创建对象实例。如果没有，Flink 可能无法正确处理这个类型。

---

## 4. JobArgs —— 参数解析

```java
private static final class JobArgs {
    // --text "hello flink"  （可传多次）
    // --parallelism 2
    // --help
}
```

这是手写的命令行参数解析。生产项目中更常用 `ParameterTool`：

```java
import org.apache.flink.api.java.utils.ParameterTool;

ParameterTool params = ParameterTool.fromArgs(args);
String text = params.get("text", "default value");
int parallelism = params.getInt("parallelism", 1);
```

---

## 5. 从代码到提交：完整流程

```
┌─ 开发 ─────────────────────────────────────────────┐
│ 1. 写 WordCountJob.java（主逻辑）                      │
│ 2. 写 WordCount.java（POJO）                          │
│ 3. 本地 IDE 里直接跑 main() 测试                       │
└─────────────────────────────────────────────────────┘
                        ↓
┌─ 打包 ─────────────────────────────────────────────┐
│ mvn -DskipTests package                             │
│ → 生成 target/flink-java-wordcount-0.1.0-SNAPSHOT   │
│     -shaded.jar（包含所有依赖）                       │
│                                                     │
│ 为什么用 shade plugin？                               │
│ 因为 Flink 集群上不一定有你代码里的依赖                  │
│ shade 把所有依赖打包进一个 fat jar                     │
└─────────────────────────────────────────────────────┘
                        ↓
┌─ 提交 ─────────────────────────────────────────────┐
│ docker cp ... jar ...:/tmp/wordcount.jar            │
│ docker compose exec jobmanager flink run            │
│   -c com.koolearn.flink.wordcount.WordCountJob      │
│   /tmp/wordcount.jar                                │
│                                                     │
│ -c 指定入口类（因为 jar 里可能有多个 main 方法）        │
└─────────────────────────────────────────────────────┘
                        ↓
┌─ 运行 ─────────────────────────────────────────────┐
│ Client (CLI) 调用 main() → 生成 JobGraph → 提交给 JM  │
│ JM 调度 → TM 执行 → print() 结果出现在 TM 日志中      │
└─────────────────────────────────────────────────────┘
```

---

## 6. 写一个生产级 Flink 任务的模板

```java
public class RealTimeOrderJob {

    public static void main(String[] args) throws Exception {
        // ===== 1. 参数解析 =====
        ParameterTool params = ParameterTool.fromArgs(args);
        String kafkaBrokers = params.getRequired("kafka.brokers");
        String kafkaTopic = params.getRequired("kafka.topic");
        String groupId = params.get("kafka.group-id", "flink-order-job");

        // ===== 2. 环境配置 =====
        StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
        env.setParallelism(params.getInt("parallelism", 4));
        env.enableCheckpointing(30000);  // 30 秒
        env.getCheckpointConfig().setCheckpointingMode(CheckpointingMode.EXACTLY_ONCE);
        env.getCheckpointConfig().setMinPauseBetweenCheckpoints(10000);
        env.getCheckpointConfig().setCheckpointTimeout(120000);
        env.setStateBackend(new HashMapStateBackend());
        // env.getCheckpointConfig().setCheckpointStorage("hdfs:///checkpoints/order");

        // ===== 3. Source =====
        KafkaSource<String> kafkaSource = KafkaSource.<String>builder()
            .setBootstrapServers(kafkaBrokers)
            .setTopics(kafkaTopic)
            .setGroupId(groupId)
            .setStartingOffsets(OffsetsInitializer.earliest())
            .setValueOnlyDeserializer(new SimpleStringSchema())
            .build();

        DataStream<String> rawStream = env.fromSource(kafkaSource,
            WatermarkStrategy.noWatermarks(), "kafka-source");

        // ===== 4. Transformation =====
        DataStream<OrderMetric> result = rawStream
            // 4.1 解析 JSON
            .map(new JsonParserFunction())
            // 4.2 过滤无效数据
            .filter(order -> order.isValid())
            // 4.3 提取事件时间 + Watermark
            .assignTimestampsAndWatermarks(
                WatermarkStrategy.<OrderEvent>forBoundedOutOfOrderness(Duration.ofSeconds(10))
                    .withTimestampAssigner((event, ts) -> event.getCreateTime())
            )
            // 4.4 按商品 ID 分组
            .keyBy(OrderEvent::getProductId)
            // 4.5 按 1 分钟滚动窗口聚合
            .window(TumblingEventTimeWindows.of(Time.minutes(1)))
            // 4.6 聚合（求总销售额）
            .aggregate(new SalesAggregateFunction());

        // ===== 5. Sink =====
        result.sinkTo(/* 写入 ClickHouse / Kafka / Paimon */);

        // ===== 6. 执行 =====
        env.execute("real-time-order-job");
    }

    // ===== 自定义函数 =====

    private static class JsonParserFunction extends RichMapFunction<String, OrderEvent> {
        private transient ObjectMapper mapper;

        @Override
        public void open(Configuration parameters) {
            mapper = new ObjectMapper();  // 在 open() 中初始化，只执行一次
        }

        @Override
        public OrderEvent map(String json) throws Exception {
            return mapper.readValue(json, OrderEvent.class);
        }
    }

    private static class SalesAggregateFunction
            implements AggregateFunction<OrderEvent, Double, OrderMetric> {
        @Override
        public Double createAccumulator() { return 0.0; }
        @Override
        public Double add(OrderEvent value, Double acc) { return acc + value.getAmount(); }
        @Override
        public Double getResult(Double acc) { return acc; }
        @Override
        public Double merge(Double a, Double b) { return a + b; }
    }
}
```

---

## 7. 常用函数接口速查

| 接口 | 用途 | 方法签名 |
|------|------|---------|
| `MapFunction<IN, OUT>` | 1对1转换 | `OUT map(IN value)` |
| `FlatMapFunction<IN, OUT>` | 1对N转换 | `void flatMap(IN value, Collector<OUT> out)` |
| `FilterFunction<T>` | 过滤 | `boolean filter(T value)` |
| `KeySelector<IN, KEY>` | 提取 key | `KEY getKey(IN value)` |
| `ReduceFunction<T>` | 聚合 | `T reduce(T value1, T value2)` |
| `AggregateFunction<IN, ACC, OUT>` | 自定义聚合 | `ACC createAccumulator(); ACC add(IN, ACC); OUT getResult(ACC); ACC merge(ACC, ACC)` |
| `RichMapFunction<IN, OUT>` | 带生命周期 (open/close) 的 map | 继承 MapFunction + 多了 `open()`, `close()`, `getRuntimeContext()` |
| `ProcessFunction<IN, OUT>` | 最底层的处理函数 | `void processElement(IN, Context, Collector<OUT>)` |

**RichFunction 的作用：**

```java
public class MyRichMap extends RichMapFunction<String, Integer> {
    private transient ValueState<Integer> state;

    @Override
    public void open(Configuration config) {
        // 每个并行子任务初始化时调用一次
        // 适合：创建数据库连接、初始化状态、加载配置
        state = getRuntimeContext().getState(...);
    }

    @Override
    public void close() {
        // 每个并行子任务结束时调用一次
        // 适合：关闭连接、清理资源
    }

    @Override
    public Integer map(String value) {
        // 每条数据处理一次
        return state.value() + 1;
    }
}
```

---

## 8. 总结：写 Flink Java 任务的思考顺序

拿到一个需求时，按这个顺序思考：

```
1. 数据从哪来？  →  选择 Source（Kafka / MySQL CDC / 文件 / 自定义）
2. 数据长什么样？  →  设计 POJO 类（WordCount 就是例子）
3. 怎么清洗？  →  map / flatMap / filter
4. 需要 Event Time 吗？  →  assignTimestampsAndWatermarks
5. 按什么分组？  →  keyBy
6. 需要窗口吗？  →  window() + 窗口类型
7. 怎么聚合？  →  reduce / aggregate / process
8. 结果去哪？  →  选择 Sink（Kafka / DB / 数据湖 / 自定义）
9. 需要容错吗？  →  enableCheckpointing + 配置
10. 并行度多少？  →  setParallelism
```

对应到 `WordCountJob.java`：

```
1. fromCollection (测试用集合)
2. WordCount POJO
3. flatMap (拆词) + map (包装)
4. noWatermarks (不需要)
5. keyBy (按 word 分组)
6. 不需要窗口（持续累加）
7. reduce (累加计数)
8. print() (输出到日志)
9. 不需要 (本地测试)
10. JobArgs.parallelism (可选参数)
```
