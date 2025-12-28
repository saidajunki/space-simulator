/**
 * World Generator - 世界生成
 * Requirements: 1.1, 1.2, 1.3, 1.5, 3.1, 8.1
 */

import { Node, createNode } from './node.js';
import { Edge, createEdge } from './edge.js';
import { Space } from './space.js';
import { Entity, createEntity, CreateEntityParams } from './entity.js';
import { RandomGenerator } from './random.js';
import { BehaviorRule } from './behavior-rule.js';
import { TerrainType, ResourceType, NodeId, createNodeId, createEdgeId } from './types.js';

/**
 * 世界生成設定
 */
export interface WorldGenConfig {
  /** ノード数 */
  nodeCount: number;
  /** エッジ密度（0-1） */
  edgeDensity: number;
  /** 初期Entity数 */
  initialEntityCount: number;
  /** 初期エネルギー分布 */
  initialEnergyMean: number;
  initialEnergyStdDev: number;
  /** 温度分布 */
  temperatureMean: number;
  temperatureStdDev: number;
  /** 資源分布 */
  resourceMean: number;
  resourceStdDev: number;
  /** 災害率分布 */
  disasterRateMean: number;
  disasterRateStdDev: number;
  /** エッジ距離分布 */
  edgeDistanceMean: number;
  edgeDistanceStdDev: number;
  /** エッジ危険度分布 */
  edgeDangerMean: number;
  edgeDangerStdDev: number;
}

/**
 * デフォルトの世界生成設定
 */
export const DEFAULT_WORLD_GEN_CONFIG: WorldGenConfig = {
  nodeCount: 100,
  edgeDensity: 0.1,
  initialEntityCount: 50,
  initialEnergyMean: 100,
  initialEnergyStdDev: 20,
  temperatureMean: 20,
  temperatureStdDev: 10,
  resourceMean: 100,
  resourceStdDev: 30,
  disasterRateMean: 0.01,
  disasterRateStdDev: 0.005,
  edgeDistanceMean: 10,
  edgeDistanceStdDev: 5,
  edgeDangerMean: 0.1,
  edgeDangerStdDev: 0.05,
};

/**
 * 世界生成結果
 */
export interface WorldGenResult {
  space: Space;
  entities: Entity[];
}

/**
 * 世界生成器
 */
export class WorldGenerator {
  private config: WorldGenConfig;

  constructor(config: Partial<WorldGenConfig> = {}) {
    this.config = { ...DEFAULT_WORLD_GEN_CONFIG, ...config };
  }

  /**
   * 世界を生成
   */
  generate(rng: RandomGenerator): WorldGenResult {
    const space = new Space();

    // ノード生成
    const nodes = this.generateNodes(rng);
    for (const node of nodes) {
      space.addNode(node);
    }

    // エッジ生成（連結グラフを保証）
    this.generateEdges(space, nodes, rng);

    // Entity生成
    const entities = this.generateEntities(nodes, rng);

    return { space, entities };
  }

  /**
   * ノード生成
   */
  private generateNodes(rng: RandomGenerator): Node[] {
    const nodes: Node[] = [];
    const terrainTypes = Object.values(TerrainType);

    for (let i = 0; i < this.config.nodeCount; i++) {
      const nodeId = createNodeId(`node-${i}`);
      
      // 地形タイプをランダム選択
      const terrainType = terrainTypes[rng.randomInt(0, terrainTypes.length - 1)]!;
      
      // 属性を確率分布から生成
      const temperature = Math.max(-50, Math.min(50, 
        rng.randomNormal(this.config.temperatureMean, this.config.temperatureStdDev)
      ));
      
      const disasterRate = Math.max(0, Math.min(1,
        rng.randomNormal(this.config.disasterRateMean, this.config.disasterRateStdDev)
      ));

      const resourceCapacity = new Map([
        [ResourceType.Energy, Math.max(0, rng.randomNormal(this.config.resourceMean, this.config.resourceStdDev))],
        [ResourceType.Material, Math.max(0, rng.randomNormal(this.config.resourceMean, this.config.resourceStdDev))],
        [ResourceType.Water, Math.max(0, rng.randomNormal(this.config.resourceMean, this.config.resourceStdDev))],
      ]);

      // 初期資源を設定（容量の50-100%）
      const initialResources = new Map<ResourceType, number>();
      for (const [type, capacity] of resourceCapacity) {
        const initialAmount = capacity * (0.5 + rng.random() * 0.5);
        initialResources.set(type, initialAmount);
      }

      const node = createNode({
        id: nodeId,
        temperature,
        terrainType,
        disasterRate,
        resourceCapacity,
        initialResources,
      });

      nodes.push(node);
    }

    return nodes;
  }

  /**
   * エッジ生成（連結グラフを保証）
   */
  private generateEdges(space: Space, nodes: Node[], rng: RandomGenerator): void {
    // まず最小全域木を作成して連結性を保証
    const connected = new Set<NodeId>();
    const unconnected = new Set<NodeId>(nodes.map(n => n.id));

    // 最初のノードを接続済みに
    const firstNode = nodes[0]!;
    connected.add(firstNode.id);
    unconnected.delete(firstNode.id);

    let edgeIndex = 0;

    // 全ノードを接続
    while (unconnected.size > 0) {
      const connectedArray = Array.from(connected);
      const unconnectedArray = Array.from(unconnected);

      const fromId = connectedArray[rng.randomInt(0, connectedArray.length - 1)]!;
      const toId = unconnectedArray[rng.randomInt(0, unconnectedArray.length - 1)]!;

      const edge = this.createRandomEdge(edgeIndex++, fromId, toId, rng);
      space.addEdge(edge);

      connected.add(toId);
      unconnected.delete(toId);
    }

    // 追加のエッジを密度に応じて生成
    const maxEdges = (nodes.length * (nodes.length - 1)) / 2;
    const targetEdges = Math.floor(maxEdges * this.config.edgeDensity);
    const additionalEdges = targetEdges - (nodes.length - 1);

    for (let i = 0; i < additionalEdges; i++) {
      const fromIndex = rng.randomInt(0, nodes.length - 1);
      const toIndex = rng.randomInt(0, nodes.length - 1);

      if (fromIndex === toIndex) continue;

      const fromId = nodes[fromIndex]!.id;
      const toId = nodes[toIndex]!.id;

      // 既存のエッジがなければ追加
      if (!space.getEdgeBetween(fromId, toId)) {
        const edge = this.createRandomEdge(edgeIndex++, fromId, toId, rng);
        space.addEdge(edge);
      }
    }
  }

  /**
   * ランダムなエッジを作成
   */
  private createRandomEdge(
    index: number,
    fromId: NodeId,
    toId: NodeId,
    rng: RandomGenerator
  ): Edge {
    const distance = Math.max(1, 
      rng.randomNormal(this.config.edgeDistanceMean, this.config.edgeDistanceStdDev)
    );

    return createEdge({
      id: createEdgeId(`edge-${index}`),
      from: fromId,
      to: toId,
      distance,
      travelTime: Math.ceil(distance),
      capacity: rng.randomInt(1, 10),
      dangerLevel: Math.max(0, Math.min(1,
        rng.randomNormal(this.config.edgeDangerMean, this.config.edgeDangerStdDev)
      )),
      durability: 100,
    });
  }

  /**
   * Entity生成
   */
  private generateEntities(nodes: Node[], rng: RandomGenerator): Entity[] {
    const entities: Entity[] = [];

    for (let i = 0; i < this.config.initialEntityCount; i++) {
      // ランダムなノードに配置
      const node = nodes[rng.randomInt(0, nodes.length - 1)]!;

      const energy = Math.max(1,
        rng.randomNormal(this.config.initialEnergyMean, this.config.initialEnergyStdDev)
      );

      const params: CreateEntityParams = {
        nodeId: node.id,
        energy,
        stateCapacity: 256,
        behaviorRule: BehaviorRule.random(rng),
        perceptionRange: 1,
      };

      const entity = createEntity(params, rng);
      entities.push(entity);
    }

    return entities;
  }

  /**
   * 設定取得
   */
  getConfig(): WorldGenConfig {
    return { ...this.config };
  }
}
