type QuestionDiagramProps = {
  svgMarkup?: string;
};

function sanitizeSvg(svgMarkup: string) {
  return svgMarkup
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "");
}

export default function QuestionDiagram({ svgMarkup }: QuestionDiagramProps) {
  if (!svgMarkup?.trim()) {
    return null;
  }

  const safeMarkup = sanitizeSvg(svgMarkup);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="max-h-64 overflow-auto" dangerouslySetInnerHTML={{ __html: safeMarkup }} />
    </div>
  );
}
