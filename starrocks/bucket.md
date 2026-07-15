# StarRocks Bucket 数量设置依据

## 一、核心原则

- 一个分区的 Bucket 数 ≈ 该分区的逻辑 Tablet 数
- Bucket 数量没有固定值，取决于以下因素：

1. 单个最大分区的数据量
2. 目标 Tablet 大小（建议 1~10 GB）
3. BE 节点数量及查询并行度
4. Bucket Key 是否高基数、分布均匀
5. 查询是否能利用 Bucket Pruning
6. 是否依赖 Colocate Join / Bucket Shuffle Join
7. 分区数 × 索引数 × 副本数 导致的 Tablet 总量
8. 导入频率、Compaction 和小文件压力

## 二、估算方法

### 建表前初步估算

按每个 Tablet 约 **10 GB** 原始数据计算：

```
Bucket 数 ≈ 最大单分区预计数据量 ÷ 10 GB
```

> 注意：按**最大单分区**计算，不是整表数据量。

示例：最大单分区 500 GB → 500 ÷ 10 = 50，可从 48 或 64 个 Bucket 开始。

### 上线后验证

```
平均 Tablet 大小 ≈ 单分区数据量 ÷ Bucket 数
```

使用 `SHOW TABLET` 检查每个 Tablet 实际大小，避免被副本或数据倾斜误导。

## 三、Bucket 过多/过少的影响

| 问题 | Bucket 太少 | Bucket 太多 |
|------|------------|------------|
| Tablet 大小 | 单个 Tablet 过大 | 大量小 Tablet（几十~几百 MB） |
| 查询 | 并行度不足 | 调度任务过多 |
| 导入 | 热点集中 | 同时写入过多 Tablet |
| Compaction | 集中在少量 Tablet | 压力上升 |
| 元数据 | 管理开销小 | FE/BE 元数据开销大 |

> Bucket 并不是越多越好。

## 四、查看分区数据量

```sql
-- 查看所有分区
SHOW PARTITIONS FROM db.table;

-- 查看指定分区
SHOW PARTITIONS FROM db.table WHERE PartitionName = 'p20260715';

-- 元数据视图排序
SELECT partition_name, data_size, row_count, bucket_num, replication_num
FROM information_schema.partitions_meta
WHERE db_name = 'db' AND table_name = 'table'
ORDER BY data_size DESC;
```

| 关键字段 | 含义 |
|---------|------|
| DataSize | 分区数据量 |
| RowCount | 分区行数 |
| Buckets | Bucket 数量 |
| ReplicationNum | 副本数 |

## 五、查看 Tablet 数据量

```sql
-- 查看指定分区的 Tablet
SHOW TABLET FROM db.table PARTITION (p20260715);

-- 查看最大的 Tablet（版本支持时）
SHOW TABLET FROM db.table PARTITION (p20260715)
ORDER BY DataSize DESC LIMIT 30;
```

| 关键字段 | 含义 |
|---------|------|
| TabletId | 逻辑 Tablet ID |
| DataSize | Tablet 大小 |
| RowCount | 行数 |
| BackendId | 所在 BE |

> 共享无数据集群中，`SHOW TABLET` 可能按副本返回多行，分析时注意区分 TabletId 和副本。

## 六、检查数据倾斜

统计 平均 Tablet 大小、最大/最小 Tablet 大小，计算 `最大 / 平均`：

| 最大值/平均值 | 判断 |
|-------------|------|
| < 1.5 | 比较均匀 |
| 1.5 ~ 2 | 需要关注 |
| > 2 | 倾斜明显 |
| > 5 | 重点检查 Bucket Key |

**适合做 Hash Bucket Key 的字段**：高基数、分布均匀、常用作等值过滤/Join 条件。

```sql
-- 推荐
DISTRIBUTED BY HASH(user_id)

-- 不推荐（低基数）
DISTRIBUTED BY HASH(country)
```

## 七、检查 Bucket Pruning

```sql
EXPLAIN SELECT * FROM db.table
WHERE dt = '2026-07-15' AND user_id = 123456;
```

关注 `partitionRatio` 和 `tabletRatio`：

| 指标 | 含义 |
|------|------|
| `tabletRatio: 1/21` | 裁剪到 1 个 Tablet，Bucket Key 生效 |
| `tabletRatio: 21/21` | 扫描全部 Tablet，Bucket Key 未生效 |

## 八、EXPLAIN ANALYZE 验证

```sql
EXPLAIN ANALYZE SELECT category, COUNT(*), SUM(amount)
FROM db.table WHERE dt = '2026-07-15' GROUP BY category;
```

在 OLAP_SCAN 节点关注：`TabletCount`、`BytesRead`、`ScanTime`、`IOTaskExecTime`、`IOTaskWaitTime`。

建议测试场景：点查、全分区扫描、分组聚合、典型 Join、并发查询。每个方案至少执行 10 次，比较 P50/P95/P99、QPS、BE CPU、磁盘 I/O 等。

## 九、控制 Tablet 总量

```
物理 Tablet 副本数 ≈ 分区数 × Bucket 数 × 索引数 × 副本数
```

示例：365 分区 × 21 Bucket × 2 索引 × 3 副本 = **45,990** 个物理副本。

不仅要看单分区查询速度，还要评估整表及集群的 Tablet 总量。

## 十、决策流程

1. 估算最大单分区最终数据量
2. 按 ~10 GB/Tablet 估算初始 Bucket 数
3. `SHOW PARTITIONS` 检查分区大小
4. `SHOW TABLET` 检查 Tablet 实际大小及倾斜
5. `EXPLAIN` 检查 partitionRatio / tabletRatio
6. `EXPLAIN ANALYZE` 比较真实查询性能
7. 测试导入、Compaction 及并发查询
8. 核算 `分区数 × Bucket 数 × 索引数 × 副本数`
9. **选择满足查询性能的最少 Bucket 数量**

## 参考文档

- [Bucketing best practices](https://docs.starrocks.io/docs/best_practices/bucketing/)
- [Data distribution](https://docs.starrocks.io/docs/table_design/data_distribution/)
- [SHOW PARTITIONS](https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/SHOW_PARTITIONS/)
- [SHOW TABLET](https://docs.starrocks.io/docs/sql-reference/sql-statements/table_bucket_part_index/SHOW_TABLET/)
- [Query Profile metrics](https://docs.starrocks.io/docs/best_practices/query_tuning/query_profile_operator_metrics/)
- [EXPLAIN ANALYZE](https://docs.starrocks.io/docs/sql-reference/sql-statements/cluster-management/plan_profile/EXPLAIN_ANALYZE/)