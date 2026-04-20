// POST /api/import-failures/bulk → 批次新增失敗紀錄
// Body: { failures: [{source_number, category, reason, raw_body}, ...] }

const BATCH_SIZE = 50

export async function onRequestPost({ request, env }) {
    const body = await request.json()
    const list = Array.isArray(body?.failures) ? body.failures : null
    if (!list || list.length === 0) {
        return Response.json({ success: false, error: '缺少 failures 陣列' }, { status: 400 })
    }

    const insertSQL = `INSERT INTO import_failures (source_number, category, reason, raw_body) VALUES (?, ?, ?, ?)`

    let inserted = 0
    const errors = []

    for (let i = 0; i < list.length; i += BATCH_SIZE) {
        const chunk = list.slice(i, i + BATCH_SIZE)
        const statements = chunk.map((f) => {
            const srcNum = f.source_number === '' || f.source_number === undefined || f.source_number === null
                ? null
                : Number(f.source_number)
            return env.DB.prepare(insertSQL).bind(
                srcNum,
                f.category || '',
                f.reason || 'unknown',
                f.raw_body || ''
            )
        })
        try {
            const results = await env.DB.batch(statements)
            inserted += results.filter(r => r.success).length
        } catch (err) {
            errors.push({ batch: i / BATCH_SIZE, error: err.message })
        }
    }

    return Response.json({ success: true, data: { inserted, total: list.length, errors } })
}
