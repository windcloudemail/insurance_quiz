// POST /api/auth/login
// Body: { username, password }
// - username='admin' → 對照 users table（admin role）
// - 其他 4 位數字 (MMDD) → 已存在則驗證、不存在則自動註冊（密碼需為 4 位數字 YYYY）
// 回傳 token 格式：{role}-{userId}-{random}，middleware 據此判斷權限

function randomTail() {
    return Math.random().toString(36).slice(2, 10)
}

export async function onRequestPost({ request, env }) {
    let body
    try {
        body = await request.json()
    } catch {
        return Response.json({ success: false, error: '請求格式錯誤' }, { status: 400 })
    }

    const { username, password } = body || {}
    if (!username || !password) {
        return Response.json({ success: false, error: '缺少帳號或密碼' }, { status: 400 })
    }

    const isAdmin = username === 'admin'
    if (!isAdmin && !/^\d{4}$/.test(username)) {
        return Response.json({ success: false, error: '帳號格式錯誤（應為 4 位數字 MMDD）' }, { status: 400 })
    }

    // 查 users
    let user = await env.DB.prepare('SELECT id, username, password, role FROM users WHERE username = ?')
        .bind(username).first()

    if (user) {
        if (user.password !== password) {
            return Response.json({ success: false, error: '密碼錯誤' }, { status: 401 })
        }
    } else {
        if (isAdmin) {
            return Response.json({ success: false, error: '管理員帳號不存在，請聯絡站長' }, { status: 401 })
        }
        // 一般用戶：自動註冊，但密碼需符合 YYYY 格式
        if (!/^\d{4}$/.test(password)) {
            return Response.json({ success: false, error: '密碼格式錯誤（應為 4 位數字 YYYY）' }, { status: 400 })
        }
        try {
            const res = await env.DB.prepare(
                'INSERT INTO users (username, password, role) VALUES (?, ?, ?)'
            ).bind(username, password, 'user').run()
            user = { id: res.meta.last_row_id, username, role: 'user' }
        } catch (e) {
            return Response.json({ success: false, error: `建立帳號失敗：${e.message}` }, { status: 500 })
        }
    }

    const token = `${user.role}-${user.id}-${randomTail()}`
    return Response.json({
        success: true,
        data: { token, username: user.username, role: user.role, user_id: user.id },
    })
}
