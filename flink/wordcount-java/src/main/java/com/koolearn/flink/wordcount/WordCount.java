package com.koolearn.flink.wordcount;

import java.util.Objects;

/**
 * WordCount 结果输出的 POJO。
 *
 * <p>使用 POJO（而不是 record / Tuple）是为了更贴近生产代码习惯，并方便在 Web UI 或日志里阅读字段含义。
 */
public class WordCount {
  private String word;
  private long count;

  public WordCount() {}

  public WordCount(String word, long count) {
    this.word = word;
    this.count = count;
  }

  public String getWord() {
    return word;
  }

  public void setWord(String word) {
    this.word = word;
  }

  public long getCount() {
    return count;
  }

  public void setCount(long count) {
    this.count = count;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) {
      return true;
    }
    if (o == null || getClass() != o.getClass()) {
      return false;
    }
    WordCount wordCount = (WordCount) o;
    return count == wordCount.count && Objects.equals(word, wordCount.word);
  }

  @Override
  public int hashCode() {
    return Objects.hash(word, count);
  }

  @Override
  public String toString() {
    return "WordCount{" + "word='" + word + '\'' + ", count=" + count + '}';
  }
}
