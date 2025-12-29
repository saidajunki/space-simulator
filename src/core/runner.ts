/**
 * Runner - シミュレーション実行ドライバ
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.7
 */

import { Universe, UniverseConfig } from './universe.js';
import { Observation, SimulationStats, SimulationEvent } from './observation.js';
import { UniverseState, EntityState, NodeState, EdgeState, ArtifactState } from './snapshot.js';
import { Entity } from './entity.js';
import { Node } from './node.js';
import { Edge } from './edge.js';
import { Artifact } from './artifact.js';

/**
 * Run入力
 */
export interface RunInput {
  /** Run ID */
  runId: string;
  /** Universe設定 */
  config: Partial<UniverseConfig>;
  /** 乱数seed */
  seed: number;
  /** 最大tick数 */
  maxTicks: number;
  /** ログ頻度（tick数） */
  logFrequency: number;
  /** スナップショット頻度（tick数） */
  snapshotFrequency: number;
  /** Git commit hash（再現性のため） */
  gitCommitHash?: string;
}

/**
 * Run出力
 */
export interface RunOutput {
  /** マニフェスト */
  manifest: RunManifest;
  /** イベントログ */
  events: SimulationEvent[];
  /** 統計履歴 */
  stats: SimulationStats[];
  /** スナップショット */
  snapshots: Map<number, UniverseState>;
  /** 最終状態 */
  finalState: UniverseState;
}

/**
 * Runマニフェスト
 */
export interface RunManifest {
  runId: string;
  config: Partial<UniverseConfig>;
  seed: number;
  gitCommitHash?: string;
  startedAt: string;
  endedAt: string;
  finalTick: number;
  exitReason: 'maxTicks' | 'extinction' | 'userStop' | 'error';
  environment: {
    platform: string;
    nodeVersion: string;
  };
}

/**
 * Runnerコールバック
 */
export interface RunnerCallbacks {
  onTick?: (tick: number, stats: SimulationStats) => void;
  onSnapshot?: (tick: number, state: UniverseState) => void;
  onEvent?: (event: SimulationEvent) => void;
  onComplete?: (output: RunOutput) => void;
}

/**
 * ローカルRunner
 */
export class LocalRunner {
  private universe: Universe | null = null;
  private observation: Observation | null = null;
  private input: RunInput | null = null;
  private snapshots: Map<number, UniverseState> = new Map();
  private isPaused: boolean = false;
  private isStopped: boolean = false;

  /**
   * Runを初期化
   */
  initialize(input: RunInput): void {
    this.input = input;
    this.universe = new Universe({
      ...input.config,
      seed: input.seed,
    });
    this.observation = new Observation();
    this.snapshots = new Map();
    this.isPaused = false;
    this.isStopped = false;
  }

  /**
   * Runを実行
   */
  run(callbacks?: RunnerCallbacks): RunOutput {
    if (!this.universe || !this.observation || !this.input) {
      throw new Error('Runner not initialized');
    }

    const startedAt = new Date().toISOString();
    let exitReason: 'maxTicks' | 'extinction' | 'userStop' | 'error' = 'maxTicks';

    try {
      while (this.universe.time.getTick() < this.input.maxTicks) {
        if (this.isStopped) {
          exitReason = 'userStop';
          break;
        }

        if (this.isPaused) {
          continue;
        }

        // 1ステップ実行
        this.universe.step();
        const tick = this.universe.time.getTick();

        // 統計記録
        const stats = this.universe.getStats();
        this.observation.recordStats(stats);

        // イベント記録
        for (const event of this.universe.getEventLog().slice(-100)) {
          if (event.tick === tick) {
            this.observation.logEvent(event);
            callbacks?.onEvent?.(event);
          }
        }

        // コールバック
        if (tick % this.input.logFrequency === 0) {
          callbacks?.onTick?.(tick, stats);
        }

        // スナップショット
        if (tick % this.input.snapshotFrequency === 0) {
          const snapshot = this.createSnapshot();
          this.snapshots.set(tick, snapshot);
          callbacks?.onSnapshot?.(tick, snapshot);
        }

        // 絶滅チェック
        if (stats.entityCount === 0) {
          exitReason = 'extinction';
          break;
        }
      }
    } catch (error) {
      exitReason = 'error';
      console.error('Run error:', error);
    }

    const endedAt = new Date().toISOString();
    const finalState = this.createSnapshot();

    const output: RunOutput = {
      manifest: {
        runId: this.input.runId,
        config: this.input.config,
        seed: this.input.seed,
        gitCommitHash: this.input.gitCommitHash ?? '',
        startedAt,
        endedAt,
        finalTick: this.universe.time.getTick(),
        exitReason,
        environment: {
          platform: typeof process !== 'undefined' ? process.platform : 'unknown',
          nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
        },
      },
      events: this.observation.logger.getAllEvents(),
      stats: this.observation.stats.getHistory(),
      snapshots: this.snapshots,
      finalState,
    };

    callbacks?.onComplete?.(output);
    return output;
  }

  /**
   * 一時停止
   */
  pause(): void {
    this.isPaused = true;
    this.universe?.pause();
  }

  /**
   * 再開
   */
  resume(): void {
    this.isPaused = false;
    this.universe?.resume();
  }

  /**
   * 停止
   */
  stop(): void {
    this.isStopped = true;
  }

  /**
   * 現在の統計を取得
   */
  getStats(): SimulationStats | undefined {
    return this.universe?.getStats();
  }

  /**
   * エネルギー内訳を取得
   */
  getEnergyBreakdown(): { entityEnergy: number; freeEnergy: number; wasteHeat: number } | undefined {
    return this.universe?.getEnergyBreakdown();
  }

  /**
   * スナップショットを作成
   */
  private createSnapshot(): UniverseState {
    if (!this.universe || !this.input) {
      throw new Error('Runner not initialized');
    }

    const entities = this.universe.getAllEntities();
    const nodes = this.universe.space.getAllNodes();
    const edges = this.universe.space.getAllEdges();
    const artifacts = this.universe.getAllArtifacts();

    return {
      tick: this.universe.time.getTick(),
      seed: this.input.seed,
      rngState: this.input.seed, // 簡易実装
      nodes: nodes.map(n => this.serializeNode(n)),
      edges: edges.map(e => this.serializeEdge(e)),
      entities: entities.map(e => this.serializeEntity(e)),
      artifacts: artifacts.map(a => this.serializeArtifact(a)),
      config: {
        entropyRate: this.universe.config.entropyRate,
        noiseRate: this.universe.config.noiseRate,
      },
    };
  }

  /**
   * Nodeをシリアライズ
   */
  private serializeNode(node: Node): NodeState {
    return {
      id: node.id,
      temperature: node.attributes.temperature,
      terrainType: node.attributes.terrainType,
      disasterRate: node.attributes.disasterRate,
      resourceCapacity: Array.from(node.attributes.resourceCapacity.entries()),
      resources: Array.from(node.resources.entries()),
      entityIds: Array.from(node.entityIds),
      artifactIds: Array.from(node.artifactIds),
      wasteHeat: node.wasteHeat,
    };
  }

  /**
   * Edgeをシリアライズ
   */
  private serializeEdge(edge: Edge): EdgeState {
    return {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      distance: edge.attributes.distance,
      travelTime: edge.attributes.travelTime,
      capacity: edge.attributes.capacity,
      dangerLevel: edge.attributes.dangerLevel,
      durability: edge.attributes.durability,
      inTransit: edge.inTransit.map(item => ({
        type: item.type,
        payload: item.payload instanceof Uint8Array 
          ? Array.from(item.payload) 
          : item.payload,
        departedAt: item.departedAt,
        arrivalAt: item.arrivalAt,
        from: item.from,
        to: item.to,
      })),
    };
  }

  /**
   * Entityをシリアライズ
   */
  private serializeEntity(entity: Entity): EntityState {
    return {
      id: entity.id,
      nodeId: entity.nodeId,
      energy: entity.energy,
      stateCapacity: entity.state.capacity,
      stateData: Array.from(entity.state.getData()),
      behaviorRuleGenes: entity.behaviorRule.serialize(),
      age: entity.age,
      perceptionRange: entity.perceptionRange,
      type: entity.type ?? 0,
      mass: entity.mass ?? 1,
      composition: entity.composition ?? [entity.type ?? 0],
    };
  }

  /**
   * Artifactをシリアライズ
   */
  private serializeArtifact(artifact: Artifact): ArtifactState {
    return {
      id: artifact.id,
      nodeId: artifact.nodeId,
      data: Array.from(artifact.data),
      durability: artifact.durability,
      createdAt: artifact.createdAt,
      creatorId: artifact.creatorId,
    };
  }
}

/**
 * バッチRunner（複数seed並列実行）
 */
export class BatchRunner {
  /**
   * 複数seedでバッチ実行
   */
  async runBatch(
    baseInput: Omit<RunInput, 'runId' | 'seed'>,
    seeds: number[],
    parallel: number = 1
  ): Promise<RunOutput[]> {
    const results: RunOutput[] = [];

    // 並列実行（簡易実装：直列）
    for (let i = 0; i < seeds.length; i += parallel) {
      const batch = seeds.slice(i, i + parallel);
      const batchResults = await Promise.all(
        batch.map((seed, j) => {
          const runner = new LocalRunner();
          runner.initialize({
            ...baseInput,
            runId: `${baseInput.gitCommitHash || 'run'}-${seed}`,
            seed,
          });
          return Promise.resolve(runner.run());
        })
      );
      results.push(...batchResults);
    }

    return results;
  }
}
