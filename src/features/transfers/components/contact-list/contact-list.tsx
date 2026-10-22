"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId } from "react";
import { assertUnreachable } from "@/domain/shared/assert-unreachable";
import { getRequestId } from "@/shared/lib/api/api-client";
import type { ContactView } from "@/shared/lib/api/views";
import { ALERT_ROLE } from "@/shared/ui/alert/types";
import { BUTTON_TYPE } from "@/shared/ui/button/types";
import { Icon } from "@/shared/ui/icon/icon";
import { ICON_NAME, ICON_SIZE } from "@/shared/ui/icon/types";
import { Skeleton } from "@/shared/ui/skeleton/skeleton";
import { SKELETON_SHAPE, SKELETON_SIZE } from "@/shared/ui/skeleton/types";
import { contactsQueryOptions } from "../../api/contact-queries";
import { ContactRow } from "../contact-row/contact-row";
import { WizardState } from "../wizard-state/wizard-state";
import styles from "./contact-list.module.scss";
import { CONTACT_LIST_STATE, CONTACT_SKELETON_ROWS, type ContactListState } from "./types";

interface ContactListProps {
  selectedId: string | null;
  onSelect: (contact: ContactView) => void;
  onAdd: () => void;
  error?: string;
}

function listState(isPending: boolean, isError: boolean, contacts: readonly ContactView[]): ContactListState {
  if (isPending) {
    return CONTACT_LIST_STATE.LOADING;
  }

  if (isError) {
    return CONTACT_LIST_STATE.ERROR;
  }

  return contacts.length === 0 ? CONTACT_LIST_STATE.EMPTY : CONTACT_LIST_STATE.LIST;
}

export function ContactList({ selectedId, onSelect, onAdd, error }: ContactListProps) {
  const t = useTranslations("transfers.recipient");
  const groupName = useId();
  const headingId = useId();
  const errorId = useId();
  const query = useQuery(contactsQueryOptions());
  const contacts = query.data?.items ?? [];
  const state = listState(query.isPending, query.isError, contacts);

  const addRow = (
    <button type={BUTTON_TYPE.BUTTON} onClick={onAdd} className={styles["contact-list__add"]}>
      <Icon name={ICON_NAME.PLUS} size={ICON_SIZE.MD} />
      {t("add")}
    </button>
  );

  function renderContent() {
    switch (state) {
      case CONTACT_LIST_STATE.LOADING:
        return (
          <div className={styles["contact-list__rows"]} aria-busy="true">
            {Array.from({ length: CONTACT_SKELETON_ROWS }, (_, index) => (
              <div key={index} className={styles["contact-list__skeleton"]} data-testid="contact-skeleton">
                <Skeleton shape={SKELETON_SHAPE.CIRCLE} size={SKELETON_SIZE.SM} />
                <span className={styles["contact-list__skeleton-text"]}>
                  <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.MD} width="55%" />
                  <Skeleton shape={SKELETON_SHAPE.LINE} size={SKELETON_SIZE.SM} width="35%" />
                </span>
              </div>
            ))}
          </div>
        );
      case CONTACT_LIST_STATE.ERROR:
        return (
          <div className={styles["contact-list__rows"]}>
            <WizardState
              icon={ICON_NAME.ALERT}
              title={t("error.title")}
              actionLabel={t("error.retry")}
              onAction={() => void query.refetch()}
              requestId={getRequestId(query.error)}
              role={ALERT_ROLE.ALERT}
            />
            {addRow}
          </div>
        );
      case CONTACT_LIST_STATE.EMPTY:
        return (
          <WizardState
            icon={ICON_NAME.USERS}
            title={t("empty.title")}
            text={t("empty.text")}
            actionLabel={t("add")}
            onAction={onAdd}
          />
        );
      case CONTACT_LIST_STATE.LIST:
        return (
          <div className={styles["contact-list__rows"]}>
            <div
              role="radiogroup"
              aria-label={t("listLabel")}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={styles["contact-list__group"]}
            >
              {contacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  name={groupName}
                  checked={contact.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </div>
            {addRow}
          </div>
        );
      default:
        return assertUnreachable(state);
    }
  }

  return (
    <section aria-labelledby={headingId} className={styles["contact-list"]}>
      <h3 id={headingId} className={styles["contact-list__heading"]}>
        {t("favorites")}
      </h3>
      {renderContent()}
      {error && (
        <p id={errorId} className={styles["contact-list__error"]}>
          {error}
        </p>
      )}
    </section>
  );
}
