import { AuthBrandPanel } from "@/features/auth/components/auth-brand-panel/auth-brand-panel";
import styles from "./layout.module.scss";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 justify-center md:items-start md:py-8 lg:grid lg:grid-cols-2 lg:items-stretch lg:py-0">
      <div className="hidden lg:flex lg:flex-col">
        <AuthBrandPanel />
      </div>
      <div
        className={`${styles["public-layout__column"]} flex w-full max-w-auth flex-1 flex-col md:flex-none lg:max-w-none lg:flex-1 lg:items-center lg:px-14`}
      >
        <div className="flex w-full flex-1 flex-col lg:max-w-form">{children}</div>
      </div>
    </div>
  );
}
