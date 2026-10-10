import { useEffect, useRef } from "react";
import { toastManager } from "../ui/toast";
import { playNotificationSound, unlockNotificationAudio } from "../../threadNotifications";
import completionSoundUrl from "../../assets/notification-completion.mp3";

export const MOB_NOTIFICATION_TEST_STORAGE_KEY = "leonidas:mob-notification-test:v1";

export const MOB_NOTIFICATION_TEST_MESSAGE =
  "Hey Mob, this is an update that Jake sent to make sure notifications are working. This is a test, can you verify to him that this is working?";

export function playTestSound() {
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

export function showMobNotificationTestToast() {
  playTestSound();

  // Desktop native notification if permitted
  if (typeof Notification !== "undefined") {
    if (Notification.permission === "granted") {
      try {
        new Notification("Leonidas Code Notification Test", {
          body: MOB_NOTIFICATION_TEST_MESSAGE,
          tag: "leonidas-mob-notification-test",
        });
      } catch {
        // Ignored
      }
    } else if (Notification.permission !== "denied") {
      void Notification.requestPermission().then((perm) => {
        if (perm === "granted") {
          try {
            new Notification("Leonidas Code Notification Test", {
              body: MOB_NOTIFICATION_TEST_MESSAGE,
              tag: "leonidas-mob-notification-test",
            });
          } catch {
            // Ignored
          }
        }
      });
    }
  }

  const toastId = toastManager.add({
    type: "info",
    title: "🔔 Leonidas Notification Test",
    description: MOB_NOTIFICATION_TEST_MESSAGE,
    timeout: 0,
    actionProps: {
      children: "Verify & Confirm",
      onClick: () => {
        try {
          localStorage.setItem(MOB_NOTIFICATION_TEST_STORAGE_KEY, "acknowledged");
        } catch {
          // ignore
        }
        toastManager.close(toastId);
        toastManager.add({
          type: "success",
          title: "Verified!",
          description: "Notification confirmed working. You can let Jake know it passed!",
        });
      },
    },
    data: {
      actionLayout: "stacked-end",
      secondaryActionProps: {
        children: "Dismiss",
        onClick: () => {
          toastManager.close(toastId);
        },
      },
    },
  });

  return toastId;
}

export function LeonidasMobNotificationNotice() {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    try {
      const acknowledged = localStorage.getItem(MOB_NOTIFICATION_TEST_STORAGE_KEY);
      if (acknowledged === "acknowledged") return;
    } catch {
      // ignore
    }

    firedRef.current = true;
    const timer = setTimeout(() => {
      showMobNotificationTestToast();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
