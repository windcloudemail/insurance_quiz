// GET /api/questions/random?count=20&category=xxx&exclude_mastered=1
// exclude_mastered 僅對已登入使用者有效；會排除該使用者已答對 ≥ 3 次的題

export async function onRequestGet({ request, env, data }) {
    const url = new URL(request.url)
    const count = parseInt(url.searchParams.get('count') || '20', 10)
    const category = url.searchParams.get('category') || ''
    const excludeMastered = url.searchParams.get('exclude_mastered') === '1'
    const userId = data?.userId

    let sql = 'SELECT * FROM questions WHERE 1 = 1'
    const args = []

    if (category) {
        sql += ' AND category = ?'
        args.push(category)
    }

    if (excludeMastered && userId) {
        sql += ` AND id NOT IN (
            SELECT question_id FROM user_attempts
            WHERE user_id = ? AND correct = 1
            GROUP BY question_id HAVING COUNT(*) >= 3
        )`
        args.push(userId)
    }

    sql += ' ORDER BY RANDOM() LIMIT ?'
    args.push(Math.min(Math.max(count, 1), 100))

    const { results } = await env.DB.prepare(sql).bind(...args).all()
    return Response.json({ success: true, data: results })
}
