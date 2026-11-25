import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { idCard?: string };
    const cleanId = body?.idCard?.trim().toUpperCase();

    if (!cleanId) {
      return NextResponse.json(
        { success: false, error: "idCard wajib disertakan untuk mereset tampilan user." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({ where: { idCard: cleanId } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: `Akun dengan ID Card "${cleanId}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { dashboardConfigJson: null },
    });

    return NextResponse.json({
      success: true,
      message: `Tampilan dashboard akun ${user.name} (${cleanId}) telah dipulihkan ke Default.`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal memulihkan tampilan default.",
      },
      { status: 500 }
    );
  }
}
