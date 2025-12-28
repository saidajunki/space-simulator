/**
 * Interaction Engine - エンティティ間の相互作用
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

import { Entity } from './entity.js';
import { RandomGenerator } from './random.js';
import { GeneIndex } from './behavior-rule.js';

/**
 * 相互作用結果
 */
export interface InteractionResult {
  /** 成功したか */
  success: boolean;
  /** 開始者の状態変化 */
  initiatorEnergyChange: number;
  /** 対象者の状態変化 */
  targetEnergyChange: number;
  /** データ交換（開始者→対象者） */
  dataToTarget: Uint8Array | null;
  /** データ交換（対象者→開始者） */
  dataToInitiator: Uint8Array | null;
  /** ノイズが発生したか */
  noiseOccurred: boolean;
  /** 相互作用タイプ */
  interactionType: 'cooperative' | 'competitive' | 'neutral';
}

/**
 * 相互作用設定
 */
export interface InteractionConfig {
  /** ノイズ率 */
  noiseRate: number;
  /** 協力時のエネルギー効率 */
  cooperationEfficiency: number;
  /** 競争時のエネルギー移動率 */
  competitionTransferRate: number;
  /** データ交換の最大サイズ */
  maxDataExchangeSize: number;
}

/**
 * デフォルトの相互作用設定
 */
export const DEFAULT_INTERACTION_CONFIG: InteractionConfig = {
  noiseRate: 0.1,
  cooperationEfficiency: 1.2,
  competitionTransferRate: 0.3,
  maxDataExchangeSize: 64,
};

/**
 * 相互作用エンジン
 */
export class InteractionEngine {
  private config: InteractionConfig;

  constructor(config: Partial<InteractionConfig> = {}) {
    this.config = { ...DEFAULT_INTERACTION_CONFIG, ...config };
  }

  /**
   * 相互作用を処理
   */
  process(
    initiator: Entity,
    target: Entity,
    data: Uint8Array | null,
    rng: RandomGenerator
  ): InteractionResult {
    // 同一ノードチェック
    if (initiator.nodeId !== target.nodeId) {
      return {
        success: false,
        initiatorEnergyChange: 0,
        targetEnergyChange: 0,
        dataToTarget: null,
        dataToInitiator: null,
        noiseOccurred: false,
        interactionType: 'neutral',
      };
    }

    // ノイズチェック
    const noiseOccurred = rng.randomWithProbability(this.config.noiseRate);

    // 相互作用タイプを決定（遺伝子に基づく）
    const initiatorAggression = initiator.behaviorRule.getGene(GeneIndex.Aggression);
    const initiatorCooperation = initiator.behaviorRule.getGene(GeneIndex.Cooperation);
    const targetAggression = target.behaviorRule.getGene(GeneIndex.Aggression);
    const targetCooperation = target.behaviorRule.getGene(GeneIndex.Cooperation);

    let interactionType: 'cooperative' | 'competitive' | 'neutral';
    let initiatorEnergyChange = 0;
    let targetEnergyChange = 0;

    // 両者の傾向から相互作用タイプを決定
    const coopScore = (initiatorCooperation + targetCooperation) / 2;
    const aggScore = (initiatorAggression + targetAggression) / 2;

    if (coopScore > aggScore && coopScore > 0.5) {
      interactionType = 'cooperative';
      // 協力: 両者にボーナス（エネルギー効率向上）
      const bonus = 5 * this.config.cooperationEfficiency;
      initiatorEnergyChange = noiseOccurred ? bonus * rng.random() : bonus;
      targetEnergyChange = noiseOccurred ? bonus * rng.random() : bonus;
    } else if (aggScore > coopScore && aggScore > 0.5) {
      interactionType = 'competitive';
      // 競争: 強い方がエネルギーを奪う
      const initiatorStrength = initiator.energy * initiatorAggression;
      const targetStrength = target.energy * targetAggression;
      const transfer = Math.min(
        target.energy * this.config.competitionTransferRate,
        initiator.energy * this.config.competitionTransferRate
      );

      if (initiatorStrength > targetStrength) {
        initiatorEnergyChange = transfer;
        targetEnergyChange = -transfer;
      } else {
        initiatorEnergyChange = -transfer;
        targetEnergyChange = transfer;
      }

      if (noiseOccurred) {
        // ノイズで結果が逆転する可能性
        if (rng.randomWithProbability(0.3)) {
          [initiatorEnergyChange, targetEnergyChange] = [targetEnergyChange, initiatorEnergyChange];
        }
      }
    } else {
      interactionType = 'neutral';
      // 中立: 小さなエネルギー交換
      const exchange = rng.random() * 2 - 1; // -1 to 1
      initiatorEnergyChange = exchange;
      targetEnergyChange = -exchange;
    }

    // データ交換
    let dataToTarget: Uint8Array | null = null;
    let dataToInitiator: Uint8Array | null = null;

    if (data && data.length <= this.config.maxDataExchangeSize) {
      dataToTarget = noiseOccurred ? rng.mutateBytes(data, 0.1) : data;
    }

    // 対象者からのデータ（内部状態の一部）
    const targetData = target.state.getData();
    if (targetData.length > 0) {
      const shareSize = Math.min(targetData.length, this.config.maxDataExchangeSize);
      dataToInitiator = targetData.slice(0, shareSize);
      if (noiseOccurred) {
        dataToInitiator = rng.mutateBytes(dataToInitiator, 0.1);
      }
    }

    return {
      success: true,
      initiatorEnergyChange,
      targetEnergyChange,
      dataToTarget,
      dataToInitiator,
      noiseOccurred,
      interactionType,
    };
  }

  /**
   * 設定を取得
   */
  getConfig(): InteractionConfig {
    return { ...this.config };
  }
}
