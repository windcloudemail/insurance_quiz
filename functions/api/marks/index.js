// GET /api/marks
// 回傳當前使用者的所有標記（給 Quiz 頁載入時批次拿）
// shape: [{ question_id, flagged, flag_note, manual_mastered, updated_at }]
// 需已登入

export async function onRequestGet({ env, data }) {
    const userId = data?.userId
    if (!userId) {
        return Response.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const { results } = await env.DB.prepare(`
        SELECT question_id, flagged, flag_note, manual_mastered, updated_at
        FROM user_question_marks
        WHERE user_id = ?
    `).bind(userId).all()

    return Response.json({ success: true, data: results })
}
