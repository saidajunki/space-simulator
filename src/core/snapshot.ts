/**
 * Snapshot - 状態の保存と復元
 * Requirements: 15.6
 */

import { NodeId, EdgeId, EntityId, ArtifactId, ResourceType, TerrainType } from './types.js';

/**
 * ノード状態
 */
export interface NodeState {
  id: string;
  temperature: number;
  terrainType: string;
  disasterRate: number;
  resourceCapacity: [string, number][];
  resources: [string, number][];
  entityIds: string[];
  artifactIds: string[];
  wasteHeat: number;
}

/**
 * エッジ状態
 */
export interface EdgeState {
  id: string;
  from: string;
  to: string;
  distance: number;
  travelTime: number;
  capacity: number;
  dangerLevel: number;
  durability: number;
  inTransit: TransitItemState[];
}

/**
 * 移動中アイテム状態
 */
export interface TransitItemState {
  type: string;
  payload: string | number | number[];
  departedAt: number;
  arrivalAt: number;
  from: string;
  to: string;
}

/**
 * エンティティ状態
 */
export interface EntityState {
  id: string;
  nodeId: string;
  energy: number;
  stateCapacity: number;
  stateData: number[];
  behaviorRuleGenes: number[];
  age: number;
  perceptionRange: number;
  // 公理19-21: 物質の多様性
  type: number;
  mass: number;
  composition: number[];
}

/**
 * アーティファクト状態
 */
export interface ArtifactState {
  id: string;
  nodeId: string;
  data: number[];
  durability: number;
  createdAt: number;
  creatorId: string;
}

/**
 * Universe状態
 */
export interface UniverseState {
  tick: number;
  seed: number;
  rngState: number;
  nodes: NodeState[];
  edges: EdgeState[];
  entities: EntityState[];
  artifacts: ArtifactState[];
  config: {
    entropyRate: number;
    noiseRate: number;
  };
  // 公理19-21: 物質の多様性
  typeDistribution?: Map<number, number> | [number, number][];
  totalMass?: number;
  reactionCount?: number;
}

/**
 * スナップショットマネージャー
 */
export class SnapshotManager {
  /**
   * スナップショットをJSONにシリアライズ
   */
  static serialize(state: UniverseState): string {
    return JSON.stringify(state, null, 2);
  }

  /**
   * JSONからスナップショットをデシリアライズ
   */
  static deserialize(json: string): UniverseState {
    return JSON.parse(json) as UniverseState;
  }

  /**
   * スナップショットをバイナリにシリアライズ（圧縮版）
   */
  static serializeBinary(state: UniverseState): Uint8Array {
    const json = JSON.stringify(state);
    const encoder = new TextEncoder();
    return encoder.encode(json);
  }

  /**
   * バイナリからスナップショットをデシリアライズ
   */
  static deserializeBinary(data: Uint8Array): UniverseState {
    const decoder = new TextDecoder();
    const json = decoder.decode(data);
    return JSON.parse(json) as UniverseState;
  }

  /**
   * 2つのスナップショットを比較
   */
  static compare(a: UniverseState, b: UniverseState): {
    tickDiff: number;
    entityCountDiff: number;
    totalEnergyDiff: number;
    newEntities: string[];
    removedEntities: string[];
  } {
    const aEntityIds = new Set(a.entities.map(e => e.id));
    const bEntityIds = new Set(b.entities.map(e => e.id));

    const newEntities = b.entities.filter(e => !aEntityIds.has(e.id)).map(e => e.id);
    const removedEntities = a.entities.filter(e => !bEntityIds.has(e.id)).map(e => e.id);

    const aTotalEnergy = a.entities.reduce((sum, e) => sum + e.energy, 0);
    const bTotalEnergy = b.entities.reduce((sum, e) => sum + e.energy, 0);

    return {
      tickDiff: b.tick - a.tick,
      entityCountDiff: b.entities.length - a.entities.length,
      totalEnergyDiff: bTotalEnergy - aTotalEnergy,
      newEntities,
      removedEntities,
    };
  }

  /**
   * スナップショットの検証
   */
  static validate(state: UniverseState): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 基本チェック
    if (state.tick < 0) {
      errors.push('tick must be non-negative');
    }

    // ノードチェック
    const nodeIds = new Set(state.nodes.map(n => n.id));
    for (const node of state.nodes) {
      if (!node.id) {
        errors.push('node missing id');
      }
    }

    // エッジチェック
    for (const edge of state.edges) {
      if (!nodeIds.has(edge.from)) {
        errors.push(`edge ${edge.id} references non-existent node ${edge.from}`);
      }
      if (!nodeIds.has(edge.to)) {
        errors.push(`edge ${edge.id} references non-existent node ${edge.to}`);
      }
    }

    // エンティティチェック
    for (const entity of state.entities) {
      if (!nodeIds.has(entity.nodeId)) {
        errors.push(`entity ${entity.id} references non-existent node ${entity.nodeId}`);
      }
      if (entity.energy < 0) {
        errors.push(`entity ${entity.id} has negative energy`);
      }
    }

    // アーティファクトチェック
    for (const artifact of state.artifacts) {
      if (!nodeIds.has(artifact.nodeId)) {
        errors.push(`artifact ${artifact.id} references non-existent node ${artifact.nodeId}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
