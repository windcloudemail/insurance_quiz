const LABELS = ['A', 'B', 'C', 'D']

export default function OptionButton({ index, text, state, onClick }) {
  // state: 'default' | 'selected' | 'correct' | 'wrong' | 'disabled'

  const base = 'w-full text-left px-4 py-3.5 rounded-lg border text-[15px] leading-relaxed transition-all duration-150 flex items-center gap-3.5'

  const styles = {
    default: `${base} border-border bg-surface text-ink hover:border-primary/40 hover:bg-primary/5 cursor-pointer`,
    selected: `${base} border-primary bg-primary/8 text-ink cursor-pointer`,
    correct: `${base} border-correct bg-correct/8 text-ink cursor-default`,
    wrong: `${base} border-wrong bg-wrong/8 text-ink cursor-default`,
    disabled: `${base} border-border bg-card text-ink-faint cursor-default`,
  }

  const labelStyle = {
    default: 'border border-border text-ink-soft bg-surface',
    selected: 'bg-primary text-surface',
    correct: 'bg-correct text-surface',
    wrong: 'bg-wrong text-surface',
    disabled: 'border border-border text-ink-faint bg-surface',
  }

  return (
    <button
      onClick={onClick}
      disabled={state === 'disabled' || state === 'correct' || state === 'wrong'}
      className={styles[state]}
    >
      <span className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-sm font-semibold transition-all ${labelStyle[state]}`}>
        {LABELS[index]}
      </span>

      <span className="flex-1">{text}</span>

      {state === 'correct' && (
        <span className="shrink-0 text-correct font-bold pop-in text-base">✓</span>
      )}
      {state === 'wrong' && (
        <span className="shrink-0 text-wrong font-bold pop-in text-base">✗</span>
      )}
    </button>
  )
}
