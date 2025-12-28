/**
 * TypeRegistry - タイプ性質と反応テーブルの管理
 * Requirements: 5.1, 5.2, 5.3, 6.4
 * 
 * 公理19: 物質の多様性（Material Diversity）
 * 公理21: 化学反応（Reaction）
 */

import { TypeProperties, serializeTypeProperties, deserializeTypeProperties } from './type-properties.js';
import { RandomGenerator } from './random.js';

/**
 * 反応結果
 * エネルギー保存則: energyDeltaは廃止し、質量変化から計算
 */
export interface ReactionResult {
  /** 反応物のタイプリスト */
  reactants: number[];
  /** 生成物のタイプリスト */
  products: number[];
  /** 反応確率（0.0-1.0） */
  probability: number;
  /** 
   * @deprecated エネルギー保存則のため廃止。質量変化から計算する。
   * 互換性のため残すが、使用しない。
   */
  energyDelta?: number;
}

/**
 * 反応キーを生成（タイプの組み合わせをソートして文字列化）
 */
function createReactionKey(type1: number, type2: number): string {
  const sorted = [type1, type2].sort((a, b) => a - b);
  return `${sorted[0]}-${sorted[1]}`;
}

/**
 * TypeRegistry - タイプ性質と反応テーブルを管理
 */
export class TypeRegistry {
  /** 最大タイプ数 */
  readonly maxTypes: number;
  /** タイプ性質マップ */
  private properties: Map<number, TypeProperties>;
  /** 反応テーブル */
  private reactionTable: Map<string, ReactionResult>;
  /** 乱数生成器 */
  private rng: RandomGenerator;

  constructor(maxTypes: number, rng: RandomGenerator) {
    this.maxTypes = maxTypes;
    this.properties = new Map();
    this.reactionTable = new Map();
    this.rng = rng;

    // 全タイプの性質を初期化
    for (let i = 0; i < maxTypes; i++) {
      this.properties.set(i, this.generateTypeProperties(i));
    }
  }

  /**
   * タイプ性質を生成（seed依存で決定論的）
   */
  private generateTypeProperties(typeId: number): TypeProperties {
    return {
      typeId,
      baseMass: Math.floor(1 + this.rng.random() * 9),  // 1-10
      harvestEfficiency: 0.5 + this.rng.random() * 1.5,  // 0.5-2.0
      reactivity: this.rng.random(),                      // 0.0-1.0
      stability: this.rng.random(),                       // 0.0-1.0
    };
  }

  /**
   * タイプ性質を取得
   */
  getTypeProperties(typeId: number): TypeProperties {
    const props = this.properties.get(typeId);
    if (!props) {
      throw new Error(`Unknown type: ${typeId}`);
    }
    return props;
  }

  /**
   * 反応結果を取得（存在しなければ生成）
   */
  getReaction(type1: number, type2: number): ReactionResult {
    const key = createReactionKey(type1, type2);
    
    let result = this.reactionTable.get(key);
    if (!result) {
      result = this.generateReaction(type1, type2);
      this.reactionTable.set(key, result);
    }
    
    return result;
  }

  /**
   * 反応結果を生成（seed依存で決定論的）
   * エネルギー保存則: energyDeltaは廃止、質量変化から計算
   */
  private generateReaction(type1: number, type2: number): ReactionResult {
    const reactants = [type1, type2].sort((a, b) => a - b);
    
    // 30%の確率で反応なし
    if (this.rng.random() < 0.3) {
      return {
        reactants,
        products: [...reactants],  // 変化なし
        probability: 0,
      };
    }

    // 生成物を決定（1-2個）
    const productCount = 1 + Math.floor(this.rng.random() * 2);
    const products: number[] = [];
    
    for (let i = 0; i < productCount; i++) {
      if (this.rng.random() < 0.5) {
        // 反応物のどちらかを継承
        products.push(reactants[Math.floor(this.rng.random() * 2)]!);
      } else {
        // 新しいタイプを生成
        products.push(Math.floor(this.rng.random() * this.maxTypes));
      }
    }

    return {
      reactants,
      products,
      probability: 0.1 + this.rng.random() * 0.5,    // 0.1-0.6
    };
  }

  /**
   * 反応テーブルのサイズを取得
   */
  getReactionTableSize(): number {
    return this.reactionTable.size;
  }

  /**
   * 全タイプ性質を取得
   */
  getAllTypeProperties(): TypeProperties[] {
    return Array.from(this.properties.values());
  }

  /**
   * 反応テーブルをエクスポート
   */
  exportReactionTable(): ReactionResult[] {
    return Array.from(this.reactionTable.values());
  }

  /**
   * シリアライズ
   */
  serialize(): object {
    return {
      maxTypes: this.maxTypes,
      properties: Array.from(this.properties.entries()).map(([id, props]) => ({
        id,
        props: serializeTypeProperties(props),
      })),
      reactionTable: Array.from(this.reactionTable.entries()).map(([key, result]) => ({
        key,
        result,
      })),
    };
  }

  /**
   * デシリアライズ
   */
  static deserialize(
    data: {
      maxTypes: number;
      properties: Array<{ id: number; props: TypeProperties }>;
      reactionTable: Array<{ key: string; result: ReactionResult }>;
    },
    rng: RandomGenerator
  ): TypeRegistry {
    const registry = new TypeRegistry(data.maxTypes, rng);
    
    // 性質を復元
    registry.properties.clear();
    for (const { id, props } of data.properties) {
      registry.properties.set(id, deserializeTypeProperties(props));
    }
    
    // 反応テーブルを復元
    registry.reactionTable.clear();
    for (const { key, result } of data.reactionTable) {
      registry.reactionTable.set(key, result);
    }
    
    return registry;
  }
}
