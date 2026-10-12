import { useClientSettings } from "../hooks/useSettings";
import { PetPlayer } from "./PetPlayer";

/** Bottom-right pet, mounted once at the app root and rendered only when the user opts in. */
export function PetOverlay() {
  const petEnabled = useClientSettings((settings) => settings.petEnabled);
  if (!petEnabled) return null;
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-40">
      <PetPlayer state="idle" />
    </div>
  );
}
