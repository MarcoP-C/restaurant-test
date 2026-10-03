// Prueba de conexión a Neon. Solo para administradores con sesión iniciada.
import { getDb } from './_db.js';
import { requireAdmin } from './_auth.js';
import { handleError, methodNotAllowed, sendJson } from './_utils.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return methodNotAllowed(res, ['GET']);
    }

    try {
        const admin = await requireAdmin(req, res);
        if (!admin) return;

        const sql = await getDb();
        const rows = await sql`SELECT NOW() AS server_time`;

        return sendJson(res, 200, {
            success: true,
            message: 'Conexión correcta con PostgreSQL',
            server_time: rows[0].server_time
        });
    } catch (error) {
        return handleError(res, error, 'test-db');
    }
}
