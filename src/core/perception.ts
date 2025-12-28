/**
 * Perception - 局所知覚
 * Requirements: 5.1, 5.2, 5.3, 5.4
 */

import { NodeId, EntityId, ArtifactId, TerrainType, ResourceType } from './types.js';
import { Node } from './node.js';
import { Entity } from './entity.js';
import { Space } from './space.js';
import { RandomGenerator } from './random.js';

/**
 * ノード情報（知覚用）
 */
export interface NodeInfo {
  id: NodeId;
  temperature: number;
  terrainType: TerrainType;
  resources: Map<ResourceType, number>;
  entityCount: number;
  artifactCount: number;
}

/**
 * エンティティ情報（知覚用）
 */
export interface EntityInfo {
  id: EntityId;
  energy: number;
  age: number;
}

/**
 * アーティファクト情報（知覚用）
 */
export interface ArtifactInfo {
  id: ArtifactId;
  durability: number;
}

/**
 * 知覚結果
 */
export interface Perception {
  /** 現在のノード情報 */
  currentNode: NodeInfo;
  /** 隣接ノード情報 */
  neighborNodes: NodeInfo[];
  /** 近くのエンティティ情報 */
  nearbyEntities: EntityInfo[];
  /** 近くのアーティファクト情報 */
  nearbyArtifacts: ArtifactInfo[];
  /** ノイズ量 (0-1) */
  noise: number;
}

/**
 * ノードから知覚用情報を抽出
 */
function extractNodeInfo(node: Node, noiseRate: number, rng: RandomGenerator): NodeInfo {
  // ノイズを適用
  const applyNoise = (value: number): number => {
    if (rng.randomWithProbability(noiseRate)) {
      return value * (1 + rng.randomNormal(0, 0.1));
    }
    return value;
  };

  const resources = new Map<ResourceType, number>();
  for (const [type, amount] of node.resources) {
    resources.set(type, applyNoise(amount));
  }

  return {
    id: node.id,
    temperature: applyNoise(node.attributes.temperature),
    terrainType: node.attributes.terrainType,
    resources,
    entityCount: node.entityIds.size,
    artifactCount: node.artifactIds.size,
  };
}

/**
 * エンティティの知覚を生成
 */
export function perceive(
  entity: Entity,
  space: Space,
  entities: Map<EntityId, Entity>,
  artifacts: Map<ArtifactId, { id: ArtifactId; durability: number }>,
  rng: RandomGenerator,
  noiseRate: number
): Perception {
  const currentNode = space.getNode(entity.nodeId);
  if (!currentNode) {
    throw new Error(`Entity ${entity.id} is in non-existent node ${entity.nodeId}`);
  }

  // 現在のノード情報
  const currentNodeInfo = extractNodeInfo(currentNode, noiseRate, rng);

  // 隣接ノード情報
  const neighbors = space.getNeighbors(entity.nodeId);
  const neighborNodes = neighbors.map(n => extractNodeInfo(n, noiseRate, rng));

  // 近くのエンティティ情報（同一ノードのみ）
  const nearbyEntities: EntityInfo[] = [];
  for (const entityId of currentNode.entityIds) {
    if (entityId === entity.id) continue;
    const other = entities.get(entityId);
    if (other) {
      nearbyEntities.push({
        id: other.id,
        energy: rng.randomWithProbability(noiseRate)
          ? other.energy * (1 + rng.randomNormal(0, 0.1))
          : other.energy,
        age: other.age,
      });
    }
  }

  // 近くのアーティファクト情報（同一ノードのみ）
  const nearbyArtifacts: ArtifactInfo[] = [];
  for (const artifactId of currentNode.artifactIds) {
    const artifact = artifacts.get(artifactId);
    if (artifact) {
      nearbyArtifacts.push({
        id: artifact.id,
        durability: artifact.durability,
      });
    }
  }

  return {
    currentNode: currentNodeInfo,
    neighborNodes,
    nearbyEntities,
    nearbyArtifacts,
    noise: noiseRate,
  };
}
