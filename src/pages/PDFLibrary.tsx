import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { listenToPdfLibrary, type PdfCategory, type PdfLibraryItem } from "../services/pdfService";
import { PDFViewer } from "../components/PDFViewer";
import { saveOfflinePdfPack } from "../services/offlineService";
import { listenContentLicensingPolicy, type ContentLicensingPolicy } from "../services/adminInfrastructureService";
import { useAuth } from "../hooks/useAuth";
import { isPrimaryAdminEmail } from "../config/admin";

type SubjectGroup = Record<string, Record<string, PdfLibraryItem[]>>;

const categoryLabel: Record<PdfCategory, string> = {
  short_notes: "Short Notes",
  formula_sheet: "Formula Sheet",
  pyq_collection: "PYQ Collection",
};

export default function PDFLibrary() {
  const { user } = useAuth();
  const [items, setItems] = useState<PdfLibraryItem[]>([]);
  const [activeItem, setActiveItem] = useState<PdfLibraryItem | null>(null);
  const [offlineHint, setOfflineHint] = useState("");
  const [licensingPolicy, setLicensingPolicy] = useState<ContentLicensingPolicy>({
    enablePremiumAccess: false,
    premiumSubjects: [],
    lockedPdfCategories: [],
    premiumMessage: "This content is available in premium access mode.",
  });

  useEffect(() => {
    const unsubscribe = listenToPdfLibrary(setItems);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    return listenContentLicensingPolicy(setLicensingPolicy);
  }, []);

  const isAdminSession = isPrimaryAdminEmail(user?.email);

  const grouped = useMemo(() => {
    return items.reduce<SubjectGroup>((acc, item) => {
      if (!acc[item.subject]) {
        acc[item.subject] = {};
      }
      if (!acc[item.subject][item.chapter]) {
        acc[item.subject][item.chapter] = [];
      }
      acc[item.subject][item.chapter].push(item);
      return acc;
    }, {});
  }, [items]);

  const activeIndex = useMemo(() => {
    if (!activeItem) {
      return -1;
    }
    return items.findIndex((item) => item.id === activeItem.id);
  }, [activeItem, items]);

  const openItem = (item: PdfLibraryItem) => setActiveItem(item);

  function isLocked(item: PdfLibraryItem) {
    if (!licensingPolicy.enablePremiumAccess || isAdminSession) {
      return false;
    }
    const subjectLocked = licensingPolicy.premiumSubjects.map((row) => row.toLowerCase()).includes(item.subject.toLowerCase());
    const categoryLocked = licensingPolicy.lockedPdfCategories.map((row) => row.toLowerCase()).includes(String(item.category).toLowerCase());
    return subjectLocked || categoryLocked;
  }

  const openNext = () => {
    if (activeIndex < 0 || activeIndex >= items.length - 1) {
      return;
    }
    setActiveItem(items[activeIndex + 1]);
  };

  const openPrev = () => {
    if (activeIndex <= 0) {
      return;
    }
    setActiveItem(items[activeIndex - 1]);
  };

  return (
    <>
      <section className="space-y-5 py-3">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel-3d p-5"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-orange-500">Part 13 Study Upgrade</p>
          <h2 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">PDF Study Library</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Open every PDF in in-app Study Mode with notes, focus timer, and sequential chapter navigation.
          </p>
        </motion.div>

        {items.length === 0 ? (
          <div className="rounded-3xl border border-white/70 bg-white/80 p-5 text-sm text-zinc-600 backdrop-blur-xl dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300">
            No PDFs uploaded yet. New resources will appear here instantly.
          </div>
        ) : null}

        <div className="space-y-4">
          {Object.entries(grouped).map(([subject, chapters]) => (
            <motion.div
              key={subject}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="panel-3d p-4"
            >
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{subject}</h3>
              <div className="mt-3 space-y-3">
                {Object.entries(chapters).map(([chapter, chapterItems]) => (
                  <div key={chapter} className="rounded-2xl border border-zinc-100 bg-white/90 p-3 dark:border-zinc-700 dark:bg-zinc-900/80">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">{chapter}</p>
                    <div className="mt-2 space-y-2">
                      {chapterItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (isLocked(item)) {
                              setOfflineHint(licensingPolicy.premiumMessage);
                              return;
                            }
                            openItem(item);
                          }}
                          className="w-full rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-left text-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-zinc-700 dark:text-zinc-100">{item.title}</span>
                            <div className="flex items-center gap-1.5">
                              <span className="rounded-full bg-zinc-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
                                v{item.version ?? 1}
                              </span>
                              <span className="rounded-full bg-orange-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-orange-700">
                                {categoryLabel[item.category]}
                              </span>
                              {isLocked(item) ? <span className="rounded-full bg-purple-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-purple-700">Premium</span> : null}
                            </div>
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Tap to open Study Mode</p>
                            <button
                              type="button"
                              className="btn-pill-ghost px-2 py-1 text-[10px]"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (isLocked(item)) {
                                  setOfflineHint(licensingPolicy.premiumMessage);
                                  return;
                                }
                                void saveOfflinePdfPack(item);
                                setOfflineHint(`${item.title} saved for offline list.`);
                              }}
                            >
                              Save Offline
                            </button>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
        {offlineHint ? <p className="text-xs text-zinc-500 dark:text-zinc-400">{offlineHint}</p> : null}
      </section>

      <AnimatePresence>
        {activeItem ? (
          <PDFViewer
            item={activeItem}
            index={activeIndex}
            total={items.length}
            onClose={() => setActiveItem(null)}
            onNext={openNext}
            onPrev={openPrev}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}