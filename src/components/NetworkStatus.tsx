import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function NetworkStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    function onOnline() {
      setOnline(true);
    }

    function onOffline() {
      setOnline(false);
    }

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!online ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full border border-red-200 bg-red-50/95 px-3 py-1.5 text-xs font-semibold text-red-700 shadow-lg backdrop-blur dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-200"
        >
          Offline mode: reconnect for live Firebase updates.
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
