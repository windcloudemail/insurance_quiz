import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getRandomQuestions } from '../lib/api.js'
import QuestionCard from '../components/QuestionCard.jsx'
import OptionButton from '../components/OptionButton.jsx'
import ExplanationBox from '../components/ExplanationBox.jsx'

export default function Quiz() {
    const { state } = useLocation()
    const navigate = useNavigate()
    const count = state?.count ?? 20
    const category = state?.category ?? ''
    const practiceOnly = state?.practiceOnly ?? false

    const [questions, setQuestions] = useState(state?.questions ?? [])
    const [current, setCurrent] = useState(0)
    const [selected, setSelected] = useState(null)
    const [revealed, setRevealed] = useState(false)
    const [answers, setAnswers] = useState([])
    const [loading, setLoading] = useState(!state?.questions)
    const [error, setError] = useState('')

    useEffect(() => {
        if (state?.questions && state.questions.length > 0) return
        getRandomQuestions(count, category === '全部' ? '' : category)
            .then(data => { setQuestions(data); setLoading(false) })
            .catch(e => { setError(e.message); setLoading(false) })
    }, [])

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-72 gap-3">
            <div className="w-10 h-10 border-2 border-border border-t-primary rounded-full animate-spin" />
            <p className="text-ink-soft text-sm">載入題目中…</p>
        </div>
    )

    if (error) return (
        <div className="text-center py-16 fadeIn">
            <p className="text-ink-soft mb-6">{error}</p>
            <button onClick={() => navigate('/')} className="px-5 py-2 bg-primary text-surface rounded-md font-medium hover:bg-primary-dim">
                返回首頁
            </button>
        </div>
    )

    if (questions.length === 0) return (
        <div className="text-center py-16 fadeIn">
            <p className="text-ink-soft mb-6">此分類尚無題目</p>
            <button onClick={() => navigate('/')} className="px-5 py-2 bg-primary text-surface rounded-md font-medium hover:bg-primary-dim">
                返回首頁
            </button>
        </div>
    )

    const q = questions[current]
    const opts = [q.option_1, q.option_2, q.option_3, q.option_4]
    const correctIdx = q.answer - 1
    const isCorrect = selected === correctIdx

    const handleSelect = (idx) => {
        if (revealed) return
        setSelected(idx)
    }

    const handleReveal = () => {
        if (selected === null) return
        setRevealed(true)
        setAnswers(prev => [...prev, { questionId: q.id, selected, correct: correctIdx }])
    }

    const handleNext = () => {
        if (current + 1 < questions.length) {
            setCurrent(c => c + 1)
            setSelected(null)
            setRevealed(false)
        } else {
            navigate('/result', { state: { questions, answers: [...answers], category, practiceOnly } })
        }
    }

    const getOptionState = (idx) => {
        if (!revealed) return selected === idx ? 'selected' : 'default'
        if (idx === correctIdx) return 'correct'
        if (idx === selected && !isCorrect) return 'wrong'
        return 'disabled'
    }

    const progress = Math.round((current / questions.length) * 100)
    const isLast = current + 1 === questions.length

    return (
        <div className="fadeIn">
            {/* 進度列 */}
            <div className="flex items-center gap-3 mb-5">
                <button
                    onClick={() => navigate('/')}
                    className="shrink-0 w-8 h-8 rounded-md border border-border text-ink-soft hover:border-border-strong hover:text-ink transition-all flex items-center justify-center text-sm"
                >
                    ✕
                </button>
                <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <span className="shrink-0 text-ink-soft text-xs font-mono tabular-nums">{current}/{questions.length}</span>
            </div>

            {practiceOnly && (
                <div className="mb-4 bg-accent/10 border border-accent/40 rounded-lg px-4 py-2.5 text-center">
                    <span className="text-accent text-[15px] font-semibold">📝 錯題練習模式 · 本次不計入統計</span>
                </div>
            )}

            <QuestionCard
                current={current + 1}
                total={questions.length}
                source_number={q.source_number}
                question={q.question}
                question_part2={q.question_part2}
            />

            <div className="flex flex-col gap-2 mb-4">
                {opts.map((opt, idx) => (
                    <OptionButton
                        key={idx}
                        index={idx}
                        text={opt}
                        state={getOptionState(idx)}
                        onClick={() => handleSelect(idx)}
                    />
                ))}
            </div>

            {revealed && <ExplanationBox isCorrect={isCorrect} explanation={q.explanation} />}

            <div className="mt-5">
                {!revealed ? (
                    <button
                        onClick={handleReveal}
                        disabled={selected === null}
                        className={`w-full py-3.5 rounded-md font-semibold text-[15px] transition-colors ${selected !== null
                            ? 'bg-primary text-surface hover:bg-primary-dim'
                            : 'bg-card text-ink-faint cursor-not-allowed'
                            }`}
                    >
                        確認答案
                    </button>
                ) : (
                    <button
                        onClick={handleNext}
                        className="w-full py-3.5 bg-primary text-surface font-semibold text-[15px] rounded-md hover:bg-primary-dim flex items-center justify-center gap-2"
                    >
                        {isLast ? '查看結果' : (
                            <>下一題 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg></>
                        )}
                    </button>
                )}
            </div>

            {/* 題號 dots */}
            <div className="flex flex-wrap gap-1.5 mt-6 justify-center">
                {questions.map((_, i) => {
                    const ans = answers[i]
                    const done = i < current
                    const ok = ans && ans.selected === ans.correct
                    const isCurr = i === current
                    return (
                        <div
                            key={i}
                            className={`w-6 h-6 rounded text-[11px] flex items-center justify-center font-semibold transition-all ${isCurr
                                ? 'bg-primary text-surface'
                                : done
                                    ? ok
                                        ? 'bg-correct/15 text-correct border border-correct/30'
                                        : 'bg-wrong/15 text-wrong border border-wrong/30'
                                    : 'bg-card text-ink-faint border border-border'
                                }`}
                        >
                            {i + 1}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
