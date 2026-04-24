// GET /api/stats/flagged-count
// 回傳「有疑義題目」總數（給 Home 入口按鈕顯示）
// 需已登入

export async function onRequestGet({ env, data }) {
    const userId = data?.userId
    if (!userId) {
        return Response.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const row = await env.DB.prepare(
        'SELECT COUNT(*) AS cnt FROM user_question_marks WHERE user_id = ? AND flagged = 1'
    ).bind(userId).first()

    return Response.json({ success: true, data: { count: row?.cnt ?? 0 } })
}
