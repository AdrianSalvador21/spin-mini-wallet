"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { READ_SCENARIO, SCENARIO_COOKIE, TRANSFER_SCENARIO } from "@/shared/lib/api/contract";
import { MEDIA_QUERY, useMediaQuery } from "@/shared/lib/media/use-media-query";
import { BUTTON_TYPE } from "@/shared/ui/button/types";
import { DESKTOP_PLACEMENT } from "../../drag-position";
import { useDraggablePosition } from "../../hooks/use-draggable-position";
import { readScenarioCookies, writeScenarioCookie, type ScenarioCookies } from "../../scenario-cookies";
import styles from "./dev-panel.module.scss";
import { NO_SCENARIO } from "./types";

const TRANSFER_OPTIONS = Object.values(TRANSFER_SCENARIO);
const READ_OPTIONS = Object.values(READ_SCENARIO).filter((scenario) => scenario !== READ_SCENARIO.OK);

function subscribe() {
  return () => undefined;
}

export function DevPanel() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return mounted ? <DevPanelContent /> : null;
}

function DevPanelContent() {
  const t = useTranslations("devTools");
  const queryClient = useQueryClient();
  const panelId = useId();
  const transferId = useId();
  const readId = useId();
  const [open, setOpen] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioCookies>(() => readScenarioCookies());
  const isDesktop = useMediaQuery(MEDIA_QUERY.LG);
  const {
    containerRef,
    position,
    placement: dragPlacement,
    measurePlacement,
    consumeDrag,
    handlers,
  } = useDraggablePosition(!isDesktop);
  const placement = isDesktop ? DESKTOP_PLACEMENT : dragPlacement;

  function toggle() {
    if (consumeDrag()) {
      return;
    }

    if (!open && !isDesktop) {
      measurePlacement();
    }

    setOpen((value) => !value);
  }

  function refresh() {
    setScenarios(readScenarioCookies());
  }

  function changeTransfer(event: ChangeEvent<HTMLSelectElement>) {
    writeScenarioCookie(SCENARIO_COOKIE.TRANSFER, event.target.value || null);
    refresh();
  }

  function changeRead(event: ChangeEvent<HTMLSelectElement>) {
    writeScenarioCookie(SCENARIO_COOKIE.READ, event.target.value || null);
    refresh();
    void queryClient.invalidateQueries();
  }

  function reset() {
    writeScenarioCookie(SCENARIO_COOKIE.TRANSFER, null);
    writeScenarioCookie(SCENARIO_COOKIE.READ, null);
    refresh();
    void queryClient.invalidateQueries();
  }

  const transferLabel = scenarios.transfer ? t(`transferScenarios.${scenarios.transfer}`) : t("random");

  return (
    <section
      ref={containerRef}
      aria-label={t("toggle")}
      className={[styles["dev-panel"], position && styles["dev-panel--moved"]].filter(Boolean).join(" ")}
      style={position ? { left: position.x, top: position.y } : undefined}
    >
      {open ? (
        <div
          id={panelId}
          className={[
            styles["dev-panel__card"],
            styles[`dev-panel__card--${placement.vertical}`],
            styles[`dev-panel__card--${placement.horizontal}`],
          ].join(" ")}
        >
          <p className={styles["dev-panel__title"]}>{t("title")}</p>
          <label htmlFor={transferId} className={styles["dev-panel__label"]}>
            {t("transfer")}
          </label>
          <select
            id={transferId}
            value={scenarios.transfer ?? NO_SCENARIO}
            onChange={changeTransfer}
            className={styles["dev-panel__select"]}
          >
            <option value={NO_SCENARIO}>{t("random")}</option>
            {TRANSFER_OPTIONS.map((scenario) => (
              <option key={scenario} value={scenario}>
                {t(`transferScenarios.${scenario}`)}
              </option>
            ))}
          </select>
          <label htmlFor={readId} className={styles["dev-panel__label"]}>
            {t("read")}
          </label>
          <select
            id={readId}
            value={scenarios.read ?? NO_SCENARIO}
            onChange={changeRead}
            className={styles["dev-panel__select"]}
          >
            <option value={NO_SCENARIO}>{t("normal")}</option>
            {READ_OPTIONS.map((scenario) => (
              <option key={scenario} value={scenario}>
                {t(`readScenarios.${scenario}`)}
              </option>
            ))}
          </select>
          <button type={BUTTON_TYPE.BUTTON} onClick={reset} className={styles["dev-panel__reset"]}>
            {t("reset")}
          </button>
        </div>
      ) : null}
      <button
        type={BUTTON_TYPE.BUTTON}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={toggle}
        {...handlers}
        className={[styles["dev-panel__pill"], !isDesktop && styles["dev-panel__pill--draggable"]]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={styles["dev-panel__tag"]}>{t("tag")}</span> {transferLabel}
      </button>
    </section>
  );
}
