import { NextResponse } from "next/server";
import { aiCorsHeaders, checkNineRouterHealth } from "@/lib/nineRouter";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await checkNineRouterHealth({ persistStatus: true, verifyUsable: false });
  return NextResponse.json(
    {
      service: "Gudang (WMS)",
      port: 3000,
      nineRouter: status,
      bridgeEndpoints: {
        status: "/api/ai/status",
        models: "/api/ai/models",
        chat: "/api/ai/chat",
      },
    },
    { headers: aiCorsHeaders() }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: aiCorsHeaders() });
}
