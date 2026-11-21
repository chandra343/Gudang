import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId");

  const company = companyId
    ? await prisma.company.findUnique({ where: { id: companyId } })
    : await prisma.company.findFirst();

  return NextResponse.json({
    status: "connected",
    service: "Gudang & Inventory Management API",
    version: "v1.0",
    company: company ? { id: company.id, name: company.name, plan: company.plan } : null,
    endpoints: {
      products: "/api/integration/purchasing/products?companyId={id}",
      lowStock: "/api/integration/purchasing/low-stock?companyId={id}",
      orders: "/api/integration/purchasing/orders?companyId={id}",
      receiveOrder: "/api/integration/purchasing/receive",
      requisitions: "/api/integration/purchasing/requisitions?companyId={id}",
    },
    message: "Integrasi sistem Gudang & Purchasing siap digunakan.",
    timestamp: new Date().toISOString(),
  });
}
