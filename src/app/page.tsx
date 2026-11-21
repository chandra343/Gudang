import { getCompanies, getDashboardData, getAllEmployees } from "./actions";
import DashboardClient from "@/components/DashboardClient";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const params = await searchParams;
  const companies = await getCompanies();
  const allEmployees = await getAllEmployees();

  const selectedCompanyId =
    params?.companyId && companies.some((c) => c.id === params.companyId)
      ? params.companyId
      : companies[0]?.id || "";

  const dashboardData = selectedCompanyId
    ? await getDashboardData(selectedCompanyId)
    : null;

  return (
    <DashboardClient
      initialCompanies={companies}
      initialCompanyId={selectedCompanyId}
      initialData={dashboardData}
      initialEmployees={allEmployees}
    />
  );
}
