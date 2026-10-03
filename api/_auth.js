// Sesiones de administrador: cookie firmada con HMAC-SHA256 (sin dependencias extra).
// El prefijo "_" evita que Vercel publique este archivo como endpoint.
import crypto from 'node:crypto';
import { getDb } from './_db.js';
import { ConfigError, sendJson } from './_utils.js';

export const COOKIE_NAME = 'admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 horas

function getSecret() {
    const secret = process.env.SESSION_SECRET;
    if (!secret || secret.length < 16) {
        throw new ConfigError('SESSION_SECRET no está configurada (mínimo 16 caracteres)');
    }
    return secret;
}

function sign(data) {
    return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

// Huella del hash de contraseña: al cambiar la contraseña se invalidan las sesiones anteriores.
export function passwordVersion(passwordHash) {
    return crypto.createHash('sha256').update(String(passwordHash)).digest('base64url').slice(0, 16);
}

export function createSessionToken(admin) {
    const payload = Buffer.from(JSON.stringify({
        id: admin.id,
        u: admin.username,
        pv: passwordVersion(admin.password_hash),
        exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
    })).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token) {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

    const given = Buffer.from(parts[1]);
    const expected = Buffer.from(sign(parts[0]));
    if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;

    try {
        const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
        if (!data || typeof data.id !== 'number' || typeof data.exp !== 'number') return null;
        if (data.exp < Math.floor(Date.now() / 1000)) return null;
        return data;
    } catch {
        return null;
    }
}

export function parseCookies(header) {
    const out = Object.create(null);
    if (!header) return out;
    for (const part of String(header).split(';')) {
        const index = part.indexOf('=');
        if (index < 0) continue;
        const key = part.slice(0, index).trim();
        const value = part.slice(index + 1).trim();
        if (key && !(key in out)) out[key] = value;
    }
    return out;
}

function isSecureRequest(req) {
    return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

function buildCookie(req, value, maxAge) {
    const parts = [`${COOKIE_NAME}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAge}`];
    if (isSecureRequest(req)) parts.push('Secure');
    return parts.join('; ');
}

export function setSessionCookie(req, res, token) {
    res.setHeader('Set-Cookie', buildCookie(req, token, SESSION_TTL_SECONDS));
}

export function clearSessionCookie(req, res) {
    res.setHeader('Set-Cookie', buildCookie(req, '', 0));
}

export function readSession(req) {
    const cookies = parseCookies(req.headers.cookie);
    return verifySessionToken(cookies[COOKIE_NAME]);
}

// Defensa CSRF básica: si el navegador envía Origin, debe coincidir con nuestro host.
export function isSameOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
        return new URL(origin).host === req.headers.host;
    } catch {
        return false;
    }
}

// Protege un endpoint de administración. Devuelve el admin o null (ya respondió el error).
// Las peticiones que modifican datos deben venir del propio sitio y con la cabecera
// X-Requested-With, algo que un formulario externo no puede añadir.
export async function requireAdmin(req, res) {
    const session = readSession(req);
    if (!session) {
        sendJson(res, 401, { success: false, authenticated: false, message: 'Sesión no válida o expirada' });
        return null;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        if (!isSameOrigin(req) || req.headers['x-requested-with'] !== 'fetch') {
            sendJson(res, 403, { success: false, message: 'Petición no permitida' });
            return null;
        }
    }

    const sql = await getDb();
    const rows = await sql`SELECT id, username, password_hash FROM admins WHERE id = ${session.id} LIMIT 1`;
    const admin = rows[0];
    if (!admin || passwordVersion(admin.password_hash) !== session.pv) {
        clearSessionCookie(req, res);
        sendJson(res, 401, { success: false, authenticated: false, message: 'Sesión no válida o expirada' });
        return null;
    }
    return admin;
}
