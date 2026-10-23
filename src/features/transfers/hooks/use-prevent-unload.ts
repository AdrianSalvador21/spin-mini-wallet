import { useEffect } from "react";

function preventUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = "";
}

export function usePreventUnload(active: boolean): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    window.addEventListener("beforeunload", preventUnload);

    return () => window.removeEventListener("beforeunload", preventUnload);
  }, [active]);
}
