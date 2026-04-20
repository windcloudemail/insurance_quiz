// DELETE /api/import-failures/:id → 手動補題完成後移除紀錄

export async function onRequestDelete({ params, env }) {
    const { id } = params
    await env.DB.prepare('DELETE FROM import_failures WHERE id = ?').bind(id).run()
    return Response.json({ success: true, data: { id } })
}
