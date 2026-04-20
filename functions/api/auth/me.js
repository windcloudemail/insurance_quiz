// GET /api/auth/me
// 回傳當前使用者身分（middleware 已從 Cf-Access header 或 Authorization 解析）

export async function onRequestGet({ data, env }) {
    if (!data?.userId) {
        return Response.json({ success: true, data: { authenticated: false } })
    }
    let username = data.username
    if (!username) {
        const u = await env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(data.userId).first()
        username = u?.username || ''
    }
    return Response.json({
        success: true,
        data: {
            authenticated: true,
            user_id: data.userId,
            username,
            role: data.role,
        },
    })
}
