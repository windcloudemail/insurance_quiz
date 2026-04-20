// GET /api/questions/categories → 取得所有分類及其題數
// 回傳：[{ category: "11502_...", total: 181 }, ...]

export async function onRequestGet({ env }) {
    const result = await env.DB.prepare(
        `SELECT category, COUNT(*) AS total
         FROM questions
         WHERE category IS NOT NULL AND category != ''
         GROUP BY category
         ORDER BY category ASC`
    ).all()

    const data = (result.results || []).map(r => ({
        category: r.category,
        total: r.total,
    }))
    return Response.json({ success: true, data })
}
