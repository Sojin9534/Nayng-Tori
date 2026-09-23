"use server";

import { getChatGPTUser } from "@/app/chatgpt-auth";
import { importLegacy } from "./api/import-legacy/route";

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
  const user = await getChatGPTUser();
  if (!user) {
    return { error: "관리자 로그인 상태를 확인하지 못했어요. 대시보드를 다시 열어주세요." };
  }

  try {
    const response = await importLegacy(formData);
    return await response.json() as LegacyImportResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 서버 오류";
    return { error: `기존 자료를 처리하지 못했어요: ${message}` };
  }
}
