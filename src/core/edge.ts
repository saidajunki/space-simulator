/**
 * Edge - ノード間の移動/通信ルート
 * Requirements: 1.3, 7.6
 */

import { EdgeId, NodeId, TransitItemType, EntityId } from './types.js';

/**
 * エッジ属性
 */
export interface EdgeAttributes {
  /** 距離（移動コストの基準） */
  distance: number;
  /** 移動時間（tick数） */
  travelTime: number;
  /** 輸送容量（同時に移動できるアイテム数） */
  capacity: number;
  /** 危険度 (0 ~ 1) */
  dangerLevel: number;
  /** 耐久度 (0 ~ 100、劣化で減少) */
  durability: number;
}

/**
 * 移動中アイテム
 */
export interface TransitItem {
  /** アイテムタイプ */
  type: TransitItemType;
  /** ペイロード（エンティティID、資源量、情報データなど） */
  payload: EntityId | number | Uint8Array;
  /** 出発tick */
  departedAt: number;
  /** 到着予定tick */
  arrivalAt: number;
  /** 出発ノード */
  from: NodeId;
  /** 到着ノード */
  to: NodeId;
}

/**
 * エッジ - ノード間の移動/通信ルート
 */
export interface Edge {
  /** 一意のID */
  id: EdgeId;
  /** 始点ノードID */
  from: NodeId;
  /** 終点ノードID */
  to: NodeId;
  /** 属性 */
  attributes: EdgeAttributes;
  /** 移動中のアイテム */
  inTransit: TransitItem[];
}

/**
 * エッジ生成パラメータ
 */
export interface CreateEdgeParams {
  id: EdgeId;
  from: NodeId;
  to: NodeId;
  distance?: number;
  travelTime?: number;
  capacity?: number;
  dangerLevel?: number;
  durability?: number;
}

/**
 * エッジを生成する
 */
export function createEdge(params: CreateEdgeParams): Edge {
  const {
    id,
    from,
    to,
    distance = 1,
    travelTime = 1,
    capacity = 10,
    dangerLevel = 0,
    durability = 100,
  } = params;

  return {
    id,
    from,
    to,
    attributes: {
      distance,
      travelTime,
      capacity,
      dangerLevel,
      durability,
    },
    inTransit: [],
  };
}

/**
 * エッジの現在の使用量を取得
 */
export function getEdgeUsage(edge: Edge): number {
  return edge.inTransit.length;
}

/**
 * エッジに空きがあるか確認
 */
export function hasEdgeCapacity(edge: Edge): boolean {
  return edge.inTransit.length < edge.attributes.capacity;
}
