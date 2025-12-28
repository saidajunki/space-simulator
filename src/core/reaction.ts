/**
 * ReactionEngine - 化学反応の処理
 * Requirements: 4.1, 4.2, 4.3, 4.4, 5.2
 * 
 * 公理21: 化学反応（Reaction）
 * - タイプの組み合わせで新しいタイプが生まれうる
 * - 反応ルールはseed依存（経路依存）
 */

import { Entity } from './entity.js';
import { TypeRegistry, ReactionResult } from './type-registry.js';
import { RandomGenerator } from './random.js';

/**
 * 反応イベント（ログ用）
 */
export interface ReactionEvent {
  /** 反応が起きたtick */
  tick: number;
  /** 反応が起きたノードID */
  nodeId: string;
  /** 反応物エンティティID */
  reactantIds: string[];
  /** 反応物タイプ */
  reactantTypes: number[];
  /** 生成物タイプ */
  productTypes: number[];
  /** エネルギー変化 */
  energyDelta: number;
}

/**
 * 反応チェック結果
 */
export interface ReactionCheckResult {
  /** 反応が起きるか */
  willReact: boolean;
  /** 反応結果（反応が起きる場合） */
  result?: ReactionResult;
}

/**
 * ReactionEngine - 化学反応を処理
 */
export class ReactionEngine {
  private registry: TypeRegistry;

  constructor(registry: TypeRegistry) {
    this.registry = registry;
  }

  /**
   * 2つのエンティティ間で反応が起きるかチェック
   */
  checkReaction(
    entity1: Entity,
    entity2: Entity,
    rng: RandomGenerator
  ): ReactionCheckResult {
    // タイプが未定義の場合は反応しない
    if (entity1.type === undefined || entity2.type === undefined) {
      return { willReact: false };
    }

    // 反応結果を取得（存在しなければ生成）
    const result = this.registry.getReaction(entity1.type, entity2.type);

    // 反応確率が0なら反応しない
    if (result.probability === 0) {
      return { willReact: false };
    }

    // 反応性を考慮した確率計算
    const props1 = this.registry.getTypeProperties(entity1.type);
    const props2 = this.registry.getTypeProperties(entity2.type);
    const avgReactivity = (props1.reactivity + props2.reactivity) / 2;
    const effectiveProbability = result.probability * avgReactivity;

    // 確率的に反応が起きるか判定
    if (rng.random() < effectiveProbability) {
      return { willReact: true, result };
    }

    return { willReact: false };
  }

  /**
   * 反応を実行し、生成物エンティティの情報を返す
   * 実際のエンティティ生成・削除はUniverse側で行う
   */
  executeReaction(
    entity1: Entity,
    entity2: Entity,
    result: ReactionResult
  ): {
    productsInfo: Array<{ type: number; mass: number; energy: number }>;
    totalEnergyChange: number;
  } {
    // 反応物の総エネルギーと質量
    const totalEnergy = entity1.energy + entity2.energy + result.energyDelta;
    const totalMass = (entity1.mass ?? 1) + (entity2.mass ?? 1);

    // 生成物の情報を計算
    const productsInfo: Array<{ type: number; mass: number; energy: number }> = [];
    const productCount = result.products.length;

    for (const productType of result.products) {
      const props = this.registry.getTypeProperties(productType);
      productsInfo.push({
        type: productType,
        mass: Math.max(1, Math.floor(totalMass / productCount)),
        energy: Math.max(0, Math.floor(totalEnergy / productCount)),
      });
    }

    return {
      productsInfo,
      totalEnergyChange: result.energyDelta,
    };
  }

  /**
   * 反応イベントを作成
   */
  createReactionEvent(
    tick: number,
    nodeId: string,
    entity1: Entity,
    entity2: Entity,
    result: ReactionResult
  ): ReactionEvent {
    return {
      tick,
      nodeId,
      reactantIds: [entity1.id, entity2.id],
      reactantTypes: [entity1.type ?? -1, entity2.type ?? -1],
      productTypes: result.products,
      energyDelta: result.energyDelta,
    };
  }
}

// ReactionResultをre-export
export type { ReactionResult } from './type-registry.js';
