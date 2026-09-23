"use server";

import { POST } from "./api/import-legacy/route";

export type LegacyImportResult = {
  ok?: boolean;
  error?: string;
  copied?: number;
  total?: number;
  likes?: number;
};

export async function importLegacyAction(
  _previous: LegacyImportResult,
  formData: FormData,
): Promise<LegacyImportResult> {
  try {
    const response = await POST(new Request("https://internal/dashboard", { method: "POST", body: formData }));
    return await response.json() as LegacyImportResult;
  } catch {
    return { error: "기존 자료를 처리하는 중 서버 오류가 났어요." };
  }
}
