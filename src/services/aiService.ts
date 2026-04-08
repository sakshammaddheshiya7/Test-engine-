import { addDoc, collection, doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db } from "../firebase/firebaseConfig";
import { storage } from "../firebase/firebaseConfig";
import type { QuestionDoc } from "./questionService";

export type AiProvider = "openrouter" | "sarvam" | "emergent";

export const defaultModelByProvider: Record<AiProvider, string> = {
  openrouter: "deepseek/deepseek-r1-0528:free",
  sarvam: "sarvam-m",
  emergent: "gpt-oss-20b",
};

type GenerateQuestionInput = {
  provider: AiProvider;
  model: string;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  type: "PYQ" | "Normal";
  count: number;
  prompt: string;
};

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

export type MistakeTag = "Concept Error" | "Calculation Error" | "Silly Mistake";

export type MistakeAnalysisResult = {
  conceptErrors: number;
  calculationErrors: number;
  sillyMistakes: number;
  suggestions: string[];
};

export type AiToolsSettings = {
  enableStudentAi: boolean;
  enableStudentAssistant: boolean;
  enableVoiceTutor: boolean;
  voiceTutorLanguage: string;
  useFastestModelRace: boolean;
  provider: AiProvider;
  model: string;
  fallbackProviders: AiProvider[];
  fallbackModels?: Partial<Record<AiProvider, string>>;
  enableLocalFallback: boolean;
  assistantPersona: string;
};

export type AiRuntimeConfig = {
  openrouterKey: string;
  sarvamKey: string;
  sarvamBaseUrl: string;
  emergentKey: string;
  emergentBaseUrl: string;
};

const DEFAULT_SETTINGS: AiToolsSettings = {
  enableStudentAi: false,
  enableStudentAssistant: true,
  enableVoiceTutor: true,
  voiceTutorLanguage: "en-IN",
  useFastestModelRace: true,
  provider: "openrouter",
  model: defaultModelByProvider.openrouter,
  fallbackProviders: ["emergent", "sarvam"],
  fallbackModels: {
    openrouter: defaultModelByProvider.openrouter,
    sarvam: defaultModelByProvider.sarvam,
    emergent: defaultModelByProvider.emergent,
  },
  enableLocalFallback: true,
  assistantPersona: "Focused NEET/JEE mentor. Keep answer concise, practical, and exam-oriented.",
};

const DEFAULT_RUNTIME_CONFIG: AiRuntimeConfig = {
  openrouterKey: "",
  sarvamKey: "",
  sarvamBaseUrl: "https://api.sarvam.ai/v1",
  emergentKey: "",
  emergentBaseUrl: "",
};

let runtimeConfigCache: { value: AiRuntimeConfig; fetchedAt: number } | null = null;

type ProviderAttempt = {
  provider: AiProvider;
  model: string;
  error: string;
};

type ProviderRunResult = {
  content: string;
  provider: AiProvider;
  model: string;
  fallbackUsed: boolean;
  attempts: ProviderAttempt[];
};

type ProviderCallConfig = {
  provider: AiProvider;
  model: string;
  endpoint: string;
  key: string;
  headers?: Record<string, string>;
};

const aiRateWindowMs = 60_000;
const aiRateLimit = 18;
const aiCallRegistry = new Map<string, number[]>();

function enforceAiRateLimit(bucket = "global") {
  const now = Date.now();
  const hits = aiCallRegistry.get(bucket) ?? [];
  const recent = hits.filter((time) => now - time < aiRateWindowMs);
  if (recent.length >= aiRateLimit) {
    throw new Error("AI request limit reached. Please wait a minute and try again.");
  }
  recent.push(now);
  aiCallRegistry.set(bucket, recent);
}

export type AssistantRequest = {
  query: string;
  screenshotUrl?: string;
  context?: {
    exam?: "NEET" | "JEE" | "NEET/JEE";
    weakTopics?: string[];
    weakChapters?: string[];
    averageAccuracy?: number;
    recentPerformance?: string;
  };
};

export type AssistantReply = {
  answer: string;
  providerUsed: AiProvider | "local-fallback";
  modelUsed: string;
  fallbackUsed: boolean;
  attempts: ProviderAttempt[];
};

export type AssistantMemoryMessage = {
  role: "student" | "assistant";
  text: string;
  meta?: string;
  createdAt: number;
};

export type AssistantUploadMemory = {
  url: string;
  name: string;
  uploadedAt: number;
};

function extractContent(responseJson: unknown) {
  if (!responseJson || typeof responseJson !== "object") {
    return "";
  }

  const root = responseJson as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };
  const message = root.choices?.[0]?.message?.content;

  if (typeof message === "string") {
    return message;
  }

  if (Array.isArray(message)) {
    return message
      .map((item) => (typeof item?.text === "string" ? item.text : ""))
      .join("\n")
      .trim();
  }

  return "";
}

function extractJsonArray(content: string) {
  const fenced = content.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? content;
  const start = fenced.indexOf("[");
  const end = fenced.lastIndexOf("]");
  const candidate = start >= 0 && end > start ? fenced.slice(start, end + 1) : fenced;
  return JSON.parse(candidate) as QuestionDoc[];
}

function buildMessages(input: GenerateQuestionInput): ChatMessage[] {
  return [
    {
      role: "system",
      content:
        "You are an expert NEET/JEE question setter. Return only strict JSON array with no extra text. Each item must include: subject, chapter, topic, difficulty (easy|medium|hard), type (PYQ|Normal), question, options (exactly 4), correct_answer, solution, pdf_link (empty string allowed).",
    },
    {
      role: "user",
      content: `Generate ${input.count} high-quality MCQ questions for competitive exam prep.\nSubject: ${input.subject}\nChapter: ${input.chapter}\nTopic: ${input.topic}\nDifficulty: ${input.difficulty}\nType: ${input.type}\nAdditional instructions: ${input.prompt || "None"}`,
    },
  ];
}

function dedupeProviders(providers: AiProvider[]) {
  return providers.filter((provider, index) => providers.indexOf(provider) === index);
}

async function resolveRuntimeConfig() {
  const now = Date.now();
  if (runtimeConfigCache && now - runtimeConfigCache.fetchedAt < 120_000) {
    return runtimeConfigCache.value;
  }

  try {
    const snapshot = await getDoc(doc(db, "platform_settings", "ai_runtime"));
    const firestoreConfig = snapshot.exists() ? (snapshot.data() as Partial<AiRuntimeConfig>) : {};
    const resolved: AiRuntimeConfig = {
      openrouterKey: firestoreConfig.openrouterKey?.trim() || import.meta.env.VITE_OPENROUTER_API_KEY || "",
      sarvamKey: firestoreConfig.sarvamKey?.trim() || import.meta.env.VITE_SARVAM_API_KEY || "",
      sarvamBaseUrl: firestoreConfig.sarvamBaseUrl?.trim() || import.meta.env.VITE_SARVAM_BASE_URL || "https://api.sarvam.ai/v1",
      emergentKey: firestoreConfig.emergentKey?.trim() || import.meta.env.VITE_EMERGENT_API_KEY || "",
      emergentBaseUrl: firestoreConfig.emergentBaseUrl?.trim() || import.meta.env.VITE_EMERGENT_BASE_URL || "",
    };
    runtimeConfigCache = { value: resolved, fetchedAt: now };
    return resolved;
  } catch {
    const fallback: AiRuntimeConfig = {
      openrouterKey: import.meta.env.VITE_OPENROUTER_API_KEY || "",
      sarvamKey: import.meta.env.VITE_SARVAM_API_KEY || "",
      sarvamBaseUrl: import.meta.env.VITE_SARVAM_BASE_URL || "https://api.sarvam.ai/v1",
      emergentKey: import.meta.env.VITE_EMERGENT_API_KEY || "",
      emergentBaseUrl: import.meta.env.VITE_EMERGENT_BASE_URL || "",
    };
    runtimeConfigCache = { value: fallback, fetchedAt: now };
    return fallback;
  }
}

function getProviderConfig(provider: AiProvider, runtimeConfig: AiRuntimeConfig) {
  if (provider === "openrouter") {
    return {
      endpoint: "https://openrouter.ai/api/v1/chat/completions",
      key: runtimeConfig.openrouterKey,
      headers: {
        "HTTP-Referer": window.location.origin,
        "X-OpenRouter-Title": "RankForge AI",
      } as Record<string, string>,
    };
  }

  if (provider === "sarvam") {
    const base = runtimeConfig.sarvamBaseUrl || "https://api.sarvam.ai/v1";
    return {
      endpoint: `${base}/chat/completions`,
      key: runtimeConfig.sarvamKey,
      headers: {} as Record<string, string>,
    };
  }

  const base = runtimeConfig.emergentBaseUrl || "";
  return {
    endpoint: `${base.replace(/\/$/, "")}/chat/completions`,
    key: runtimeConfig.emergentKey,
    headers: {} as Record<string, string>,
  };
}

async function runProviderWithFallback(
  messages: ChatMessage[],
  primaryProvider: AiProvider,
  primaryModel: string,
  settings?: Partial<AiToolsSettings>,
) {
  const runtimeConfig = await resolveRuntimeConfig();
  const attempts: ProviderAttempt[] = [];
  const fallbackProviders = settings?.fallbackProviders ?? DEFAULT_SETTINGS.fallbackProviders;
  const chain = dedupeProviders([primaryProvider, ...fallbackProviders]);

  for (let index = 0; index < chain.length; index += 1) {
    const provider = chain[index];
    const model =
      (index === 0 ? primaryModel : settings?.fallbackModels?.[provider]) ??
      defaultModelByProvider[provider] ??
      primaryModel;

    const providerConfig = getProviderConfig(provider, runtimeConfig);
    if (!providerConfig.key || !providerConfig.endpoint.startsWith("http")) {
      attempts.push({
        provider,
        model,
        error: "Missing API key or endpoint configuration.",
      });
      continue;
    }

    try {
      const responseJson = await callOpenAICompatibleApi(
        providerConfig.endpoint,
        providerConfig.key,
        model,
        messages,
        providerConfig.headers,
      );
      const content = extractContent(responseJson);

      if (!content) {
        attempts.push({ provider, model, error: "Provider returned empty content." });
        continue;
      }

      const result: ProviderRunResult = {
        content,
        provider,
        model,
        fallbackUsed: index > 0,
        attempts,
      };
      return result;
    } catch (error) {
      attempts.push({
        provider,
        model,
        error: error instanceof Error ? error.message : "Unknown provider error",
      });
    }
  }

  throw new Error(
    `AI providers unavailable. Attempts: ${attempts
      .map((attempt) => `${attempt.provider}(${attempt.model})`)
      .join(" -> ")}`,
  );
}

async function callSingleProvider(messages: ChatMessage[], config: ProviderCallConfig) {
  const responseJson = await callOpenAICompatibleApi(
    config.endpoint,
    config.key,
    config.model,
    messages,
    config.headers,
  );
  const content = extractContent(responseJson);
  if (!content) {
    throw new Error("Provider returned empty content.");
  }

  return {
    content,
    provider: config.provider,
    model: config.model,
  };
}

async function runProviderFastest(
  messages: ChatMessage[],
  primaryProvider: AiProvider,
  primaryModel: string,
  settings?: Partial<AiToolsSettings>,
) {
  const runtimeConfig = await resolveRuntimeConfig();
  const attempts: ProviderAttempt[] = [];
  const fallbackProviders = settings?.fallbackProviders ?? DEFAULT_SETTINGS.fallbackProviders;
  const chain = dedupeProviders([primaryProvider, ...fallbackProviders]);

  const providerConfigs: ProviderCallConfig[] = [];
  chain.forEach((provider, index) => {
    const model =
      (index === 0 ? primaryModel : settings?.fallbackModels?.[provider]) ??
      defaultModelByProvider[provider] ??
      primaryModel;

    const providerConfig = getProviderConfig(provider, runtimeConfig);
    if (!providerConfig.key || !providerConfig.endpoint.startsWith("http")) {
      attempts.push({
        provider,
        model,
        error: "Missing API key or endpoint configuration.",
      });
      return;
    }

    providerConfigs.push({
      provider,
      model,
      endpoint: providerConfig.endpoint,
      key: providerConfig.key,
      headers: providerConfig.headers,
    });
  });

  if (!providerConfigs.length) {
    throw new Error("AI providers unavailable. Missing key or endpoint configuration.");
  }

  const wrappedCalls = providerConfigs.map((config) =>
    callSingleProvider(messages, config).catch((error: unknown) => {
      attempts.push({
        provider: config.provider,
        model: config.model,
        error: error instanceof Error ? error.message : "Unknown provider error",
      });
      throw error;
    }),
  );

  try {
    const fastestResult = await new Promise<{
      content: string;
      provider: AiProvider;
      model: string;
    }>((resolve, reject) => {
      let pending = wrappedCalls.length;
      wrappedCalls.forEach((call) => {
        call
          .then((value) => {
            resolve(value);
          })
          .catch(() => {
            pending -= 1;
            if (pending <= 0) {
              reject(new Error("All providers failed."));
            }
          });
      });
    });
    return {
      ...fastestResult,
      fallbackUsed: fastestResult.provider !== primaryProvider,
      attempts,
    } satisfies ProviderRunResult;
  } catch {
    throw new Error(
      `AI providers unavailable. Attempts: ${attempts
        .map((attempt) => `${attempt.provider}(${attempt.model})`)
        .join(" -> ")}`,
    );
  }
}

function buildLocalFallbackReply(request: AssistantRequest) {
  const weakTopics = request.context?.weakTopics?.slice(0, 3).join(", ") || "conceptual weak areas";
  const weakChapters = request.context?.weakChapters?.slice(0, 2).join(", ") || "core chapters";
  const accuracy = request.context?.averageAccuracy ?? 0;
  const exam = request.context?.exam ?? "NEET/JEE";

  return [
    `Quick Mentor Plan (${exam})`,
    `Current estimated accuracy: ${accuracy}%`,
    `Priority topics: ${weakTopics}`,
    `Priority chapters: ${weakChapters}`,
    "Daily loop: 25 concept questions + 10 PYQ + 20 min mistake review.",
    "Every 3rd day: full mixed timed test and analyze wrong options.",
    `Your query focus: ${request.query}`,
  ].join("\n");
}

function buildLocalMistakeAnalysis(input: {
  wrongAttempts: Array<{ timeTakenSec: number; chapter: string; topic: string }>;
}): MistakeAnalysisResult {
  let conceptErrors = 0;
  let calculationErrors = 0;
  let sillyMistakes = 0;

  input.wrongAttempts.forEach((row) => {
    if (row.timeTakenSec >= 95) {
      conceptErrors += 1;
      return;
    }

    if (row.timeTakenSec >= 45) {
      calculationErrors += 1;
      return;
    }

    sillyMistakes += 1;
  });

  return {
    conceptErrors,
    calculationErrors,
    sillyMistakes,
    suggestions: [
      "Concept Error: revise NCERT concept notes before next mixed test.",
      "Calculation Error: do 15 timed numericals with unit checks.",
      "Silly Mistake: use 10-second option elimination and recheck rule.",
    ],
  };
}

async function callOpenAICompatibleApi(
  endpoint: string,
  key: string,
  model: string,
  messages: ChatMessage[],
  extraHeaders?: Record<string, string>,
) {
  enforceAiRateLimit();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 2200,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI request failed (${response.status}): ${text.slice(0, 180)}`);
  }

  return response.json();
}

function normalizeGeneratedQuestions(rows: QuestionDoc[], input: GenerateQuestionInput) {
  return rows
    .filter((item) => item?.question && Array.isArray(item.options) && item.options.length >= 4)
    .map((item) => ({
      subject: item.subject?.trim() || input.subject,
      chapter: item.chapter?.trim() || input.chapter,
      topic: item.topic?.trim() || input.topic,
      difficulty: (item.difficulty as QuestionDoc["difficulty"]) || input.difficulty,
      type: (item.type as QuestionDoc["type"]) || input.type,
      question: item.question.trim(),
      options: item.options.slice(0, 4).map((option) => option.trim()),
      correct_answer: item.correct_answer?.trim() || item.options[0]?.trim() || "",
      solution: item.solution?.trim() || "",
      pdf_link: item.pdf_link?.trim() || "",
    }));
}

export async function generateQuestionsWithAi(input: GenerateQuestionInput) {
  const messages = buildMessages(input);
  const content = (
    await runProviderWithFallback(messages, input.provider, input.model, {
      fallbackProviders: [],
    })
  ).content;
  if (!content) {
    throw new Error("AI model did not return usable content.");
  }

  const parsed = extractJsonArray(content);
  const cleaned = normalizeGeneratedQuestions(parsed, input);

  if (!cleaned.length) {
    throw new Error("AI output could not be parsed into valid question format.");
  }

  await addDoc(collection(db, "ai_generations"), {
    provider: input.provider,
    model: input.model,
    count: cleaned.length,
    subject: input.subject,
    chapter: input.chapter,
    topic: input.topic,
    createdAt: serverTimestamp(),
  });

  return cleaned;
}

export async function generateQuestionsWithAiFallback(
  input: GenerateQuestionInput,
  settings?: Partial<AiToolsSettings>,
) {
  const messages = buildMessages(input);
  const runResult = await runProviderWithFallback(messages, input.provider, input.model, settings);
  const parsed = extractJsonArray(runResult.content);
  const cleaned = normalizeGeneratedQuestions(parsed, input);

  if (!cleaned.length) {
    throw new Error("AI output could not be parsed into valid question format.");
  }

  return {
    questions: cleaned,
    providerUsed: runResult.provider,
    modelUsed: runResult.model,
    fallbackUsed: runResult.fallbackUsed,
    attempts: runResult.attempts,
  };
}

export async function generatePdfSummary(provider: AiProvider, model: string, text: string) {
  const summaryPrompt: ChatMessage[] = [
    {
      role: "system",
      content: "Create concise exam revision notes with formulas and key points.",
    },
    {
      role: "user",
      content: `Summarize for NEET/JEE revision in bullet points:\n${text}`,
    },
  ];

  const result = await runProviderWithFallback(summaryPrompt, provider, model, { fallbackProviders: [] });
  return result.content;
}

export async function generateWeakTopicRecommendations(
  provider: AiProvider,
  model: string,
  payload: {
    weakTopics: string[];
    weakChapters: string[];
    avgAccuracy: number;
    exam: "NEET" | "JEE" | "NEET/JEE";
  },
) {
  const recommendationPrompt: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are an exam strategy coach. Give concise weekly test recommendations. Keep output under 180 words with clear bullets.",
    },
    {
      role: "user",
      content: `Create a weak-topic focused test plan for ${payload.exam} student.\nAverage accuracy: ${payload.avgAccuracy}%\nWeak chapters: ${payload.weakChapters.join(", ") || "None"}\nWeak topics: ${payload.weakTopics.join(", ") || "None"}\nOutput format:\n1) Priority topics\n2) Recommended custom test filters\n3) 7-day revision + test sequence\n4) Target accuracy for next 3 tests`,
    },
  ];

  const result = await runProviderWithFallback(recommendationPrompt, provider, model, { fallbackProviders: [] });
  return result.content;
}

export async function generateDailyStudyPlan(
  provider: AiProvider,
  model: string,
  payload: {
    exam: "NEET" | "JEE" | "NEET/JEE";
    avgAccuracy: number;
    weakTopics: string[];
    weakChapters: string[];
    streakDays: number;
    avgSecPerQuestion: number;
  },
) {
  const plannerPrompt: ChatMessage[] = [
    {
      role: "system",
      content:
        "You are an adaptive exam planner for NEET/JEE. Respond in concise markdown with a day-wise actionable plan and revision reminders.",
    },
    {
      role: "user",
      content: `Build a smart daily study plan for ${payload.exam}.\nCurrent average accuracy: ${payload.avgAccuracy}%\nWeak chapters: ${payload.weakChapters.join(", ") || "None"}\nWeak topics: ${payload.weakTopics.join(", ") || "None"}\nCurrent streak: ${payload.streakDays} days\nAverage solving speed: ${payload.avgSecPerQuestion || "N/A"} sec/question\nOutput sections:\n1) Today Plan (3 blocks)\n2) 7-day adaptive schedule\n3) Revision reminders\n4) Adaptive difficulty rule (easy/medium/hard mix)\nKeep it under 220 words.`,
    },
  ];

  const result = await runProviderWithFallback(plannerPrompt, provider, model, { fallbackProviders: [] });
  return result.content;
}

export async function generateMistakeAnalysis(
  payload: {
    exam: "NEET" | "JEE" | "NEET/JEE";
    wrongAttempts: Array<{ chapter: string; topic: string; timeTakenSec: number }>;
  },
  settings?: Partial<AiToolsSettings>,
): Promise<MistakeAnalysisResult> {
  const resolved = {
    ...DEFAULT_SETTINGS,
    ...(settings ?? {}),
  };

  if (!payload.wrongAttempts.length) {
    return {
      conceptErrors: 0,
      calculationErrors: 0,
      sillyMistakes: 0,
      suggestions: ["Great job. Keep weekly mixed revision tests active."],
    };
  }

  const prompt: ChatMessage[] = [
    {
      role: "system",
      content:
        "Classify mistakes for exam prep. Return strict JSON object only: { conceptErrors: number, calculationErrors: number, sillyMistakes: number, suggestions: string[] }",
    },
    {
      role: "user",
      content: `Exam: ${payload.exam}\nWrong attempts data: ${JSON.stringify(payload.wrongAttempts)}\nProvide concise remediation suggestions.`,
    },
  ];

  try {
    const run = await runProviderWithFallback(prompt, resolved.provider, resolved.model, resolved);
    const raw = run.content.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? run.content;
    const parsed = JSON.parse(raw) as Partial<MistakeAnalysisResult>;

    return {
      conceptErrors: Math.max(0, Number(parsed.conceptErrors ?? 0)),
      calculationErrors: Math.max(0, Number(parsed.calculationErrors ?? 0)),
      sillyMistakes: Math.max(0, Number(parsed.sillyMistakes ?? 0)),
      suggestions: Array.isArray(parsed.suggestions)
        ? parsed.suggestions.map((item) => String(item)).slice(0, 5)
        : buildLocalMistakeAnalysis(payload).suggestions,
    };
  } catch {
    if (!resolved.enableLocalFallback) {
      throw new Error("Mistake analysis failed and fallback is disabled.");
    }

    return buildLocalMistakeAnalysis(payload);
  }
}

export async function generateStudentAssistantReply(request: AssistantRequest, settings?: Partial<AiToolsSettings>): Promise<AssistantReply> {
  const resolvedSettings = {
    ...DEFAULT_SETTINGS,
    ...(settings ?? {}),
  };

  const assistantPrompt: ChatMessage[] = [
    {
      role: "system",
      content:
        `${resolvedSettings.assistantPersona}\nYou are a premium exam assistant for NEET/JEE. Keep response structured with 4 short sections: Strategy, Today Plan, Next Test Filters, Mistake Fix.`,
    },
    {
      role: "user",
      content: `Student query: ${request.query}\nExam: ${request.context?.exam ?? "NEET/JEE"}\nWeak chapters: ${request.context?.weakChapters?.join(", ") || "Not available"}\nWeak topics: ${request.context?.weakTopics?.join(", ") || "Not available"}\nAverage accuracy: ${request.context?.averageAccuracy ?? "Not available"}%\nRecent performance note: ${request.context?.recentPerformance ?? "Not available"}\nScreenshot URL (if provided): ${request.screenshotUrl || "N/A"}\nIf screenshot URL exists, infer likely question pattern and provide a step-by-step solve approach.`,
    },
  ];

  try {
    const result = resolvedSettings.useFastestModelRace
      ? await runProviderFastest(assistantPrompt, resolvedSettings.provider, resolvedSettings.model, resolvedSettings)
      : await runProviderWithFallback(assistantPrompt, resolvedSettings.provider, resolvedSettings.model, resolvedSettings);

    return {
      answer: result.content,
      providerUsed: result.provider,
      modelUsed: result.model,
      fallbackUsed: result.fallbackUsed,
      attempts: result.attempts,
    };
  } catch (error) {
    if (!resolvedSettings.enableLocalFallback) {
      throw error;
    }

    return {
      answer: buildLocalFallbackReply(request),
      providerUsed: "local-fallback",
      modelUsed: "heuristic-engine",
      fallbackUsed: true,
      attempts: [],
    };
  }
}

export async function saveAiToolsSettings(settings: AiToolsSettings) {
  await setDoc(
    doc(db, "platform_settings", "ai_tools"),
    {
      ...settings,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveAiRuntimeConfig(config: AiRuntimeConfig) {
  await setDoc(
    doc(db, "platform_settings", "ai_runtime"),
    {
      ...config,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
  runtimeConfigCache = { value: config, fetchedAt: Date.now() };
}

export async function getAiRuntimeConfig() {
  const resolved = await resolveRuntimeConfig();
  return {
    ...DEFAULT_RUNTIME_CONFIG,
    ...resolved,
  };
}

export async function getAiToolsSettings() {
  const snapshot = await getDoc(doc(db, "platform_settings", "ai_tools"));
  if (!snapshot.exists()) {
    return DEFAULT_SETTINGS;
  }

  const data = snapshot.data() as Partial<AiToolsSettings>;
  return normalizeAiToolsSettings(data);
}

export function normalizeAiToolsSettings(data?: Partial<AiToolsSettings>) {
  if (!data) {
    return DEFAULT_SETTINGS;
  }

  const fallbackProviders = Array.isArray(data.fallbackProviders)
    ? (data.fallbackProviders.filter((item): item is AiProvider =>
        item === "openrouter" || item === "sarvam" || item === "emergent",
      ) as AiProvider[])
    : DEFAULT_SETTINGS.fallbackProviders;

  return {
    ...DEFAULT_SETTINGS,
    ...data,
    voiceTutorLanguage: data.voiceTutorLanguage?.trim() || DEFAULT_SETTINGS.voiceTutorLanguage,
    fallbackProviders,
    fallbackModels: {
      ...DEFAULT_SETTINGS.fallbackModels,
      ...(data.fallbackModels ?? {}),
    },
  };
}

export async function uploadAssistantScreenshot(userId: string, file: File) {
  const safeName = file.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
  const fileRef = ref(storage, `assistant_uploads/${userId}/${Date.now()}-${safeName}`);
  await uploadBytes(fileRef, file, { contentType: file.type || "image/*" });
  return getDownloadURL(fileRef);
}

export async function saveAssistantMemory(
  userId: string,
  payload: {
    messages: AssistantMemoryMessage[];
    uploads: AssistantUploadMemory[];
    lastScreenshotUrl?: string;
    ownerEmail?: string;
  },
) {
  await setDoc(
    doc(db, "assistant_memory", userId),
    {
      userId,
      ownerUid: userId,
      ownerEmail: payload.ownerEmail || "",
      messages: payload.messages.slice(-60),
      uploads: payload.uploads.slice(-24),
      lastScreenshotUrl: payload.lastScreenshotUrl || "",
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getAssistantMemory(userId: string) {
  const snapshot = await getDoc(doc(db, "assistant_memory", userId));
  if (!snapshot.exists()) {
    return {
      messages: [] as AssistantMemoryMessage[],
      uploads: [] as AssistantUploadMemory[],
      lastScreenshotUrl: "",
    };
  }

  const data = snapshot.data() as {
    ownerUid?: string;
    messages?: AssistantMemoryMessage[];
    uploads?: AssistantUploadMemory[];
    lastScreenshotUrl?: string;
  };

  if (typeof data.ownerUid === "string" && data.ownerUid !== userId) {
    return {
      messages: [] as AssistantMemoryMessage[],
      uploads: [] as AssistantUploadMemory[],
      lastScreenshotUrl: "",
    };
  }

  return {
    messages: Array.isArray(data.messages)
      ? data.messages
          .filter((row) => row && typeof row.text === "string" && (row.role === "student" || row.role === "assistant"))
          .map((row) => ({
            role: row.role,
            text: row.text,
            meta: row.meta,
            createdAt: Number(row.createdAt || Date.now()),
          }))
      : [],
    uploads: Array.isArray(data.uploads)
      ? data.uploads
          .filter((row) => row && typeof row.url === "string")
          .map((row) => ({
            url: row.url,
            name: String(row.name || "upload"),
            uploadedAt: Number(row.uploadedAt || Date.now()),
          }))
      : [],
    lastScreenshotUrl: typeof data.lastScreenshotUrl === "string" ? data.lastScreenshotUrl : "",
  };
}

export function listenAssistantMemory(
  userId: string,
  onData: (payload: { messages: AssistantMemoryMessage[]; uploads: AssistantUploadMemory[]; lastScreenshotUrl: string }) => void,
) {
  return onSnapshot(doc(db, "assistant_memory", userId), (snapshot) => {
    if (!snapshot.exists()) {
      onData({ messages: [], uploads: [], lastScreenshotUrl: "" });
      return;
    }

    const data = snapshot.data() as {
      ownerUid?: string;
      messages?: AssistantMemoryMessage[];
      uploads?: AssistantUploadMemory[];
      lastScreenshotUrl?: string;
    };

    if (typeof data.ownerUid === "string" && data.ownerUid !== userId) {
      onData({ messages: [], uploads: [], lastScreenshotUrl: "" });
      return;
    }

    onData({
      messages: Array.isArray(data.messages)
        ? data.messages
            .filter((row) => row && typeof row.text === "string" && (row.role === "student" || row.role === "assistant"))
            .map((row) => ({
              role: row.role,
              text: row.text,
              meta: row.meta,
              createdAt: Number(row.createdAt || Date.now()),
            }))
        : [],
      uploads: Array.isArray(data.uploads)
        ? data.uploads
            .filter((row) => row && typeof row.url === "string")
            .map((row) => ({
              url: row.url,
              name: String(row.name || "upload"),
              uploadedAt: Number(row.uploadedAt || Date.now()),
            }))
        : [],
      lastScreenshotUrl: typeof data.lastScreenshotUrl === "string" ? data.lastScreenshotUrl : "",
    });
  });
}