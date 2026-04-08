import QuestionDiagram from "./QuestionDiagram";

type QuestionSupportProps = {
  svgMarkup?: string;
  imageUrl?: string;
  conceptExplanation?: string;
  ncertReference?: string;
  formulaHint?: string;
};

export default function QuestionSupport({
  svgMarkup,
  imageUrl,
  conceptExplanation,
  ncertReference,
  formulaHint,
}: QuestionSupportProps) {
  const hasContext = Boolean(conceptExplanation?.trim() || ncertReference?.trim() || formulaHint?.trim());
  const hasImage = Boolean(imageUrl?.trim());

  if (!hasContext && !hasImage && !svgMarkup?.trim()) {
    return null;
  }

  return (
    <div className="space-y-3">
      {hasImage ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <img src={imageUrl} alt="Question visual" className="max-h-72 w-full object-contain" loading="lazy" />
        </div>
      ) : null}

      <QuestionDiagram svgMarkup={svgMarkup} />

      {hasContext ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/90 p-3 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-200">
          {conceptExplanation?.trim() ? (
            <p>
              <span className="font-semibold">Concept: </span>
              {conceptExplanation}
            </p>
          ) : null}
          {ncertReference?.trim() ? (
            <p className="mt-1">
              <span className="font-semibold">NCERT Ref: </span>
              {ncertReference}
            </p>
          ) : null}
          {formulaHint?.trim() ? (
            <p className="mt-1">
              <span className="font-semibold">Formula Hint: </span>
              {formulaHint}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
