import styles from "./layout.module.scss";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 justify-center md:items-start md:py-8">
      <div className={`${styles["public-layout__column"]} flex w-full max-w-auth flex-1 flex-col md:flex-none`}>
        {children}
      </div>
    </div>
  );
}
