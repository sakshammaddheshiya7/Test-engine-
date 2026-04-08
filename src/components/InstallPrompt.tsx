import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = window.localStorage.getItem("rankforge_install_dismissed");
    if (dismissed === "1") {
      return;
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setIsVisible(true);
    }

    function onInstalled() {
      setIsVisible(false);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function onInstallClick() {
    if (!deferredPrompt) {
      return;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        window.localStorage.removeItem("rankforge_install_dismissed");
      }
      setDeferredPrompt(null);
      setIsVisible(false);
    } catch {
      setIsVisible(false);
    }
  }

  function onDismiss() {
    window.localStorage.setItem("rankforge_install_dismissed", "1");
    setIsVisible(false);
  }

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-24 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-2 rounded-full border border-white/70 bg-white/85 p-1.5 shadow-[0_12px_30px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-zinc-700 dark:bg-zinc-900/90">
      <button
        type="button"
        onClick={onInstallClick}
        className="min-h-10 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-orange-300"
      >
        Install App
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="min-h-10 rounded-full px-3 py-1 text-xs font-semibold text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-100"
      >
        Not now
      </button>
    </div>
  );
}