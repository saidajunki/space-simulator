/**
 * Information Transfer - 情報伝達
 * Requirements: 1.x, 2.x, 3.x, 4.x, 6.x
 * 
 * エンティティが情報を取得・保存・伝達する仕組み。
 * 既存の公理（相互作用、複製、アーティファクト）を拡張して実装。
 */

import { Entity } from './entity.js';
import { InternalState } from './internal-state.js';
import { RandomGenerator } from './random.js';

/**
 * 情報伝達設定
 */
export interface InformationTransferConfig {
  /** 情報交換を有効にするか */
  exchangeEnabled: boolean;
  /** 交換率（state容量に対する割合） */
  exchangeRate: number;
  /** 情報継承を有効にするか */
  inheritanceEnabled: boolean;
  /** 変異率（ビット単位） */
  mutationRate: number;
  /** 情報取得を有効にするか */
  acquisitionEnabled: boolean;
  /** 初期state充填率 */
  initialStateFillRate: number;
}

/**
 * デフォルトの情報伝達設定
 */
export const DEFAULT_INFORMATION_TRANSFER_CONFIG: InformationTransferConfig = {
  exchangeEnabled: true,
  exchangeRate: 0.1,  // 10%
  inheritanceEnabled: true,
  mutationRate: 0.05,  // 5%
  acquisitionEnabled: true,
  initialStateFillRate: 0.5,  // 50%
};

/**
 * 情報交換の結果
 */
export interface ExchangeResult {
  exchangedBytesA: number;
  exchangedBytesB: number;
}

/**
 * 情報継承の結果
 */
export interface InheritanceResult {
  inheritedBytes: number;
  mutatedBits: number;
}

/**
 * 情報取得の結果
 */
export interface AcquisitionResult {
  acquiredBytes: number;
}


/**
 * 2つのエンティティ間で情報を交換
 * 
 * @param entityA 第1のエンティティ
 * @param entityB 第2のエンティティ
 * @param config 情報伝達設定
 * @param rng 乱数生成器
 * @returns 交換結果
 */
export function exchangeInformation(
  entityA: Entity,
  entityB: Entity,
  config: InformationTransferConfig,
  rng: RandomGenerator
): ExchangeResult {
  if (!config.exchangeEnabled) {
    return { exchangedBytesA: 0, exchangedBytesB: 0 };
  }

  const stateA = entityA.state;
  const stateB = entityB.state;
  const dataA = stateA.getData();
  const dataB = stateB.getData();

  // 交換するバイト数を計算
  const exchangeBytesA = Math.floor(dataA.length * config.exchangeRate);
  const exchangeBytesB = Math.floor(dataB.length * config.exchangeRate);

  if (exchangeBytesA === 0 && exchangeBytesB === 0) {
    return { exchangedBytesA: 0, exchangedBytesB: 0 };
  }

  // AからBへ、BからAへ情報を交換
  // ランダムな位置から交換するバイトを選択
  if (exchangeBytesA > 0 && dataA.length > 0) {
    const startA = rng.randomInt(0, Math.max(0, dataA.length - exchangeBytesA));
    const bytesToB = dataA.slice(startA, startA + exchangeBytesA);
    stateB.append(bytesToB);
  }

  if (exchangeBytesB > 0 && dataB.length > 0) {
    const startB = rng.randomInt(0, Math.max(0, dataB.length - exchangeBytesB));
    const bytesToA = dataB.slice(startB, startB + exchangeBytesB);
    stateA.append(bytesToA);
  }

  return {
    exchangedBytesA: exchangeBytesB,  // Aが受け取った量
    exchangedBytesB: exchangeBytesA,  // Bが受け取った量
  };
}

/**
 * 親から子へ情報を継承
 * 
 * @param childState 子のstate
 * @param parentState 親のstate
 * @param partnerState パートナーのstate（協力複製の場合）
 * @param config 情報伝達設定
 * @param rng 乱数生成器
 * @returns 継承結果
 */
export function inheritInformation(
  childState: InternalState,
  parentState: InternalState,
  partnerState: InternalState | null,
  config: InformationTransferConfig,
  rng: RandomGenerator
): InheritanceResult {
  if (!config.inheritanceEnabled) {
    return { inheritedBytes: 0, mutatedBits: 0 };
  }

  const parentData = parentState.getData();
  let inheritedData: Uint8Array;

  if (partnerState) {
    // 協力複製: 両親の情報を混合
    const partnerData = partnerState.getData();
    inheritedData = mixStates(parentData, partnerData, rng);
  } else {
    // 単独複製: 親の情報をコピー
    inheritedData = new Uint8Array(parentData);
  }

  // 変異を適用
  let mutatedBits = 0;
  if (config.mutationRate > 0 && inheritedData.length > 0) {
    mutatedBits = applyMutation(inheritedData, config.mutationRate, rng);
  }

  // 子のstateに設定
  childState.setData(inheritedData);

  return {
    inheritedBytes: inheritedData.length,
    mutatedBits,
  };
}

/**
 * 2つのstateを混合
 */
function mixStates(
  dataA: Uint8Array,
  dataB: Uint8Array,
  rng: RandomGenerator
): Uint8Array {
  const maxLen = Math.max(dataA.length, dataB.length);
  if (maxLen === 0) return new Uint8Array(0);

  const result = new Uint8Array(maxLen);
  
  for (let i = 0; i < maxLen; i++) {
    // 各バイトをランダムにどちらかの親から選択
    if (rng.random() < 0.5) {
      result[i] = i < dataA.length ? dataA[i]! : (i < dataB.length ? dataB[i]! : 0);
    } else {
      result[i] = i < dataB.length ? dataB[i]! : (i < dataA.length ? dataA[i]! : 0);
    }
  }

  return result;
}

/**
 * 変異を適用（ビットフリップ）
 */
function applyMutation(
  data: Uint8Array,
  mutationRate: number,
  rng: RandomGenerator
): number {
  let mutatedBits = 0;
  const totalBits = data.length * 8;
  const expectedMutations = Math.floor(totalBits * mutationRate);

  for (let i = 0; i < expectedMutations; i++) {
    const bitIndex = rng.randomInt(0, totalBits - 1);
    const byteIndex = Math.floor(bitIndex / 8);
    const bitPosition = bitIndex % 8;
    
    if (byteIndex < data.length) {
      const currentByte = data[byteIndex];
      if (currentByte !== undefined) {
        data[byteIndex] = currentByte ^ (1 << bitPosition);
        mutatedBits++;
      }
    }
  }

  return mutatedBits;
}

/**
 * アーティファクトから情報を取得
 * 
 * @param entityState エンティティのstate
 * @param artifactData アーティファクトのdata
 * @param repairAmount 修復量（0-1）
 * @param config 情報伝達設定
 * @returns 取得結果
 */
export function acquireInformation(
  entityState: InternalState,
  artifactData: Uint8Array,
  repairAmount: number,
  config: InformationTransferConfig
): AcquisitionResult {
  if (!config.acquisitionEnabled || artifactData.length === 0) {
    return { acquiredBytes: 0 };
  }

  // 修復量に比例した情報を取得
  const acquireBytes = Math.floor(artifactData.length * repairAmount);
  if (acquireBytes === 0) {
    return { acquiredBytes: 0 };
  }

  // アーティファクトの先頭から取得
  const bytesToAcquire = artifactData.slice(0, acquireBytes);
  entityState.append(bytesToAcquire);

  return { acquiredBytes: acquireBytes };
}

/**
 * エンティティの初期stateを生成
 * 
 * @param state 初期化するstate
 * @param config 情報伝達設定
 * @param rng 乱数生成器
 */
export function initializeState(
  state: InternalState,
  config: InformationTransferConfig,
  rng: RandomGenerator
): void {
  const fillSize = Math.floor(state.capacity * config.initialStateFillRate);
  if (fillSize === 0) return;

  const data = new Uint8Array(fillSize);
  for (let i = 0; i < fillSize; i++) {
    data[i] = rng.randomInt(0, 255);
  }

  state.setData(data);
}
