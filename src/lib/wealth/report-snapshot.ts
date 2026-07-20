import { z } from "zod";

import { wealthReportSchema, type WealthReport } from "./wealth-report";

export const WEALTH_REPORT_SNAPSHOT_VERSION =
  "wealth-report-snapshot-v1" as const;
export const MAX_WEALTH_REPORT_SNAPSHOT_BYTES = 256 * 1024;

export const wealthReportSnapshotSchema = z
  .object({
    snapshotVersion: z.literal(WEALTH_REPORT_SNAPSHOT_VERSION),
    exportedAt: z.string().datetime({ offset: true }),
    report: wealthReportSchema,
  })
  .strict();

export type WealthReportSnapshot = z.infer<typeof wealthReportSnapshotSchema>;

export type WealthReportSnapshotParseErrorCode =
  | "SNAPSHOT_TOO_LARGE"
  | "SNAPSHOT_INVALID_JSON"
  | "SNAPSHOT_UNSUPPORTED_VERSION"
  | "SNAPSHOT_INVALID_FORMAT";

export type WealthReportSnapshotParseResult =
  | { ok: true; snapshot: WealthReportSnapshot }
  | {
      ok: false;
      error: {
        code: WealthReportSnapshotParseErrorCode;
        message: string;
      };
    };

const SNAPSHOT_ERROR_MESSAGES = {
  SNAPSHOT_TOO_LARGE: "파일이 256 KiB 제한을 넘습니다.",
  SNAPSHOT_INVALID_JSON: "JSON 파일을 읽을 수 없습니다.",
  SNAPSHOT_UNSUPPORTED_VERSION: "지원하지 않는 스냅샷 버전입니다.",
  SNAPSHOT_INVALID_FORMAT: "WealthCopy 스냅샷 형식이 올바르지 않습니다.",
} as const satisfies Record<WealthReportSnapshotParseErrorCode, string>;

function failure(
  code: WealthReportSnapshotParseErrorCode,
): WealthReportSnapshotParseResult {
  return {
    ok: false,
    error: {
      code,
      message: SNAPSHOT_ERROR_MESSAGES[code],
    },
  };
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/**
 * Parses a user-selected snapshot without persisting it or exposing validation
 * details that could contain financial values.
 */
export function parseWealthReportSnapshot(
  json: string,
): WealthReportSnapshotParseResult {
  if (utf8ByteLength(json) > MAX_WEALTH_REPORT_SNAPSHOT_BYTES) {
    return failure("SNAPSHOT_TOO_LARGE");
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(json);
  } catch {
    return failure("SNAPSHOT_INVALID_JSON");
  }

  if (
    typeof candidate === "object" &&
    candidate !== null &&
    "snapshotVersion" in candidate &&
    candidate.snapshotVersion !== WEALTH_REPORT_SNAPSHOT_VERSION
  ) {
    return failure("SNAPSHOT_UNSUPPORTED_VERSION");
  }

  const parsed = wealthReportSnapshotSchema.safeParse(candidate);
  if (!parsed.success) {
    return failure("SNAPSHOT_INVALID_FORMAT");
  }

  return { ok: true, snapshot: parsed.data };
}

/**
 * Produces the complete portable snapshot. The report is revalidated at the
 * export boundary; invalid values throw a ZodError instead of being serialized.
 */
export function serializeWealthReportSnapshot(
  report: WealthReport,
  exportedAt: Date = new Date(),
): string {
  const validatedReport = wealthReportSchema.parse(report);
  const snapshot = wealthReportSnapshotSchema.parse({
    snapshotVersion: WEALTH_REPORT_SNAPSHOT_VERSION,
    exportedAt: exportedAt.toISOString(),
    report: validatedReport,
  });

  return JSON.stringify(snapshot, null, 2);
}
