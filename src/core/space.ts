/**
 * Space - グラフ構造の空間
 * Requirements: 1.1, 1.4, 1.5
 */

import { NodeId, EdgeId, createEdgeId } from './types.js';
import { Node } from './node.js';
import { Edge } from './edge.js';

/**
 * 経路情報
 */
export interface Path {
  /** 経路上のノードID（始点から終点まで） */
  nodes: NodeId[];
  /** 総距離 */
  totalDistance: number;
  /** 総移動時間 */
  totalTravelTime: number;
}

/**
 * Space - グラフ構造の空間
 */
export class Space {
  /** ノードのマップ */
  private nodes: Map<NodeId, Node> = new Map();
  /** エッジのマップ */
  private edges: Map<EdgeId, Edge> = new Map();
  /** 隣接リスト（ノードID -> 隣接エッジID[]） */
  private adjacency: Map<NodeId, EdgeId[]> = new Map();

  /**
   * ノードを追加
   */
  addNode(node: Node): void {
    this.nodes.set(node.id, node);
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, []);
    }
  }

  /**
   * エッジを追加
   */
  addEdge(edge: Edge): void {
    // 両端のノードが存在するか確認
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
      throw new Error(`Edge ${edge.id} references non-existent node`);
    }

    this.edges.set(edge.id, edge);

    // 隣接リストを更新（双方向）
    const fromAdj = this.adjacency.get(edge.from) ?? [];
    fromAdj.push(edge.id);
    this.adjacency.set(edge.from, fromAdj);

    const toAdj = this.adjacency.get(edge.to) ?? [];
    toAdj.push(edge.id);
    this.adjacency.set(edge.to, toAdj);
  }

  /**
   * ノードを取得
   */
  getNode(id: NodeId): Node | undefined {
    return this.nodes.get(id);
  }

  /**
   * エッジを取得
   */
  getEdge(id: EdgeId): Edge | undefined {
    return this.edges.get(id);
  }

  /**
   * 2ノード間のエッジを取得
   */
  getEdgeBetween(from: NodeId, to: NodeId): Edge | undefined {
    const edgeIds = this.adjacency.get(from) ?? [];
    for (const edgeId of edgeIds) {
      const edge = this.edges.get(edgeId);
      if (edge && ((edge.from === from && edge.to === to) || (edge.from === to && edge.to === from))) {
        return edge;
      }
    }
    return undefined;
  }

  /**
   * 隣接ノードを取得
   */
  getNeighbors(nodeId: NodeId): Node[] {
    const edgeIds = this.adjacency.get(nodeId) ?? [];
    const neighbors: Node[] = [];

    for (const edgeId of edgeIds) {
      const edge = this.edges.get(edgeId);
      if (edge) {
        const neighborId = edge.from === nodeId ? edge.to : edge.from;
        const neighbor = this.nodes.get(neighborId);
        if (neighbor) {
          neighbors.push(neighbor);
        }
      }
    }

    return neighbors;
  }

  /**
   * 全ノードを取得
   */
  getAllNodes(): Node[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 全エッジを取得
   */
  getAllEdges(): Edge[] {
    return Array.from(this.edges.values());
  }

  /**
   * ノード数を取得
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * エッジ数を取得
   */
  getEdgeCount(): number {
    return this.edges.size;
  }

  /**
   * 2ノード間の距離を計算
   */
  distance(from: NodeId, to: NodeId): number {
    if (from === to) return 0;
    const path = this.shortestPath(from, to);
    return path?.totalDistance ?? Infinity;
  }

  /**
   * 最短経路を計算（ダイクストラ法）
   */
  shortestPath(from: NodeId, to: NodeId): Path | null {
    if (from === to) {
      return { nodes: [from], totalDistance: 0, totalTravelTime: 0 };
    }

    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      return null;
    }

    // ダイクストラ法
    const distances = new Map<NodeId, number>();
    const travelTimes = new Map<NodeId, number>();
    const previous = new Map<NodeId, NodeId>();
    const visited = new Set<NodeId>();

    // 初期化
    for (const nodeId of this.nodes.keys()) {
      distances.set(nodeId, Infinity);
      travelTimes.set(nodeId, Infinity);
    }
    distances.set(from, 0);
    travelTimes.set(from, 0);

    // 未訪問ノードから最小距離のノードを選択
    const getMinDistanceNode = (): NodeId | null => {
      let minDist = Infinity;
      let minNode: NodeId | null = null;
      for (const [nodeId, dist] of distances) {
        if (!visited.has(nodeId) && dist < minDist) {
          minDist = dist;
          minNode = nodeId;
        }
      }
      return minNode;
    };

    while (true) {
      const current = getMinDistanceNode();
      if (current === null) break;
      if (current === to) break;

      visited.add(current);
      const currentDist = distances.get(current) ?? Infinity;
      const currentTime = travelTimes.get(current) ?? Infinity;

      // 隣接ノードを更新
      const edgeIds = this.adjacency.get(current) ?? [];
      for (const edgeId of edgeIds) {
        const edge = this.edges.get(edgeId);
        if (!edge) continue;

        const neighborId = edge.from === current ? edge.to : edge.from;
        if (visited.has(neighborId)) continue;

        const newDist = currentDist + edge.attributes.distance;
        const newTime = currentTime + edge.attributes.travelTime;

        if (newDist < (distances.get(neighborId) ?? Infinity)) {
          distances.set(neighborId, newDist);
          travelTimes.set(neighborId, newTime);
          previous.set(neighborId, current);
        }
      }
    }

    // 経路が見つからない場合
    if (!previous.has(to) && from !== to) {
      return null;
    }

    // 経路を復元
    const nodes: NodeId[] = [];
    let current: NodeId | undefined = to;
    while (current !== undefined) {
      nodes.unshift(current);
      current = previous.get(current);
    }

    return {
      nodes,
      totalDistance: distances.get(to) ?? Infinity,
      totalTravelTime: travelTimes.get(to) ?? Infinity,
    };
  }

  /**
   * グラフが連結かどうかを確認
   */
  isConnected(): boolean {
    if (this.nodes.size === 0) return true;
    if (this.nodes.size === 1) return true;

    const visited = new Set<NodeId>();
    const startNode = this.nodes.keys().next().value as NodeId;
    const queue: NodeId[] = [startNode];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = this.getNeighbors(current);
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.id)) {
          queue.push(neighbor.id);
        }
      }
    }

    return visited.size === this.nodes.size;
  }
}
