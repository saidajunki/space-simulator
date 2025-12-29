/**
 * Similarity - 情報の一致度計算
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.2, 2.3, 2.4
 * 
 * アーティファクトのdataとエンティティのstateの一致度を計算し、
 * 修復効率へのボーナスを決定する。
 */

/**
 * 2つのバイト列の一致度を計算
 * 
 * @param a 第1のバイト列
 * @param b 第2のバイト列
 * @returns 一致度 (0.0〜1.0)
 * 
 * アルゴリズム:
 * 1. どちらかが空の場合は0.0を返す
 * 2. 短い方の長さまで比較し、一致するバイト数をカウント
 * 3. 長さの差をペナルティとして適用
 * 4. 最終スコア = (一致数 / 最大長) * (1 - 長さペナルティ係数)
 */
export function calculateSimilarity(a: Uint8Array | null | undefined, b: Uint8Array | null | undefined): number {
  // null/undefinedは空配列として扱う
  const arrA = a ?? new Uint8Array(0);
  const arrB = b ?? new Uint8Array(0);
  
  // どちらかが空の場合は0.0
  if (arrA.length === 0 || arrB.length === 0) {
    return 0.0;
  }
  
  const minLen = Math.min(arrA.length, arrB.length);
  const maxLen = Math.max(arrA.length, arrB.length);
  
  // 一致するバイト数をカウント
  let matchCount = 0;
  for (let i = 0; i < minLen; i++) {
    if (arrA[i] === arrB[i]) {
      matchCount++;
    }
  }
  
  // 基本一致率（短い方の長さに対する一致率）
  const baseMatch = matchCount / minLen;
  
  // 長さペナルティ（長さの差が大きいほどペナルティ）
  // ペナルティ係数 = (maxLen - minLen) / maxLen
  const lengthPenalty = (maxLen - minLen) / maxLen;
  
  // 最終スコア = 基本一致率 * (1 - ペナルティ係数 * 0.5)
  // ペナルティは最大50%まで（完全に0にはしない）
  const finalScore = baseMatch * (1 - lengthPenalty * 0.5);
  
  // 範囲を[0.0, 1.0]に制限
  return Math.max(0.0, Math.min(1.0, finalScore));
}

/**
 * 一致度から修復効率ボーナスを計算
 * 
 * @param similarity 一致度 (0.0〜1.0)
 * @returns 効率倍率 (1.0〜2.0)
 * 
 * 計算式:
 * - similarity ≤ 0.5: return 1.0 (ボーナスなし)
 * - similarity > 0.5: return 1.0 + (similarity - 0.5) * 2.0
 *   - similarity = 0.5 → 1.0
 *   - similarity = 0.75 → 1.5
 *   - similarity = 1.0 → 2.0
 */
export function calculateKnowledgeBonus(similarity: number): number {
  // 範囲外の値を正規化
  const normalizedSim = Math.max(0.0, Math.min(1.0, similarity));
  
  if (normalizedSim <= 0.5) {
    return 1.0;
  }
  
  // 線形補間: 0.5→1.0, 1.0→2.0
  return 1.0 + (normalizedSim - 0.5) * 2.0;
}
