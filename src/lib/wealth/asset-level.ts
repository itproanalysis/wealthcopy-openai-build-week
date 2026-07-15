import { z } from "zod";

export const ASSET_LEVELS = [
  "L1",
  "L2",
  "L3",
  "L4",
  "L5",
  "L6",
  "L7",
  "L8",
  "L9",
  "L10",
  "L11",
  "L12",
  "L13",
  "L14",
  "L15",
] as const;

export const assetLevelSchema = z.enum(ASSET_LEVELS);

export type AssetLevel = z.infer<typeof assetLevelSchema>;

export const WEALTH_SOURCE_LEVEL_HEADER = "X-WealthCopy-Source-Level";

export const ASSET_LEVEL_LABELS = {
  L1: "재무 회복",
  L2: "기반 시작",
  L3: "현금흐름 정리",
  L4: "안전망 구축",
  L5: "자산 형성",
  L6: "자산 구조화",
  L7: "성장 기반",
  L8: "자산 확장",
  L9: "자산 체계화",
  L10: "자산 운영",
  L11: "통합 관리",
  L12: "전문 관리",
  L13: "거버넌스",
  L14: "초고액 관리",
  L15: "장기 운영",
} as const satisfies Record<AssetLevel, string>;

export const NEXT_ASSET_LEVELS = [
  "L2",
  "L3",
  "L4",
  "L5",
  "L6",
  "L7",
  "L8",
  "L9",
  "L10",
  "L11",
  "L12",
  "L13",
  "L14",
  "L15",
] as const;
export const nextAssetLevelSchema = z.enum(NEXT_ASSET_LEVELS);
export type NextAssetLevel = z.infer<typeof nextAssetLevelSchema>;

const NEXT_ASSET_LEVEL = {
  L1: "L2",
  L2: "L3",
  L3: "L4",
  L4: "L5",
  L5: "L6",
  L6: "L7",
  L7: "L8",
  L8: "L9",
  L9: "L10",
  L10: "L11",
  L11: "L12",
  L12: "L13",
  L13: "L14",
  L14: "L15",
  L15: "L15",
} as const satisfies Record<AssetLevel, NextAssetLevel>;

/** Returns the next level. L15 is the terminal maintenance state. */
export function nextAssetLevel(currentLevel: AssetLevel): NextAssetLevel {
  return NEXT_ASSET_LEVEL[currentLevel];
}
