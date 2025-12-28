/**
 * Node - 空間内の地域
 * Requirements: 1.2, 7.1
 */

import {
  NodeId,
  EntityId,
  ArtifactId,
  TerrainType,
  ResourceType,
} from './types.js';

/**
 * ノード属性
 */
export interface NodeAttributes {
  /** 温度 (-100 ~ 100) */
  temperature: number;
  /** 地形タイプ */
  terrainType: TerrainType;
  /** 災害率 (0 ~ 1) */
  disasterRate: number;
  /** 資源容量（各資源タイプの最大量） */
  resourceCapacity: Map<ResourceType, number>;
}

/**
 * ノード - 空間内の地域
 */
export interface Node {
  /** 一意のID */
  id: NodeId;
  /** 属性 */
  attributes: NodeAttributes;
  /** このノードに存在するエンティティのID */
  entityIds: Set<EntityId>;
  /** このノードに存在するアーティファクトのID */
  artifactIds: Set<ArtifactId>;
  /** 現在の資源量 */
  resources: Map<ResourceType, number>;
}

/**
 * ノード生成パラメータ
 */
export interface CreateNodeParams {
  id: NodeId;
  temperature?: number;
  terrainType?: TerrainType;
  disasterRate?: number;
  resourceCapacity?: Map<ResourceType, number>;
  initialResources?: Map<ResourceType, number>;
}

/**
 * ノードを生成する
 */
export function createNode(params: CreateNodeParams): Node {
  const {
    id,
    temperature = 20,
    terrainType = TerrainType.Plain,
    disasterRate = 0.01,
    resourceCapacity = new Map([
      [ResourceType.Energy, 1000],
      [ResourceType.Material, 500],
      [ResourceType.Water, 500],
    ]),
    initialResources,
  } = params;

  // 初期資源量（指定がなければ容量の50%）
  const resources = initialResources ?? new Map(
    Array.from(resourceCapacity.entries()).map(([type, cap]) => [type, cap * 0.5])
  );

  return {
    id,
    attributes: {
      temperature,
      terrainType,
      disasterRate,
      resourceCapacity,
    },
    entityIds: new Set(),
    artifactIds: new Set(),
    resources,
  };
}
