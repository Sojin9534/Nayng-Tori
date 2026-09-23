import { NextResponse } from "next/server";

export function proxy() {
  return new NextResponse("냥토리 새 사이트는 현재 비활성화되어 있어요.", {
    status: 503,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export const config = { matcher: "/:path*" };
