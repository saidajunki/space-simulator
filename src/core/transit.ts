/**
 * Transit System - 遅延と輸送
 * Requirements: 4.2, 4.3, 4.4, 4.5
 */

import { NodeId, EntityId, TransitItemType } from './types.js';
import { Edge, TransitItem } from './edge.js';
import { Space } from './space.js';
import { Entity } from './entity.js';

/** 基本質量単位（移動コスト計算用） */
export const BASE_MASS_UNIT = 5;

/**
 * 質量ベースの移動コストを計算
 * 公理20: 質量が大きいほど移動コストが高い
 * 
 * @param entity エンティティ
 * @param baseCost 基本移動コスト
 * @returns 質量を考慮した移動コスト
 */
export function calculateMovementCost(entity: Entity, baseCost: number): number {
  const massFactor = 1 + (entity.mass ?? 1) / BASE_MASS_UNIT;
  return Math.ceil(baseCost * massFactor);
}

/**
 * 輸送システム
 */
export class TransitSystem {
  /**
   * アイテムを輸送開始
   */
  startTransit(
    edge: Edge,
    type: TransitItemType,
    payload: EntityId | number | Uint8Array,
    currentTick: number,
    from: NodeId,
    to: NodeId
  ): boolean {
    // 容量チェック
    if (edge.inTransit.length >= edge.attributes.capacity) {
      return false;
    }

    const item: TransitItem = {
      type,
      payload,
      departedAt: currentTick,
      arrivalAt: currentTick + edge.attributes.travelTime,
      from,
      to,
    };

    edge.inTransit.push(item);
    return true;
  }

  /**
   * 到着したアイテムを処理
   */
  processArrivals(space: Space, currentTick: number): TransitItem[] {
    const arrivedItems: TransitItem[] = [];

    for (const edge of space.getAllEdges()) {
      const stillInTransit: TransitItem[] = [];

      for (const item of edge.inTransit) {
        if (item.arrivalAt <= currentTick) {
          arrivedItems.push(item);
        } else {
          stillInTransit.push(item);
        }
      }

      edge.inTransit = stillInTransit;
    }

    return arrivedItems;
  }

  /**
   * 特定のエッジの輸送中アイテムを取得
   */
  getInTransit(edge: Edge): TransitItem[] {
    return [...edge.inTransit];
  }

  /**
   * 輸送中のアイテム数を取得
   */
  getTransitCount(space: Space): number {
    let count = 0;
    for (const edge of space.getAllEdges()) {
      count += edge.inTransit.length;
    }
    return count;
  }

  /**
   * 特定タイプの輸送中アイテムを取得
   */
  getInTransitByType(space: Space, type: TransitItemType): TransitItem[] {
    const items: TransitItem[] = [];
    for (const edge of space.getAllEdges()) {
      for (const item of edge.inTransit) {
        if (item.type === type) {
          items.push(item);
        }
      }
    }
    return items;
  }
}
