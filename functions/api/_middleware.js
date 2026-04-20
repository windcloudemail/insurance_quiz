// Middleware：CORS + 解析身分
//
// 身分來源優先順序：
//   1. Cloudflare Access header `Cf-Access-Authenticated-User-Email`
//      → 自動建立 / 對應 users 表 → 配 role
//      windcloudemail@gmail.com 為 admin、其他為 user
//   2. 舊 Authorization Bearer token（local 開發 / 直接打 API 時的 fallback）
//      Token 格式：v1-admin-token-secure（legacy） 或 {role}-{userId}-{random}

const ADMIN_EMAIL = 'windcloudemail@gmail.com'

function parseLegacyToken(request) {
    const header = request.headers.get('Authorization')
    if (!header?.startsWith('Bearer ')) return { role: null, userId: null }
    const token = header.slice(7)
    if (token === 'v1-admin-token-secure') return { role: 'admin', userId: 1 }
    const m = token.match(/^(admin|user)-(\d+)-[a-z0-9]+$/)
    if (m) return { role: m[1], userId: Number(m[2]) }
    return { role: null, userId: null }
}

// Cloudflare Access 把身分放在 cookie CF_Authorization 的 JWT payload 裡（email 欄）
// 不會自動 inject Cf-Access-Authenticated-User-Email header，所以要自己解 cookie
function getEmailFromAccessJWT(request) {
    const cookieHeader = request.headers.get('Cookie') || ''
    const m = cookieHeader.match(/CF_Authorization=([^;]+)/)
    if (!m) return null
    const jwt = m[1]
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    try {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const padded = b64 + '='.repeat((4 - b64.length % 4) % 4)
        const payload = JSON.parse(atob(padded))
        return payload.email || null
    } catch {
        return null
    }
}

async function getOrCreateAccessUser(env, email) {
    const lower = email.toLowerCase()
    let user = await env.DB.prepare(
        'SELECT id, username, role FROM users WHERE LOWER(username) = ?'
    ).bind(lower).first()

    if (!user) {
        const role = lower === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user'
        const res = await env.DB.prepare(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)'
        ).bind(lower, '__sso__', role).run()
        user = { id: res.meta.last_row_id, username: lower, role }
    }
    return user
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

        let role = null, userId = null, username = null

        // 1. Cloudflare Access SSO（優先）
        //    先試 header（某些 inject 設定有），fallback 解 CF_Authorization cookie 的 JWT
        const accessEmail =
            context.request.headers.get('Cf-Access-Authenticated-User-Email') ||
            getEmailFromAccessJWT(context.request)
        if (accessEmail) {
            try {
                const user = await getOrCreateAccessUser(context.env, accessEmail)
                role = user.role
                userId = user.id
                username = user.username
            } catch (e) {
                console.error('[middleware] SSO user lookup failed:', e?.message)
            }
        } else {
            // 2. 舊 token-based（local 開發 / API 直呼）
            const parsed = parseLegacyToken(context.request)
            role = parsed.role
            userId = parsed.userId
        }

        const requiresAdmin =
            (path.startsWith('/api/questions') && isMutation) ||
            (path.startsWith('/api/import-failures') && isMutation)

        const requiresUser =
            (path === '/api/attempts' && isMutation) ||
            (path === '/api/questions/random-wrong') ||
            (path.startsWith('/api/stats/'))

        if (requiresAdmin && role !== 'admin') {
            return Response.json({ success: false, error: '未經授權的操作，請先以管理員登入' }, { status: 401 })
        }
        if (requiresUser && !role) {
            return Response.json({ success: false, error: '請先登入再進行操作' }, { status: 401 })
        }

        context.data = { role, userId, username }

        const response = await context.next()
        const newRes = new Response(response.body, response)
        newRes.headers.set('Access-Control-Allow-Origin', '*')
        return newRes
    } catch (err) {
        return Response.json({ success: false, error: err.message }, { status: 500 })
    }
}
