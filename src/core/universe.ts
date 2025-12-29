/**
 * Universe - シミュレーション全体管理
 * Requirements: 15.1, 2.2
 */

import { Space } from './space.js';
import { TimeManager } from './time.js';
import { RandomGenerator } from './random.js';
import { Entity, createEntity } from './entity.js';
import { ArtifactManager } from './artifact.js';
import { EntropyEngine } from './entropy.js';
import { TransitSystem } from './transit.js';
import { EnergySystem } from './energy.js';
import { perceive, Perception } from './perception.js';
import { InteractionEngine } from './interaction.js';
import { ReplicationEngine } from './replication.js';
import { WorldGenerator, WorldGenConfig } from './world-generator.js';
import { EntityId, NodeId, ArtifactId, ResourceType } from './types.js';
import { Node } from './node.js';
import { GeneIndex } from './behavior-rule.js';
import { Action } from './action.js';
import { SimulationEvent, SimulationStats } from './observation.js';
import { TypeRegistry } from './type-registry.js';
import { ReactionEngine, ReactionEvent } from './reaction.js';

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
  /** 資源再生率（外部エネルギー入力を表す） */
  resourceRegenerationRate: number;
  /** 廃熱放散率（宇宙への放散） */
  wasteHeatRadiationRate: number;
}

/**
 * デフォルトのUniverse設定
 */
export const DEFAULT_UNIVERSE_CONFIG: UniverseConfig = {
  worldGen: {},
  seed: 12345,
  entropyRate: 0.001,
  noiseRate: 0.1,
  resourceRegenerationRate: 0.008,  // バランス調整
  wasteHeatRadiationRate: 0.3,
};

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
  
  // 公理19-21: 物質の多様性
  private typeRegistry: TypeRegistry;
  private reactionEngine: ReactionEngine;
  private reactionLog: ReactionEvent[] = [];
  
  private eventLog: SimulationEvent[] = [];
  private isPaused: boolean = false;

  constructor(config: Partial<UniverseConfig> = {}) {
    this.config = { ...DEFAULT_UNIVERSE_CONFIG, ...config };
    
    // コンポーネント初期化
    this.rng = new RandomGenerator(this.config.seed);
    this.time = new TimeManager();
    
    // 世界生成
    const worldGen = new WorldGenerator(this.config.worldGen);
    const { space, entities, typeRegistry } = worldGen.generate(this.rng);
    this.space = space;
    this.typeRegistry = typeRegistry;
    this.reactionEngine = new ReactionEngine(typeRegistry);
    
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

    // 3. 資源再生（外部エネルギー入力）
    this.regenerateResources();

    // 4. エントロピー適用
    this.applyEntropy();

    // 5. 各Entityの行動
    this.processEntityActions(tick);

    // 6. 死亡判定
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
          // 元のノードからエンティティIDを削除
          const fromNode = this.space.getNode(item.from);
          if (fromNode) {
            fromNode.entityIds.delete(entity.id);
          }
          
          // 新しいノードにエンティティIDを追加
          const toNode = this.space.getNode(item.to);
          if (toNode) {
            toNode.entityIds.add(entity.id);
          }
          
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
   * エネルギーを廃熱としてノードに散逸させる（エネルギー保存則）
   * 行動コストや維持コストは消滅せず、廃熱として蓄積される
   * 廃熱は採取不可で、徐々に宇宙に放散される
   */
  private dissipateEnergyToNode(nodeId: NodeId, amount: number): void {
    const node = this.space.getNode(nodeId);
    if (node) {
      node.wasteHeat += amount;
    }
  }

  /**
   * 資源再生（外部エネルギー入力を表す）
   * 物理的必要性: 閉鎖系ではエントロピー増大により必ず死滅する。
   * 持続可能なシステムには外部からのエネルギー入力が必要（太陽光など）。
   */
  private regenerateResources(): void {
    const rate = this.config.resourceRegenerationRate;
    
    for (const node of this.space.getAllNodes()) {
      for (const [type, capacity] of node.attributes.resourceCapacity) {
        const current = node.resources.get(type) ?? 0;
        if (current < capacity) {
          // 容量に向かって緩やかに回復（外部入力）
          const regeneration = (capacity - current) * rate;
          node.resources.set(type, current + regeneration);
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
    const nodeResources = new Map<NodeId, Map<ResourceType, number>>();
    for (const node of this.space.getAllNodes()) {
      nodeResources.set(node.id, node.resources);
    }

    // エンティティとノードのマッピングを作成（維持コストの散逸先）
    const entityNodeMap = new Map<EntityId, Node>();
    // 公理19: エンティティのstabilityマップを作成
    const entityStabilityMap = new Map<EntityId, number>();
    for (const entity of entities) {
      const node = this.space.getNode(entity.nodeId);
      if (node) {
        entityNodeMap.set(entity.id, node);
      }
      // タイプのstabilityを取得
      const entityType = entity.type ?? 0;
      const typeProps = this.typeRegistry.getTypeProperties(entityType);
      entityStabilityMap.set(entity.id, typeProps.stability);
    }

    const result = this.entropyEngine.applyEntropy(
      entities,
      artifacts,
      edges,
      nodeResources,
      entityNodeMap,
      this.rng,
      entityStabilityMap
    );

    // 消滅したArtifactを削除
    for (const artifactId of result.decayedArtifacts) {
      const artifact = this.artifactManager.get(artifactId);
      if (artifact) {
        // ノードのartifactIdsから削除
        const node = this.space.getNode(artifact.nodeId);
        if (node) {
          node.artifactIds.delete(artifactId);
        }
      }
      this.artifactManager.remove(artifactId);
      this.logEvent({
        type: 'artifactDecayed',
        artifactId,
        tick: this.time.getTick(),
      });
    }
    
    // 廃熱の宇宙への放散（熱力学第二法則）
    this.radiateWasteHeat();
  }

  /**
   * 廃熱を宇宙に放散する
   * 熱力学第二法則: 廃熱は徐々に宇宙空間に放散され、系から消滅する
   * これにより、エネルギーは保存されつつも、利用可能なエネルギーは減少する
   */
  private radiateWasteHeat(): void {
    const radiationRate = this.config.wasteHeatRadiationRate ?? 0.1;
    
    for (const node of this.space.getAllNodes()) {
      if (node.wasteHeat > 0) {
        const radiated = node.wasteHeat * radiationRate;
        node.wasteHeat -= radiated;
        // 放散されたエネルギーは系から消滅（宇宙空間へ）
      }
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
      // ゾンビ防止: 反応等で削除された個体はスキップ
      if (!this.entities.has(entity.id)) {
        continue;
      }
      
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
    
    // エネルギーが低い → まず現在地で資源採取を試みる
    const hungerThreshold = genes.getGene(GeneIndex.HungerThreshold) * 100;
    if (entity.energy < hungerThreshold) {
      // 現在のノードに資源があれば採取
      if (perception.currentNode.resources.get(ResourceType.Energy) ?? 0 > 0) {
        const harvestAmount = Math.min(20, perception.currentNode.resources.get(ResourceType.Energy) ?? 0);
        return { type: 'harvest', amount: harvestAmount };
      }
      
      // 資源がなければ移動
      if (perception.neighborNodes.length > 0) {
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

    // デフォルト: 資源があれば採取、なければ待機
    const currentEnergy = perception.currentNode.resources.get(ResourceType.Energy) ?? 0;
    if (currentEnergy > 0) {
      return { type: 'harvest', amount: Math.min(10, currentEnergy) };
    }

    return { type: 'idle' };
  }

  /**
   * 行動実行
   */
  private executeAction(entity: Entity, action: Action, tick: number): void {
    // 移動の場合はターゲットノードを取得
    const targetNode = action.type === 'move' ? action.targetNode : undefined;
    
    // 行動コスト計算（entityを渡して質量ベースのコストを有効化）
    const cost = this.energySystem.calculateCost(action, this.space, entity.nodeId, targetNode, entity);
    
    // replicate と createArtifact は内部でコスト処理するため、ここでは減算しない
    const skipCostDeduction = action.type === 'replicate' || action.type === 'createArtifact';
    
    if (!skipCostDeduction) {
      if (entity.energy < cost) {
        // アイドルコストも環境に散逸
        entity.energy -= 0.1;
        this.dissipateEnergyToNode(entity.nodeId, 0.1);
        return;
      }
      entity.energy -= cost;
      // エネルギー保存則: 行動コストは環境に散逸（熱として放出）
      this.dissipateEnergyToNode(entity.nodeId, cost);
    }

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
      case 'harvest':
        this.executeHarvest(entity, action.amount, tick);
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

    // 公理21: 化学反応チェック
    const reactionCheck = this.reactionEngine.checkReaction(entity, target, this.rng);
    
    if (reactionCheck.willReact && reactionCheck.result) {
      // 化学反応を実行
      this.executeReaction(entity, target, reactionCheck.result, tick);
      return;
    }

    // 通常の相互作用
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
   * 化学反応実行（公理21）
   * エネルギー保存則: 質量-エネルギー変換に基づく
   */
  private executeReaction(
    entity1: Entity,
    entity2: Entity,
    result: import('./type-registry.js').ReactionResult,
    tick: number
  ): void {
    // 反応を実行
    const { productsInfo, totalEnergyChange, massDelta } = this.reactionEngine.executeReaction(entity1, entity2, result);

    // 反応イベントをログ
    const reactionEvent = this.reactionEngine.createReactionEvent(
      tick,
      entity1.nodeId,
      entity1,
      entity2,
      result,
      massDelta,
      totalEnergyChange
    );
    this.reactionLog.push(reactionEvent);
    
    // イベントログにも記録（observation.tsの型定義に合わせる）
    this.logEvent({
      type: 'reaction',
      tick,
      nodeId: entity1.nodeId,
      reactantTypes: [entity1.type ?? 0, entity2.type ?? 0],
      productTypes: productsInfo.map(p => p.type),
      energyDelta: totalEnergyChange,
    });

    // ノードからエンティティIDを削除
    const node = this.space.getNode(entity1.nodeId);
    if (node) {
      node.entityIds.delete(entity1.id);
      node.entityIds.delete(entity2.id);
    }

    // 反応物を削除
    this.entities.delete(entity1.id);
    this.entities.delete(entity2.id);
    
    this.logEvent({
      type: 'entityDied',
      entityId: entity1.id,
      cause: 'reaction',
      tick,
    });
    this.logEvent({
      type: 'entityDied',
      entityId: entity2.id,
      cause: 'reaction',
      tick,
    });

    // 生成物を作成
    for (const productInfo of productsInfo) {
      const newEntity = createEntity({
        nodeId: entity1.nodeId,
        energy: productInfo.energy,
        type: productInfo.type,
        mass: productInfo.mass,
        composition: [productInfo.type],
      }, this.rng);
      
      this.entities.set(newEntity.id, newEntity);
      
      // ノードにエンティティIDを追加
      if (node) {
        node.entityIds.add(newEntity.id);
      }
      
      this.logEvent({
        type: 'entityCreated',
        entityId: newEntity.id,
        nodeId: newEntity.nodeId,
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
      
      // ノードにエンティティIDを追加
      const node = this.space.getNode(result.child.nodeId);
      if (node) {
        node.entityIds.add(result.child.id);
      }
      
      // エネルギー保存則: 複製コストは環境に散逸（子への移転分は保存される）
      // 注: energyConsumed = energyCost + childEnergy だが、childEnergyは子に移転されるので
      // 環境に散逸するのはenergyCostのみ
      const dissipatedEnergy = result.energyConsumed - (result.child.energy ?? 0);
      if (dissipatedEnergy > 0) {
        this.dissipateEnergyToNode(entity.nodeId, dissipatedEnergy);
      }
      
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
      // エネルギー保存則: Artifact生成コストは環境に散逸
      this.dissipateEnergyToNode(entity.nodeId, result.energyConsumed);
      
      // ノードのartifactIdsを更新
      const node = this.space.getNode(entity.nodeId);
      if (node) {
        node.artifactIds.add(result.artifact.id);
      }
      
      this.logEvent({
        type: 'artifactCreated',
        artifactId: result.artifact.id,
        nodeId: entity.nodeId,
        tick,
      });
    }
  }

  /**
   * 資源採取実行
   * 公理19: タイプごとのharvestEfficiencyを反映
   */
  private executeHarvest(entity: Entity, amount: number, tick: number): void {
    const node = this.space.getNode(entity.nodeId);
    if (!node) return;

    // タイプの採取効率を取得（公理19: 物質多様性）
    const entityType = entity.type ?? 0;
    const typeProps = this.typeRegistry.getTypeProperties(entityType);
    const efficiency = typeProps.harvestEfficiency;
    
    // 効率を反映した採取量
    const adjustedAmount = amount * efficiency;
    
    const harvested = this.energySystem.harvestFromNode(entity, node, adjustedAmount);
    if (harvested > 0) {
      this.logEvent({
        type: 'harvest',
        entityId: entity.id,
        nodeId: entity.nodeId,
        amount: harvested,
        tick,
      });
    }
  }

  /**
   * 死亡判定
   * エネルギー保存則: 死亡時のエネルギーは環境（ノード資源）に返還
   */
  private processDeaths(tick: number): void {
    const toRemove: EntityId[] = [];

    for (const [id, entity] of this.entities) {
      if (entity.energy <= 0) {
        toRemove.push(id);
        
        // ノードからエンティティIDを削除
        const node = this.space.getNode(entity.nodeId);
        if (node) {
          node.entityIds.delete(entity.id);
          
          // エネルギー保存則: 死亡時のエネルギーを環境に返還
          this.energySystem.handleDeath(entity, node);
        }
        
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

    // 空間分布を計算
    const spatialDistribution = new Map<NodeId, number>();
    for (const entity of entities) {
      const count = spatialDistribution.get(entity.nodeId) ?? 0;
      spatialDistribution.set(entity.nodeId, count + 1);
    }

    // タイプ分布を計算（公理19）
    const typeDistribution = new Map<number, number>();
    let totalMass = 0;
    for (const entity of entities) {
      const type = entity.type ?? 0;
      const count = typeDistribution.get(type) ?? 0;
      typeDistribution.set(type, count + 1);
      totalMass += entity.mass ?? 1;
    }

    // イベントカウント
    const tick = this.time.getTick();
    const recentEvents = this.eventLog.filter(e => e.tick === tick);
    const interactionCount = recentEvents.filter(e => e.type === 'interaction').length;
    const replicationCount = recentEvents.filter(e => e.type === 'replication').length;
    const deathCount = recentEvents.filter(e => e.type === 'entityDied').length;
    const reactionCount = this.reactionLog.filter(e => e.tick === tick).length;

    return {
      tick,
      entityCount: entities.length,
      totalEnergy,
      artifactCount: this.artifactManager.count,
      averageAge: entities.length > 0 ? totalAge / entities.length : 0,
      spatialDistribution,
      interactionCount,
      replicationCount,
      deathCount,
      typeDistribution,
      totalMass,
      reactionCount,
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
    const breakdown = this.getEnergyBreakdown();
    return breakdown.entityEnergy + breakdown.freeEnergy + breakdown.wasteHeat;
  }

  /**
   * エネルギー内訳を取得
   * freeEnergy: 採取可能なエネルギー（ノード資源）
   * wasteHeat: 採取不可の廃熱（徐々に宇宙に放散）
   * entityEnergy: エンティティが保持するエネルギー
   */
  getEnergyBreakdown(): { entityEnergy: number; freeEnergy: number; wasteHeat: number } {
    let entityEnergy = 0;
    let freeEnergy = 0;
    let wasteHeat = 0;
    
    // Entity
    for (const entity of this.entities.values()) {
      entityEnergy += entity.energy;
    }
    
    // Node resources (freeEnergy) and wasteHeat
    for (const node of this.space.getAllNodes()) {
      for (const amount of node.resources.values()) {
        freeEnergy += amount;
      }
      wasteHeat += node.wasteHeat;
    }
    
    return { entityEnergy, freeEnergy, wasteHeat };
  }

  /**
   * TypeRegistry取得（外部からの参照用）
   */
  getTypeRegistry(): TypeRegistry {
    return this.typeRegistry;
  }
}
