// POST /api/attempts
// Body: [{ question_id, correct }, ...]  或  { attempts: [...] }
// 雙寫：
//   1. user_attempts（per-user 歷程，供錯題複習 / 精熟排除用）
//   2. questions.correct_count / wrong_count（全站累計，Admin 參考）

export async function onRequestPost({ request, env, data }) {
    const userId = data?.userId
    if (!userId) {
        return Response.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const body = await request.json()
    const list = Array.isArray(body) ? body : (Array.isArray(body?.attempts) ? body.attempts : null)
    if (!list || list.length === 0) {
        return Response.json({ success: false, error: '缺少 attempts 陣列' }, { status: 400 })
    }

    const valid = list.filter(a => Number.isInteger(Number(a?.question_id)))
    if (valid.length === 0) {
        return Response.json({ success: false, error: '沒有有效的 question_id' }, { status: 400 })
    }

    const stmts = []
    for (const a of valid) {
        const qid = Number(a.question_id)
        const correct = a.correct ? 1 : 0
        stmts.push(
            env.DB.prepare('INSERT INTO user_attempts (user_id, question_id, correct) VALUES (?, ?, ?)')
                .bind(userId, qid, correct)
        )
        const col = correct ? 'correct_count' : 'wrong_count'
        stmts.push(
            env.DB.prepare(`UPDATE questions SET ${col} = ${col} + 1 WHERE id = ?`).bind(qid)
        )
    }

    try {
        await env.DB.batch(stmts)
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 })
    }

    return Response.json({ success: true, data: { updated: valid.length } })
}
