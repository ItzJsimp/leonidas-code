import { playNotificationSound, unlockNotificationAudio } from "../../threadNotifications";
import completionSoundUrl from "../../assets/notification-completion.mp3";

/** Plays the chime when a desktop update is ready to install. */
export function playUpdateReadySound() {
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
