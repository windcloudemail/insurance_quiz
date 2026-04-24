import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getFlaggedQuestions, deleteMark, updateMark } from '../lib/api.js'

const LABELS = ['A', 'B', 'C', 'D']

export default function Flagged() {
    const navigate = useNavigate()
    const [items, setItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [editing, setEditing] = useState({}) // { [id]: draft string }

    const load = async () => {
        setLoading(true)
        try {
            const data = await getFlaggedQuestions()
            setItems(data || [])
        } catch (e) {
            setError(e.message || '載入失敗')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const removeFlag = async (id) => {
        if (!confirm('要取消這題的疑義標記嗎？')) return
        try {
            // 完全移除：把 flagged 設為 0（保留 manual_mastered 狀態）
            await updateMark(id, { flagged: 0, flag_note: '' })
            setItems(arr => arr.filter(it => it.id !== id))
        } catch (e) {
            alert('取消失敗：' + (e.message || ''))
        }
    }

    const startEdit = (id, currentNote) => {
        setEditing(s => ({ ...s, [id]: currentNote || '' }))
    }
    const cancelEdit = (id) => {
        setEditing(s => { const n = { ...s }; delete n[id]; return n })
    }
    const saveEdit = async (id) => {
        const draft = editing[id] ?? ''
        try {
            await updateMark(id, { flag_note: draft })
            setItems(arr => arr.map(it => it.id === id ? { ...it, flag_note: draft } : it))
            cancelEdit(id)
        } catch (e) {
            alert('儲存失敗：' + (e.message || ''))
        }
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-72 gap-3">
            <div className="w-10 h-10 border-2 border-border border-t-primary rounded-full animate-spin" />
            <p className="text-ink-soft text-sm">載入中…</p>
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

    return (
        <div className="fadeIn pb-12">
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => navigate('/')}
                    className="shrink-0 w-8 h-8 rounded-md border border-border text-ink-soft hover:border-border-strong hover:text-ink flex items-center justify-center text-sm"
                    title="回首頁"
                >
                    ←
                </button>
                <div>
                    <p className="text-xs tracking-widest text-primary/80 uppercase font-semibold">Flagged</p>
                    <h1 className="font-display text-2xl font-semibold text-ink leading-tight">有疑義題目</h1>
                </div>
                <span className="ml-auto text-ink-soft text-sm font-mono">{items.length} 題</span>
            </div>

            {items.length === 0 ? (
                <div className="bg-surface border border-border rounded-lg px-6 py-16 text-center">
                    <p className="text-ink-soft text-sm leading-relaxed">
                        目前沒有標記為有疑義的題目。<br />
                        作答時點題卡下方的「🚩 有疑義」即可加入這個列表。
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {items.map(q => {
                        const opts = [q.option_1, q.option_2, q.option_3, q.option_4]
                        const correctIdx = q.answer - 1
                        const isEditing = editing.hasOwnProperty(q.id)

                        return (
                            <article
                                key={q.id}
                                className="bg-surface border border-wrong/30 rounded-lg p-4"
                            >
                                <header className="flex items-start gap-2 flex-wrap mb-2.5">
                                    <span className="text-[11px] font-mono text-ink-faint">#{q.id}</span>
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
                                    {q.manual_mastered ? (
                                        <span className="text-[10px] text-correct bg-correct/10 px-1.5 py-0.5 rounded">✓ 已標精熟</span>
                                    ) : null}
                                    <span className="ml-auto text-[10px] text-ink-faint font-mono">
                                        {q.marked_at ? q.marked_at.slice(0, 16) : ''}
                                    </span>
                                </header>

                                <p className="text-[14px] text-ink leading-relaxed font-semibold mb-2">
                                    {q.question}
                                    {q.question_part2 && <span className="block mt-1 font-normal">{q.question_part2}</span>}
                                </p>

                                <ul className="flex flex-col gap-1 mb-3">
                                    {opts.map((opt, idx) => (
                                        <li
                                            key={idx}
                                            className={`text-[13px] px-2 py-1 rounded ${idx === correctIdx
                                                ? 'bg-correct/10 text-correct font-semibold'
                                                : 'text-ink-soft'
                                                }`}
                                        >
                                            <span className="font-mono mr-2">{LABELS[idx]}.</span>
                                            {opt}
                                        </li>
                                    ))}
                                </ul>

                                {q.explanation && (
                                    <p className="text-[12px] text-ink-soft bg-card rounded px-3 py-2 mb-3 leading-relaxed">
                                        <span className="font-semibold text-ink">解析：</span>{q.explanation}
                                    </p>
                                )}

                                {/* 備註區 */}
                                <div className="border-t border-border pt-3 mt-1">
                                    <p className="text-[11px] text-ink-faint font-semibold mb-1">疑義備註：</p>
                                    {isEditing ? (
                                        <>
                                            <textarea
                                                value={editing[q.id]}
                                                onChange={e => setEditing(s => ({ ...s, [q.id]: e.target.value.slice(0, 500) }))}
                                                rows={3}
                                                className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm text-ink placeholder-ink-faint focus:outline-none focus:border-primary"
                                            />
                                            <div className="flex gap-2 mt-2 justify-end">
                                                <button onClick={() => cancelEdit(q.id)} className="text-[12px] px-3 py-1 border border-border text-ink-soft rounded">取消</button>
                                                <button onClick={() => saveEdit(q.id)} className="text-[12px] px-3 py-1 bg-primary text-surface rounded">儲存</button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex items-start gap-2">
                                            <p className="flex-1 text-[13px] text-ink whitespace-pre-wrap">
                                                {q.flag_note || <span className="text-ink-faint italic">（無）</span>}
                                            </p>
                                            <button
                                                onClick={() => startEdit(q.id, q.flag_note)}
                                                className="shrink-0 text-[11px] text-primary hover:underline"
                                            >
                                                編輯
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={() => removeFlag(q.id)}
                                        className="text-[12px] px-3 py-1 border border-wrong/40 text-wrong rounded hover:bg-wrong/10"
                                    >
                                        取消疑義標記
                                    </button>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
