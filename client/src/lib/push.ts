import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { api } from "./api";
import { useToast } from "@/components/Toast";

export const PUSH_TOKEN_KEY = "panelforge.push_token";

let PushNotifications: any = null;

async function getPushNotifications() {
  if (!PushNotifications) {
    const mod = await import("@capacitor/push-notifications");
    PushNotifications = mod.PushNotifications as any;
  }
  return PushNotifications;
}

let isRegistered = false;

export async function registerPush() {
  if (!Capacitor.isNativePlatform()) return;
  if (isRegistered) return;

  const Push = await getPushNotifications();
  const saved = await Preferences.get({ key: PUSH_TOKEN_KEY });
  if (!saved.value) {
    await Push.requestPermissions();
  }

  const reg = (await Push.register()) as any;
  reg.addEventListener("token", (event: any) => {
    const token = event.value;
    Preferences.set({ key: PUSH_TOKEN_KEY, value: token }).then(() => {
      api("POST", "/api/notifications/register-token", { token, platform: "android" }).catch(() => {});
    });
  });
  reg.addEventListener("registrationError", (event: any) => {
    console.warn("[push] error de registro:", event.message);
  });

  if (saved.value) {
    isRegistered = true;
  }
}

export function usePushListener() {
  const { show } = useToast();
  if (!Capacitor.isNativePlatform()) return;
  getPushNotifications().then((Push) => {
    Push.addListener("notificationReceived", (notification: any) => {
      api("POST", "/api/notifications/register-token", { token: notification.token, platform: "android" }).catch(() => {});
    });
    Push.addListener("notificationActionPerformed", (action: any) => {
      console.log("[push] acción:", action.userText);
    });
  });
}
