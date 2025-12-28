/**
 * Observation - 観測とログ記録（誘導なし）
 * Requirements: 2.4, 14.1, 14.2, 14.3
 */

import { EntityId, NodeId, ArtifactId } from './types.js';

/**
 * シミュレーションイベント
 */
export type SimulationEvent =
  | { type: 'entityCreated'; entityId: EntityId; nodeId: NodeId; tick: number }
  | { type: 'entityDied'; entityId: EntityId; cause: string; tick: number }
  | { type: 'entityMoved'; entityId: EntityId; from: NodeId; to: NodeId; tick: number }
  | { type: 'interaction'; initiator: EntityId; target: EntityId; tick: number }
  | { type: 'replication'; parentId: EntityId; childId: EntityId; tick: number }
  | { type: 'artifactCreated'; artifactId: string; nodeId: NodeId; tick: number }
  | { type: 'artifactDecayed'; artifactId: string; tick: number }
  | { type: 'harvest'; entityId: EntityId; nodeId: NodeId; amount: number; tick: number }
  | { type: 'disaster'; nodeId: NodeId; disasterType: string; tick: number }
  | { type: 'guardrailIntervention'; intervention: string; tick: number };

/**
 * シミュレーション統計
 */
export interface SimulationStats {
  tick: number;
  entityCount: number;
  totalEnergy: number;
  artifactCount: number;
  averageAge: number;
  spatialDistribution: Map<NodeId, number>;
  interactionCount: number;
  replicationCount: number;
  deathCount: number;
}

/**
 * クラスタ情報
 */
export interface Cluster {
  id: string;
  nodeIds: NodeId[];
  entityCount: number;
  centroid: NodeId;
}

/**
 * 周期性情報
 */
export interface Periodicity {
  metric: string;
  period: number;
  amplitude: number;
  confidence: number;
}

/**
 * イベントロガー（append-only）
 */
export class EventLogger {
  private events: SimulationEvent[] = [];

  /**
   * イベントを記録
   */
  log(event: SimulationEvent): void {
    this.events.push(event);
  }

  /**
   * 指定範囲のイベントを取得
   */
  getEvents(fromTick: number, toTick: number): SimulationEvent[] {
    return this.events.filter(e => e.tick >= fromTick && e.tick <= toTick);
  }

  /**
   * 全イベントを取得
   */
  getAllEvents(): SimulationEvent[] {
    return [...this.events];
  }

  /**
   * イベント数を取得
   */
  get count(): number {
    return this.events.length;
  }

  /**
   * 特定タイプのイベントを取得
   */
  getEventsByType(type: SimulationEvent['type']): SimulationEvent[] {
    return this.events.filter(e => e.type === type);
  }

  /**
   * シリアライズ
   */
  serialize(): SimulationEvent[] {
    return [...this.events];
  }

  /**
   * デシリアライズ
   */
  static deserialize(events: SimulationEvent[]): EventLogger {
    const logger = new EventLogger();
    logger.events = [...events];
    return logger;
  }
}

/**
 * 統計集計器
 */
export class StatsAggregator {
  private history: SimulationStats[] = [];

  /**
   * 統計を記録
   */
  record(stats: SimulationStats): void {
    this.history.push(stats);
  }

  /**
   * 最新の統計を取得
   */
  getLatest(): SimulationStats | undefined {
    return this.history[this.history.length - 1];
  }

  /**
   * 履歴を取得
   */
  getHistory(fromTick?: number, toTick?: number): SimulationStats[] {
    if (fromTick === undefined && toTick === undefined) {
      return [...this.history];
    }
    return this.history.filter(s => {
      if (fromTick !== undefined && s.tick < fromTick) return false;
      if (toTick !== undefined && s.tick > toTick) return false;
      return true;
    });
  }

  /**
   * 特定メトリクスの時系列を取得
   */
  getTimeSeries(metric: keyof SimulationStats): { tick: number; value: number }[] {
    return this.history.map(s => ({
      tick: s.tick,
      value: s[metric] as number,
    }));
  }

  /**
   * 移動平均を計算
   */
  getMovingAverage(metric: keyof SimulationStats, windowSize: number): { tick: number; value: number }[] {
    const series = this.getTimeSeries(metric);
    const result: { tick: number; value: number }[] = [];

    for (let i = windowSize - 1; i < series.length; i++) {
      let sum = 0;
      for (let j = 0; j < windowSize; j++) {
        sum += series[i - j]!.value;
      }
      result.push({
        tick: series[i]!.tick,
        value: sum / windowSize,
      });
    }

    return result;
  }

  /**
   * シリアライズ
   */
  serialize(): SimulationStats[] {
    return [...this.history];
  }

  /**
   * デシリアライズ
   */
  static deserialize(history: SimulationStats[]): StatsAggregator {
    const aggregator = new StatsAggregator();
    aggregator.history = [...history];
    return aggregator;
  }
}

/**
 * パターン検出器
 */
export class PatternDetector {
  /**
   * クラスタを検出（空間的な集中）
   */
  detectClusters(
    spatialDistribution: Map<NodeId, number>,
    threshold: number = 5
  ): Cluster[] {
    const clusters: Cluster[] = [];
    let clusterId = 0;

    // 単純なクラスタ検出：閾値以上のエンティティがいるノードをクラスタとする
    for (const [nodeId, count] of spatialDistribution) {
      if (count >= threshold) {
        clusters.push({
          id: `cluster-${clusterId++}`,
          nodeIds: [nodeId],
          entityCount: count,
          centroid: nodeId,
        });
      }
    }

    return clusters;
  }

  /**
   * 周期性を検出
   */
  detectPeriodicity(
    timeSeries: { tick: number; value: number }[],
    minPeriod: number = 10,
    maxPeriod: number = 100
  ): Periodicity[] {
    if (timeSeries.length < maxPeriod * 2) {
      return [];
    }

    const periodicities: Periodicity[] = [];
    const values = timeSeries.map(p => p.value);

    // 自己相関による周期性検出
    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;
      let count = 0;

      for (let i = period; i < values.length; i++) {
        correlation += (values[i]! - values[i - period]!) ** 2;
        count++;
      }

      const avgDiff = correlation / count;
      const variance = this.calculateVariance(values);

      // 低い差分 = 高い周期性
      if (variance > 0 && avgDiff < variance * 0.5) {
        periodicities.push({
          metric: 'unknown',
          period,
          amplitude: Math.sqrt(variance),
          confidence: 1 - avgDiff / variance,
        });
      }
    }

    // 信頼度でソート
    return periodicities.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  }

  /**
   * 分散を計算
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  }

  /**
   * トレンドを検出
   */
  detectTrend(
    timeSeries: { tick: number; value: number }[]
  ): 'increasing' | 'decreasing' | 'stable' {
    if (timeSeries.length < 10) return 'stable';

    const recentWindow = Math.min(50, Math.floor(timeSeries.length / 2));
    const recent = timeSeries.slice(-recentWindow);
    const earlier = timeSeries.slice(-recentWindow * 2, -recentWindow);

    if (earlier.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, p) => sum + p.value, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, p) => sum + p.value, 0) / earlier.length;

    const changeRate = (recentAvg - earlierAvg) / (earlierAvg || 1);

    if (changeRate > 0.1) return 'increasing';
    if (changeRate < -0.1) return 'decreasing';
    return 'stable';
  }
}

/**
 * 観測システム
 */
export class Observation {
  readonly logger: EventLogger;
  readonly stats: StatsAggregator;
  readonly patternDetector: PatternDetector;

  constructor() {
    this.logger = new EventLogger();
    this.stats = new StatsAggregator();
    this.patternDetector = new PatternDetector();
  }

  /**
   * イベントを記録
   */
  logEvent(event: SimulationEvent): void {
    this.logger.log(event);
  }

  /**
   * 統計を記録
   */
  recordStats(stats: SimulationStats): void {
    this.stats.record(stats);
  }

  /**
   * 現在の統計を取得
   */
  getStats(): SimulationStats | undefined {
    return this.stats.getLatest();
  }

  /**
   * パターンを検出
   */
  detectPatterns(): {
    clusters: Cluster[];
    periodicities: Periodicity[];
    trends: Map<string, 'increasing' | 'decreasing' | 'stable'>;
  } {
    const latestStats = this.stats.getLatest();
    const clusters = latestStats
      ? this.patternDetector.detectClusters(latestStats.spatialDistribution)
      : [];

    const entityCountSeries = this.stats.getTimeSeries('entityCount');
    const periodicities = this.patternDetector.detectPeriodicity(entityCountSeries);

    const trends = new Map<string, 'increasing' | 'decreasing' | 'stable'>();
    trends.set('entityCount', this.patternDetector.detectTrend(entityCountSeries));
    trends.set('totalEnergy', this.patternDetector.detectTrend(this.stats.getTimeSeries('totalEnergy')));

    return { clusters, periodicities, trends };
  }

  /**
   * エクスポート
   */
  export(): {
    events: SimulationEvent[];
    stats: SimulationStats[];
  } {
    return {
      events: this.logger.serialize(),
      stats: this.stats.serialize(),
    };
  }

  /**
   * インポート
   */
  static import(data: {
    events: SimulationEvent[];
    stats: SimulationStats[];
  }): Observation {
    const observation = new Observation();
    (observation as any).logger = EventLogger.deserialize(data.events);
    (observation as any).stats = StatsAggregator.deserialize(data.stats);
    return observation;
  }
}
