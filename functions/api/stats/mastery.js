// GET /api/stats/mastery
// 回傳每個 category 的：{ category, total, mastered }
// mastered = 該 user 在該題答對 ≥ 3 次的題數
// 需 user token

export async function onRequestGet({ env, data }) {
    const userId = data?.userId
    if (!userId) {
        return Response.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    // mastered = 自動精熟（答對 ≥ 3 次）OR 手動精熟（user 主動標記）
    const sql = `
        SELECT
          q.category AS category,
          COUNT(*) AS total,
          COALESCE(SUM(
            CASE
              WHEN (ua.cnt IS NOT NULL AND ua.cnt >= 3) OR mm.manual_mastered = 1
                THEN 1 ELSE 0
            END
          ), 0) AS mastered
        FROM questions q
        LEFT JOIN (
          SELECT question_id, COUNT(*) AS cnt
          FROM user_attempts
          WHERE user_id = ? AND correct = 1
          GROUP BY question_id
        ) ua ON ua.question_id = q.id
        LEFT JOIN (
          SELECT question_id, manual_mastered
          FROM user_question_marks
          WHERE user_id = ? AND manual_mastered = 1
        ) mm ON mm.question_id = q.id
        GROUP BY q.category
        ORDER BY q.category ASC
    `

    const { results } = await env.DB.prepare(sql).bind(userId, userId).all()
    return Response.json({ success: true, data: results })
}
