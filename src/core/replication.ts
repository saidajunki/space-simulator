/**
 * Replication Engine - 複製と継承
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

import { Entity, createEntity } from './entity.js';
import { RandomGenerator } from './random.js';

/** タイプ変異率（公理19） */
const TYPE_MUTATION_RATE = 0.01;

/**
 * 複製設定
 */
export interface ReplicationConfig {
  /** 複製に必要なエネルギー */
  energyCost: number;
  /** 変異率 */
  mutationRate: number;
  /** 親から子へのエネルギー移転率 */
  energyTransferRate: number;
  /** 子の内部状態容量 */
  childStateCapacity: number;
  /** 協力複製のボーナス */
  cooperativeBonus: number;
  /** 最大タイプ数（タイプ変異用） */
  maxTypes: number;
}

/**
 * デフォルトの複製設定
 */
export const DEFAULT_REPLICATION_CONFIG: ReplicationConfig = {
  energyCost: 50,
  mutationRate: 0.1,
  energyTransferRate: 0.4,
  childStateCapacity: 256,
  cooperativeBonus: 1.2,
  maxTypes: 10,
};

/**
 * 複製結果
 */
export interface ReplicationResult {
  /** 成功したか */
  success: boolean;
  /** 生成された子エンティティ */
  child: Entity | null;
  /** 消費されたエネルギー */
  energyConsumed: number;
  /** 失敗理由 */
  failureReason?: string;
  /** タイプ変異が発生したか（公理19） */
  typeMutated?: boolean;
}

/**
 * タイプを継承（変異あり）
 * 公理19: 複製時にタイプが継承され、小確率で変異
 */
function inheritType(parentType: number, rng: RandomGenerator, maxTypes: number): { type: number; mutated: boolean } {
  if (rng.random() < TYPE_MUTATION_RATE) {
    return {
      type: rng.randomInt(0, maxTypes - 1),
      mutated: true,
    };
  }
  return {
    type: parentType,
    mutated: false,
  };
}

/**
 * 複製エンジン
 */
export class ReplicationEngine {
  private config: ReplicationConfig;

  constructor(config: Partial<ReplicationConfig> = {}) {
    this.config = { ...DEFAULT_REPLICATION_CONFIG, ...config };
  }

  /**
   * 単独複製
   */
  replicateAlone(parent: Entity, rng: RandomGenerator): ReplicationResult {
    // エネルギーチェック
    if (parent.energy < this.config.energyCost) {
      return {
        success: false,
        child: null,
        energyConsumed: 0,
        failureReason: 'Insufficient energy',
      };
    }

    // エネルギー消費
    parent.energy -= this.config.energyCost;

    // 子へのエネルギー移転
    const childEnergy = parent.energy * this.config.energyTransferRate;
    parent.energy -= childEnergy;

    // 行動ルールの継承と変異
    const childBehaviorRule = parent.behaviorRule.inherit(rng, this.config.mutationRate);

    // タイプの継承と変異（公理19）
    const { type: childType, mutated: typeMutated } = inheritType(
      parent.type ?? 0,
      rng,
      this.config.maxTypes
    );

    // 子エンティティ生成
    const child = createEntity({
      nodeId: parent.nodeId,
      energy: childEnergy,
      stateCapacity: this.config.childStateCapacity,
      behaviorRule: childBehaviorRule,
      perceptionRange: parent.perceptionRange,
      type: childType,
      mass: parent.mass ?? 1,
      composition: [childType],
    }, rng);

    return {
      success: true,
      child,
      energyConsumed: this.config.energyCost + childEnergy,
      typeMutated,
    };
  }

  /**
   * 協力複製（2親）
   */
  replicateWithPartner(
    parent1: Entity,
    parent2: Entity,
    rng: RandomGenerator
  ): ReplicationResult {
    // 同一ノードチェック
    if (parent1.nodeId !== parent2.nodeId) {
      return {
        success: false,
        child: null,
        energyConsumed: 0,
        failureReason: 'Parents must be on the same node',
      };
    }

    // 各親のエネルギーコスト（半分ずつ）
    const costPerParent = this.config.energyCost / 2;

    if (parent1.energy < costPerParent || parent2.energy < costPerParent) {
      return {
        success: false,
        child: null,
        energyConsumed: 0,
        failureReason: 'Insufficient energy',
      };
    }

    // エネルギー消費
    parent1.energy -= costPerParent;
    parent2.energy -= costPerParent;

    // 子へのエネルギー移転（協力ボーナス付き）
    const transferRate = this.config.energyTransferRate * this.config.cooperativeBonus;
    const childEnergy1 = parent1.energy * (transferRate / 2);
    const childEnergy2 = parent2.energy * (transferRate / 2);
    parent1.energy -= childEnergy1;
    parent2.energy -= childEnergy2;
    const childEnergy = childEnergy1 + childEnergy2;

    // 行動ルールの交叉と変異
    const childBehaviorRule = parent1.behaviorRule.inheritFrom(
      parent2.behaviorRule,
      rng,
      this.config.mutationRate
    );

    // タイプの継承（どちらかの親から、変異あり）（公理19）
    const parentType = rng.random() < 0.5 ? (parent1.type ?? 0) : (parent2.type ?? 0);
    const { type: childType, mutated: typeMutated } = inheritType(
      parentType,
      rng,
      this.config.maxTypes
    );

    // 質量は両親の平均
    const childMass = Math.ceil(((parent1.mass ?? 1) + (parent2.mass ?? 1)) / 2);

    // 子エンティティ生成
    const child = createEntity({
      nodeId: parent1.nodeId,
      energy: childEnergy,
      stateCapacity: this.config.childStateCapacity,
      behaviorRule: childBehaviorRule,
      perceptionRange: Math.max(parent1.perceptionRange, parent2.perceptionRange),
      type: childType,
      mass: childMass,
      composition: [childType],
    }, rng);

    return {
      success: true,
      child,
      energyConsumed: this.config.energyCost + childEnergy,
      typeMutated,
    };
  }

  /**
   * 複製可能かチェック
   */
  canReplicate(entity: Entity): boolean {
    return entity.energy >= this.config.energyCost;
  }

  /**
   * 協力複製可能かチェック
   */
  canReplicateWithPartner(entity1: Entity, entity2: Entity): boolean {
    const costPerParent = this.config.energyCost / 2;
    return (
      entity1.nodeId === entity2.nodeId &&
      entity1.energy >= costPerParent &&
      entity2.energy >= costPerParent
    );
  }
}
