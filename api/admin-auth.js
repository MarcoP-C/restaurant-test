// Autenticación única (login, logout, auth-check)
export default async function handler(req, res) {
    const { action } = req.query;

    if (req.method === 'POST' && action === 'login') {
        // Login
        try {
            const { sql } = require('./db');
            const bcrypt = require('bcryptjs');
            const cookieParser = require('cookie-parser');

            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({ success: false, message: 'Usuario y contraseña son requeridos' });
            }

            const result = await sql`
                SELECT id, username, password_hash
                FROM admins
                WHERE username = ${username}
                LIMIT 1
            `;

            if (result.length === 0) {
                return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
            }

            const admin = result[0];
            const isPasswordValid = await bcrypt.compare(password, admin.password_hash);

            if (!isPasswordValid) {
                return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
            }

            res.setHeader('Set-Cookie', [
                cookieParser.sign({ adminId: admin.id, username: admin.username }, process.env.SESSION_SECRET || 'your-secret-key'),
                'Path=/',
                'HttpOnly',
                'SameSite=Lax'
            ]);

            return res.status(200).json({
                success: true,
                message: 'Login exitoso',
                admin: { id: admin.id, username: admin.username }
            });

        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({ success: false, message: 'Error al iniciar sesión' });
        }

    } else if (req.method === 'GET' && action === 'check') {
        // Check auth
        try {
            const { sql } = require('./db');
            const cookieParser = require('cookie-parser');

            let sessionId = null;
            if (req.headers.cookie) {
                const parsed = cookieParser(req.headers.cookie, { secret: process.env.SESSION_SECRET || 'your-secret-key' });
                const cookiesArr = parsed(req.headers.cookie);
                sessionId = cookiesArr.sessionId;
            }

            if (!sessionId) {
                return res.status(401).json({ success: false, authenticated: false });
            }

            const result = await sql`SELECT id, username FROM admins WHERE id = ${sessionId} LIMIT 1`;

            if (result.length === 0) {
                return res.status(401).json({ success: false, authenticated: false });
            }

            return res.status(200).json({
                success: true,
                authenticated: true,
                admin: { id: result[0].id, username: result[0].username }
            });

        } catch (error) {
            console.error('Auth check error:', error);
            return res.status(500).json({ success: false, authenticated: false });
        }

    } else if (req.method === 'POST' && action === 'logout') {
        // Logout
        try {
            res.setHeader('Set-Cookie', [
                'sessionId=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
                'username=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
            ]);

            return res.status(200).json({ success: true, message: 'Sesión cerrada' });

        } catch (error) {
            console.error('Logout error:', error);
            return res.status(500).json({ success: false, message: 'Error al cerrar sesión' });
        }
    }

    return res.status(405).json({ success: false, message: 'Método no permitido' });
}
