/**
 * Energy System - エネルギー管理
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1
 */

import { EntityId, NodeId, ResourceType } from './types.js';
import { Entity } from './entity.js';
import { Node } from './node.js';
import { Space } from './space.js';
import { Action, ActionCosts, DEFAULT_ACTION_COSTS, calculateActionCost } from './action.js';

/** エネルギー・質量変換レート（公理20: E=mc²的概念） */
export const ENERGY_MASS_CONVERSION_RATE = 10;

/**
 * エネルギーシステム設定
 */
export interface EnergyConfig {
  /** 行動コスト */
  actionCosts: ActionCosts;
  /** 資源からのエネルギー変換率 */
  resourceToEnergyRate: number;
  /** 最大エネルギー */
  maxEnergy: number;
  /** エネルギー・質量変換レート（公理20） */
  energyMassConversionRate: number;
}

/**
 * デフォルトのエネルギー設定
 */
export const DEFAULT_ENERGY_CONFIG: EnergyConfig = {
  actionCosts: DEFAULT_ACTION_COSTS,
  resourceToEnergyRate: 1.0,
  maxEnergy: 1000,
  energyMassConversionRate: ENERGY_MASS_CONVERSION_RATE,
};

/**
 * エネルギーシステム
 */
export class EnergySystem {
  private config: EnergyConfig;
  /** 総エネルギー追跡 */
  private totalEnergy: number = 0;

  constructor(config: Partial<EnergyConfig> = {}) {
    this.config = { ...DEFAULT_ENERGY_CONFIG, ...config };
  }

  /**
   * 総エネルギーを初期化
   */
  initializeTotalEnergy(entities: Map<EntityId, Entity>, nodes: Node[]): void {
    this.totalEnergy = 0;
    
    // エンティティのエネルギー
    for (const entity of entities.values()) {
      this.totalEnergy += entity.energy;
    }
    
    // ノードの資源エネルギー
    for (const node of nodes) {
      const energyResource = node.resources.get(ResourceType.Energy) ?? 0;
      this.totalEnergy += energyResource * this.config.resourceToEnergyRate;
    }
  }

  /**
   * 総エネルギーを取得
   */
  getTotalEnergy(): number {
    return this.totalEnergy;
  }

  /**
   * 行動のエネルギーコストを計算
   */
  calculateCost(action: Action, space: Space, fromNode: NodeId, toNode?: NodeId): number {
    let distance = 1;
    if (action.type === 'move' && toNode) {
      const edge = space.getEdgeBetween(fromNode, toNode);
      distance = edge?.attributes.distance ?? 1;
    }
    return calculateActionCost(action, this.config.actionCosts, distance);
  }

  /**
   * エンティティがエネルギーを消費
   */
  consume(entity: Entity, amount: number): boolean {
    if (entity.energy < amount) {
      return false;
    }
    entity.energy -= amount;
    // 総エネルギーは変わらない（消費されたエネルギーは熱として環境に放出される想定）
    return true;
  }

  /**
   * エンティティにエネルギーを追加
   */
  add(entity: Entity, amount: number): void {
    const actualAmount = Math.min(amount, this.config.maxEnergy - entity.energy);
    entity.energy += actualAmount;
  }

  /**
   * エネルギー移動（エンティティ間）
   */
  transfer(from: Entity, to: Entity, amount: number): boolean {
    const actualAmount = Math.min(amount, from.energy, this.config.maxEnergy - to.energy);
    if (actualAmount <= 0) {
      return false;
    }
    from.energy -= actualAmount;
    to.energy += actualAmount;
    // 総エネルギーは保存される
    return true;
  }

  /**
   * 資源からエネルギーを取得
   */
  harvestFromNode(entity: Entity, node: Node, amount: number): number {
    const available = node.resources.get(ResourceType.Energy) ?? 0;
    const actualAmount = Math.min(amount, available, this.config.maxEnergy - entity.energy);
    
    if (actualAmount <= 0) {
      return 0;
    }

    node.resources.set(ResourceType.Energy, available - actualAmount);
    entity.energy += actualAmount * this.config.resourceToEnergyRate;
    // 総エネルギーは保存される（資源→エンティティ）
    return actualAmount;
  }

  /**
   * エンティティが死亡した際のエネルギー処理
   * 公理20: 質量に比例したエネルギーを放出
   */
  handleDeath(entity: Entity, node: Node): void {
    // エンティティのエネルギーを環境に戻す
    const currentEnergy = node.resources.get(ResourceType.Energy) ?? 0;
    
    // 質量からのエネルギー放出（公理20: E=mc²的概念）
    const massEnergy = (entity.mass ?? 1) * this.config.energyMassConversionRate;
    const totalReleasedEnergy = entity.energy + massEnergy;
    
    node.resources.set(ResourceType.Energy, currentEnergy + totalReleasedEnergy);
    entity.energy = 0;
    // 総エネルギーは保存される
  }

  /**
   * エンティティ生成に必要なエネルギーを計算
   * 公理20: 質量に比例したエネルギーが必要
   */
  calculateCreationEnergy(mass: number): number {
    return mass * this.config.energyMassConversionRate;
  }

  /**
   * 質量からエネルギーを計算
   * 公理20: E=mc²的概念
   */
  massToEnergy(mass: number): number {
    return mass * this.config.energyMassConversionRate;
  }

  /**
   * エネルギーから質量を計算
   * 公理20: E=mc²的概念
   */
  energyToMass(energy: number): number {
    return Math.floor(energy / this.config.energyMassConversionRate);
  }

  /**
   * エネルギー保存則の検証（デバッグ用）
   */
  verifyConservation(entities: Map<EntityId, Entity>, nodes: Node[]): boolean {
    let currentTotal = 0;
    
    for (const entity of entities.values()) {
      currentTotal += entity.energy;
    }
    
    for (const node of nodes) {
      const energyResource = node.resources.get(ResourceType.Energy) ?? 0;
      currentTotal += energyResource * this.config.resourceToEnergyRate;
    }

    // 浮動小数点誤差を考慮
    return Math.abs(currentTotal - this.totalEnergy) < 0.0001;
  }

  /**
   * 設定を取得
   */
  getConfig(): EnergyConfig {
    return { ...this.config };
  }
}
