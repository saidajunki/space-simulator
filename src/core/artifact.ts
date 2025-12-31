/**
 * Artifact - 環境に刻まれた情報
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6
 */

import { ArtifactId, EntityId, NodeId, createArtifactId } from './types.js';
import { RandomGenerator } from './random.js';

/**
 * アーティファクト
 */
export interface Artifact {
  /** 一意識別子 */
  id: ArtifactId;
  /** 配置ノード */
  nodeId: NodeId;
  /** データ（有限容量） */
  data: Uint8Array;
  /** 耐久度（0-1、時間経過で減少） */
  durability: number;
  /** Prestige: 維持に投下された累積エネルギー（エネルギーではなく会計値） */
  prestige: number;
  /** 作成tick */
  createdAt: number;
  /** 作成者ID */
  creatorId: EntityId;
}

/**
 * アーティファクト生成設定
 */
export interface ArtifactConfig {
  /** 最大データサイズ（バイト） */
  maxDataSize: number;
  /** 初期耐久度 */
  initialDurability: number;
  /** 生成に必要なエネルギー */
  energyCost: number;
  /** 劣化率（tick毎） */
  degradationRate: number;
}

/**
 * デフォルトのアーティファクト設定
 */
export const DEFAULT_ARTIFACT_CONFIG: ArtifactConfig = {
  maxDataSize: 1024,
  initialDurability: 1.0,
  energyCost: 10,
  degradationRate: 0.001,
};

/**
 * アーティファクト生成結果
 */
export interface CreateArtifactResult {
  success: boolean;
  artifact: Artifact | null;
  energyConsumed: number;
  failureReason?: string;
}

/**
 * アーティファクトマネージャー
 */
export class ArtifactManager {
  private config: ArtifactConfig;
  private artifacts: Map<ArtifactId, Artifact> = new Map();

  constructor(config: Partial<ArtifactConfig> = {}) {
    this.config = { ...DEFAULT_ARTIFACT_CONFIG, ...config };
  }

  /**
   * アーティファクト生成
   */
  create(
    creatorId: EntityId,
    nodeId: NodeId,
    data: Uint8Array,
    creatorEnergy: number,
    currentTick: number,
    rng: RandomGenerator,
    costMultiplier: number = 1.0
  ): CreateArtifactResult {
    // スキルボーナスによるコスト調整
    const adjustedCost = this.config.energyCost * costMultiplier;
    
    // エネルギーチェック
    if (creatorEnergy < adjustedCost) {
      return {
        success: false,
        artifact: null,
        energyConsumed: 0,
        failureReason: 'Insufficient energy',
      };
    }

    // データサイズチェック
    if (data.length > this.config.maxDataSize) {
      return {
        success: false,
        artifact: null,
        energyConsumed: 0,
        failureReason: `Data size exceeds maximum (${this.config.maxDataSize} bytes)`,
      };
    }

    const artifact: Artifact = {
      id: createArtifactId(`artifact-${rng.randomInt(0, 0xffffffff).toString(16)}-${currentTick}`),
      nodeId,
      data: new Uint8Array(data),
      durability: this.config.initialDurability,
      prestige: adjustedCost, // 生成時の消費エネルギーをPrestigeに積む
      createdAt: currentTick,
      creatorId,
    };

    this.artifacts.set(artifact.id, artifact);

    return {
      success: true,
      artifact,
      energyConsumed: adjustedCost,
    };
  }

  /**
   * アーティファクト取得
   */
  get(id: ArtifactId): Artifact | undefined {
    return this.artifacts.get(id);
  }

  /**
   * ノード内のアーティファクト取得
   */
  getByNode(nodeId: NodeId): Artifact[] {
    return Array.from(this.artifacts.values()).filter(a => a.nodeId === nodeId);
  }

  /**
   * 全アーティファクト取得
   */
  getAll(): Artifact[] {
    return Array.from(this.artifacts.values());
  }

  /**
   * アーティファクト削除
   */
  remove(id: ArtifactId): boolean {
    return this.artifacts.delete(id);
  }

  /**
   * 劣化処理（1tick分）
   */
  applyDegradation(): ArtifactId[] {
    const decayed: ArtifactId[] = [];

    for (const [id, artifact] of this.artifacts) {
      artifact.durability -= this.config.degradationRate;

      if (artifact.durability <= 0) {
        this.artifacts.delete(id);
        decayed.push(id);
      }
    }

    return decayed;
  }

  /**
   * アーティファクトの修復（エネルギー消費）
   */
  repair(id: ArtifactId, amount: number, prestigeGain: number = 0): { success: boolean; before: number; after: number } {
    const artifact = this.artifacts.get(id);
    if (!artifact) return { success: false, before: 0, after: 0 };

    const before = artifact.durability;
    artifact.durability = Math.min(1.0, artifact.durability + amount);
    artifact.prestige += prestigeGain;
    return { success: true, before, after: artifact.durability };
  }

  /**
   * アーティファクトの読み取り
   */
  read(id: ArtifactId): Uint8Array | null {
    const artifact = this.artifacts.get(id);
    if (!artifact) return null;
    return new Uint8Array(artifact.data);
  }

  /**
   * アーティファクト数
   */
  get count(): number {
    return this.artifacts.size;
  }

  /**
   * 設定取得
   */
  getConfig(): ArtifactConfig {
    return { ...this.config };
  }
}
