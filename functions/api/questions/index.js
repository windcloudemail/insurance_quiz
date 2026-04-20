// GET  /api/questions        → 取得所有題目（後台用）
// POST /api/questions        → 新增題目

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url)
  const category = url.searchParams.get('category') || ''
  const page = parseInt(url.searchParams.get('page') || '1', 10)
  const pageSize = 1000
  const offset = (page - 1) * pageSize

  let query = 'SELECT * FROM questions'
  const args = []

  if (category) {
    query += ' WHERE category = ?'
    args.push(category)
  }

  query += ' ORDER BY order_index ASC, id ASC LIMIT ? OFFSET ?'
  args.push(pageSize, offset)

  const { results } = await env.DB.prepare(query).bind(...args).all()

  return Response.json({ success: true, data: results })
}

export async function onRequestPost({ request, env }) {
  const body = await request.json()
  const { source_number, category, difficulty, question, question_part2, option_1, option_2, option_3, option_4, answer, explanation } = body

  if (!question || !option_1 || !option_2 || !option_3 || !option_4 || !answer) {
    return Response.json({ success: false, error: '缺少必要欄位' }, { status: 400 })
  }

  // 自動將新題目排在最後面：查詢當前最大的 order_index
  const maxResult = await env.DB.prepare(
    `SELECT COALESCE(MAX(order_index), -1) as max_idx FROM questions`
  ).first()
  const nextOrderIndex = (maxResult?.max_idx ?? -1) + 1

  const srcNum = source_number === '' || source_number === undefined || source_number === null
    ? null
    : Number(source_number)

  const result = await env.DB.prepare(
    `INSERT INTO questions (source_number, category, difficulty, question, question_part2, option_1, option_2, option_3, option_4, answer, explanation, order_index)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    srcNum,
    category || '外幣保險',
    difficulty || 'medium',
    question, question_part2 || '', option_1, option_2, option_3, option_4,
    Number(answer),
    explanation || '',
    nextOrderIndex
  ).run()

  return Response.json({ success: true, data: { id: result.meta.last_row_id } })
}
