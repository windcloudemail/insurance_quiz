// POST /api/questions/bulk → 批次新增題目
// Body: { questions: [{source_number, category, difficulty, question, question_part2, option_1..4, answer, explanation}, ...] }

const BATCH_SIZE = 50 // D1 每次 batch 的 statement 上限

export async function onRequestPost({ request, env }) {
    const body = await request.json()
    const list = Array.isArray(body?.questions) ? body.questions : null
    if (!list || list.length === 0) {
        return Response.json({ success: false, error: '缺少 questions 陣列' }, { status: 400 })
    }

    // 先驗證每題必要欄位
    for (const [i, q] of list.entries()) {
        if (!q?.question || !q?.option_1 || !q?.option_2 || !q?.option_3 || !q?.option_4 || !q?.answer) {
            return Response.json({ success: false, error: `第 ${i + 1} 題缺少必要欄位` }, { status: 400 })
        }
    }

    // 查當前最大 order_index，接續往下
    const maxResult = await env.DB.prepare(
        `SELECT COALESCE(MAX(order_index), -1) as max_idx FROM questions`
    ).first()
    let nextIdx = (maxResult?.max_idx ?? -1) + 1

    const insertSQL = `INSERT INTO questions
        (source_number, category, difficulty, question, question_part2, option_1, option_2, option_3, option_4, answer, explanation, order_index)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

    let totalInserted = 0
    const errors = []

    for (let i = 0; i < list.length; i += BATCH_SIZE) {
        const chunk = list.slice(i, i + BATCH_SIZE)
        const statements = chunk.map((q) => {
            const srcNum = q.source_number === '' || q.source_number === undefined || q.source_number === null
                ? null
                : Number(q.source_number)
            return env.DB.prepare(insertSQL).bind(
                srcNum,
                q.category || '外幣保險',
                q.difficulty || 'medium',
                q.question, q.question_part2 || '',
                q.option_1, q.option_2, q.option_3, q.option_4,
                Number(q.answer),
                q.explanation || '',
                nextIdx++
            )
        })

        try {
            const results = await env.DB.batch(statements)
            totalInserted += results.filter(r => r.success).length
        } catch (err) {
            errors.push({ batch: i / BATCH_SIZE, error: err.message })
        }
    }

    return Response.json({
        success: true,
        data: { inserted: totalInserted, total: list.length, errors },
    })
}
