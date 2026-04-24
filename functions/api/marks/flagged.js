// GET /api/marks/flagged
// 回傳當前使用者所有 flagged=1 的題目（含完整題目內容，供 /flagged 頁列表）
// 需已登入

export async function onRequestGet({ env, data }) {
    const userId = data?.userId
    if (!userId) {
        return Response.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const { results } = await env.DB.prepare(`
        SELECT q.*,
               m.flag_note,
               m.manual_mastered,
               m.updated_at AS marked_at
        FROM user_question_marks m
        JOIN questions q ON q.id = m.question_id
        WHERE m.user_id = ? AND m.flagged = 1
        ORDER BY m.updated_at DESC
    `).bind(userId).all()

    return Response.json({ success: true, data: results })
}
