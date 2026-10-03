// Autenticación del panel: /api/admin-auth?action=login|logout|check|password
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getDb } from './_db.js';
import {
    clearSessionCookie,
    createSessionToken,
    isSameOrigin,
    readSession,
    requireAdmin,
    passwordVersion,
    setSessionCookie
} from './_auth.js';
import {
    ConfigError,
    badRequest,
    getBody,
    handleError,
    methodNotAllowed,
    sendJson,
    sleep
} from './_utils.js';

const ACTIONS = { login: 'POST', logout: 'POST', check: 'GET', password: 'POST' };
const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const DEFAULT_PASSWORD = 'changeme123';

let dummyHash = null; // para igualar tiempos cuando el usuario no existe

export default async function handler(req, res) {
    const action = String(req.query?.action || '');

    if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) {
        return badRequest(res, 'Parámetro "action" requerido: login|logout|check|password');
    }
    if (req.method !== ACTIONS[action]) {
        return methodNotAllowed(res, [ACTIONS[action]]);
    }

    try {
        switch (action) {
            case 'login': return await login(req, res);
            case 'logout': return logout(req, res);
            case 'check': return await check(req, res);
            case 'password': return await changePassword(req, res);
        }
    } catch (error) {
        return handleError(res, error, 'admin-auth');
    }
}

function safeEqual(a, b) {
    const ha = crypto.createHash('sha256').update(String(a)).digest();
    const hb = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(ha, hb);
}

// Primer acceso: si no existe ningún admin y las credenciales coinciden con
// "admin" + ADMIN_PASSWORD (variable de entorno), se crea el administrador.
async function bootstrapAdmin(sql, username, password) {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected || username !== 'admin' || !safeEqual(password, expected)) return;

    if (expected === DEFAULT_PASSWORD || expected.length < MIN_PASSWORD_LENGTH) {
        throw new ConfigError(`ADMIN_PASSWORD debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres y no puede ser "${DEFAULT_PASSWORD}"`);
    }

    const rows = await sql`SELECT COUNT(*)::int AS total FROM admins`;
    if (rows[0].total > 0) return;

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await sql`
        INSERT INTO admins (username, password_hash)
        VALUES ('admin', ${hash})
        ON CONFLICT (username) DO NOTHING
    `;
}

async function login(req, res) {
    if (!isSameOrigin(req)) {
        return sendJson(res, 403, { success: false, message: 'Petición no permitida' });
    }

    const body = getBody(req);
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!username || !password) {
        return badRequest(res, 'Usuario y contraseña son requeridos');
    }
    if (username.length > 50 || password.length > MAX_PASSWORD_LENGTH) {
        return sendJson(res, 401, { success: false, message: 'Usuario o contraseña incorrectos' });
    }

    const sql = await getDb();
    await bootstrapAdmin(sql, username, password);

    const rows = await sql`
        SELECT id, username, password_hash
        FROM admins
        WHERE username = ${username}
        LIMIT 1
    `;
    const admin = rows[0];

    if (!dummyHash) dummyHash = bcrypt.hashSync('no-existe', BCRYPT_ROUNDS);
    const valid = await bcrypt.compare(password, admin ? admin.password_hash : dummyHash);

    if (!admin || !valid) {
        await sleep(400); // frena la fuerza bruta
        return sendJson(res, 401, { success: false, message: 'Usuario o contraseña incorrectos' });
    }

    setSessionCookie(req, res, createSessionToken(admin));
    return sendJson(res, 200, {
        success: true,
        message: 'Login exitoso',
        admin: { id: admin.id, username: admin.username }
    });
}

function logout(req, res) {
    if (!isSameOrigin(req)) {
        return sendJson(res, 403, { success: false, message: 'Petición no permitida' });
    }
    clearSessionCookie(req, res);
    return sendJson(res, 200, { success: true, message: 'Sesión cerrada' });
}

// Siempre responde 200: "no autenticado" es un estado normal, no un error.
async function check(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    const session = readSession(req);
    if (!session) {
        return sendJson(res, 200, { success: true, authenticated: false });
    }

    const sql = await getDb();
    const rows = await sql`SELECT id, username, password_hash FROM admins WHERE id = ${session.id} LIMIT 1`;
    const admin = rows[0];
    if (!admin || passwordVersion(admin.password_hash) !== session.pv) {
        clearSessionCookie(req, res);
        return sendJson(res, 200, { success: true, authenticated: false });
    }

    return sendJson(res, 200, {
        success: true,
        authenticated: true,
        admin: { id: admin.id, username: admin.username }
    });
}

async function changePassword(req, res) {
    const admin = await requireAdmin(req, res);
    if (!admin) return;

    const body = getBody(req);
    const current = typeof body.current_password === 'string' ? body.current_password : '';
    const next = typeof body.new_password === 'string' ? body.new_password : '';

    if (!current || !next) {
        return badRequest(res, 'La contraseña actual y la nueva son requeridas');
    }
    if (next.length < MIN_PASSWORD_LENGTH || next.length > MAX_PASSWORD_LENGTH) {
        return badRequest(res, `La nueva contraseña debe tener entre ${MIN_PASSWORD_LENGTH} y ${MAX_PASSWORD_LENGTH} caracteres`);
    }
    if (next === current) {
        return badRequest(res, 'La nueva contraseña debe ser distinta a la actual');
    }

    const valid = await bcrypt.compare(current, admin.password_hash);
    if (!valid) {
        await sleep(400);
        return sendJson(res, 400, { success: false, message: 'La contraseña actual es incorrecta' });
    }

    const sql = await getDb();
    const hash = await bcrypt.hash(next, BCRYPT_ROUNDS);
    await sql`UPDATE admins SET password_hash = ${hash} WHERE id = ${admin.id}`;

    // La huella cambió: emitimos una sesión nueva para esta pestaña.
    setSessionCookie(req, res, createSessionToken({ id: admin.id, username: admin.username, password_hash: hash }));
    return sendJson(res, 200, { success: true, message: 'Contraseña actualizada' });
}
