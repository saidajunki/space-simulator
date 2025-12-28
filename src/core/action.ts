/**
 * Action - エンティティの行動
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import { NodeId, EntityId, ArtifactId } from './types.js';

/**
 * 移動行動
 */
export interface MoveAction {
  type: 'move';
  targetNode: NodeId;
}

/**
 * 相互作用行動
 */
export interface InteractAction {
  type: 'interact';
  targetEntity: EntityId;
  data: Uint8Array | null;
}

/**
 * 変換行動（自身の状態変更）
 */
export interface TransformAction {
  type: 'transform';
  newStateData: Uint8Array;
}

/**
 * 複製行動
 */
export interface ReplicateAction {
  type: 'replicate';
  partner: EntityId | null;
}

/**
 * アーティファクト生成行動
 */
export interface CreateArtifactAction {
  type: 'createArtifact';
  data: Uint8Array;
}

/**
 * アーティファクト読み取り行動
 */
export interface ReadArtifactAction {
  type: 'readArtifact';
  artifactId: ArtifactId;
}

/**
 * 待機行動
 */
export interface IdleAction {
  type: 'idle';
}

/**
 * 行動の型
 */
export type Action =
  | MoveAction
  | InteractAction
  | TransformAction
  | ReplicateAction
  | CreateArtifactAction
  | ReadArtifactAction
  | IdleAction;

/**
 * 行動結果
 */
export interface ActionResult {
  success: boolean;
  energyConsumed: number;
  error?: ActionError;
}

/**
 * 行動エラー
 */
export type ActionError =
  | { type: 'insufficientEnergy'; required: number; available: number }
  | { type: 'invalidTarget'; reason: string }
  | { type: 'capacityExceeded'; limit: number }
  | { type: 'pathBlocked'; reason: string }
  | { type: 'noiseFailure'; originalAction: Action };

/**
 * 行動コスト設定
 */
export interface ActionCosts {
  /** 移動の基本コスト */
  moveBase: number;
  /** 移動の距離係数 */
  moveDistanceFactor: number;
  /** 相互作用コスト */
  interact: number;
  /** 変換コスト */
  transform: number;
  /** 複製コスト */
  replicate: number;
  /** アーティファクト生成コスト */
  createArtifact: number;
  /** アーティファクト読み取りコスト */
  readArtifact: number;
  /** 待機コスト（生存コスト） */
  idle: number;
}

/**
 * デフォルトの行動コスト
 */
export const DEFAULT_ACTION_COSTS: ActionCosts = {
  moveBase: 5,
  moveDistanceFactor: 1,
  interact: 2,
  transform: 1,
  replicate: 50,
  createArtifact: 10,
  readArtifact: 1,
  idle: 1,
};

/**
 * 行動のコストを計算
 */
export function calculateActionCost(
  action: Action,
  costs: ActionCosts,
  distance: number = 1
): number {
  switch (action.type) {
    case 'move':
      return costs.moveBase + costs.moveDistanceFactor * distance;
    case 'interact':
      return costs.interact;
    case 'transform':
      return costs.transform;
    case 'replicate':
      return costs.replicate;
    case 'createArtifact':
      return costs.createArtifact;
    case 'readArtifact':
      return costs.readArtifact;
    case 'idle':
      return costs.idle;
  }
}

/**
 * 行動を文字列に変換（ログ用）
 */
export function actionToString(action: Action): string {
  switch (action.type) {
    case 'move':
      return `move to ${action.targetNode}`;
    case 'interact':
      return `interact with ${action.targetEntity}`;
    case 'transform':
      return `transform state`;
    case 'replicate':
      return action.partner
        ? `replicate with ${action.partner}`
        : `replicate alone`;
    case 'createArtifact':
      return `create artifact`;
    case 'readArtifact':
      return `read artifact ${action.artifactId}`;
    case 'idle':
      return `idle`;
  }
}
