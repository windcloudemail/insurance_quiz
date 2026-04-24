import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getRandomQuestions, getRandomWrongQuestions, getWrongPriorityQuestions, getMarks, updateMark } from '../lib/api.js'
import QuestionCard from '../components/QuestionCard.jsx'
import OptionButton from '../components/OptionButton.jsx'
import ExplanationBox from '../components/ExplanationBox.jsx'

// 將題目的 4 個選項隨機打散，answer 欄位同步 remap 保持指向正確選項
function maybeShuffleOptions(qs, enabled) {
    if (!enabled) return qs
    return qs.map(q => {
        const order = [0, 1, 2, 3]
        for (let i = 3; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[order[i], order[j]] = [order[j], order[i]]
        }
        const opts = [q.option_1, q.option_2, q.option_3, q.option_4]
        return {
            ...q,
            option_1: opts[order[0]],
            option_2: opts[order[1]],
            option_3: opts[order[2]],
            option_4: opts[order[3]],
            answer: order.indexOf(q.answer - 1) + 1,
        }
    })
}

export default function Quiz() {
    const { state } = useLocation()
    const navigate = useNavigate()
    const count = state?.count ?? 20
    const category = state?.category ?? ''
    const practiceOnly = state?.practiceOnly ?? false
    const shuffleOptions = state?.shuffleOptions ?? false
    const mode = state?.mode ?? 'random'
    const excludeMastered = state?.excludeMastered ?? false
    const wrongCount = state?.wrongCount ?? 0

    const [questions, setQuestions] = useState(() => maybeShuffleOptions(state?.questions ?? [], shuffleOptions))
    const [current, setCurrent] = useState(0)
    const [selected, setSelected] = useState(null)
    const [revealed, setRevealed] = useState(false)
    const [answers, setAnswers] = useState([])
    const [loading, setLoading] = useState(!state?.questions)
    const [error, setError] = useState('')

    // marks: { [question_id]: { flagged, flag_note, manual_mastered } }
    const [marks, setMarks] = useState({})
    // 標記疑義 modal
    const [flagModal, setFlagModal] = useState({ open: false, draft: '' })
    const [savingMark, setSavingMark] = useState(false)

    // 從 Result「再練一次」進來時 state.questions 為空，依 mode 重抽
    useEffect(() => {
        if (state?.questions && state.questions.length > 0) return
        const cat = category === '全部' ? '' : category

        let fetchPromise
        if (mode === 'wrong-priority') {
            fetchPromise = getWrongPriorityQuestions(20, cat)
        } else if (mode === 'mixed') {
            const wrongN = Math.max(0, Number(wrongCount) || 0)
            const newN = Math.max(0, count - wrongN)
            fetchPromise = Promise.all([
                newN > 0 ? getRandomQuestions(newN, cat, excludeMastered) : Promise.resolve([]),
                wrongN > 0 ? getRandomWrongQuestions(wrongN, cat, excludeMastered) : Promise.resolve([]),
            ]).then(([newQs, wrongQs]) => {
                const seen = new Set()
                const merged = [...newQs, ...wrongQs].filter(q => {
                    if (seen.has(q.id)) return false
                    seen.add(q.id)
                    return true
                })
                for (let i = merged.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1))
                    ;[merged[i], merged[j]] = [merged[j], merged[i]]
                }
                return merged
            })
        } else {
            fetchPromise = getRandomQuestions(count, cat, excludeMastered)
        }

        fetchPromise
            .then(data => { setQuestions(maybeShuffleOptions(data, shuffleOptions)); setLoading(false) })
            .catch(e => { setError(e.message); setLoading(false) })
    }, [])

    // 載入 user 全部標記（用於 Quiz 頁右上角顯示「已標」記號 + 按鈕 active 狀態）
    useEffect(() => {
        getMarks()
            .then(rows => {
                const map = {}
                for (const r of rows || []) {
                    map[r.question_id] = {
                        flagged: !!r.flagged,
                        flag_note: r.flag_note || '',
                        manual_mastered: !!r.manual_mastered,
                    }
                }
                setMarks(map)
            })
            .catch(() => { /* 未登入或失敗：marks 維持空 */ })
    }, [])

    // 切題時自動同步 selected / revealed：跳到已答題顯示原答案 + reveal 狀態
    useEffect(() => {
        if (current < answers.length) {
            const a = answers[current]
            setSelected(a.selected)
            setRevealed(true)
        } else {
            setSelected(null)
            setRevealed(false)
        }
    }, [current])

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
    const isJumpedBack = current < answers.length
    const currentMark = marks[q.id] || { flagged: false, flag_note: '', manual_mastered: false }

    const handleSelect = (idx) => {
        // 跳回模式可以重選；正常模式 reveal 後鎖定
        if (revealed && !isJumpedBack) return
        setSelected(idx)
        // 跳回模式：選了就立刻當「重新作答」（仍要點下方確認鈕才寫入 answers）
        if (isJumpedBack) {
            setRevealed(false)  // 暫時切掉 reveal，讓使用者按確認後再 reveal
        }
    }

    const handleReveal = () => {
        if (selected === null) return
        setRevealed(true)
        const newAnswer = { questionId: q.id, selected, correct: correctIdx }
        if (isJumpedBack) {
            // 跳回模式：替換該題答案
            setAnswers(prev => prev.map((a, i) => i === current ? newAnswer : a))
        } else {
            // 正常模式：append
            setAnswers(prev => [...prev, newAnswer])
        }
    }

    const handleNext = () => {
        if (current + 1 < questions.length) {
            setCurrent(c => c + 1)
        } else {
            navigate('/result', { state: { questions, answers: [...answers], category, practiceOnly, shuffleOptions, mode, excludeMastered, wrongCount } })
        }
    }

    const backToProgress = () => {
        // 跳到「下一個還沒答的題」（= answers.length）
        setCurrent(Math.min(answers.length, questions.length - 1))
    }

    // dot click：只允許跳到「已答的題」（防止跳過未答）
    const jumpToQuestion = (i) => {
        if (i > answers.length) return
        setCurrent(i)
    }

    const getOptionState = (idx) => {
        if (!revealed) return selected === idx ? 'selected' : 'default'
        if (idx === correctIdx) return 'correct'
        if (idx === selected && !isCorrect) return 'wrong'
        return 'disabled'
    }

    const progress = Math.round((current / questions.length) * 100)
    const isLast = current + 1 === questions.length

    // 標記行為
    const openFlagModal = () => {
        setFlagModal({ open: true, draft: currentMark.flag_note || '' })
    }
    const closeFlagModal = () => setFlagModal({ open: false, draft: '' })

    const saveFlag = async (newFlagged) => {
        setSavingMark(true)
        try {
            const note = newFlagged ? flagModal.draft : ''
            await updateMark(q.id, { flagged: newFlagged ? 1 : 0, flag_note: note })
            setMarks(m => ({ ...m, [q.id]: { ...currentMark, flagged: newFlagged, flag_note: note } }))
            closeFlagModal()
        } catch (e) {
            alert('標記失敗：' + (e.message || ''))
        } finally {
            setSavingMark(false)
        }
    }

    const toggleMaster = async () => {
        const next = !currentMark.manual_mastered
        setSavingMark(true)
        try {
            await updateMark(q.id, { manual_mastered: next ? 1 : 0 })
            setMarks(m => ({ ...m, [q.id]: { ...currentMark, manual_mastered: next } }))
        } catch (e) {
            alert('標記失敗：' + (e.message || ''))
        } finally {
            setSavingMark(false)
        }
    }

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
                <span className="shrink-0 text-ink-soft text-xs font-mono tabular-nums">{Math.min(answers.length, questions.length)}/{questions.length}</span>
            </div>

            {practiceOnly && (
                <div className="mb-4 bg-accent/10 border border-accent/40 rounded-lg px-4 py-2.5 text-center">
                    <span className="text-accent text-[15px] font-semibold">📝 錯題練習模式 · 本次不計入統計</span>
                </div>
            )}

            {isJumpedBack && (
                <div className="mb-4 bg-primary/5 border border-primary/30 rounded-lg px-4 py-2.5 flex items-center justify-between">
                    <span className="text-primary text-[13px] font-semibold">↩ 回看第 {current + 1} 題（可改答案）</span>
                    <button
                        onClick={backToProgress}
                        className="text-[12px] px-3 py-1 bg-primary text-surface rounded-md hover:bg-primary-dim"
                    >
                        回到第 {answers.length + 1} 題
                    </button>
                </div>
            )}

            <QuestionCard
                current={current + 1}
                total={questions.length}
                source_number={q.source_number}
                question={q.question}
                question_part2={q.question_part2}
            />

            {/* 已標記的記號（題卡下方一行） */}
            {(currentMark.flagged || currentMark.manual_mastered) && (
                <div className="flex items-center gap-2 -mt-2 mb-3 ml-1 text-[11px]">
                    {currentMark.flagged && (
                        <span className="text-wrong bg-wrong/10 px-2 py-0.5 rounded font-semibold">🚩 已標疑義</span>
                    )}
                    {currentMark.manual_mastered && (
                        <span className="text-correct bg-correct/10 px-2 py-0.5 rounded font-semibold">✓ 已標精熟</span>
                    )}
                </div>
            )}

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

            {/* 標記按鈕（reveal 後出現） */}
            {revealed && (
                <div className="grid grid-cols-2 gap-2 mt-3">
                    <button
                        onClick={openFlagModal}
                        disabled={savingMark}
                        className={`py-2.5 rounded-md text-[13px] font-semibold border transition-all disabled:opacity-50 ${
                            currentMark.flagged
                                ? 'bg-wrong/10 border-wrong/40 text-wrong'
                                : 'bg-surface border-border text-ink-soft hover:border-border-strong hover:text-ink'
                        }`}
                    >
                        {currentMark.flagged ? '🚩 已標疑義（編輯）' : '🚩 有疑義'}
                    </button>
                    <button
                        onClick={toggleMaster}
                        disabled={savingMark}
                        className={`py-2.5 rounded-md text-[13px] font-semibold border transition-all disabled:opacity-50 ${
                            currentMark.manual_mastered
                                ? 'bg-correct/10 border-correct/40 text-correct'
                                : 'bg-surface border-border text-ink-soft hover:border-border-strong hover:text-ink'
                        }`}
                    >
                        {currentMark.manual_mastered ? '✓ 已標精熟（取消）' : '✓ 已會了'}
                    </button>
                </div>
            )}

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
                        {isJumpedBack ? '確認新答案' : '確認答案'}
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

            {/* 題號 dots（已答的可點跳轉，未答的不能點） */}
            <div className="flex flex-wrap gap-1.5 mt-6 justify-center">
                {questions.map((_, i) => {
                    const ans = answers[i]
                    const done = i < answers.length
                    const ok = ans && ans.selected === ans.correct
                    const isCurr = i === current
                    const clickable = i <= answers.length  // 已答 + 下一個未答
                    const dotMark = marks[questions[i]?.id]
                    return (
                        <button
                            key={i}
                            onClick={() => jumpToQuestion(i)}
                            disabled={!clickable}
                            className={`relative w-6 h-6 rounded text-[11px] flex items-center justify-center font-semibold transition-all ${isCurr
                                ? 'bg-primary text-surface ring-2 ring-primary/30'
                                : done
                                    ? ok
                                        ? 'bg-correct/15 text-correct border border-correct/30 hover:bg-correct/25 cursor-pointer'
                                        : 'bg-wrong/15 text-wrong border border-wrong/30 hover:bg-wrong/25 cursor-pointer'
                                    : clickable
                                        ? 'bg-card text-ink-faint border border-border'
                                        : 'bg-card text-ink-faint border border-border cursor-not-allowed opacity-60'
                                }`}
                            title={done ? `第 ${i + 1} 題（已答）` : `第 ${i + 1} 題`}
                        >
                            {i + 1}
                            {dotMark?.flagged && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-wrong rounded-full" />
                            )}
                        </button>
                    )
                })}
            </div>

            {/* 標記疑義 modal */}
            {flagModal.open && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={closeFlagModal}>
                    <div
                        className="bg-surface rounded-lg p-5 w-full max-w-sm shadow-xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <h3 className="text-ink font-display text-lg font-semibold mb-1">
                            {currentMark.flagged ? '編輯疑義備註' : '標記為有疑義'}
                        </h3>
                        <p className="text-ink-soft text-[12px] mb-3">
                            （選填）寫下為什麼覺得這題有疑義，方便日後對照
                        </p>
                        <textarea
                            value={flagModal.draft}
                            onChange={e => setFlagModal(s => ({ ...s, draft: e.target.value.slice(0, 500) }))}
                            placeholder="例：跟 11502-2 第 38 題答案不同 / 選項 B 也應該成立…"
                            rows={4}
                            className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-primary"
                        />
                        <div className="text-right text-[10px] text-ink-faint mt-1">{flagModal.draft.length}/500</div>
                        <div className="flex gap-2 mt-3">
                            {currentMark.flagged && (
                                <button
                                    onClick={() => saveFlag(false)}
                                    disabled={savingMark}
                                    className="flex-1 py-2 border border-border text-ink-soft rounded-md text-sm hover:border-wrong hover:text-wrong disabled:opacity-50"
                                >
                                    取消標記
                                </button>
                            )}
                            <button
                                onClick={closeFlagModal}
                                className="flex-1 py-2 border border-border text-ink-soft rounded-md text-sm hover:border-border-strong hover:text-ink"
                            >
                                關閉
                            </button>
                            <button
                                onClick={() => saveFlag(true)}
                                disabled={savingMark}
                                className="flex-1 py-2 bg-primary text-surface rounded-md text-sm font-semibold hover:bg-primary-dim disabled:opacity-50"
                            >
                                {currentMark.flagged ? '儲存' : '確定標記'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
