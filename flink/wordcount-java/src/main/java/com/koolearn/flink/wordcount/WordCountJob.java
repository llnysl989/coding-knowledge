package com.koolearn.flink.wordcount;

import java.util.List;
import org.apache.flink.api.common.eventtime.WatermarkStrategy;
import org.apache.flink.api.common.functions.FlatMapFunction;
import org.apache.flink.api.common.functions.MapFunction;
import org.apache.flink.api.common.functions.ReduceFunction;
import org.apache.flink.api.java.functions.KeySelector;
import org.apache.flink.streaming.api.datastream.DataStream;
import org.apache.flink.streaming.api.environment.StreamExecutionEnvironment;
import org.apache.flink.util.Collector;

/**
 * 一个最小但可用于提交到 Flink 集群执行的 DataStream API WordCount 示例。
 *
 * <p>特点：
 *
 * <ul>
 *   <li>默认使用有界输入（fromElements），提交到集群后会跑完并结束，便于验证“打包→提交→运行→看日志”的链路
 *   <li>输出使用 print()，结果会出现在 TaskManager 日志里
 * </ul>
 *
 * <p>参数：
 *
 * <ul>
 *   <li>--text  指定要统计的文本（可传多次，按空格拆词）
 *   <li>--parallelism  指定作业并行度（可选）
 * </ul>
 */
public final class WordCountJob {

  private WordCountJob() {}

  public static void main(String[] args) throws Exception {
    JobArgs jobArgs = JobArgs.parse(args);

    StreamExecutionEnvironment env = StreamExecutionEnvironment.getExecutionEnvironment();
    if (jobArgs.parallelism != null) {
      env.setParallelism(jobArgs.parallelism);
    }


    
    DataStream<String> lines = env.fromCollection(jobArgs.textLines);

    DataStream<WordCount> wordCounts =
        lines
            .flatMap(new SplitToWords())
            .assignTimestampsAndWatermarks(WatermarkStrategy.noWatermarks())
            .map(new WordToOne())
            .keyBy(new WordKey())
            .reduce(new SumCounts());

    wordCounts.name("wordcount-result").print().name("stdout-sink");

    env.execute("java-wordcount");
  }

  private static final class SplitToWords implements FlatMapFunction<String, String> {
    @Override
    public void flatMap(String value, Collector<String> out) {
      if (value == null || value.isBlank()) {
        return;
      }

      String[] tokens = value.trim().split("\\s+");
      for (String token : tokens) {
        if (!token.isEmpty()) {
          out.collect(token);
        }
      }
    }
  }

  private static final class WordToOne implements MapFunction<String, WordCount> {
    @Override
    public WordCount map(String value) {
      return new WordCount(value, 1L);
    }
  }

  private static final class WordKey implements KeySelector<WordCount, String> {
    @Override
    public String getKey(WordCount value) {
      return value.getWord();
    }
  }

  private static final class SumCounts implements ReduceFunction<WordCount> {
    @Override
    public WordCount reduce(WordCount left, WordCount right) {
      return new WordCount(left.getWord(), left.getCount() + right.getCount());
    }
  }

  private static final class JobArgs {
    private final List<String> textLines;
    private final Integer parallelism;

    private JobArgs(List<String> textLines, Integer parallelism) {
      this.textLines = textLines;
      this.parallelism = parallelism;
    }

    private static JobArgs parse(String[] args) {
      List<String> defaultText =
          List.of(
              "hello flink hello docker",
              "flink wordcount wordcount",
              "hello java api");

      if (args == null || args.length == 0) {
        return new JobArgs(defaultText, null);
      }

      Integer parallelism = null;
      List<String> texts = new java.util.ArrayList<>();

      for (int i = 0; i < args.length; i++) {
        String arg = args[i];
        if ("--text".equals(arg) && i + 1 < args.length) {
          texts.add(args[++i]);
          continue;
        }
        if ("--parallelism".equals(arg) && i + 1 < args.length) {
          parallelism = Integer.parseInt(args[++i]);
          continue;
        }
        if ("--help".equals(arg) || "-h".equals(arg)) {
          printUsageAndExit();
        }
      }

      if (texts.isEmpty()) {
        texts = defaultText;
      }

      return new JobArgs(texts, parallelism);
    }

    private static void printUsageAndExit() {
      String usage =
          String.join(
              System.lineSeparator(),
              "Usage:",
              "  flink run -c com.koolearn.flink.wordcount.WordCountJob <jar> [--text <line>]... [--parallelism <n>]",
              "",
              "Examples:",
              "  flink run -c com.koolearn.flink.wordcount.WordCountJob <jar>",
              "  flink run -c com.koolearn.flink.wordcount.WordCountJob <jar> --text \"hello flink\" --text \"hello docker\"",
              "  flink run -c com.koolearn.flink.wordcount.WordCountJob <jar> --parallelism 2");
      System.out.println(usage);
      System.exit(0);
    }
  }
}
