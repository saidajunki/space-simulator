/**
 * Skill System - stateからスキルを抽出し、行動効率に影響を与える
 * Requirements: semantic-information 1.x, 2.x, 3.x
 */

/**
 * スキルインデックス
 */
export enum SkillIndex {
  /** 採取効率 */
  Harvest = 0,
  /** 修復効率 */
  Repair = 1,
  /** 生成効率 */
  Create = 2,
  /** 移動効率 */
  Move = 3,
  /** 相互作用効率 */
  Interact = 4,
  /** 複製効率 */
  Replicate = 5,
  /** 知覚範囲 */
  Perception = 6,
  /** 予約 */
  Reserved = 7,
}

/** スキルの数 */
export const SKILL_COUNT = 8;

/** デフォルトのスキルボーナス係数（スキル値1.0あたりの追加倍率） */
export const DEFAULT_SKILL_BONUS_COEFFICIENT = 0.5;

/** スキルボーナスの最小倍率 */
export const MIN_SKILL_BONUS = 1.0;

/**
 * stateからスキルベクトルを抽出
 * @param state エンティティの内部状態
 * @returns スキルベクトル（各要素は0.0〜1.0）
 */
export function extractSkills(state: Uint8Array): Float32Array {
  const skills = new Float32Array(SKILL_COUNT);
  
  for (let i = 0; i < SKILL_COUNT; i++) {
    if (i < state.length) {
      // バイト値を0.0〜1.0に正規化
      skills[i] = state[i]! / 255;
    } else {
      // stateが短い場合は0でパディング
      skills[i] = 0;
    }
  }
  
  return skills;
}

/**
 * スキル値からボーナス倍率を計算
 * @param skillValue スキル値（0.0〜1.0）
 * @param coefficient ボーナス係数（デフォルト: 0.5）
 * @returns ボーナス倍率（1.0〜1.0+coefficient）
 */
export function calculateSkillBonus(skillValue: number, coefficient: number = DEFAULT_SKILL_BONUS_COEFFICIENT): number {
  // 範囲を0.0〜1.0にクランプ
  const clampedValue = Math.max(0, Math.min(1, skillValue));
  // 1.0 + (skill * coefficient)
  return MIN_SKILL_BONUS + clampedValue * coefficient;
}

/**
 * 特定のスキルのボーナスを取得
 * @param state エンティティの内部状態
 * @param skillIndex スキルインデックス
 * @returns ボーナス倍率（1.0〜1.5）
 */
export function getSkillBonus(state: Uint8Array, skillIndex: SkillIndex): number {
  const skills = extractSkills(state);
  return calculateSkillBonus(skills[skillIndex] ?? 0);
}

/**
 * スキルベクトルの平均を計算
 * @param skillVectors スキルベクトルの配列
 * @returns 平均スキルベクトル
 */
export function calculateAverageSkills(skillVectors: Float32Array[]): Float32Array {
  const avg = new Float32Array(SKILL_COUNT);
  
  if (skillVectors.length === 0) {
    return avg;
  }
  
  for (const skills of skillVectors) {
    for (let i = 0; i < SKILL_COUNT; i++) {
      avg[i]! += skills[i] ?? 0;
    }
  }
  
  for (let i = 0; i < SKILL_COUNT; i++) {
    avg[i]! /= skillVectors.length;
  }
  
  return avg;
}

/**
 * スキルベクトルの分散を計算
 * @param skillVectors スキルベクトルの配列
 * @param avgSkills 平均スキルベクトル（省略時は計算）
 * @returns 分散ベクトル
 */
export function calculateSkillVariance(
  skillVectors: Float32Array[],
  avgSkills?: Float32Array
): Float32Array {
  const variance = new Float32Array(SKILL_COUNT);
  
  if (skillVectors.length === 0) {
    return variance;
  }
  
  const avg = avgSkills ?? calculateAverageSkills(skillVectors);
  
  for (const skills of skillVectors) {
    for (let i = 0; i < SKILL_COUNT; i++) {
      const diff = (skills[i] ?? 0) - (avg[i] ?? 0);
      variance[i]! += diff * diff;
    }
  }
  
  for (let i = 0; i < SKILL_COUNT; i++) {
    variance[i]! /= skillVectors.length;
  }
  
  return variance;
}
