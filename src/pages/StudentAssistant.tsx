import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useAuth } from "../hooks/useAuth";
import { listenToUserTestHistory, type TestAttemptDoc } from "../services/questionService";
import {
  getAssistantMemory,
  generateStudentAssistantReply,
  getAiToolsSettings,
  listenAssistantMemory,
  normalizeAiToolsSettings,
  saveAssistantMemory,
  uploadAssistantScreenshot,
  type AssistantMemoryMessage,
  type AssistantUploadMemory,
  type AiToolsSettings,
} from "../services/aiService";
import { claimUsage, listenUsagePolicy, type UsagePolicy } from "../services/experienceService";

type ChatMessage = {
  role: "student" | "assistant";
  text: string;
  meta?: string;
};

const initialAssistantMessage: ChatMessage = {
  role: "assistant",
  text: "Ask me for test strategy, weak topic revision, or daily plan. I will use your performance data for personalized guidance.",
};

const quickPrompts = [
  "Make me a 3-day plan for Physics weak topics",
  "How to improve score from 55% to 75% in 2 weeks?",
  "Give me chapter wise revision strategy for NEET",
];

export default function StudentAssistant() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AiToolsSettings | null>(null);
  const [history, setHistory] = useState<TestAttemptDoc[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [uploadHint, setUploadHint] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"off" | "auto">("auto");
  const [speechRate, setSpeechRate] = useState(1);
  const [messages, setMessages] = useState<ChatMessage[]>([initialAssistantMessage]);
  const [uploadHistory, setUploadHistory] = useState<AssistantUploadMemory[]>([]);
  const [usagePolicy, setUsagePolicy] = useState<UsagePolicy>({
    dailyAiMessages: 30,
    dailyPdfDownloads: 20,
    dailyTestAttempts: 12,
    premiumModeEnabled: false,
  });
  const recognitionRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  function toMemoryMessages(rows: ChatMessage[]): AssistantMemoryMessage[] {
    return rows.map((row) => ({
      role: row.role,
      text: row.text,
      meta: row.meta,
      createdAt: Date.now(),
    }));
  }

  useEffect(() => {
    let mounted = true;
    getAiToolsSettings().then((data) => {
      if (mounted) {
        setSettings(normalizeAiToolsSettings(data));
      }
    });

    const unsubscribeSettings = onSnapshot(doc(db, "platform_settings", "ai_tools"), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(normalizeAiToolsSettings(snapshot.data() as Partial<AiToolsSettings>));
      } else {
        setSettings(null);
      }
    });

    return () => {
      mounted = false;
      unsubscribeSettings();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    return listenToUserTestHistory(user.uid, setHistory);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMessages([initialAssistantMessage]);
      setUploadHistory([]);
      setScreenshotUrl("");
      return;
    }

    // Reset local state immediately when account changes to avoid cross-user memory flash.
    setMessages([initialAssistantMessage]);
    setUploadHistory([]);
    setScreenshotUrl("");

    let mounted = true;
    getAssistantMemory(user.uid)
      .then((memory) => {
        if (!mounted) {
          return;
        }

        setMessages(memory.messages.length ? memory.messages.map((row) => ({ role: row.role, text: row.text, meta: row.meta })) : [initialAssistantMessage]);
        setUploadHistory(memory.uploads);
        setScreenshotUrl(memory.lastScreenshotUrl || "");
      })
      .catch(() => {
        // Memory load failures should not block assistant usage.
      });

    const unsubscribeMemory = listenAssistantMemory(user.uid, (memory) => {
      if (!mounted) {
        return;
      }

      setMessages(memory.messages.length ? memory.messages.map((row) => ({ role: row.role, text: row.text, meta: row.meta })) : [initialAssistantMessage]);
      setUploadHistory(memory.uploads);
      setScreenshotUrl(memory.lastScreenshotUrl || "");
    });

    return () => {
      mounted = false;
      unsubscribeMemory();
    };
  }, [user]);

  useEffect(() => {
    return listenUsagePolicy(setUsagePolicy);
  }, []);

  useEffect(() => {
    const speechReady = typeof window !== "undefined" && "speechSynthesis" in window;
    const SpeechRecognitionCtor =
      typeof window !== "undefined"
        ? ((window as unknown as { SpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; lang: string; start: () => void; stop: () => void; onresult?: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend?: () => void; onerror?: () => void } }).SpeechRecognition ||
            (window as unknown as { webkitSpeechRecognition?: new () => { continuous: boolean; interimResults: boolean; lang: string; start: () => void; stop: () => void; onresult?: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend?: () => void; onerror?: () => void } }).webkitSpeechRecognition)
        : null;

    setVoiceSupported(Boolean(speechReady && SpeechRecognitionCtor));

    if (!SpeechRecognitionCtor) {
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = settings?.voiceTutorLanguage || "en-IN";
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        setInput(transcript);
      }
    };
    recognition.onerror = () => {
      setUploadHint("Voice input failed. Try again or type manually.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [settings?.voiceTutorLanguage]);

  const context = useMemo(() => {
    const topicMap = new Map<string, { attempted: number; correct: number }>();
    const chapterCounts = new Map<string, number>();
    let accuracySum = 0;

    history.forEach((attempt) => {
      accuracySum += attempt.accuracy ?? 0;
      (attempt.weakChapters ?? []).forEach((chapter) => {
        chapterCounts.set(chapter, (chapterCounts.get(chapter) ?? 0) + 1);
      });

      Object.entries(attempt.topicPerformance ?? {}).forEach(([topic, perf]) => {
        const row = topicMap.get(topic) ?? { attempted: 0, correct: 0 };
        row.attempted += perf.attempted ?? 0;
        row.correct += perf.correct ?? 0;
        topicMap.set(topic, row);
      });
    });

    const weakTopics = [...topicMap.entries()]
      .map(([topic, perf]) => ({
        topic,
        accuracy: perf.attempted ? (perf.correct / perf.attempted) * 100 : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 4)
      .map((item) => item.topic);

    const weakChapters = [...chapterCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([chapter]) => chapter);

    const averageAccuracy = history.length ? Math.round(accuracySum / history.length) : 0;

    return {
      weakTopics,
      weakChapters,
      averageAccuracy,
      recentPerformance: history[0]
        ? `Last test accuracy ${history[0].accuracy}% with score ${history[0].correctAnswers}/${history[0].totalQuestions}`
        : "No test history yet",
    };
  }, [history]);

  async function askAssistant(messageText?: string) {
    if (!settings?.enableStudentAssistant || loading) {
      return;
    }

    const text = (messageText ?? input).trim();
    if (!text) {
      return;
    }

    if (user) {
      const usage = await claimUsage(user.uid, "ai", usagePolicy.dailyAiMessages);
      if (!usage.allowed) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: `Daily AI limit reached (${usage.limit}). Try again tomorrow or ask admin to increase limit.`,
            meta: "usage-limit",
          },
        ]);
        return;
      }
    }

    setLoading(true);
    const nextWithStudent = [...messages, { role: "student", text } as ChatMessage];
    setMessages(nextWithStudent);
    setInput("");

    try {
      const response = await generateStudentAssistantReply(
        {
          query: text,
          screenshotUrl,
          context: {
            exam: "NEET/JEE",
            weakTopics: context.weakTopics,
            weakChapters: context.weakChapters,
            averageAccuracy: context.averageAccuracy,
            recentPerformance: context.recentPerformance,
          },
        },
        settings,
      );

      const finalMessages = [
        ...nextWithStudent,
        {
          role: "assistant",
          text: response.answer,
          meta: `${response.providerUsed} • ${response.modelUsed}${response.fallbackUsed ? " • fallback" : ""}`,
        } satisfies ChatMessage,
      ];
      setMessages(finalMessages);
      if (voiceMode === "auto" && settings?.enableVoiceTutor) {
        speakText(response.answer, settings.voiceTutorLanguage);
      }
      setScreenshotUrl("");
      setUploadHint("");
      if (user) {
        await saveAssistantMemory(user.uid, {
          messages: toMemoryMessages(finalMessages),
          uploads: uploadHistory,
          lastScreenshotUrl: "",
          ownerEmail: user.email || "",
        });
      }
    } catch (error) {
      const finalMessages = [
        ...nextWithStudent,
        {
          role: "assistant",
          text: error instanceof Error ? error.message : "Assistant is unavailable right now.",
          meta: "error",
        } satisfies ChatMessage,
      ];
      setMessages(finalMessages);
      if (user) {
        await saveAssistantMemory(user.uid, {
          messages: toMemoryMessages(finalMessages),
          uploads: uploadHistory,
          lastScreenshotUrl: screenshotUrl,
          ownerEmail: user.email || "",
        });
      }
    } finally {
      setLoading(false);
    }
  }

  async function onUploadScreenshot(file: File | null) {
    if (!file || !user) {
      return;
    }

    setUploadingImage(true);
    setUploadHint("");

    try {
      const uploadedUrl = await uploadAssistantScreenshot(user.uid, file);
      const nextUploads: AssistantUploadMemory[] = [
        ...uploadHistory,
        {
          url: uploadedUrl,
          name: file.name,
          uploadedAt: Date.now(),
        },
      ].slice(-24);
      setScreenshotUrl(uploadedUrl);
      setUploadHistory(nextUploads);
      setUploadHint("Screenshot uploaded. Ask assistant now for step-by-step solve.");
      await saveAssistantMemory(user.uid, {
        messages: toMemoryMessages(messages),
        uploads: nextUploads,
        lastScreenshotUrl: uploadedUrl,
        ownerEmail: user.email || "",
      });
    } catch (error) {
      setUploadHint(error instanceof Error ? error.message : "Screenshot upload failed.");
    } finally {
      setUploadingImage(false);
    }
  }

  function speakText(text: string, language = "en-IN") {
    if (typeof window === "undefined" || !("speechSynthesis" in window) || !text.trim()) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.rate = speechRate;
    window.speechSynthesis.speak(utterance);
  }

  function toggleVoiceInput() {
    if (!recognitionRef.current || !settings?.enableVoiceTutor) {
      return;
    }

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    setUploadHint("Listening... speak your doubt clearly.");
    setListening(true);
    recognitionRef.current.start();
  }

  if (!settings?.enableStudentAssistant) {
    return (
      <section className="space-y-4 py-3">
        <div className="panel-3d p-5">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Deepu AI Assistance</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Assistant is currently unavailable. Please try again later.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 py-3">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="panel-3d p-5"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-orange-500">AI Advanced</p>
        <h2 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Deepu AI Assistance</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Personalized mentor chat with provider fallback and performance-aware recommendations.</p>
      </motion.div>

      <div className="panel-3d p-4">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Avg Accuracy: {context.averageAccuracy}%</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Weak Topics: {context.weakTopics.join(", ") || "No data yet"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => askAssistant(prompt)}
              className="btn-pill-ghost px-3 py-1.5 text-xs"
            >
              {prompt}
            </button>
          ))}
        </div>
        {settings?.enableVoiceTutor ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-pill-ghost px-3 py-1.5 text-[11px]"
              onClick={() => setVoiceMode((prev) => (prev === "auto" ? "off" : "auto"))}
            >
              Voice Tutor: {voiceMode === "auto" ? "Auto Read" : "Manual"}
            </button>
            <button
              type="button"
              className="btn-pill-ghost px-3 py-1.5 text-[11px]"
              onClick={toggleVoiceInput}
              disabled={!voiceSupported}
            >
              {listening ? "Stop Mic" : "Voice Input"}
            </button>
            <label className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Speed
              <input
                type="range"
                min={0.8}
                max={1.3}
                step={0.1}
                value={speechRate}
                onChange={(event) => setSpeechRate(Number(event.target.value))}
                className="ml-2 align-middle"
              />
            </label>
          </div>
        ) : null}
      </div>

      <div className="panel-3d space-y-3 p-4">
        <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-2xl p-3 text-sm ${
                message.role === "student"
                  ? "ml-8 bg-zinc-900 text-white"
                  : "mr-8 border border-zinc-200 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.text}</p>
              {message.role === "assistant" && settings?.enableVoiceTutor ? (
                <button
                  type="button"
                  className="mt-2 text-[11px] font-semibold text-orange-500"
                  onClick={() => speakText(message.text, settings.voiceTutorLanguage)}
                >
                  Play Voice
                </button>
              ) : null}
              {message.meta ? <p className="mt-1 text-[11px] opacity-70">{message.meta}</p> : null}
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            className="input-soft flex-1"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask strategy, revision plan, or test filters"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void askAssistant();
              }
            }}
          />
          <button
            className="btn-pill-primary px-4 py-2 text-xs"
            type="button"
            onClick={() => askAssistant()}
            disabled={loading}
          >
            {loading ? "Thinking..." : "Send"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn-pill-ghost cursor-pointer px-3 py-1.5 text-[11px]">
            {uploadingImage ? "Uploading..." : "Upload Question Screenshot"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingImage || loading}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void onUploadScreenshot(file);
                event.currentTarget.value = "";
              }}
            />
          </label>
          {screenshotUrl ? (
            <a
              className="text-[11px] font-medium text-orange-500 underline"
              href={screenshotUrl}
              target="_blank"
              rel="noreferrer"
            >
              Preview screenshot
            </a>
          ) : null}
        </div>
        {uploadHistory.length ? (
          <div className="flex flex-wrap gap-2">
            {uploadHistory
              .slice()
              .reverse()
              .slice(0, 4)
              .map((item) => (
                <a
                  key={`${item.url}-${item.uploadedAt}`}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {item.name.length > 16 ? `${item.name.slice(0, 16)}...` : item.name}
                </a>
              ))}
          </div>
        ) : null}
        {uploadHint ? <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{uploadHint}</p> : null}
      </div>
    </section>
  );
}
