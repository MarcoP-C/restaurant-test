// Utilidades compartidas por las funciones de /api.
// El prefijo "_" evita que Vercel publique este archivo como endpoint.

export const TIMEZONE = process.env.APP_TIMEZONE || 'America/Mexico_City';

export class ConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConfigError';
    }
}

export function sendJson(res, status, body) {
    return res.status(status).json(body);
}

export function methodNotAllowed(res, allowed) {
    res.setHeader('Allow', allowed.join(', '));
    return sendJson(res, 405, { success: false, message: 'Método no permitido' });
}

export function badRequest(res, message) {
    return sendJson(res, 400, { success: false, message });
}

// Devuelve siempre un objeto, aunque el cuerpo falte o sea inválido.
export function getBody(req) {
    const body = req.body;
    if (body && typeof body === 'object') return body;
    if (typeof body === 'string') {
        try {
            const parsed = JSON.parse(body);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }
    return {};
}

// Respuesta de error uniforme: no filtra detalles internos al cliente.
export function handleError(res, error, context = 'api') {
    if (error instanceof ConfigError) {
        console.error(`[${context}] Configuración incompleta: ${error.message}`);
        return sendJson(res, 500, {
            success: false,
            message: 'El servidor no está configurado correctamente'
        });
    }
    if (error && error.code === '23505') {
        return sendJson(res, 409, { success: false, message: 'Ya existe un registro con esos datos' });
    }
    if (error && error.code === '23503') {
        return sendJson(res, 400, { success: false, message: 'El registro hace referencia a datos que no existen' });
    }
    console.error(`[${context}]`, error);
    return sendJson(res, 500, { success: false, message: 'Error interno del servidor' });
}

export function slugify(text) {
    const slug = String(text ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80)
        .replace(/-+$/g, '');
    return slug || 'item';
}

export function toBool(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (value === undefined || value === null || value === '') return fallback;
    const s = String(value).trim().toLowerCase();
    if (['true', '1', 'on', 'yes', 'si', 'sí'].includes(s)) return true;
    if (['false', '0', 'off', 'no'].includes(s)) return false;
    return fallback;
}

// Número finito o null.
export function toNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isFinite(n) ? n : null;
}

// Entero o null.
export function toInt(value) {
    const n = toNumber(value);
    return n !== null && Number.isInteger(n) ? n : null;
}

// Texto recortado; cadena vacía -> null.
export function cleanText(value) {
    if (value === undefined || value === null) return null;
    const s = String(value).trim();
    return s === '' ? null : s;
}

// Acepta "YYYY-MM-DD" (o ISO que empiece así) y devuelve "YYYY-MM-DD" válido o null.
export function toDateOnly(value) {
    if (value === undefined || value === null || value === '') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
}

// Fecha de hoy (YYYY-MM-DD) en la zona horaria del negocio.
export function todayInTimeZone(timeZone = TIMEZONE) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(new Date());
}

// Neon devuelve NUMERIC como texto: lo convertimos a número para el frontend.
export function withNumbers(row, keys) {
    const out = { ...row };
    for (const key of keys) {
        if (out[key] !== null && out[key] !== undefined) out[key] = Number(out[key]);
    }
    return out;
}

export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
