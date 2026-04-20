import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { submitAttempts } from '../lib/api.js'

const LABELS = ['A', 'B', 'C', 'D']

export default function Result() {
    const { state } = useLocation()
    const navigate = useNavigate()
    const reported = useRef(false)

    if (!state?.questions) {
        navigate('/')
        return null
    }

    const { questions, answers, category, practiceOnly } = state
    const wrongQuestions = questions.filter((q, i) => answers[i]?.selected !== answers[i]?.correct)
    const hasWrong = wrongQuestions.length > 0

    useEffect(() => {
        if (practiceOnly) return
        if (reported.current || !answers || answers.length === 0) return
        reported.current = true
        const payload = answers.map(a => ({
            question_id: a.questionId,
            correct: a.selected === a.correct,
        }))
        submitAttempts(payload).catch(() => { /* 靜默失敗 */ })
    }, [])

    const score = answers.filter(a => a.selected === a.correct).length
    const pct = Math.round((score / questions.length) * 100)

    const gradeColor = pct >= 80 ? '#5b7f4f' : pct >= 60 ? '#b67a3a' : '#b54545'
    const gradeMsg = pct >= 80 ? '表現優秀，繼續保持' : pct >= 60 ? '不錯，再加把勁' : '多練習幾次，你可以的'

    const circumference = 2 * Math.PI * 52

    return (
        <div className="fadeIn pb-28">
            {practiceOnly && (
                <div className="mb-4 bg-accent/10 border border-accent/40 rounded-lg px-4 py-2.5 text-center">
                    <span className="text-accent text-[15px] font-semibold">📝 錯題練習模式 · 本次不計入統計</span>
                </div>
            )}

            {/* 分數卡 */}
            <div className="bg-surface border border-border rounded-xl p-6 mb-6 text-center">
                <div className="inline-flex items-center justify-center relative mb-3">
                    <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: 'rotate(-90deg)' }}>
                        <circle cx="64" cy="64" r="52" fill="none" stroke="#e5e1d6" strokeWidth="6" />
                        <circle
                            cx="64" cy="64" r="52"
                            fill="none"
                            stroke={gradeColor}
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference * (1 - pct / 100)}
                            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1)' }}
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-display text-3xl font-semibold" style={{ color: gradeColor }}>{pct}%</span>
                        <span className="text-[11px] text-ink-faint font-mono mt-0.5">{score} / {questions.length}</span>
                    </div>
                </div>

                <h2 className="font-display text-xl font-semibold text-ink mb-1">測驗完成</h2>
                <p className="text-sm" style={{ color: gradeColor }}>{gradeMsg}</p>

                <div className="flex justify-center gap-10 mt-5 pt-5 border-t border-border">
                    <div className="text-center">
                        <div className="font-mono text-xl font-semibold text-correct">{score}</div>
                        <div className="text-[11px] text-ink-faint mt-0.5">答對</div>
                    </div>
                    <div className="text-center">
                        <div className="font-mono text-xl font-semibold text-wrong">{questions.length - score}</div>
                        <div className="text-[11px] text-ink-faint mt-0.5">答錯</div>
                    </div>
                    <div className="text-center">
                        <div className="font-mono text-xl font-semibold text-ink-soft">{questions.length}</div>
                        <div className="text-[11px] text-ink-faint mt-0.5">總題數</div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3 mb-3">
                <span className="font-serif font-semibold text-ink text-sm">逐題回顧</span>
                <div className="flex-1 h-px bg-border" />
            </div>

            <div className="flex flex-col gap-2">
                {questions.map((q, i) => {
                    const a = answers[i]
                    const ok = a?.selected === a?.correct
                    const opts = [q.option_1, q.option_2, q.option_3, q.option_4]

                    return (
                        <div
                            key={i}
                            className={`rounded-lg p-3.5 border ${ok ? 'border-correct/30 bg-correct/5' : 'border-wrong/30 bg-wrong/5'}`}
                        >
                            <div className="flex gap-3 items-start">
                                <div className={`shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-semibold mt-0.5 ${ok ? 'bg-correct text-surface' : 'bg-wrong text-surface'}`}>
                                    {ok ? '✓' : '✗'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <span className="text-[11px] font-mono text-ink-faint">Q{i + 1}</span>
                                        {q.source_number != null && (
                                            <span className="text-[10px] text-ink-soft bg-card px-1.5 py-0.5 rounded font-mono">
                                                題本 #{q.source_number}
                                            </span>
                                        )}
                                        {q.category && (
                                            <span className="text-[10px] text-primary bg-primary/8 px-1.5 py-0.5 rounded">
                                                {q.category}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[14px] text-ink leading-relaxed line-clamp-2 mb-1.5">
                                        {q.question}
                                    </p>
                                    {!ok && a && (
                                        <p className="text-[12px] text-wrong mb-0.5">
                                            你的答案：{LABELS[a.selected]}. {opts[a.selected]}
                                        </p>
                                    )}
                                    <p className="text-[12px] text-correct">
                                        正確答案：{LABELS[q.answer - 1]}. {opts[q.answer - 1]}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* 底部按鈕 */}
            <div className="fixed bottom-0 left-0 right-0 px-3 sm:px-4 pb-4 pt-3 bg-gradient-to-t from-base via-base to-transparent">
                <div className="max-w-2xl mx-auto grid grid-cols-3 gap-1.5 sm:gap-2">
                    <button
                        onClick={() => navigate('/')}
                        className="py-3 px-1 border border-border bg-surface text-ink-soft rounded-md font-medium text-xs sm:text-sm hover:border-border-strong hover:text-ink transition-all"
                    >
                        回首頁
                    </button>
                    <button
                        onClick={() => navigate('/quiz', { state: { questions: wrongQuestions, count: wrongQuestions.length, category, practiceOnly: true } })}
                        disabled={!hasWrong}
                        className={`py-3 px-1 font-medium text-xs sm:text-sm rounded-md transition-all ${hasWrong
                            ? 'bg-wrong/10 border border-wrong/40 text-wrong hover:bg-wrong/15'
                            : 'bg-card border border-border text-ink-faint cursor-not-allowed'
                            }`}
                        title={hasWrong ? `只練本次答錯的 ${wrongQuestions.length} 題（不計入統計）` : '本次全對'}
                    >
                        {hasWrong ? `練錯題 ${wrongQuestions.length}` : '✓ 全對'}
                    </button>
                    <button
                        onClick={() => navigate('/quiz', { state: { count: questions.length, category } })}
                        className="py-3 px-1 bg-primary text-surface font-semibold text-xs sm:text-sm rounded-md hover:bg-primary-dim transition-colors"
                    >
                        再練一次
                    </button>
                </div>
            </div>
        </div>
    )
}
