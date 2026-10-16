import type { EnvironmentId } from "@t3tools/contracts";
import { useEffect } from "react";
import { useEnvironment } from "../state/environments";

/** Publish only this computer's workspace; remote paths are not local skill catalogs. */
export function useScribeWorkspace(
  environmentId: EnvironmentId | null,
  workspaceRoot: string | null,
) {
  const environment = useEnvironment(environmentId);
  const root = environment?.entry.target._tag === "PrimaryConnectionTarget" ? workspaceRoot : null;
  useEffect(() => {
    const publish = window.desktopBridge?.setScribeWorkspace;
    if (!publish) return;
    const write = (value: string | null) => {
      void publish(value).catch((error: unknown) =>
        console.warn("Scribe workspace unavailable", error),
      );
    };
    const send = () => {
      if (document.hasFocus()) write(root);
    };
    send();
    window.addEventListener("focus", send);
    const timer = window.setInterval(send, 10_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", send);
      write(null);
    };
  }, [root]);
}
