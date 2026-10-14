import { playNotificationSound, unlockNotificationAudio } from "../../threadNotifications";
import completionSoundUrl from "../../assets/notification-completion.mp3";

/** Chime played when an update finishes downloading. */
export function playUpdateSound() {
  if (typeof AudioContext !== "undefined") {
    unlockNotificationAudio();
  }
  if (typeof Audio !== "undefined") {
    try {
      const audio = new Audio(completionSoundUrl);
      audio.volume = 1.0;
      void audio.play().catch(() => {
        void playNotificationSound("completion", () => true);
      });
    } catch {
      void playNotificationSound("completion", () => true);
    }
  }
}
