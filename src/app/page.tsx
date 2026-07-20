import { WealthCopyApp } from "@/components/wealth/wealth-copy-app";

export const revalidate = 0;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ judge?: string | string[] }>;
}) {
  const query = await searchParams;
  return <WealthCopyApp initialLanguage={query.judge === "1" ? "en" : "ko"} />;
}
