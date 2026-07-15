import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const t = await getTranslations("Common");

  return (
    <Suspense
      fallback={
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>{t("loading")}</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
