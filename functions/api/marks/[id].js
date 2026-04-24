// PUT /api/marks/:questionId
// body: { flagged?: 0|1, flag_note?: string, manual_mastered?: 0|1 }
// upsert：未提供的欄位保留原值
//
// DELETE /api/marks/:questionId
// 完全移除該題的標記
//
// 需已登入

export async function onRequestPut({ request, env, data, params }) {
    const userId = data?.userId
    if (!userId) {
        return Response.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const questionId = parseInt(params.id, 10)
    if (!questionId) {
        return Response.json({ success: false, error: 'invalid question id' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))

    // 先讀現況
    const existing = await env.DB.prepare(
        'SELECT flagged, flag_note, manual_mastered FROM user_question_marks WHERE user_id = ? AND question_id = ?'
    ).bind(userId, questionId).first()

    const flagged = body.flagged ?? existing?.flagged ?? 0
    const flag_note = body.flag_note ?? existing?.flag_note ?? ''
    const manual_mastered = body.manual_mastered ?? existing?.manual_mastered ?? 0

    // upsert：D1 SQLite 支援 ON CONFLICT
    await env.DB.prepare(`
        INSERT INTO user_question_marks (user_id, question_id, flagged, flag_note, manual_mastered, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id, question_id) DO UPDATE SET
          flagged = excluded.flagged,
          flag_note = excluded.flag_note,
          manual_mastered = excluded.manual_mastered,
          updated_at = excluded.updated_at
    `).bind(userId, questionId, flagged ? 1 : 0, String(flag_note || ''), manual_mastered ? 1 : 0).run()

    return Response.json({
        success: true,
        data: { question_id: questionId, flagged: flagged ? 1 : 0, flag_note, manual_mastered: manual_mastered ? 1 : 0 },
    })
}

export async function onRequestDelete({ env, data, params }) {
    const userId = data?.userId
    if (!userId) {
        return Response.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const questionId = parseInt(params.id, 10)
    if (!questionId) {
        return Response.json({ success: false, error: 'invalid question id' }, { status: 400 })
    }

    await env.DB.prepare(
        'DELETE FROM user_question_marks WHERE user_id = ? AND question_id = ?'
    ).bind(userId, questionId).run()

    return Response.json({ success: true })
}
