// Middleware：CORS + 解析 Authorization + 路徑權限驗證
// token 格式：
//   legacy admin：v1-admin-token-secure
//   new：{role}-{userId}-{random}   role='admin'|'user'
// 下游 route 可透過 context.data.role / context.data.userId 取得身分

function parseAuth(request) {
    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) return { role: null, userId: null }
    const token = header.slice(7)
    // legacy admin（向下相容，日後可移除）
    if (token === 'v1-admin-token-secure') return { role: 'admin', userId: 1 }
    const m = token.match(/^(admin|user)-(\d+)-[a-z0-9]+$/)
    if (m) return { role: m[1], userId: Number(m[2]) }
    return { role: null, userId: null }
}

export async function onRequest(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        })
    }

    try {
        const url = new URL(context.request.url)
        const path = url.pathname
        const method = context.request.method
        const isMutation = ['POST', 'PUT', 'DELETE'].includes(method)

        const { role, userId } = parseAuth(context.request)

        // 題庫 / 失敗紀錄的 mutation 只允許 admin
        const requiresAdmin =
            (path.startsWith('/api/questions') && isMutation) ||
            (path.startsWith('/api/import-failures') && isMutation)

        // 個人答題上報需登入（任何 role）
        const requiresUser =
            (path === '/api/attempts' && isMutation) ||
            (path === '/api/questions/random-wrong') ||  // 錯題複習一定要 per-user
            (path.startsWith('/api/stats/'))              // 個人統計（精熟度等）一定要 per-user

        if (requiresAdmin && role !== 'admin') {
            return Response.json({ success: false, error: '未經授權的操作，請先以管理員登入' }, { status: 401 })
        }
        if (requiresUser && !role) {
            return Response.json({ success: false, error: '請先登入再進行操作' }, { status: 401 })
        }

        // 把解析結果傳給下游 route
        context.data = { role, userId }

        const response = await context.next()
        const newRes = new Response(response.body, response)
        newRes.headers.set('Access-Control-Allow-Origin', '*')
        return newRes
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 })
    }
}
