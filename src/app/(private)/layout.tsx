import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { LogoutButton } from "@/features/auth/components/logout-button/logout-button";
import { LOGOUT_BUTTON_VARIANT } from "@/features/auth/components/logout-button/types";
import { DevPanel } from "@/features/dev-tools/components/dev-panel/dev-panel";
import { getServices } from "@/server/container";
import { getSession } from "@/server/session/session";
import { getEnv } from "@/shared/config/env";
import { getFirstName, getInitials } from "@/shared/lib/format/name";
import { QueryProvider } from "@/shared/lib/query/query-provider";
import { ROUTES } from "@/shared/lib/routes";
import { Avatar } from "@/shared/ui/avatar/avatar";
import { AVATAR_SIZE, AVATAR_TONE } from "@/shared/ui/avatar/types";
import { ICON_NAME } from "@/shared/ui/icon/types";
import { SideNav, type SideNavItem } from "@/shared/ui/side-nav/side-nav";

async function SideNavUser() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const summary = await getServices().wallet.getSummary(session.userId);

  if (!summary.ok) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-2">
      <Avatar
        initials={getInitials(summary.value.user.fullName)}
        size={AVATAR_SIZE.TOUCH}
        tone={AVATAR_TONE.ON_BRAND}
      />
      <span className="hidden flex-col xl:flex">
        <span className="text-sm font-semibold">{getFirstName(summary.value.user.fullName)}</span>
        <span className="text-xs opacity-80">{summary.value.user.maskedPhone}</span>
      </span>
    </div>
  );
}

export default async function PrivateLayout({ children }: LayoutProps<"/">) {
  const t = await getTranslations("common.nav");
  const env = getEnv();
  const showDevTools = env.NEXT_PUBLIC_ENABLE_DEV_TOOLS && env.MOCK_ALLOW_SCENARIO_OVERRIDE;

  const items: SideNavItem[] = [
    { href: ROUTES.HOME, label: t("home"), icon: ICON_NAME.HOME },
    { href: ROUTES.TRANSFER_AMOUNT, label: t("send"), icon: ICON_NAME.SEND },
  ];

  return (
    <div className="flex flex-1 lg:grid lg:grid-cols-[var(--size-rail)_1fr] xl:grid-cols-[var(--size-sidebar)_1fr]">
      <SideNav
        items={items}
        label={t("label")}
        user={
          <Suspense fallback={null}>
            <SideNavUser />
          </Suspense>
        }
        footer={<LogoutButton variant={LOGOUT_BUTTON_VARIANT.NAV_ITEM} />}
      />
      <QueryProvider>
        <div className="flex flex-1 flex-col">{children}</div>
        {showDevTools ? <DevPanel /> : null}
      </QueryProvider>
    </div>
  );
}
