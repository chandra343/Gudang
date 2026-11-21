import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/integration/purchasing/requisitions?companyId={companyId}
// Digunakan oleh Project Purchasing untuk mengecek Purchase Requisition (PR) / Permintaan Pembelian dari Gudang
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get("companyId");

    const targetCompanyId =
      companyId || (await prisma.company.findFirst())?.id;

    if (!targetCompanyId) {
      return NextResponse.json({ error: "Perusahaan tidak ditemukan" }, { status: 404 });
    }

    const prs = await prisma.purchaseRequisition.findMany({
      where: { companyId: targetCompanyId },
      orderBy: { createdAt: "desc" },
    });

    const parsed = prs.map((pr) => ({
      ...pr,
      items: JSON.parse(pr.itemsJson || "[]"),
    }));

    return NextResponse.json({
      success: true,
      count: parsed.length,
      data: parsed,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengambil data PR" },
      { status: 500 }
    );
  }
}
