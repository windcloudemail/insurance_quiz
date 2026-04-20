// GET /api/questions/random-wrong?count=10&category=xxx&exclude_mastered=1
// 從該「使用者」曾答錯的題中隨機抽；若開啟 exclude_mastered 會排除該使用者已答對 ≥ 3 次的題

export async function onRequestGet({ request, env, data }) {
    const userId = data?.userId
    if (!userId) {
        return Response.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const url = new URL(request.url)
    const count = parseInt(url.searchParams.get('count') || '10', 10)
    const category = url.searchParams.get('category') || ''
    const excludeMastered = url.searchParams.get('exclude_mastered') === '1'

    const args = [userId]
    let sql = `
        SELECT q.* FROM questions q
        WHERE q.id IN (
            SELECT DISTINCT question_id FROM user_attempts
            WHERE user_id = ? AND correct = 0
        )
    `

    if (excludeMastered) {
        sql += ` AND q.id NOT IN (
            SELECT question_id FROM user_attempts
            WHERE user_id = ? AND correct = 1
            GROUP BY question_id HAVING COUNT(*) >= 3
        )`
        args.push(userId)
    }

    if (category) {
        sql += ' AND q.category = ?'
        args.push(category)
    }

    sql += ' ORDER BY RANDOM() LIMIT ?'
    args.push(Math.min(Math.max(count, 1), 100))

    const { results } = await env.DB.prepare(sql).bind(...args).all()
    return Response.json({ success: true, data: results })
}
