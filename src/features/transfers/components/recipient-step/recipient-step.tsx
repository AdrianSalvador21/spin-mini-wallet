"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useValidationMessage } from "@/shared/i18n/use-validation-message";
import type { ContactView } from "@/shared/lib/api/views";
import { getFirstName } from "@/shared/lib/format/name";
import { ROUTES } from "@/shared/lib/routes";
import { Button } from "@/shared/ui/button/button";
import { BUTTON_TYPE, BUTTON_VARIANT } from "@/shared/ui/button/types";
import { useTransferDraft } from "../../draft/draft-store";
import { useDraftPreview } from "../../draft/preview-store";
import { previousStepRoute } from "../../draft/step-guard";
import { TRANSFER_STEP, type DraftRecipient } from "../../draft/types";
import { useStepGuard } from "../../draft/use-step-guard";
import { useNewRecipientMode } from "../../hooks/use-new-recipient-mode";
import { recipientStepSchema, type RecipientStepValues } from "../../schemas/recipient-step-schema";
import { ContactList } from "../contact-list/contact-list";
import { NewRecipientForm } from "../new-recipient-form/new-recipient-form";
import { WizardActions } from "../wizard-actions/wizard-actions";
import { WizardSkeleton } from "../wizard-skeleton/wizard-skeleton";
import styles from "./recipient-step.module.scss";

const resolver = zodResolver(recipientStepSchema);

export function RecipientStep() {
  const ready = useStepGuard(TRANSFER_STEP.RECIPIENT);
  const { isNew, open } = useNewRecipientMode();

  if (!ready) {
    return <WizardSkeleton />;
  }

  return isNew ? <NewRecipientForm /> : <RecipientPicker onAdd={open} />;
}

function toDraftRecipient(contact: ContactView): DraftRecipient {
  return { contactId: contact.id, name: contact.name, account: contact.account };
}

interface RecipientPickerProps {
  onAdd: () => void;
}

function RecipientPicker({ onAdd }: RecipientPickerProps) {
  const t = useTranslations("transfers.actions");
  const router = useRouter();
  const validationMessage = useValidationMessage();
  const draftRecipient = useTransferDraft((draft) => draft.recipient);
  const setRecipient = useTransferDraft((draft) => draft.setRecipient);
  const previewRecipient = useDraftPreview((preview) => preview.previewRecipient);
  const [selected, setSelected] = useState<DraftRecipient | null>(draftRecipient);

  const {
    handleSubmit,
    setValue,
    formState: { errors, isSubmitted },
  } = useForm<RecipientStepValues>({
    resolver,
    defaultValues: { contactId: draftRecipient?.contactId ?? "" },
  });

  useEffect(() => () => previewRecipient(undefined), [previewRecipient]);

  function select(contact: ContactView) {
    const recipient = toDraftRecipient(contact);

    setSelected(recipient);
    previewRecipient(recipient);
    setValue("contactId", contact.id, { shouldValidate: isSubmitted });
  }

  const onValid = () => {
    if (!selected) {
      return;
    }

    setRecipient(selected);
    router.push(ROUTES.TRANSFER_REVIEW);
  };

  return (
    <form className={styles["recipient-step"]} noValidate onSubmit={handleSubmit(onValid)}>
      <ContactList
        selectedId={selected?.contactId ?? null}
        onSelect={select}
        onAdd={onAdd}
        error={validationMessage(errors.contactId?.message)}
      />

      <WizardActions backHref={previousStepRoute(TRANSFER_STEP.RECIPIENT)}>
        <Button variant={BUTTON_VARIANT.PRIMARY} type={BUTTON_TYPE.SUBMIT}>
          {selected ? (
            <>
              <span className={styles["recipient-step__cta-mobile"]}>
                {t("continueWith", { name: getFirstName(selected.name) })}
              </span>
              <span className={styles["recipient-step__cta-desktop"]}>{t("continue")}</span>
            </>
          ) : (
            t("continue")
          )}
        </Button>
      </WizardActions>
    </form>
  );
}
