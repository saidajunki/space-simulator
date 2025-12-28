/**
 * BehaviorRule - 遺伝子ベースの行動決定
 * Requirements: 8.5, 11.2, 11.3
 */

import { RandomGenerator } from './random.js';

/**
 * 遺伝子インデックス
 */
export enum GeneIndex {
  /** 飢餓閾値（エネルギーがこの割合以下で資源探索） */
  HungerThreshold = 0,
  /** 社会性（他エンティティとの相互作用傾向） */
  Sociality = 1,
  /** 探索性（ランダム移動傾向） */
  Exploration = 2,
  /** 複製閾値（エネルギーがこの割合以上で複製） */
  ReplicationThreshold = 3,
  /** 攻撃性（競争的相互作用傾向） */
  Aggression = 4,
  /** 協力性（協力的相互作用傾向） */
  Cooperation = 5,
  /** アーティファクト生成傾向 */
  ArtifactCreation = 6,
  /** 移動速度係数 */
  MoveSpeed = 7,
}

/** 遺伝子の数 */
export const GENE_COUNT = 8;

/**
 * BehaviorRule - 遺伝子ベースの行動ルール
 */
export class BehaviorRule {
  /** 遺伝子（0-1の値） */
  readonly genes: Float32Array;

  /**
   * コンストラクタ
   * @param genes 遺伝子配列
   */
  constructor(genes?: Float32Array) {
    if (genes) {
      if (genes.length !== GENE_COUNT) {
        throw new Error(`Gene count must be ${GENE_COUNT}, got ${genes.length}`);
      }
      this.genes = new Float32Array(genes);
    } else {
      this.genes = new Float32Array(GENE_COUNT);
    }
  }

  /**
   * ランダムな遺伝子で初期化
   */
  static random(rng: RandomGenerator): BehaviorRule {
    const genes = new Float32Array(GENE_COUNT);
    for (let i = 0; i < GENE_COUNT; i++) {
      genes[i] = rng.random();
    }
    return new BehaviorRule(genes);
  }

  /**
   * 遺伝子の値を取得
   */
  getGene(index: GeneIndex): number {
    return this.genes[index] ?? 0;
  }

  /**
   * 継承（単独親）
   */
  inherit(rng: RandomGenerator, mutationRate: number): BehaviorRule {
    const newGenes = new Float32Array(GENE_COUNT);
    for (let i = 0; i < GENE_COUNT; i++) {
      let value = this.genes[i] ?? 0;
      // 変異
      if (rng.randomWithProbability(mutationRate)) {
        value = Math.max(0, Math.min(1, value + rng.randomNormal(0, 0.1)));
      }
      newGenes[i] = value;
    }
    return new BehaviorRule(newGenes);
  }

  /**
   * 継承（両親）
   */
  inheritFrom(other: BehaviorRule, rng: RandomGenerator, mutationRate: number): BehaviorRule {
    const newGenes = new Float32Array(GENE_COUNT);
    for (let i = 0; i < GENE_COUNT; i++) {
      // 両親からランダムに選択
      const parentValue = rng.randomWithProbability(0.5)
        ? (this.genes[i] ?? 0)
        : (other.genes[i] ?? 0);
      
      let value = parentValue;
      // 変異
      if (rng.randomWithProbability(mutationRate)) {
        value = Math.max(0, Math.min(1, value + rng.randomNormal(0, 0.1)));
      }
      newGenes[i] = value;
    }
    return new BehaviorRule(newGenes);
  }

  /**
   * コピーを作成
   */
  clone(): BehaviorRule {
    return new BehaviorRule(this.genes);
  }

  /**
   * シリアライズ
   */
  serialize(): number[] {
    return Array.from(this.genes);
  }

  /**
   * デシリアライズ
   */
  static deserialize(data: number[]): BehaviorRule {
    return new BehaviorRule(new Float32Array(data));
  }
}
