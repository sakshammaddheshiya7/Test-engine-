import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { listenToUserQuestionCollection, type SavedQuestionDoc } from "../services/questionService";

type FlashState = Record<string, { confidence: "low" | "medium" | "high"; seen: number }>;

function getFlashStoreKey(userId: string) {
  return `rankforge_flash_state_${userId}`;
}

export default function Flashcards() {
  const { user } = useAuth();
  const [mistakes, setMistakes] = useState<SavedQuestionDoc[]>([]);
  const [saved, setSaved] = useState<SavedQuestionDoc[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [stateMap, setStateMap] = useState<FlashState>({});

  useEffect(() => {
    if (!user) {
      return;
    }

    const raw = localStorage.getItem(getFlashStoreKey(user.uid));
    if (raw) {
      try {
        setStateMap(JSON.parse(raw) as FlashState);
      } catch {
        setStateMap({});
      }
    }

    const unsubMistakes = listenToUserQuestionCollection(user.uid, "mistake_book", setMistakes);
    const unsubSaved = listenToUserQuestionCollection(user.uid, "saved_questions", setSaved);

    return () => {
      unsubMistakes();
      unsubSaved();
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    localStorage.setItem(getFlashStoreKey(user.uid), JSON.stringify(stateMap));
  }, [stateMap, user]);

  const cards = useMemo(() => {
    const map = new Map<string, SavedQuestionDoc>();
    [...mistakes, ...saved].forEach((item) => {
      map.set(item.id, item);
    });

    return [...map.values()].sort((a, b) => {
      const aWeight = stateMap[a.id]?.confidence === "low" ? 0 : stateMap[a.id]?.confidence === "medium" ? 1 : 2;
      const bWeight = stateMap[b.id]?.confidence === "low" ? 0 : stateMap[b.id]?.confidence === "medium" ? 1 : 2;
      return aWeight - bWeight;
    });
  }, [mistakes, saved, stateMap]);

  const current = cards[activeIndex];

  function markCard(confidence: "low" | "medium" | "high") {
    if (!current) {
      return;
    }

    setStateMap((prev) => {
      const previousSeen = prev[current.id]?.seen ?? 0;
      return {
        ...prev,
        [current.id]: {
          confidence,
          seen: previousSeen + 1,
        },
      };
    });

    setShowAnswer(false);
    setActiveIndex((prev) => (cards.length ? (prev + 1) % cards.length : 0));
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-panel rounded-[26px] p-5">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Flashcard Revision</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Swipe-like rapid revision from your saved and mistake questions.</p>
      </motion.div>

      {!current ? (
        <div className="glass-panel rounded-2xl p-4 text-sm text-zinc-500 dark:text-zinc-300">
          No flashcards yet. Solve tests and save questions to build your deck.
        </div>
      ) : (
        <motion.article
          key={current.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-panel rounded-[26px] p-4"
        >
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-300">
            <span>
              Card {activeIndex + 1} / {cards.length}
            </span>
            <span>{current.subject}</span>
          </div>

          <p className="mt-3 text-base font-medium text-zinc-900 dark:text-zinc-100">{current.question}</p>

          {!showAnswer ? (
            <button type="button" className="btn-pill-primary mt-4 w-full" onClick={() => setShowAnswer(true)}>
              Reveal Answer
            </button>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
                Correct: {current.correct_answer}
              </div>
              {current.solution ? (
                <p className="rounded-2xl border border-zinc-200 bg-white/85 p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200">
                  {current.solution}
                </p>
              ) : null}
              <div className="grid grid-cols-3 gap-2">
                <button type="button" className="btn-pill-ghost" onClick={() => markCard("low")}>Again</button>
                <button type="button" className="btn-pill-ghost" onClick={() => markCard("medium")}>Good</button>
                <button type="button" className="btn-pill-primary" onClick={() => markCard("high")}>Easy</button>
              </div>
            </div>
          )}
        </motion.article>
      )}
    </section>
  );
}