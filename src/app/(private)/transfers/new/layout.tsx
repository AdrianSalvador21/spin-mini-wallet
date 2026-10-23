import { WizardShell } from "@/features/transfers/components/wizard-shell/wizard-shell";

export default function TransferWizardLayout({ children }: LayoutProps<"/transfers/new">) {
  return <WizardShell>{children}</WizardShell>;
}
