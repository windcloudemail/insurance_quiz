export default function ExplanationBox({ isCorrect, explanation }) {
  return (
    <div
      className={`rounded-lg mt-4 border-l-2 ${isCorrect
        ? 'border-correct bg-correct/5'
        : 'border-wrong bg-wrong/5'}`}
      style={{ animation: 'slideUp 0.3s cubic-bezier(0.22,1,0.36,1) forwards' }}
    >
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`text-sm font-semibold font-serif ${isCorrect ? 'text-correct' : 'text-wrong'}`}>
            {isCorrect ? '答對' : '答錯'}
          </span>
        </div>
        {explanation && (
          <p className="text-ink-soft text-[14px] leading-relaxed">
            {explanation}
          </p>
        )}
      </div>
    </div>
  )
}
