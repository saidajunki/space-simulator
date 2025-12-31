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
import { GeneIndex, FeatureIndex, ActionIndex, BehaviorRule, FEATURE_COUNT, ACTION_COUNT } from './behavior-rule.js';
import { Action } from './action.js';
import { SimulationEvent, SimulationStats } from './observation.js';
import { TypeRegistry } from './type-registry.js';
import { ReactionEngine, ReactionEvent } from './reaction.js';
import { calculateSimilarity, calculateKnowledgeBonus } from './similarity.js';
import { 
  InformationTransferConfig, 
  DEFAULT_INFORMATION_TRANSFER_CONFIG,
  exchangeInformation,
  acquireInformation,
} from './information-transfer.js';
import { extractSkills, SkillIndex, calculateSkillBonus, SKILL_COUNT, DEFAULT_SKILL_BONUS_COEFFICIENT } from './skill.js';

const BEACON_DURABILITY_THRESHOLD = 0.5;
const BEACON_SCALE = 1.0;
const REPAIR_ENERGY_PER_DURABILITY = 20;
const PARTNER_MAINTAINER_BONUS = 1.0;
const BEACON_ATTRACTION_WEIGHT = 1.0;
const MAINTAINER_DURATION_MIN = 10;
const MAINTAINER_DURATION_MAX = 50;

/**
 * 土地（ノード）の状態情報
 */
export interface LandscapeInfo {
  nodeId: NodeId;
  resources: number;
  entityCount: number;
  artifactCount: number;
  totalPrestige: number;
  beaconStrength: number;
  harvestBonus: number;
  shelterEffect: number;
  wasteHeat: number;
}

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
  /** 道具効果（採取効率・シェルター）を有効にするか */
  toolEffectEnabled: boolean;
  /** 知識ボーナス（情報一致度による修復効率向上）を有効にするか */
  knowledgeBonusEnabled: boolean;
  /** スキルボーナス（stateパターンによる行動効率向上）を有効にするか */
  skillBonusEnabled: boolean;
  /** スキルボーナス係数（スキル値1.0あたりの追加倍率、デフォルト: 0.5） */
  skillBonusCoefficient: number;
  /** 情報伝達設定 */
  informationTransfer: InformationTransferConfig;
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
  toolEffectEnabled: true,  // デフォルトはON
  knowledgeBonusEnabled: true,  // デフォルトはON
  skillBonusEnabled: true,  // デフォルトはON
  skillBonusCoefficient: DEFAULT_SKILL_BONUS_COEFFICIENT,  // デフォルト: 0.5
  informationTransfer: DEFAULT_INFORMATION_TRANSFER_CONFIG,
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
  private nodePrestigeMap: Map<NodeId, number> = new Map();
  private beaconStrengthMap: Map<NodeId, number> = new Map();
  
  private eventLog: SimulationEvent[] = [];
  private isPaused: boolean = false;
  
  // イベントカウンタ（tick別集計の最適化）
  private tickEventCounts: Map<number, {
    interaction: number;
    replication: number;
    death: number;
    reaction: number;
    repair: number;
  }> = new Map();

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
    // maxTypesをReplicationEngineに渡す（タイプ変異の範囲制限）
    const maxTypes = this.config.worldGen.maxTypes ?? 10;
    this.replicationEngine = new ReplicationEngine({ maxTypes });
  }

  /**
   * Beacon強度を計算（Prestigeに対し減衰付き）
   */
  private calculateBeaconStrength(durability: number, prestige: number): number {
    return durability * Math.log1p(Math.max(0, prestige)) * BEACON_SCALE;
  }

  /**
   * 維持者ステータスの有無
   */
  private isMaintainer(entity: Entity, tick: number): boolean {
    return (entity.maintainerUntilTick ?? -1) > tick;
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

    // ノードごとのシェルター効果を事前計算
    const nodeShelterMap = new Map<NodeId, number>();
    for (const node of this.space.getAllNodes()) {
      nodeShelterMap.set(node.id, this.calculateShelterEffect(node.id));
    }

    // エンティティとノードのマッピングを作成（維持コストの散逸先）
    const entityNodeMap = new Map<EntityId, Node>();
    // 公理19: エンティティのstabilityマップを作成
    const entityStabilityMap = new Map<EntityId, number>();
    // シェルター効果マップを作成
    const entityShelterMap = new Map<EntityId, number>();
    for (const entity of entities) {
      const node = this.space.getNode(entity.nodeId);
      if (node) {
        entityNodeMap.set(entity.id, node);
        // ノードのシェルター効果をエンティティに適用
        entityShelterMap.set(entity.id, nodeShelterMap.get(node.id) ?? 0);
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
      entityStabilityMap,
      entityShelterMap
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
    
    // Artifactをマップに変換し、Prestige / Beacon を集約
    const artifactMap = new Map<ArtifactId, { id: ArtifactId; durability: number; prestige: number; nodeId: NodeId }>();
    this.nodePrestigeMap.clear();
    this.beaconStrengthMap.clear();
    for (const artifact of this.artifactManager.getAll()) {
      artifactMap.set(artifact.id, {
        id: artifact.id,
        durability: artifact.durability,
        prestige: artifact.prestige,
        nodeId: artifact.nodeId,
      });
      const currentPrestige = this.nodePrestigeMap.get(artifact.nodeId) ?? 0;
      this.nodePrestigeMap.set(artifact.nodeId, currentPrestige + (artifact.prestige ?? 0));
      if (artifact.durability > BEACON_DURABILITY_THRESHOLD) {
        const strength = this.calculateBeaconStrength(artifact.durability, artifact.prestige ?? 0);
        const currentStrength = this.beaconStrengthMap.get(artifact.nodeId) ?? 0;
        this.beaconStrengthMap.set(artifact.nodeId, currentStrength + strength);
      }
    }
    
    for (const entity of entityList) {
      // ゾンビ防止: 反応等で削除された個体はスキップ
      if (!this.entities.has(entity.id)) {
        continue;
      }

      // 維持者ステータスの期限切れをクリア
      if (entity.maintainerUntilTick && entity.maintainerUntilTick <= tick) {
        entity.maintainerUntilTick = undefined;
      }
      
      // 知覚
      const perception = perceive(
        entity,
        this.space,
        this.entities,
        artifactMap,
        this.rng,
        this.config.noiseRate,
        this.nodePrestigeMap,
        this.beaconStrengthMap,
        tick
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
   * 遺伝子ベースの行動決定（特徴量→スコア→softmax選択）
   */
  private decideAction(entity: Entity, perception: Perception): Action {
    const rule = entity.behaviorRule;
    const tick = this.time.getTick();
    
    // 特徴量を抽出
    const features = this.extractFeatures(entity, perception, tick);
    
    // 各行動のスコアを計算
    const scores = rule.computeActionScores(features);
    
    // Softmax確率を計算（温度2.0で探索を促進）
    const probs = BehaviorRule.softmax(scores, 2.0);
    
    // 確率に基づいて行動を選択
    const actionIndex = this.sampleFromProbs(probs);
    
    // 選択された行動を具体的なActionに変換
    return this.actionIndexToAction(actionIndex, entity, perception);
  }

  /**
   * 知覚から特徴量を抽出
   */
  private extractFeatures(entity: Entity, perception: Perception, tick: number): Float32Array {
    const features = new Float32Array(FEATURE_COUNT);
    
    // 自身のエネルギー（0-200を0-1に正規化）
    features[FeatureIndex.SelfEnergy] = Math.min(1, entity.energy / 200);
    
    // 現在ノードの資源量（0-100を0-1に正規化）
    const currentResources = perception.currentNode.resources.get(ResourceType.Energy) ?? 0;
    features[FeatureIndex.CurrentResources] = Math.min(1, currentResources / 100);
    
    // 近隣ノードの最大資源量
    let maxNeighborResources = 0;
    for (const node of perception.neighborNodes) {
      const res = node.resources.get(ResourceType.Energy) ?? 0;
      if (res > maxNeighborResources) maxNeighborResources = res;
    }
    features[FeatureIndex.MaxNeighborResources] = Math.min(1, maxNeighborResources / 100);
    
    // 近くのエンティティ数（0-10を0-1に正規化）
    features[FeatureIndex.NearbyEntityCount] = Math.min(1, perception.nearbyEntities.length / 10);
    
    // 現在ノードのBeacon強度
    features[FeatureIndex.CurrentBeacon] = Math.min(1, (perception.currentNode.beaconStrength ?? 0) / 50);
    
    // 近隣ノードの最大Beacon強度
    let maxNeighborBeacon = 0;
    for (const node of perception.neighborNodes) {
      const beacon = node.beaconStrength ?? 0;
      if (beacon > maxNeighborBeacon) maxNeighborBeacon = beacon;
    }
    features[FeatureIndex.MaxNeighborBeacon] = Math.min(1, maxNeighborBeacon / 50);
    
    // 近くの劣化アーティファクト有無
    const hasDamaged = perception.nearbyArtifacts.some(a => a.durability < 0.95);
    features[FeatureIndex.HasDamagedArtifact] = hasDamaged ? 1 : 0;
    
    // 維持者ステータス
    const isMaintainer = entity.maintainerUntilTick !== undefined && entity.maintainerUntilTick > tick;
    features[FeatureIndex.IsMaintainer] = isMaintainer ? 1 : 0;
    
    // バイアス項
    features[FeatureIndex.Bias] = 1;
    
    return features;
  }

  /**
   * 確率分布からサンプリング
   */
  private sampleFromProbs(probs: Float32Array): ActionIndex {
    const r = this.rng.random();
    let cumulative = 0;
    for (let i = 0; i < probs.length; i++) {
      cumulative += probs[i]!;
      if (r < cumulative) {
        return i as ActionIndex;
      }
    }
    return ActionIndex.Idle;
  }

  /**
   * ActionIndexを具体的なActionに変換
   */
  private actionIndexToAction(actionIndex: ActionIndex, entity: Entity, perception: Perception): Action {
    switch (actionIndex) {
      case ActionIndex.Idle:
        return { type: 'idle' };
        
      case ActionIndex.Harvest: {
        const currentEnergy = perception.currentNode.resources.get(ResourceType.Energy) ?? 0;
        if (currentEnergy > 0) {
          return { type: 'harvest', amount: Math.min(20, currentEnergy) };
        }
        return { type: 'idle' };
      }
      
      case ActionIndex.MoveToResource: {
        if (perception.neighborNodes.length === 0) return { type: 'idle' };
        // 資源が最も多いノードへ移動
        let bestNode = perception.neighborNodes[0];
        let bestResources = 0;
        for (const node of perception.neighborNodes) {
          const res = node.resources.get(ResourceType.Energy) ?? 0;
          if (res > bestResources) {
            bestResources = res;
            bestNode = node;
          }
        }
        if (bestNode) {
          return { type: 'move', targetNode: bestNode.id };
        }
        return { type: 'idle' };
      }
      
      case ActionIndex.MoveToBeacon: {
        if (perception.neighborNodes.length === 0) return { type: 'idle' };
        // Beacon強度が最も高いノードへ移動
        let bestNode = perception.neighborNodes[0];
        let bestBeacon = 0;
        for (const node of perception.neighborNodes) {
          const beacon = node.beaconStrength ?? 0;
          if (beacon > bestBeacon) {
            bestBeacon = beacon;
            bestNode = node;
          }
        }
        if (bestNode && bestBeacon > 0) {
          return { type: 'move', targetNode: bestNode.id };
        }
        // Beaconがなければランダム移動
        const randomNode = perception.neighborNodes[this.rng.randomInt(0, perception.neighborNodes.length - 1)];
        if (randomNode) {
          return { type: 'move', targetNode: randomNode.id };
        }
        return { type: 'idle' };
      }
      
      case ActionIndex.Explore: {
        if (perception.neighborNodes.length === 0) return { type: 'idle' };
        const randomNode = perception.neighborNodes[this.rng.randomInt(0, perception.neighborNodes.length - 1)];
        if (randomNode) {
          return { type: 'move', targetNode: randomNode.id };
        }
        return { type: 'idle' };
      }
      
      case ActionIndex.Interact: {
        if (perception.nearbyEntities.length === 0) return { type: 'idle' };
        const target = perception.nearbyEntities[this.rng.randomInt(0, perception.nearbyEntities.length - 1)];
        if (target) {
          return { type: 'interact', targetEntity: target.id, data: null };
        }
        return { type: 'idle' };
      }
      
      case ActionIndex.Replicate: {
        // 協力性が高く、近くにエンティティがいれば協力複製
        if (entity.behaviorRule.getGene(GeneIndex.Cooperation) > 0.5 && perception.nearbyEntities.length > 0) {
          const partner = this.choosePartnerWithMaintainerBias(
            perception.nearbyEntities,
            perception.currentNode.nodePrestige
          );
          if (partner) {
            return { type: 'replicate', partner: partner.id };
          }
        }
        return { type: 'replicate', partner: null };
      }
      
      case ActionIndex.CreateArtifact:
        return { type: 'createArtifact', data: entity.state.getData() };
      
      case ActionIndex.RepairArtifact: {
        const damaged = perception.nearbyArtifacts.find(a => a.durability < 0.95);
        if (damaged) {
          return { type: 'repairArtifact', artifactId: damaged.id };
        }
        return { type: 'idle' };
      }
      
      default:
        return { type: 'idle' };
    }
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
      case 'repairArtifact':
        this.executeRepairArtifact(entity, action.artifactId, cost, tick);
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

    // 情報交換（情報伝達機能）
    const exchangeResult = exchangeInformation(
      entity,
      target,
      this.config.informationTransfer,
      this.rng
    );

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
        exchangedBytesA: exchangeResult.exchangedBytesA,
        exchangedBytesB: exchangeResult.exchangedBytesB,
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
      // ログ: パートナー選択（維持者シグナル + Prestige）
      const isMaintainer = this.isMaintainer(partner, tick);
      const nodePrestige = this.nodePrestigeMap.get(entity.nodeId) ?? 0;
      this.logEvent({
        type: 'partnerSelected',
        entityId: entity.id,
        partnerId: partner.id,
        isMaintainer,
        nodePrestige,
        tick,
      });
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
        ...(result.inheritedBytes !== undefined && { inheritedBytes: result.inheritedBytes }),
        ...(result.mutatedBits !== undefined && { mutatedBits: result.mutatedBits }),
      });
    }
  }

  /**
   * Artifact生成実行
   * スキルボーナス: stateパターンによるコスト低減
   */
  private executeCreateArtifact(entity: Entity, data: Uint8Array | null, tick: number): void {
    // スキルボーナス（stateパターンによるコスト低減）
    const skillBonus = this.config.skillBonusEnabled
      ? calculateSkillBonus(extractSkills(entity.state.getData())[SkillIndex.Create] ?? 0, this.config.skillBonusCoefficient)
      : 1.0;
    
    // スキルボーナスが高いほどコストが下がる（1.0〜1.5 → コスト係数1.0〜0.67）
    const costMultiplier = 1.0 / skillBonus;
    
    const result = this.artifactManager.create(
      entity.id,
      entity.nodeId,
      data || new Uint8Array(0),
      entity.energy,
      tick,
      this.rng,
      costMultiplier
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
        skillBonus,
        tick,
      });
    }
  }

  /**
   * Artifact修復実行
   * 情報→行動の接続: entity.stateとartifact.dataの一致度が修復効率に影響
   * スキルボーナス: stateパターンによる効率向上
   */
  private executeRepairArtifact(entity: Entity, artifactId: ArtifactId, cost: number, tick: number): void {
    const artifact = this.artifactManager.get(artifactId);
    if (!artifact || artifact.nodeId !== entity.nodeId) return;

    // 情報→行動の接続: 一致度計算
    const similarity = calculateSimilarity(entity.state.getData(), artifact.data);
    
    // 知識ボーナス計算（設定で無効化可能）
    const knowledgeBonus = this.config.knowledgeBonusEnabled 
      ? calculateKnowledgeBonus(similarity) 
      : 1.0;

    // スキルボーナス（stateパターンによる効率向上）
    const skillBonus = this.config.skillBonusEnabled
      ? calculateSkillBonus(extractSkills(entity.state.getData())[SkillIndex.Repair] ?? 0, this.config.skillBonusCoefficient)
      : 1.0;

    const durabilityBefore = artifact.durability;
    // ボーナスを適用した修復量（知識ボーナス × スキルボーナス）
    const baseRepairGain = Math.min(1 - artifact.durability, cost / REPAIR_ENERGY_PER_DURABILITY);
    const repairGain = baseRepairGain * knowledgeBonus * skillBonus;
    const repairResult = this.artifactManager.repair(artifactId, repairGain, cost);

    if (!repairResult.success) {
      return;
    }

    // 情報取得（修復量に比例してアーティファクトから情報を取得）
    const acquisitionResult = acquireInformation(
      entity.state,
      artifact.data,
      repairGain,
      this.config.informationTransfer
    );

    // Maintainerボーナス付与
    const duration = this.rng.randomInt(MAINTAINER_DURATION_MIN, MAINTAINER_DURATION_MAX);
    entity.maintainerUntilTick = tick + duration;

    this.logEvent({
      type: 'artifactRepaired',
      entityId: entity.id,
      artifactId,
      energyConsumed: cost,
      durabilityBefore,
      durabilityAfter: repairResult.after,
      similarity,
      knowledgeBonus,
      skillBonus,
      acquiredBytes: acquisitionResult.acquiredBytes,
      tick,
    });

    this.logEvent({
      type: 'maintainerGranted',
      entityId: entity.id,
      untilTick: entity.maintainerUntilTick,
      tick,
    });
  }

  /**
   * 資源採取実行
   * 公理19: タイプごとのharvestEfficiencyを反映
   * アーティファクトによる局所効果（採取効率向上）を追加
   * スキルボーナス: stateパターンによる効率向上
   */
  private executeHarvest(entity: Entity, amount: number, tick: number): void {
    const node = this.space.getNode(entity.nodeId);
    if (!node) return;

    // タイプの採取効率を取得（公理19: 物質多様性）
    const entityType = entity.type ?? 0;
    const typeProps = this.typeRegistry.getTypeProperties(entityType);
    const baseEfficiency = typeProps.harvestEfficiency;
    
    // アーティファクトによる局所効果（採取効率ボーナス）
    const artifactBonus = this.calculateArtifactHarvestBonus(entity.nodeId);
    
    // スキルボーナス（stateパターンによる効率向上）
    const skillBonus = this.config.skillBonusEnabled
      ? calculateSkillBonus(extractSkills(entity.state.getData())[SkillIndex.Harvest] ?? 0, this.config.skillBonusCoefficient)
      : 1.0;
    
    const efficiency = baseEfficiency * (1 + artifactBonus) * skillBonus;
    
    // 効率を反映した採取量
    const adjustedAmount = amount * efficiency;
    
    const harvested = this.energySystem.harvestFromNode(entity, node, adjustedAmount);
    if (harvested > 0) {
      this.logEvent({
        type: 'harvest',
        entityId: entity.id,
        nodeId: entity.nodeId,
        amount: harvested,
        skillBonus,
        tick,
      });
    }
  }

  /**
   * アーティファクトによる採取効率ボーナスを計算
   * durabilityに比例（道具効果）
   * toolEffectEnabled=falseの場合は常に0を返す
   */
  private calculateArtifactHarvestBonus(nodeId: NodeId): number {
    // 道具効果が無効の場合は0
    if (!this.config.toolEffectEnabled) return 0;
    
    const artifacts = this.artifactManager.getByNode(nodeId);
    if (artifacts.length === 0) return 0;
    
    // 各アーティファクトのdurabilityの合計 × 係数
    const ARTIFACT_HARVEST_BONUS_RATE = 0.1; // durability 1.0あたり10%ボーナス
    let totalBonus = 0;
    for (const artifact of artifacts) {
      totalBonus += artifact.durability * ARTIFACT_HARVEST_BONUS_RATE;
    }
    
    // 最大50%ボーナスに制限
    return Math.min(0.5, totalBonus);
  }

  /**
   * アーティファクトによるシェルター効果を計算
   * durabilityに比例（断熱効果＝維持コスト低減）
   * toolEffectEnabled=falseの場合は常に0を返す
   */
  private calculateShelterEffect(nodeId: NodeId): number {
    // 道具効果が無効の場合は0
    if (!this.config.toolEffectEnabled) return 0;
    
    const artifacts = this.artifactManager.getByNode(nodeId);
    if (artifacts.length === 0) return 0;
    
    // 各アーティファクトのdurabilityの合計 × 係数
    const SHELTER_EFFECT_RATE = 0.05; // durability 1.0あたり5%維持コスト低減
    let totalEffect = 0;
    for (const artifact of artifacts) {
      totalEffect += artifact.durability * SHELTER_EFFECT_RATE;
    }
    
    // 最大30%低減に制限
    return Math.min(0.3, totalEffect);
  }

  /**
   * 重み付き選択（重みが全て0の場合はランダム）
   */
  private pickWeighted<T>(items: T[], weights: number[]): T | null {
    if (items.length === 0) return null;
    let total = 0;
    for (const w of weights) {
      total += Math.max(0, w);
    }
    if (total <= 0) {
      return items[this.rng.randomInt(0, items.length - 1)] ?? null;
    }
    let r = this.rng.random() * total;
    for (let i = 0; i < items.length; i++) {
      r -= Math.max(0, weights[i] ?? 0);
      if (r <= 0) {
        return items[i] ?? null;
      }
    }
    return items[items.length - 1] ?? null;
  }

  /**
   * 維持者シグナル + Prestige に基づくパートナー選好
   */
  private choosePartnerWithMaintainerBias(
    candidates: { id: EntityId; isMaintainer: boolean }[],
    nodePrestige: number
  ): { id: EntityId; isMaintainer: boolean } | null {
    if (candidates.length === 0) return null;

    const prestigeFactor = 1 + Math.log1p(Math.max(0, nodePrestige));
    const weights = candidates.map(c => {
      const maintainerWeight = c.isMaintainer ? 1 + PARTNER_MAINTAINER_BONUS : 1;
      return maintainerWeight * prestigeFactor;
    });

    return this.pickWeighted(candidates, weights);
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
    
    // tick別カウンタを更新（O(1)アクセス用）
    const tick = event.tick;
    let counts = this.tickEventCounts.get(tick);
    if (!counts) {
      counts = { interaction: 0, replication: 0, death: 0, reaction: 0, repair: 0 };
      this.tickEventCounts.set(tick, counts);
    }
    
    switch (event.type) {
      case 'interaction':
        counts.interaction++;
        break;
      case 'replication':
        counts.replication++;
        break;
      case 'entityDied':
        counts.death++;
        break;
      case 'reaction':
        counts.reaction++;
        break;
      case 'artifactRepaired':
        counts.repair++;
        break;
    }
  }

  /**
   * 指定tickのイベントカウントを取得（O(1)）
   */
  private getTickEventCounts(tick: number): { interaction: number; replication: number; death: number; reaction: number; repair: number } {
    return this.tickEventCounts.get(tick) ?? { interaction: 0, replication: 0, death: 0, reaction: 0, repair: 0 };
  }

  /**
   * 統計取得
   */
  getStats(): SimulationStats {
    const entities = Array.from(this.entities.values());
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

    // イベントカウント（O(1)アクセス）
    const tick = this.time.getTick();
    const eventCounts = this.getTickEventCounts(tick);
    const interactionCount = eventCounts.interaction;
    const replicationCount = eventCounts.replication;
    const deathCount = eventCounts.death;
    const reactionCount = eventCounts.reaction;

    // エネルギー内訳
    const breakdown = this.getEnergyBreakdown();

    // アーティファクト関連メトリクス
    const artifacts = this.artifactManager.getAll();
    const repairCount = eventCounts.repair;
    const totalPrestige = artifacts.reduce((sum, a) => sum + (a.prestige ?? 0), 0);
    const beaconStrengths = artifacts
      .filter(a => a.durability >= 0.5)
      .map(a => a.durability * (a.prestige ?? 1));
    const avgBeaconStrength = beaconStrengths.length > 0
      ? beaconStrengths.reduce((a, b) => a + b, 0) / beaconStrengths.length
      : 0;
    const maintainerCount = entities.filter(e => 
      e.maintainerUntilTick !== undefined && e.maintainerUntilTick > tick
    ).length;
    
    // アーティファクト年齢
    const artifactAges = artifacts.map(a => tick - a.createdAt);
    const avgArtifactAge = artifactAges.length > 0
      ? artifactAges.reduce((a, b) => a + b, 0) / artifactAges.length
      : 0;
    const maxArtifactAge = artifactAges.length > 0
      ? Math.max(...artifactAges)
      : 0;

    // 空間集中度（ジニ係数）
    const spatialGini = this.calculateGini(Array.from(spatialDistribution.values()));

    // 知識関連メトリクス（情報→行動の接続）
    const repairEvents = this.eventLog.filter(
      e => e.type === 'artifactRepaired' && e.tick === tick
    ) as Array<{ type: 'artifactRepaired'; similarity: number; knowledgeBonus: number; skillBonus?: number; acquiredBytes?: number }>;
    const knowledge = {
      avgSimilarity: repairEvents.length > 0
        ? repairEvents.reduce((sum, e) => sum + e.similarity, 0) / repairEvents.length
        : 0,
      repairCountThisTick: repairEvents.length,
      bonusAppliedCount: repairEvents.filter(e => e.knowledgeBonus > 1.0).length,
    };

    // 情報伝達メトリクス
    const interactionEvents = this.eventLog.filter(
      e => e.type === 'interaction' && e.tick === tick
    ) as Array<{ type: 'interaction'; exchangedBytesA?: number; exchangedBytesB?: number }>;
    const replicationEvents = this.eventLog.filter(
      e => e.type === 'replication' && e.tick === tick
    ) as Array<{ type: 'replication'; inheritedBytes?: number }>;
    
    // 平均state充填率
    let totalStateFillRate = 0;
    for (const entity of entities) {
      const fillRate = entity.state.getData().length / entity.state.capacity;
      totalStateFillRate += fillRate;
    }
    const avgStateFillRate = entities.length > 0 ? totalStateFillRate / entities.length : 0;
    
    // 情報多様性（ユニークなstateハッシュ数）
    const stateHashes = new Set<string>();
    for (const entity of entities) {
      const data = entity.state.getData();
      if (data.length > 0) {
        // 簡易ハッシュ: 先頭8バイトを文字列化
        const hashBytes = data.slice(0, Math.min(8, data.length));
        stateHashes.add(Array.from(hashBytes).join(','));
      }
    }
    
    const informationTransfer = {
      avgStateFillRate,
      exchangeCount: interactionEvents.filter(e => (e.exchangedBytesA ?? 0) > 0 || (e.exchangedBytesB ?? 0) > 0).length,
      inheritanceCount: replicationEvents.filter(e => (e.inheritedBytes ?? 0) > 0).length,
      acquisitionCount: repairEvents.filter(e => (e.acquiredBytes ?? 0) > 0).length,
      diversity: stateHashes.size,
    };

    // スキルシステムメトリクス
    const skillVectors: Float32Array[] = [];
    for (const entity of entities) {
      skillVectors.push(extractSkills(entity.state.getData()));
    }
    
    // 平均スキル値
    const avgSkills = new Array(SKILL_COUNT).fill(0);
    if (skillVectors.length > 0) {
      for (const skills of skillVectors) {
        for (let i = 0; i < SKILL_COUNT; i++) {
          avgSkills[i] += skills[i] ?? 0;
        }
      }
      for (let i = 0; i < SKILL_COUNT; i++) {
        avgSkills[i] /= skillVectors.length;
      }
    }
    
    // スキル分散
    const skillVariance = new Array(SKILL_COUNT).fill(0);
    if (skillVectors.length > 0) {
      for (const skills of skillVectors) {
        for (let i = 0; i < SKILL_COUNT; i++) {
          const diff = (skills[i] ?? 0) - avgSkills[i];
          skillVariance[i] += diff * diff;
        }
      }
      for (let i = 0; i < SKILL_COUNT; i++) {
        skillVariance[i] /= skillVectors.length;
      }
    }
    
    // ボーナス適用回数（このtickのイベントから集計）
    const harvestEvents = this.eventLog.filter(
      e => e.type === 'harvest' && e.tick === tick
    ) as Array<{ type: 'harvest'; skillBonus?: number }>;
    const createEvents = this.eventLog.filter(
      e => e.type === 'artifactCreated' && e.tick === tick
    ) as Array<{ type: 'artifactCreated'; skillBonus?: number }>;
    
    const bonusApplications: Record<string, number> = {
      harvest: harvestEvents.filter(e => (e.skillBonus ?? 1.0) > 1.0).length,
      repair: repairEvents.filter(e => (e.skillBonus ?? 1.0) > 1.0).length,
      create: createEvents.filter(e => (e.skillBonus ?? 1.0) > 1.0).length,
    };
    
    const skills = {
      avgSkills,
      skillVariance,
      bonusApplications,
    };

    return {
      tick,
      entityCount: entities.length,
      totalEnergy: breakdown.entityEnergy,  // 従来互換: エンティティ保持分
      artifactCount: this.artifactManager.count,
      averageAge: entities.length > 0 ? totalAge / entities.length : 0,
      spatialDistribution,
      interactionCount,
      replicationCount,
      deathCount,
      typeDistribution,
      totalMass,
      reactionCount,
      // エネルギー内訳（新規）
      entityEnergy: breakdown.entityEnergy,
      freeEnergy: breakdown.freeEnergy,
      wasteHeat: breakdown.wasteHeat,
      // アーティファクト永続化メトリクス
      repairCount,
      totalPrestige,
      avgBeaconStrength,
      maintainerCount,
      avgArtifactAge,
      maxArtifactAge,
      spatialGini,
      // 知識関連メトリクス
      knowledge,
      // 情報伝達メトリクス
      informationTransfer,
      // スキルシステムメトリクス
      skills,
    };
  }

  /**
   * ジニ係数を計算（0=完全均等、1=完全集中）
   */
  private calculateGini(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    if (sum === 0) return 0;
    
    let numerator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (2 * (i + 1) - n - 1) * sorted[i]!;
    }
    return numerator / (n * sum);
  }

  /**
   * 土地（ノード）の状態を取得
   */
  getLandscape(): LandscapeInfo[] {
    const nodes = this.space.getAllNodes();
    const result: LandscapeInfo[] = [];

    for (const node of nodes) {
      const artifacts = this.artifactManager.getByNode(node.id);
      const entities = Array.from(this.entities.values()).filter(e => e.nodeId === node.id);
      const harvestBonus = this.calculateArtifactHarvestBonus(node.id);
      const shelterEffect = this.calculateShelterEffect(node.id);
      
      // Beacon強度計算
      let beaconStrength = 0;
      let totalPrestige = 0;
      for (const artifact of artifacts) {
        totalPrestige += artifact.prestige ?? 0;
        if (artifact.durability >= BEACON_DURABILITY_THRESHOLD) {
          beaconStrength += artifact.durability * (artifact.prestige ?? 1) * BEACON_SCALE;
        }
      }

      result.push({
        nodeId: node.id,
        resources: node.resources.get(ResourceType.Energy) ?? 0,
        entityCount: entities.length,
        artifactCount: artifacts.length,
        totalPrestige,
        beaconStrength,
        harvestBonus,
        shelterEffect,
        wasteHeat: node.wasteHeat ?? 0,
      });
    }

    return result;
  }

  /**
   * イベントログ取得
   */
  getEventLog(): SimulationEvent[] {
    return [...this.eventLog];
  }

  /**
   * イベントログをクリア（メモリ管理用）
   * 各tick処理後にRunnerから呼び出される
   */
  clearEventLog(): void {
    this.eventLog = [];
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

  /**
   * 全Artifact取得
   */
  getAllArtifacts(): import('./artifact.js').Artifact[] {
    return this.artifactManager.getAll();
  }
}
