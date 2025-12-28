/**
 * Entity - 空間内で活動する基本単位
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { EntityId, NodeId, createEntityId } from './types.js';
import { InternalState } from './internal-state.js';
import { BehaviorRule } from './behavior-rule.js';
import { RandomGenerator } from './random.js';

/**
 * Entity - 空間内で活動する基本単位
 */
export interface Entity {
  /** 一意のID */
  id: EntityId;
  /** 所属ノードID */
  nodeId: NodeId;
  /** エネルギー量 */
  energy: number;
  /** 内部状態 */
  state: InternalState;
  /** 行動ルール（遺伝子） */
  behaviorRule: BehaviorRule;
  /** 年齢（tick数） */
  age: number;
  /** 知覚範囲（ホップ数） */
  perceptionRange: number;
}

/**
 * Entity生成パラメータ
 */
export interface CreateEntityParams {
  id?: EntityId;
  nodeId: NodeId;
  energy?: number;
  stateCapacity?: number;
  behaviorRule?: BehaviorRule;
  perceptionRange?: number;
}

/** エンティティIDカウンター */
let entityIdCounter = 0;

/**
 * エンティティIDをリセット（テスト用）
 */
export function resetEntityIdCounter(): void {
  entityIdCounter = 0;
}

/**
 * エンティティを生成
 */
export function createEntity(params: CreateEntityParams, rng?: RandomGenerator): Entity {
  const {
    id = createEntityId(`entity-${++entityIdCounter}`),
    nodeId,
    energy = 100,
    stateCapacity = 256,
    behaviorRule = rng ? BehaviorRule.random(rng) : new BehaviorRule(),
    perceptionRange = 1,
  } = params;

  return {
    id,
    nodeId,
    energy,
    state: new InternalState(stateCapacity),
    behaviorRule,
    age: 0,
    perceptionRange,
  };
}

/**
 * エンティティのエネルギーを消費
 */
export function consumeEnergy(entity: Entity, amount: number): boolean {
  if (entity.energy < amount) {
    return false;
  }
  entity.energy -= amount;
  return true;
}

/**
 * エンティティにエネルギーを追加
 */
export function addEnergy(entity: Entity, amount: number): void {
  entity.energy += amount;
}

/**
 * エンティティが生存しているか
 */
export function isAlive(entity: Entity): boolean {
  return entity.energy > 0;
}

/**
 * エンティティの年齢を進める
 */
export function ageEntity(entity: Entity): void {
  entity.age += 1;
}

/**
 * エンティティをシリアライズ
 */
export function serializeEntity(entity: Entity): object {
  return {
    id: entity.id,
    nodeId: entity.nodeId,
    energy: entity.energy,
    state: entity.state.serialize(),
    behaviorRule: entity.behaviorRule.serialize(),
    age: entity.age,
    perceptionRange: entity.perceptionRange,
  };
}

/**
 * エンティティをデシリアライズ
 */
export function deserializeEntity(data: {
  id: string;
  nodeId: string;
  energy: number;
  state: { capacity: number; data: number[] };
  behaviorRule: number[];
  age: number;
  perceptionRange: number;
}): Entity {
  return {
    id: createEntityId(data.id),
    nodeId: data.nodeId as NodeId,
    energy: data.energy,
    state: InternalState.deserialize(data.state),
    behaviorRule: BehaviorRule.deserialize(data.behaviorRule),
    age: data.age,
    perceptionRange: data.perceptionRange,
  };
}
