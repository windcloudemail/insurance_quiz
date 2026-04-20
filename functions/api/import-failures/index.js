// GET  /api/import-failures       → 列出所有失敗紀錄
// POST /api/import-failures/bulk  → 批次新增（由 JSON 匯入時帶進來）

export async function onRequestGet({ env }) {
    const { results } = await env.DB.prepare(
        `SELECT * FROM import_failures ORDER BY category ASC, source_number ASC, id ASC`
    ).all()
    return Response.json({ success: true, data: results })
}
