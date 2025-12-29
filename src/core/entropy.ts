/**
 * Entropy Engine - エントロピー増大と劣化
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { EntityId, ArtifactId, EdgeId, NodeId, ResourceType } from './types.js';
import { Entity } from './entity.js';
import { Artifact } from './artifact.js';
import { Edge } from './edge.js';
import { Node } from './node.js';
import { RandomGenerator } from './random.js';

/**
 * エントロピー設定
 */
export interface EntropyConfig {
  /** Entity状態劣化率 */
  entityDegradationRate: number;
  /** Artifact劣化率 */
  artifactDegradationRate: number;
  /** Edge劣化率 */
  edgeDegradationRate: number;
  /** 資源散逸率 */
  resourceDissipationRate: number;
  /** 維持コスト（エネルギー/tick） */
  maintenanceCost: number;
}

/**
 * デフォルトのエントロピー設定
 */
export const DEFAULT_ENTROPY_CONFIG: EntropyConfig = {
  entityDegradationRate: 0.001,
  artifactDegradationRate: 0.001,
  edgeDegradationRate: 0.0001,
  resourceDissipationRate: 0.0005,
  maintenanceCost: 0.1,
};

/**
 * エントロピー適用結果
 */
export interface EntropyResult {
  /** 劣化したEntity */
  degradedEntities: EntityId[];
  /** 消滅したArtifact */
  decayedArtifacts: ArtifactId[];
  /** 劣化したEdge */
  degradedEdges: EdgeId[];
  /** 資源散逸量 */
  resourceDissipation: Map<NodeId, Map<ResourceType, number>>;
  /** 総エネルギー損失 */
  totalEnergyLoss: number;
}

/**
 * エントロピーエンジン
 */
export class EntropyEngine {
  private config: EntropyConfig;

  constructor(config: Partial<EntropyConfig> = {}) {
    this.config = { ...DEFAULT_ENTROPY_CONFIG, ...config };
  }

  /**
   * Entity状態の劣化
   */
  degradeEntity(entity: Entity, rng: RandomGenerator): boolean {
    // 内部状態のランダムビット反転（情報劣化）
    if (rng.randomWithProbability(this.config.entityDegradationRate)) {
      const state = entity.state;
      const data = state.getData();
      if (data.length > 0) {
        // ランダムな位置のバイトを変化させる
        const randomIndex = rng.randomInt(0, data.length - 1);
        const noise = rng.randomInt(-10, 10);
        data[randomIndex] = Math.max(0, Math.min(255, data[randomIndex]! + noise));
        state.setData(data);
        return true;
      }
    }
    return false;
  }

  /**
   * Artifact耐久度の劣化
   */
  degradeArtifact(artifact: Artifact): boolean {
    artifact.durability -= this.config.artifactDegradationRate;
    return artifact.durability <= 0;
  }

  /**
   * Edge耐久度の劣化
   */
  degradeEdge(edge: Edge): boolean {
    edge.attributes.durability -= this.config.edgeDegradationRate;
    
    // 耐久度が低下すると移動時間が増加
    if (edge.attributes.durability < 0.5) {
      const degradationFactor = 1 + (0.5 - edge.attributes.durability);
      edge.attributes.travelTime = Math.ceil(
        edge.attributes.travelTime * degradationFactor
      );
    }
    
    return edge.attributes.durability <= 0;
  }

  /**
   * 資源の散逸
   */
  dissipateResources(
    resources: Map<ResourceType, number>,
    rng: RandomGenerator
  ): Map<ResourceType, number> {
    const dissipated = new Map<ResourceType, number>();

    for (const [type, amount] of resources) {
      if (rng.randomWithProbability(this.config.resourceDissipationRate)) {
        const loss = amount * this.config.resourceDissipationRate;
        resources.set(type, amount - loss);
        dissipated.set(type, loss);
      }
    }

    return dissipated;
  }

  /**
   * 維持コストの適用
   * エネルギー保存則: 維持コストは廃熱として環境に散逸する
   * 公理19: タイプのstabilityが高いほど維持コストが低い
   */
  applyMaintenanceCost(entity: Entity, node: Node | undefined, stability?: number): number {
    // stability: 0.0-1.0、高いほど安定（維持コスト低）
    // stabilityが1.0なら維持コストは半分、0.0なら2倍
    const stabilityFactor = stability !== undefined 
      ? 2.0 - stability  // stability=1.0 → 1.0倍, stability=0.0 → 2.0倍
      : 1.0;
    
    const cost = this.config.maintenanceCost * stabilityFactor;
    entity.energy -= cost;
    
    // エネルギー保存則: 維持コストは廃熱として散逸
    if (node) {
      node.wasteHeat += cost;
    }
    
    return cost;
  }

  /**
   * 全体へのエントロピー適用
   * @param entityStabilityMap エンティティIDからstability値へのマップ（公理19）
   */
  applyEntropy(
    entities: Entity[],
    artifacts: Artifact[],
    edges: Edge[],
    nodeResources: Map<NodeId, Map<ResourceType, number>>,
    entityNodeMap: Map<EntityId, Node>,
    rng: RandomGenerator,
    entityStabilityMap?: Map<EntityId, number>
  ): EntropyResult {
    const result: EntropyResult = {
      degradedEntities: [],
      decayedArtifacts: [],
      degradedEdges: [],
      resourceDissipation: new Map(),
      totalEnergyLoss: 0,
    };

    // Entity劣化
    for (const entity of entities) {
      if (this.degradeEntity(entity, rng)) {
        result.degradedEntities.push(entity.id);
      }
      // エネルギー保存則: 維持コストは環境に散逸
      // 公理19: タイプのstabilityを反映
      const node = entityNodeMap.get(entity.id);
      const stability = entityStabilityMap?.get(entity.id);
      result.totalEnergyLoss += this.applyMaintenanceCost(entity, node, stability);
    }

    // Artifact劣化
    for (const artifact of artifacts) {
      if (this.degradeArtifact(artifact)) {
        result.decayedArtifacts.push(artifact.id);
      }
    }

    // Edge劣化
    for (const edge of edges) {
      if (this.degradeEdge(edge)) {
        result.degradedEdges.push(edge.id);
      }
    }

    // 資源散逸（これは系外への散逸として許容 - 宇宙の膨張的な概念）
    for (const [nodeId, resources] of nodeResources) {
      const dissipated = this.dissipateResources(resources, rng);
      if (dissipated.size > 0) {
        result.resourceDissipation.set(nodeId, dissipated);
        for (const loss of dissipated.values()) {
          result.totalEnergyLoss += loss;
        }
      }
    }

    return result;
  }

  /**
   * 設定取得
   */
  getConfig(): EntropyConfig {
    return { ...this.config };
  }

  /**
   * 設定更新
   */
  updateConfig(config: Partial<EntropyConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
