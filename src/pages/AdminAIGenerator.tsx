import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  defaultModelByProvider,
  getAiRuntimeConfig,
  generatePdfSummary,
  generateQuestionsWithAi,
  getAiToolsSettings,
  saveAiRuntimeConfig,
  saveAiToolsSettings,
  type AiProvider,
  type AiRuntimeConfig,
  type AiToolsSettings,
} from "../services/aiService";
import { uploadBulkQuestions, type QuestionDoc } from "../services/questionService";

type AiQuestionForm = {
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

const initialQuestions: AiQuestionForm = {
  provider: "openrouter" as AiProvider,
  model: defaultModelByProvider.openrouter,
  subject: "Physics",
  chapter: "",
  topic: "",
  difficulty: "medium" as const,
  type: "Normal" as const,
  count: 8,
  prompt: "",
};

export default function AdminAIGenerator() {
  const [form, setForm] = useState(initialQuestions);
  const [settings, setSettings] = useState<AiToolsSettings>({
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
    assistantPersona: "Focused NEET/JEE mentor",
  });
  const [generatedQuestions, setGeneratedQuestions] = useState<QuestionDoc[]>([]);
  const [runtimeConfig, setRuntimeConfig] = useState<AiRuntimeConfig>({
    openrouterKey: "",
    sarvamKey: "",
    sarvamBaseUrl: "https://api.sarvam.ai/v1",
    emergentKey: "",
    emergentBaseUrl: "",
  });
  const [summaryInput, setSummaryInput] = useState("");
  const [summaryOutput, setSummaryOutput] = useState("");
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [loadingRuntimeConfig, setLoadingRuntimeConfig] = useState(false);
  const [showRuntimeKeys, setShowRuntimeKeys] = useState(false);
  const [message, setMessage] = useState("");

  const providerHint = useMemo(() => {
    if (form.provider === "openrouter") {
      return "OpenRouter supports free models like DeepSeek and Llama variants.";
    }

    if (form.provider === "sarvam") {
      return "Sarvam supports multilingual models like sarvam-m and sarvam-30b.";
    }

    return "Emergent uses your custom OpenAI-compatible base URL and free key.";
  }, [form.provider]);

  useEffect(() => {
    let mounted = true;
    getAiToolsSettings()
      .then((data) => {
        if (!mounted) {
          return;
        }
        setSettings(data);
      })
      .catch(() => {
        if (mounted) {
          setMessage("Could not fetch AI tool settings. Using defaults.");
        }
      });

    getAiRuntimeConfig()
      .then((data) => {
        if (!mounted) {
          return;
        }
        setRuntimeConfig(data);
      })
      .catch(() => {
        if (mounted) {
          setMessage("Could not fetch AI runtime API config. Using env fallback.");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function onGenerateQuestions() {
    setLoadingGenerate(true);
    setMessage("");

    try {
      const rows = await generateQuestionsWithAi(form);
      setGeneratedQuestions(rows);
      setMessage(`${rows.length} AI-generated questions ready. Review and save to Firestore.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI question generation failed.");
    } finally {
      setLoadingGenerate(false);
    }
  }

  async function onSaveQuestions() {
    if (!generatedQuestions.length) {
      setMessage("Generate questions first.");
      return;
    }

    setLoadingSave(true);
    try {
      await uploadBulkQuestions(generatedQuestions);
      setMessage(`${generatedQuestions.length} AI-generated questions saved to Firebase questions collection.`);
      setGeneratedQuestions([]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save generated questions.");
    } finally {
      setLoadingSave(false);
    }
  }

  async function onGenerateSummary() {
    if (!summaryInput.trim()) {
      setMessage("Paste text before generating summary.");
      return;
    }

    setLoadingSummary(true);
    try {
      const output = await generatePdfSummary(form.provider, form.model, summaryInput.trim());
      setSummaryOutput(output);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Summary generation failed.");
    } finally {
      setLoadingSummary(false);
    }
  }

  async function onSaveSettings() {
    setLoadingSettings(true);
    try {
      await saveAiToolsSettings(settings);
      setMessage("AI settings saved. Student AI Quick Drill status updated live.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save AI settings.");
    } finally {
      setLoadingSettings(false);
    }
  }

  async function onSaveRuntimeConfig() {
    setLoadingRuntimeConfig(true);
    try {
      await saveAiRuntimeConfig(runtimeConfig);
      setMessage("AI runtime API config saved. Student panel AI now uses this live config.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save runtime API config.");
    } finally {
      setLoadingRuntimeConfig(false);
    }
  }

  return (
    <section className="space-y-5 py-3">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="admin-hero p-5"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Part 11 AI Tools</p>
        <h2 className="mt-1 text-2xl font-semibold">AI Question and Solution Generator</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Generate NEET/JEE questions from OpenRouter, Sarvam, or Emergent-compatible endpoints, then push directly to Firebase.
        </p>
      </motion.div>

      <div className="admin-surface space-y-3 p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Student AI Access Control</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="input-soft"
            value={settings.provider}
            onChange={(event) =>
              setSettings((prev) => {
                const nextProvider = event.target.value as AiProvider;
                return {
                  ...prev,
                  provider: nextProvider,
                  model: defaultModelByProvider[nextProvider],
                };
              })
            }
          >
            <option value="openrouter">OpenRouter</option>
            <option value="sarvam">Sarvam</option>
            <option value="emergent">Emergent</option>
          </select>
          <input
            className="input-soft"
            value={settings.model}
            onChange={(event) => setSettings((prev) => ({ ...prev, model: event.target.value }))}
            placeholder="Student model"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={settings.enableStudentAi}
            onChange={(event) => setSettings((prev) => ({ ...prev, enableStudentAi: event.target.checked }))}
          />
          Enable AI Quick Drill for students in Custom Test page
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={settings.enableStudentAssistant}
            onChange={(event) => setSettings((prev) => ({ ...prev, enableStudentAssistant: event.target.checked }))}
          />
          Enable Deepu AI Assistance in student panel
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={settings.enableVoiceTutor}
            onChange={(event) => setSettings((prev) => ({ ...prev, enableVoiceTutor: event.target.checked }))}
          />
          Enable AI Voice Tutor in Deepu AI Assistance
        </label>
        <input
          className="input-soft"
          value={settings.voiceTutorLanguage}
          onChange={(event) => setSettings((prev) => ({ ...prev, voiceTutorLanguage: event.target.value }))}
          placeholder="Voice language (e.g. en-IN, en-US, hi-IN)"
        />
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={settings.enableLocalFallback}
            onChange={(event) => setSettings((prev) => ({ ...prev, enableLocalFallback: event.target.checked }))}
          />
          Enable AD fallback mode (local assistant plan when APIs fail)
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={settings.useFastestModelRace}
            onChange={(event) => setSettings((prev) => ({ ...prev, useFastestModelRace: event.target.checked }))}
          />
          Enable fastest-response model race for assistant replies
        </label>
        <div className="rounded-2xl border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Fallback provider order</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {(["openrouter", "emergent", "sarvam"] as AiProvider[]).map((provider) => (
              <label key={provider} className="flex items-center gap-1 rounded-full border border-zinc-200 px-3 py-1.5 dark:border-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={settings.fallbackProviders.includes(provider)}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      fallbackProviders: event.target.checked
                        ? [...prev.fallbackProviders, provider]
                        : prev.fallbackProviders.filter((item) => item !== provider),
                    }))
                  }
                />
                {provider}
              </label>
            ))}
          </div>
        </div>
        <textarea
          className="input-soft min-h-20"
          value={settings.assistantPersona}
          onChange={(event) => setSettings((prev) => ({ ...prev, assistantPersona: event.target.value }))}
          placeholder="Assistant persona instruction"
        />
        <button
          className="btn-pill-dark px-4 py-2 text-xs"
          type="button"
          onClick={onSaveSettings}
          disabled={loadingSettings}
        >
          {loadingSettings ? "Saving..." : "Save AI Settings"}
        </button>
      </div>

      <div className="admin-surface space-y-3 p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">API Prompt Box (Live Runtime)</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Paste provider API keys and endpoints. This runtime config is used by admin and student AI features.
        </p>
        <button
          type="button"
          className="btn-pill-ghost px-3 py-1.5 text-[11px]"
          onClick={() => setShowRuntimeKeys((prev) => !prev)}
        >
          {showRuntimeKeys ? "Hide Keys" : "Show Keys"}
        </button>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            className="input-soft"
            type={showRuntimeKeys ? "text" : "password"}
            value={runtimeConfig.openrouterKey}
            onChange={(event) => setRuntimeConfig((prev) => ({ ...prev, openrouterKey: event.target.value }))}
            placeholder="OPENROUTER API KEY"
          />
          <input
            className="input-soft"
            type={showRuntimeKeys ? "text" : "password"}
            value={runtimeConfig.sarvamKey}
            onChange={(event) => setRuntimeConfig((prev) => ({ ...prev, sarvamKey: event.target.value }))}
            placeholder="SARVAM API KEY"
          />
          <input
            className="input-soft"
            value={runtimeConfig.sarvamBaseUrl}
            onChange={(event) => setRuntimeConfig((prev) => ({ ...prev, sarvamBaseUrl: event.target.value }))}
            placeholder="Sarvam Base URL"
          />
          <input
            className="input-soft"
            type={showRuntimeKeys ? "text" : "password"}
            value={runtimeConfig.emergentKey}
            onChange={(event) => setRuntimeConfig((prev) => ({ ...prev, emergentKey: event.target.value }))}
            placeholder="EMERGENT API KEY"
          />
        </div>
        <input
          className="input-soft"
          value={runtimeConfig.emergentBaseUrl}
          onChange={(event) => setRuntimeConfig((prev) => ({ ...prev, emergentBaseUrl: event.target.value }))}
          placeholder="Emergent Base URL (OpenAI-compatible)"
        />
        <button
          className="btn-pill-dark px-4 py-2 text-xs"
          type="button"
          onClick={onSaveRuntimeConfig}
          disabled={loadingRuntimeConfig}
        >
          {loadingRuntimeConfig ? "Saving..." : "Save Runtime API Config"}
        </button>
      </div>

      <div className="admin-surface space-y-3 p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Generate Questions</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{providerHint}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            className="input-soft"
            value={form.provider}
            onChange={(event) =>
              setForm((prev) => {
                const nextProvider = event.target.value as AiProvider;
                return {
                  ...prev,
                  provider: nextProvider,
                  model: defaultModelByProvider[nextProvider],
                };
              })
            }
          >
            <option value="openrouter">OpenRouter</option>
            <option value="sarvam">Sarvam</option>
            <option value="emergent">Emergent</option>
          </select>
          <input
            className="input-soft"
            value={form.model}
            onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
            placeholder="Model"
          />
          <input
            className="input-soft"
            value={form.subject}
            onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))}
            placeholder="Subject"
          />
          <input
            className="input-soft"
            value={form.chapter}
            onChange={(event) => setForm((prev) => ({ ...prev, chapter: event.target.value }))}
            placeholder="Chapter"
          />
          <input
            className="input-soft"
            value={form.topic}
            onChange={(event) => setForm((prev) => ({ ...prev, topic: event.target.value }))}
            placeholder="Topic"
          />
          <input
            className="input-soft"
            type="number"
            min={1}
            max={30}
            value={form.count}
            onChange={(event) => setForm((prev) => ({ ...prev, count: Number(event.target.value || 8) }))}
            placeholder="Question count"
          />
          <select
            className="input-soft"
            value={form.difficulty}
            onChange={(event) => setForm((prev) => ({ ...prev, difficulty: event.target.value as "easy" | "medium" | "hard" }))}
          >
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select
            className="input-soft"
            value={form.type}
            onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as "PYQ" | "Normal" }))}
          >
            <option value="Normal">Normal</option>
            <option value="PYQ">PYQ</option>
          </select>
        </div>
        <textarea
          className="input-soft min-h-24"
          value={form.prompt}
          onChange={(event) => setForm((prev) => ({ ...prev, prompt: event.target.value }))}
          placeholder="Additional prompt instructions for style, pattern, and concept depth"
        />
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-pill-primary px-4 py-2 text-xs"
            type="button"
            onClick={onGenerateQuestions}
            disabled={loadingGenerate}
          >
            {loadingGenerate ? "Generating..." : "Generate Questions"}
          </button>
          <button
            className="btn-pill-ghost px-4 py-2 text-xs"
            type="button"
            onClick={onSaveQuestions}
            disabled={loadingSave || generatedQuestions.length === 0}
          >
            {loadingSave ? "Saving..." : "Save to Firestore"}
          </button>
        </div>

        {generatedQuestions.length ? (
          <div className="space-y-2 rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/70">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Generated Preview</p>
            {generatedQuestions.slice(0, 4).map((item, index) => (
              <div key={`${item.question}-${index}`} className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Q{index + 1}. {item.question}</p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Answer: {item.correct_answer}</p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{item.solution}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="admin-surface space-y-3 p-4">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">PDF Summary Generator</h3>
        <textarea
          className="input-soft min-h-28"
          value={summaryInput}
          onChange={(event) => setSummaryInput(event.target.value)}
          placeholder="Paste raw notes or PDF extracted text"
        />
        <button
          className="btn-pill-dark px-4 py-2 text-xs"
          type="button"
          onClick={onGenerateSummary}
          disabled={loadingSummary}
        >
          {loadingSummary ? "Generating..." : "Generate Summary"}
        </button>
        {summaryOutput ? (
          <pre className="whitespace-pre-wrap rounded-2xl bg-zinc-50 p-3 text-xs text-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-200">
            {summaryOutput}
          </pre>
        ) : null}
      </div>

      {message ? <p className="text-sm text-zinc-600 dark:text-zinc-300">{message}</p> : null}
    </section>
  );
}