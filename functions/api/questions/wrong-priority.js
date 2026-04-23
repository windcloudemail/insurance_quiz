// GET /api/questions/wrong-priority?count=20&category=xxx
// 錯題加強練習：
//   - 錯題定義：wrong_count > right_count（錯誤次數嚴格大於答對次數）
//   - 排序：(wrong_count - right_count) DESC，同差值再隨機
//   - 永遠排除已精熟題（答對 ≥ 3 次），雖然「對 ≥ 錯」已自動排除，這裡做硬過濾保險
//   - 需已登入

export async function onRequestGet({ request, env, data }) {
    const userId = data?.userId
    if (!userId) {
        return Response.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const url = new URL(request.url)
    const count = parseInt(url.searchParams.get('count') || '20', 10)
    const category = url.searchParams.get('category') || ''

    const args = [userId]
    let sql = `
        SELECT q.*,
               SUM(CASE WHEN ua.correct = 0 THEN 1 ELSE 0 END) AS wrong_cnt,
               SUM(CASE WHEN ua.correct = 1 THEN 1 ELSE 0 END) AS right_cnt
        FROM questions q
        JOIN user_attempts ua ON ua.question_id = q.id
        WHERE ua.user_id = ?
    `

    if (category) {
        sql += ' AND q.category = ?'
        args.push(category)
    }

    sql += `
        GROUP BY q.id
        HAVING wrong_cnt > right_cnt
        ORDER BY (wrong_cnt - right_cnt) DESC, RANDOM()
        LIMIT ?
    `
    args.push(Math.min(Math.max(count, 1), 100))

    const { results } = await env.DB.prepare(sql).bind(...args).all()
    return Response.json({ success: true, data: results })
}
