/**
 * ReactionEngine - 化学反応の処理
 * Requirements: 4.1, 4.2, 4.3, 4.4, 5.2
 * 
 * 公理21: 化学反応（Reaction）
 * - タイプの組み合わせで新しいタイプが生まれうる
 * - 反応ルールはseed依存（経路依存）
 * - エネルギー保存則: 質量-エネルギー変換（E=mc²）に基づく
 */

import { Entity } from './entity.js';
import { TypeRegistry, ReactionResult } from './type-registry.js';
import { RandomGenerator } from './random.js';
import { ENERGY_MASS_CONVERSION_RATE } from './energy.js';

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
  /** 質量変化（正=質量減少=エネルギー放出） */
  massDelta: number;
  /** エネルギー変化（質量変化から計算） */
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
   * 
   * エネルギー保存則:
   * - 反応前の総エネルギー = E1 + E2 + (m1 + m2) * c
   * - 反応後の総エネルギー = E_products + m_products * c
   * - 質量が減少すればエネルギーが放出される（発熱反応）
   * - 質量が増加すればエネルギーが吸収される（吸熱反応）
   */
  executeReaction(
    entity1: Entity,
    entity2: Entity,
    result: ReactionResult
  ): {
    productsInfo: Array<{ type: number; mass: number; energy: number }>;
    totalEnergyChange: number;
    massDelta: number;
  } {
    // 反応物の総エネルギーと質量
    const totalInputEnergy = entity1.energy + entity2.energy;
    const totalInputMass = (entity1.mass ?? 1) + (entity2.mass ?? 1);

    // 生成物の質量を計算
    const productCount = result.products.length;
    const productsInfo: Array<{ type: number; mass: number; energy: number }> = [];
    let totalOutputMass = 0;

    for (const productType of result.products) {
      const props = this.registry.getTypeProperties(productType);
      const productMass = props.baseMass;
      totalOutputMass += productMass;
      productsInfo.push({
        type: productType,
        mass: productMass,
        energy: 0, // 後で計算
      });
    }

    // 質量変化からエネルギー変化を計算（E=mc²）
    const massDelta = totalInputMass - totalOutputMass;
    const energyFromMass = massDelta * ENERGY_MASS_CONVERSION_RATE;

    // 総エネルギーを保存
    const totalOutputEnergy = totalInputEnergy + energyFromMass;

    // 生成物にエネルギーを分配
    const energyPerProduct = Math.max(0, totalOutputEnergy / productCount);
    for (const product of productsInfo) {
      product.energy = energyPerProduct;
    }

    return {
      productsInfo,
      totalEnergyChange: energyFromMass,
      massDelta,
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
    result: ReactionResult,
    massDelta: number,
    energyDelta: number
  ): ReactionEvent {
    return {
      tick,
      nodeId,
      reactantIds: [entity1.id, entity2.id],
      reactantTypes: [entity1.type ?? -1, entity2.type ?? -1],
      productTypes: result.products,
      massDelta,
      energyDelta,
    };
  }
}

// ReactionResultをre-export
export type { ReactionResult } from './type-registry.js';
