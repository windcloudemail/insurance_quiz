export default function QuestionCard({ current, total, source_number, question, question_part2 }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-6 mb-4 fadeIn">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-primary uppercase tracking-wider font-serif">
            第 {current} 題
          </span>
          {source_number != null && (
            <span className="text-[11px] text-ink-soft font-mono bg-card px-2 py-0.5 rounded">
              題本 #{source_number}
            </span>
          )}
        </div>
        <span className="text-xs text-ink-faint font-mono">
          {current} / {total}
        </span>
      </div>

      <p className="text-ink text-[16px] font-medium leading-relaxed whitespace-pre-line">
        {question}
      </p>

      {question_part2 && (
        <p className="text-ink-soft text-[15px] leading-relaxed mt-3 pt-3 border-t border-border whitespace-pre-line">
          {question_part2}
        </p>
      )}
    </div>
  )
}
