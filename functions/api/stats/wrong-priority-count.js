// GET /api/stats/wrong-priority-count?category=xxx
// 回傳「未攻克」題數：wrong_count > right_count 的題數
// 需已登入

export async function onRequestGet({ request, env, data }) {
    const userId = data?.userId
    if (!userId) {
        return Response.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const url = new URL(request.url)
    const category = url.searchParams.get('category') || ''

    const args = [userId]
    let sql = `
        SELECT COUNT(*) AS cnt FROM (
            SELECT q.id
            FROM questions q
            JOIN user_attempts ua ON ua.question_id = q.id
            WHERE ua.user_id = ?
              AND q.id NOT IN (
                  SELECT question_id FROM user_question_marks
                  WHERE user_id = ? AND manual_mastered = 1
              )
    `
    args.push(userId)

    if (category) {
        sql += ' AND q.category = ?'
        args.push(category)
    }
    sql += `
            GROUP BY q.id
            HAVING SUM(CASE WHEN ua.correct = 0 THEN 1 ELSE 0 END)
                 > SUM(CASE WHEN ua.correct = 1 THEN 1 ELSE 0 END)
        )
    `

    const row = await env.DB.prepare(sql).bind(...args).first()
    return Response.json({ success: true, data: { count: row?.cnt ?? 0 } })
}
