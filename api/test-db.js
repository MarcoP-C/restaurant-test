// Test connection to Neon PostgreSQL
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }

    try {
        const { neon } = require('@neondatabase/serverless');
        const databaseUrl = process.env.DATABASE_URL;

        if (!databaseUrl) {
            return res.status(500).json({
                success: false,
                message: 'DATABASE_URL no está configurada'
            });
        }

        const sql = neon(databaseUrl);
        const result = await sql`
            SELECT
                version() AS database_version,
                NOW() AS server_time
        `;

        return res.status(200).json({
            success: true,
            message: 'Conexión correcta con PostgreSQL',
            database_version: result[0].database_version,
            server_time: result[0].server_time
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error al conectar con PostgreSQL',
            error: error.message
        });
    }
}
