/**
 * Universe - シミュレーション全体管理
 * Requirements: 15.1, 2.2
 */

import { Space } from './space.js';
import { TimeManager } from './time.js';
import { RandomGenerator } from './random.js';
import { Entity } from './entity.js';
import { Artifact, ArtifactManager } from './artifact.js';
import { EntropyEngine } from './entropy.js';
import { TransitSystem } from './transit.js';
import { TransitItem } from './edge.js';
import { EnergySystem } from './energy.js';
import { perceive, Perception } from './perception.js';
import { InteractionEngine } from './interaction.js';
import { ReplicationEngine } from './replication.js';
import { WorldGenerator, WorldGenConfig } from './world-generator.js';
import { EntityId, NodeId, ArtifactId } from './types.js';
import { GeneIndex } from './behavior-rule.js';
import { Action } from './action.js';

/**
 * Universe設定
 */
export interface UniverseConfig {
  /** 世界生成設定 */
  worldGen: Partial<WorldGenConfig>;
  /** 乱数seed */
  seed: number;
  /** エントロピー率 */
  entropyRate: number;
  /** ノイズ率 */
  noiseRate: number;
}

/**
 * デフォルトのUniverse設定
 */
export const DEFAULT_UNIVERSE_CONFIG: UniverseConfig = {
  worldGen: {},
  seed: 12345,
  entropyRate: 0.001,
  noiseRate: 0.1,
};

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
  | { type: 'artifactDecayed'; artifactId: string; tick: number };

/**
 * シミュレーション統計
 */
export interface SimulationStats {
  tick: number;
  entityCount: number;
  totalEnergy: number;
  artifactCount: number;
  averageAge: number;
}

/**
 * Universe - シミュレーション全体
 */
export class Universe {
  readonly config: UniverseConfig;
  readonly space: Space;
  readonly time: TimeManager;
  readonly rng: RandomGenerator;
  
  private entities: Map<EntityId, Entity> = new Map();
  private artifactManager: ArtifactManager;
  private entropyEngine: EntropyEngine;
  private transitSystem: TransitSystem;
  private energySystem: EnergySystem;
  private interactionEngine: InteractionEngine;
  private replicationEngine: ReplicationEngine;
  
  private eventLog: SimulationEvent[] = [];
  private isPaused: boolean = false;

  constructor(config: Partial<UniverseConfig> = {}) {
    this.config = { ...DEFAULT_UNIVERSE_CONFIG, ...config };
    
    // コンポーネント初期化
    this.rng = new RandomGenerator(this.config.seed);
    this.time = new TimeManager();
    
    // 世界生成
    const worldGen = new WorldGenerator(this.config.worldGen);
    const { space, entities } = worldGen.generate(this.rng);
    this.space = space;
    
    // Entity登録
    for (const entity of entities) {
      this.entities.set(entity.id, entity);
      this.logEvent({
        type: 'entityCreated',
        entityId: entity.id,
        nodeId: entity.nodeId,
        tick: 0,
      });
    }
    
    // エンジン初期化
    this.artifactManager = new ArtifactManager();
    this.entropyEngine = new EntropyEngine({ 
      entityDegradationRate: this.config.entropyRate,
      artifactDegradationRate: this.config.entropyRate,
    });
    this.transitSystem = new TransitSystem();
    this.energySystem = new EnergySystem();
    this.interactionEngine = new InteractionEngine();
    this.replicationEngine = new ReplicationEngine();
  }

  /**
   * 1ステップ実行
   */
  step(): void {
    if (this.isPaused) return;

    // 1. 時間を進める
    this.time.advance();
    const tick = this.time.getTick();

    // 2. 移動中アイテムの到着処理
    this.processTransitArrivals(tick);

    // 3. エントロピー適用
    this.applyEntropy();

    // 4. 各Entityの行動
    this.processEntityActions(tick);

    // 5. 死亡判定
    this.processDeaths(tick);
  }

  /**
   * 複数ステップ実行
   */
  run(steps: number): void {
    for (let i = 0; i < steps; i++) {
      if (this.isPaused) break;
      this.step();
    }
  }

  /**
   * 一時停止
   */
  pause(): void {
    this.isPaused = true;
  }

  /**
   * 再開
   */
  resume(): void {
    this.isPaused = false;
  }

  /**
   * 移動中アイテムの到着処理
   */
  private processTransitArrivals(tick: number): void {
    const arrivals = this.transitSystem.processArrivals(this.space, tick);
    
    for (const item of arrivals) {
      if (item.type === 'entity' && typeof item.payload === 'string') {
        const entity = this.entities.get(item.payload as EntityId);
        if (entity) {
          entity.nodeId = item.to;
          this.logEvent({
            type: 'entityMoved',
            entityId: entity.id,
            from: item.from,
            to: item.to,
            tick,
          });
        }
      }
    }
  }

  /**
   * エントロピー適用
   */
  private applyEntropy(): void {
    const entities = Array.from(this.entities.values());
    const artifacts = this.artifactManager.getAll();
    const edges = this.space.getAllEdges();
    
    // ノードリソースを収集
    const nodeResources = new Map<NodeId, Map<string, number>>();
    for (const node of this.space.getAllNodes()) {
      nodeResources.set(node.id, node.resources as Map<string, number>);
    }

    const result = this.entropyEngine.applyEntropy(
      entities,
      artifacts,
      edges,
      nodeResources as any,
      this.rng
    );

    // 消滅したArtifactを削除
    for (const artifactId of result.decayedArtifacts) {
      this.artifactManager.remove(artifactId);
      this.logEvent({
        type: 'artifactDecayed',
        artifactId,
        tick: this.time.getTick(),
      });
    }
  }

  /**
   * 各Entityの行動処理
   */
  private processEntityActions(tick: number): void {
    const entityList = Array.from(this.entities.values());
    
    // Artifactをマップに変換
    const artifactMap = new Map<ArtifactId, { id: ArtifactId; durability: number }>();
    for (const artifact of this.artifactManager.getAll()) {
      artifactMap.set(artifact.id, { id: artifact.id, durability: artifact.durability });
    }
    
    for (const entity of entityList) {
      // 知覚
      const perception = perceive(
        entity,
        this.space,
        this.entities,
        artifactMap,
        this.rng,
        this.config.noiseRate
      );

      // 行動決定（遺伝子ベース）
      const action = this.decideAction(entity, perception);

      // 行動実行
      this.executeAction(entity, action, tick);

      // 加齢
      entity.age++;
    }
  }

  /**
   * 遺伝子ベースの行動決定
   */
  private decideAction(entity: Entity, perception: Perception): Action {
    const genes = entity.behaviorRule;
    
    // エネルギーが低い → 資源を探す（移動）
    const hungerThreshold = genes.getGene(GeneIndex.HungerThreshold) * 100;
    if (entity.energy < hungerThreshold && perception.neighborNodes.length > 0) {
      // 資源が多いノードを探す
      let bestNode = perception.neighborNodes[0];
      let bestResources = 0;
      for (const node of perception.neighborNodes) {
        let total = 0;
        for (const amount of node.resources.values()) {
          total += amount;
        }
        if (total > bestResources) {
          bestResources = total;
          bestNode = node;
        }
      }
      if (bestNode) {
        return { type: 'move', targetNode: bestNode.id };
      }
    }

    // 複製閾値を超えている → 複製
    const replicationThreshold = genes.getGene(GeneIndex.ReplicationThreshold) * 200;
    if (entity.energy > replicationThreshold) {
      // 協力性が高く、近くにエンティティがいれば協力複製
      if (genes.getGene(GeneIndex.Cooperation) > 0.5 && perception.nearbyEntities.length > 0) {
        const partner = perception.nearbyEntities[this.rng.randomInt(0, perception.nearbyEntities.length - 1)];
        if (partner) {
          return { type: 'replicate', partner: partner.id };
        }
      }
      return { type: 'replicate', partner: null };
    }

    // 社会性が高い → 相互作用
    if (this.rng.random() < genes.getGene(GeneIndex.Sociality) && perception.nearbyEntities.length > 0) {
      const target = perception.nearbyEntities[this.rng.randomInt(0, perception.nearbyEntities.length - 1)];
      if (target) {
        return { type: 'interact', targetEntity: target.id, data: null };
      }
    }

    // 探索性が高い → ランダム移動
    if (this.rng.random() < genes.getGene(GeneIndex.Exploration) && perception.neighborNodes.length > 0) {
      const target = perception.neighborNodes[this.rng.randomInt(0, perception.neighborNodes.length - 1)];
      if (target) {
        return { type: 'move', targetNode: target.id };
      }
    }

    // アーティファクト生成傾向
    if (this.rng.random() < genes.getGene(GeneIndex.ArtifactCreation) * 0.1) {
      return { type: 'createArtifact', data: entity.state.getData() };
    }

    return { type: 'idle' };
  }

  /**
   * 行動実行
   */
  private executeAction(entity: Entity, action: Action, tick: number): void {
    // 行動コスト計算
    const cost = this.energySystem.calculateCost(action, this.space, entity.nodeId);
    if (entity.energy < cost) {
      entity.energy -= 0.1; // アイドルコスト
      return;
    }
    entity.energy -= cost;

    switch (action.type) {
      case 'move':
        this.executeMove(entity, action.targetNode, tick);
        break;
      case 'interact':
        this.executeInteract(entity, action.targetEntity, tick);
        break;
      case 'replicate':
        this.executeReplicate(entity, action.partner ?? undefined, tick);
        break;
      case 'createArtifact':
        this.executeCreateArtifact(entity, action.data, tick);
        break;
      case 'idle':
      default:
        break;
    }
  }

  /**
   * 移動実行
   */
  private executeMove(entity: Entity, targetNode: NodeId, tick: number): void {
    const edge = this.space.getEdgeBetween(entity.nodeId, targetNode);
    if (!edge) return;

    // 遅延付き移動
    this.transitSystem.startTransit(
      edge,
      'entity',
      entity.id,
      tick,
      entity.nodeId,
      targetNode
    );
  }

  /**
   * 相互作用実行
   */
  private executeInteract(entity: Entity, targetId: EntityId, tick: number): void {
    const target = this.entities.get(targetId);
    if (!target || target.nodeId !== entity.nodeId) return;

    const result = this.interactionEngine.process(entity, target, null, this.rng);
    
    if (result.success) {
      entity.energy += result.initiatorEnergyChange;
      target.energy += result.targetEnergyChange;
      
      this.logEvent({
        type: 'interaction',
        initiator: entity.id,
        target: targetId,
        tick,
      });
    }
  }

  /**
   * 複製実行
   */
  private executeReplicate(entity: Entity, partnerId: EntityId | undefined, tick: number): void {
    let result;
    
    if (partnerId) {
      const partner = this.entities.get(partnerId);
      if (!partner || partner.nodeId !== entity.nodeId) return;
      result = this.replicationEngine.replicateWithPartner(entity, partner, this.rng);
    } else {
      result = this.replicationEngine.replicateAlone(entity, this.rng);
    }

    if (result.success && result.child) {
      this.entities.set(result.child.id, result.child);
      this.logEvent({
        type: 'entityCreated',
        entityId: result.child.id,
        nodeId: result.child.nodeId,
        tick,
      });
      this.logEvent({
        type: 'replication',
        parentId: entity.id,
        childId: result.child.id,
        tick,
      });
    }
  }

  /**
   * Artifact生成実行
   */
  private executeCreateArtifact(entity: Entity, data: Uint8Array | null, tick: number): void {
    const result = this.artifactManager.create(
      entity.id,
      entity.nodeId,
      data || new Uint8Array(0),
      entity.energy,
      tick,
      this.rng
    );

    if (result.success && result.artifact) {
      entity.energy -= result.energyConsumed;
      this.logEvent({
        type: 'artifactCreated',
        artifactId: result.artifact.id,
        nodeId: entity.nodeId,
        tick,
      });
    }
  }

  /**
   * 死亡判定
   */
  private processDeaths(tick: number): void {
    const toRemove: EntityId[] = [];

    for (const [id, entity] of this.entities) {
      if (entity.energy <= 0) {
        toRemove.push(id);
        this.logEvent({
          type: 'entityDied',
          entityId: id,
          cause: 'energy_depletion',
          tick,
        });
      }
    }

    for (const id of toRemove) {
      this.entities.delete(id);
    }
  }

  /**
   * イベントログ記録
   */
  private logEvent(event: SimulationEvent): void {
    this.eventLog.push(event);
  }

  /**
   * 統計取得
   */
  getStats(): SimulationStats {
    const entities = Array.from(this.entities.values());
    const totalEnergy = entities.reduce((sum, e) => sum + e.energy, 0);
    const totalAge = entities.reduce((sum, e) => sum + e.age, 0);

    return {
      tick: this.time.getTick(),
      entityCount: entities.length,
      totalEnergy,
      artifactCount: this.artifactManager.count,
      averageAge: entities.length > 0 ? totalAge / entities.length : 0,
    };
  }

  /**
   * イベントログ取得
   */
  getEventLog(): SimulationEvent[] {
    return [...this.eventLog];
  }

  /**
   * Entity取得
   */
  getEntity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  /**
   * 全Entity取得
   */
  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  /**
   * 総エネルギー取得
   */
  getTotalEnergy(): number {
    let total = 0;
    
    // Entity
    for (const entity of this.entities.values()) {
      total += entity.energy;
    }
    
    // Node resources
    for (const node of this.space.getAllNodes()) {
      for (const amount of node.resources.values()) {
        total += amount;
      }
    }
    
    return total;
  }
}
