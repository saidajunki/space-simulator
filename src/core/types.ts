/**
 * Core Types
 * 基本型の定義
 */

// 識別子（ブランド型で型安全性を確保）
export type NodeId = string & { readonly __brand: 'NodeId' };
export type EdgeId = string & { readonly __brand: 'EdgeId' };
export type EntityId = string & { readonly __brand: 'EntityId' };
export type ArtifactId = string & { readonly __brand: 'ArtifactId' };

// 識別子生成ヘルパー
export const createNodeId = (id: string): NodeId => id as NodeId;
export const createEdgeId = (id: string): EdgeId => id as EdgeId;
export const createEntityId = (id: string): EntityId => id as EntityId;
export const createArtifactId = (id: string): ArtifactId => id as ArtifactId;

// 地形タイプ
export enum TerrainType {
  Plain = 'plain',
  Mountain = 'mountain',
  Water = 'water',
  Desert = 'desert',
  Forest = 'forest',
}

// 資源タイプ
export enum ResourceType {
  Energy = 'energy',
  Material = 'material',
  Water = 'water',
}

// 行動タイプ
export type ActionType =
  | 'move'
  | 'interact'
  | 'transform'
  | 'replicate'
  | 'createArtifact'
  | 'readArtifact'
  | 'idle';

// 移動中アイテムタイプ
export type TransitItemType = 'entity' | 'resource' | 'information';
