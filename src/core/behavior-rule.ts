/**
 * BehaviorRule - 遺伝子ベースの行動決定
 * Requirements: 8.5, 11.2, 11.3
 */

import { RandomGenerator } from './random.js';

/**
 * 遺伝子インデックス（閾値パラメータ）
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

/** 閾値遺伝子の数 */
export const GENE_COUNT = 8;

/**
 * 知覚特徴量インデックス
 */
export enum FeatureIndex {
  /** 自身のエネルギー（正規化） */
  SelfEnergy = 0,
  /** 現在ノードの資源量（正規化） */
  CurrentResources = 1,
  /** 近隣ノードの最大資源量（正規化） */
  MaxNeighborResources = 2,
  /** 近くのエンティティ数（正規化） */
  NearbyEntityCount = 3,
  /** 現在ノードのBeacon強度（正規化） */
  CurrentBeacon = 4,
  /** 近隣ノードの最大Beacon強度（正規化） */
  MaxNeighborBeacon = 5,
  /** 近くの劣化アーティファクト有無 */
  HasDamagedArtifact = 6,
  /** 維持者ステータス */
  IsMaintainer = 7,
  /** State特徴量0（情報→行動接続） */
  StateFeature0 = 8,
  /** State特徴量1（情報→行動接続） */
  StateFeature1 = 9,
  /** State特徴量2（情報→行動接続） */
  StateFeature2 = 10,
  /** State特徴量3（情報→行動接続） */
  StateFeature3 = 11,
  /** バイアス項（常に1） */
  Bias = 12,
}

/** 特徴量の数 */
export const FEATURE_COUNT = 13;

/**
 * 行動タイプインデックス
 */
export enum ActionIndex {
  Idle = 0,
  Harvest = 1,
  MoveToResource = 2,
  MoveToBeacon = 3,
  Explore = 4,
  Interact = 5,
  Replicate = 6,
  CreateArtifact = 7,
  RepairArtifact = 8,
}

/** 行動の数 */
export const ACTION_COUNT = 9;

/** 行動重み遺伝子の数 */
export const ACTION_WEIGHT_COUNT = FEATURE_COUNT * ACTION_COUNT;

/**
 * BehaviorRule - 遺伝子ベースの行動ルール
 */
export class BehaviorRule {
  /** 閾値遺伝子（0-1の値） */
  readonly genes: Float32Array;
  /** 行動重み遺伝子（特徴量×行動の重み行列） */
  readonly actionWeights: Float32Array;

  /**
   * コンストラクタ
   */
  constructor(genes?: Float32Array, actionWeights?: Float32Array) {
    if (genes) {
      if (genes.length !== GENE_COUNT) {
        throw new Error(`Gene count must be ${GENE_COUNT}, got ${genes.length}`);
      }
      this.genes = new Float32Array(genes);
    } else {
      this.genes = new Float32Array(GENE_COUNT);
    }

    if (actionWeights) {
      if (actionWeights.length !== ACTION_WEIGHT_COUNT) {
        throw new Error(`Action weight count must be ${ACTION_WEIGHT_COUNT}, got ${actionWeights.length}`);
      }
      this.actionWeights = new Float32Array(actionWeights);
    } else {
      this.actionWeights = new Float32Array(ACTION_WEIGHT_COUNT);
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

    const actionWeights = new Float32Array(ACTION_WEIGHT_COUNT);
    // 初期重みは0（バイアスのみで制御）
    for (let i = 0; i < ACTION_WEIGHT_COUNT; i++) {
      actionWeights[i] = 0;
    }

    // 初期バイアスを設定（生存に必要な基本行動を優先）
    
    // Harvest: 最優先（エネルギー低い時に高スコア、資源があれば高スコア）
    actionWeights[ActionIndex.Harvest * FEATURE_COUNT + FeatureIndex.SelfEnergy] = -4; // 低エネルギーで高
    actionWeights[ActionIndex.Harvest * FEATURE_COUNT + FeatureIndex.CurrentResources] = 4; // 資源あれば高
    actionWeights[ActionIndex.Harvest * FEATURE_COUNT + FeatureIndex.Bias] = 2;

    // MoveToResource: 資源探索（現在地に資源がなく、近隣にある時）
    actionWeights[ActionIndex.MoveToResource * FEATURE_COUNT + FeatureIndex.SelfEnergy] = -3;
    actionWeights[ActionIndex.MoveToResource * FEATURE_COUNT + FeatureIndex.CurrentResources] = -3;
    actionWeights[ActionIndex.MoveToResource * FEATURE_COUNT + FeatureIndex.MaxNeighborResources] = 4;
    actionWeights[ActionIndex.MoveToResource * FEATURE_COUNT + FeatureIndex.Bias] = 0;

    // Replicate: エネルギーがある程度あれば複製
    actionWeights[ActionIndex.Replicate * FEATURE_COUNT + FeatureIndex.SelfEnergy] = 4;
    actionWeights[ActionIndex.Replicate * FEATURE_COUNT + FeatureIndex.Bias] = -2;

    // Idle: 基本的に低スコア
    actionWeights[ActionIndex.Idle * FEATURE_COUNT + FeatureIndex.Bias] = -3;

    // Explore: 探索（低確率）
    actionWeights[ActionIndex.Explore * FEATURE_COUNT + FeatureIndex.Bias] = -2;

    // RepairArtifact: 劣化アーティファクトがある時のみ（エネルギー余裕がある時）
    actionWeights[ActionIndex.RepairArtifact * FEATURE_COUNT + FeatureIndex.HasDamagedArtifact] = 3;
    actionWeights[ActionIndex.RepairArtifact * FEATURE_COUNT + FeatureIndex.SelfEnergy] = 3;
    actionWeights[ActionIndex.RepairArtifact * FEATURE_COUNT + FeatureIndex.Bias] = -5;

    // CreateArtifact: 非常に低確率（エネルギー非常に高い時のみ）
    actionWeights[ActionIndex.CreateArtifact * FEATURE_COUNT + FeatureIndex.SelfEnergy] = 2;
    actionWeights[ActionIndex.CreateArtifact * FEATURE_COUNT + FeatureIndex.Bias] = -8;

    // Interact: 近くにエンティティがいる時（低優先度）
    actionWeights[ActionIndex.Interact * FEATURE_COUNT + FeatureIndex.NearbyEntityCount] = 2;
    actionWeights[ActionIndex.Interact * FEATURE_COUNT + FeatureIndex.Bias] = -3;

    // MoveToBeacon: Beaconに引き寄せられる（低優先度）
    actionWeights[ActionIndex.MoveToBeacon * FEATURE_COUNT + FeatureIndex.MaxNeighborBeacon] = 2;
    actionWeights[ActionIndex.MoveToBeacon * FEATURE_COUNT + FeatureIndex.CurrentBeacon] = -1;
    actionWeights[ActionIndex.MoveToBeacon * FEATURE_COUNT + FeatureIndex.Bias] = -3;

    // 小さなランダムノイズを追加（多様性のため）
    for (let i = 0; i < ACTION_WEIGHT_COUNT; i++) {
      actionWeights[i] = (actionWeights[i] ?? 0) + (rng.random() - 0.5) * 0.5;
    }

    return new BehaviorRule(genes, actionWeights);
  }

  /**
   * 遺伝子の値を取得
   */
  getGene(index: GeneIndex): number {
    return this.genes[index] ?? 0;
  }

  /**
   * 行動重みを取得
   */
  getActionWeight(actionIndex: ActionIndex, featureIndex: FeatureIndex): number {
    return this.actionWeights[actionIndex * FEATURE_COUNT + featureIndex] ?? 0;
  }

  /**
   * 特徴量から各行動のスコアを計算
   */
  computeActionScores(features: Float32Array): Float32Array {
    const scores = new Float32Array(ACTION_COUNT);
    for (let a = 0; a < ACTION_COUNT; a++) {
      let score = 0;
      for (let f = 0; f < FEATURE_COUNT; f++) {
        score += this.actionWeights[a * FEATURE_COUNT + f]! * features[f]!;
      }
      scores[a] = score;
    }
    return scores;
  }

  /**
   * Softmax確率を計算
   */
  static softmax(scores: Float32Array, temperature: number = 1.0): Float32Array {
    const probs = new Float32Array(scores.length);
    let maxScore = -Infinity;
    for (let i = 0; i < scores.length; i++) {
      if (scores[i]! > maxScore) maxScore = scores[i]!;
    }
    
    let sumExp = 0;
    for (let i = 0; i < scores.length; i++) {
      const exp = Math.exp((scores[i]! - maxScore) / temperature);
      probs[i] = exp;
      sumExp += exp;
    }
    
    for (let i = 0; i < probs.length; i++) {
      probs[i] = probs[i]! / sumExp;
    }
    
    return probs;
  }

  /**
   * 継承（単独親）
   */
  inherit(rng: RandomGenerator, mutationRate: number): BehaviorRule {
    const newGenes = new Float32Array(GENE_COUNT);
    for (let i = 0; i < GENE_COUNT; i++) {
      let value = this.genes[i] ?? 0;
      if (rng.randomWithProbability(mutationRate)) {
        value = Math.max(0, Math.min(1, value + rng.randomNormal(0, 0.1)));
      }
      newGenes[i] = value;
    }

    const newWeights = new Float32Array(ACTION_WEIGHT_COUNT);
    for (let i = 0; i < ACTION_WEIGHT_COUNT; i++) {
      let value = this.actionWeights[i] ?? 0;
      if (rng.randomWithProbability(mutationRate)) {
        value = value + rng.randomNormal(0, 0.2);
      }
      newWeights[i] = value;
    }

    return new BehaviorRule(newGenes, newWeights);
  }

  /**
   * 継承（両親）
   */
  inheritFrom(other: BehaviorRule, rng: RandomGenerator, mutationRate: number): BehaviorRule {
    const newGenes = new Float32Array(GENE_COUNT);
    for (let i = 0; i < GENE_COUNT; i++) {
      const parentValue = rng.randomWithProbability(0.5)
        ? (this.genes[i] ?? 0)
        : (other.genes[i] ?? 0);
      let value = parentValue;
      if (rng.randomWithProbability(mutationRate)) {
        value = Math.max(0, Math.min(1, value + rng.randomNormal(0, 0.1)));
      }
      newGenes[i] = value;
    }

    const newWeights = new Float32Array(ACTION_WEIGHT_COUNT);
    for (let i = 0; i < ACTION_WEIGHT_COUNT; i++) {
      const parentValue = rng.randomWithProbability(0.5)
        ? (this.actionWeights[i] ?? 0)
        : (other.actionWeights[i] ?? 0);
      let value = parentValue;
      if (rng.randomWithProbability(mutationRate)) {
        value = value + rng.randomNormal(0, 0.2);
      }
      newWeights[i] = value;
    }

    return new BehaviorRule(newGenes, newWeights);
  }

  /**
   * コピーを作成
   */
  clone(): BehaviorRule {
    return new BehaviorRule(this.genes, this.actionWeights);
  }

  /**
   * シリアライズ
   */
  serialize(): number[] {
    return [...Array.from(this.genes), ...Array.from(this.actionWeights)];
  }

  /**
   * デシリアライズ
   */
  static deserialize(data: number[]): BehaviorRule {
    if (data.length === GENE_COUNT) {
      // 旧形式（閾値遺伝子のみ）
      return new BehaviorRule(new Float32Array(data));
    }
    const genes = new Float32Array(data.slice(0, GENE_COUNT));
    const weights = new Float32Array(data.slice(GENE_COUNT));
    return new BehaviorRule(genes, weights);
  }
}
