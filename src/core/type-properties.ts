/**
 * TypeProperties - エンティティタイプの性質定義
 * Requirements: 6.1, 6.2, 6.3
 * 
 * 公理19: 物質の多様性（Material Diversity）
 * - エンティティはタイプを持つ（整数で表現）
 * - タイプによって基本的な性質が異なる
 */

/**
 * タイプの基本性質
 */
export interface TypeProperties {
  /** タイプID（0からN-1） */
  typeId: number;
  /** 基本質量（1-10） */
  baseMass: number;
  /** 採取効率（0.5-2.0） */
  harvestEfficiency: number;
  /** 反応性（0.0-1.0） */
  reactivity: number;
  /** 安定性（エントロピー耐性、0.0-1.0） */
  stability: number;
}

/**
 * TypePropertiesのバリデーション
 */
export function validateTypeProperties(props: TypeProperties): boolean {
  return (
    props.typeId >= 0 &&
    Number.isInteger(props.typeId) &&
    props.baseMass >= 1 &&
    props.baseMass <= 10 &&
    props.harvestEfficiency >= 0.5 &&
    props.harvestEfficiency <= 2.0 &&
    props.reactivity >= 0.0 &&
    props.reactivity <= 1.0 &&
    props.stability >= 0.0 &&
    props.stability <= 1.0
  );
}

/**
 * TypePropertiesをシリアライズ
 */
export function serializeTypeProperties(props: TypeProperties): object {
  return {
    typeId: props.typeId,
    baseMass: props.baseMass,
    harvestEfficiency: props.harvestEfficiency,
    reactivity: props.reactivity,
    stability: props.stability,
  };
}

/**
 * TypePropertiesをデシリアライズ
 */
export function deserializeTypeProperties(data: {
  typeId: number;
  baseMass: number;
  harvestEfficiency: number;
  reactivity: number;
  stability: number;
}): TypeProperties {
  return {
    typeId: data.typeId,
    baseMass: data.baseMass,
    harvestEfficiency: data.harvestEfficiency,
    reactivity: data.reactivity,
    stability: data.stability,
  };
}
