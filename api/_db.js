// Conexión a Neon y creación (una sola vez por instancia) del esquema.
// El prefijo "_" evita que Vercel publique este archivo como endpoint.
import { neon } from '@neondatabase/serverless';
import { ConfigError } from './_utils.js';

let sqlInstance = null;
let schemaPromise = null;

export function getSql() {
    if (!sqlInstance) {
        const url = process.env.DATABASE_URL;
        if (!url) throw new ConfigError('DATABASE_URL no está configurada');
        sqlInstance = neon(url);
    }
    return sqlInstance;
}

// Devuelve la conexión con el esquema ya verificado.
export async function getDb() {
    const sql = getSql();
    if (!schemaPromise) {
        schemaPromise = prepareSchema(sql).catch((error) => {
            schemaPromise = null; // permitir reintento en la siguiente petición
            throw error;
        });
    }
    await schemaPromise;
    return sql;
}

async function prepareSchema(sql) {
    // Chequeo barato: el esquema está completo solo si existen TODAS las
    // columnas añadidas por migraciones (products.promo_price y promotions.pay_y).
    const ready = await sql`
        SELECT
            COUNT(*) FILTER (WHERE table_name = 'products' AND column_name = 'promo_price') AS products_ok,
            COUNT(*) FILTER (WHERE table_name = 'promotions' AND column_name = 'pay_y') AS promotions_ok
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (
            (table_name = 'products' AND column_name = 'promo_price')
            OR (table_name = 'promotions' AND column_name = 'pay_y')
          )
    `;
    const row = ready[0];
    if (row && Number(row.products_ok) > 0 && Number(row.promotions_ok) > 0) return;
    await createSchema(sql);
}

async function createSchema(sql) {
    await sql`
        CREATE TABLE IF NOT EXISTS categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(100) UNIQUE NOT NULL,
            description TEXT,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            slug VARCHAR(255) UNIQUE NOT NULL,
            description TEXT,
            price DECIMAL(10, 2) NOT NULL,
            promo_price DECIMAL(10, 2),
            is_available BOOLEAN DEFAULT true,
            category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
            is_promotional BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS promotions (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            discount_type VARCHAR(20) NOT NULL,
            discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
            min_purchase DECIMAL(10, 2) DEFAULT 0,
            buy_x_get_y INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            end_date TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS product_images (
            id SERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            image_url TEXT NOT NULL,
            is_primary BOOLEAN DEFAULT false,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS admins (
            id SERIAL PRIMARY KEY,
            username VARCHAR(50) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    await sql`
        CREATE TABLE IF NOT EXISTS settings (
            key VARCHAR(100) PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_products_category ON products (category_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images (product_id)`;

    // Migraciones idempotentes para bases creadas con versiones anteriores.
    // OJO con el orden: la última migración (products.promo_price) es el marcador
    // de "esquema completo"; si algo falla antes, el chequeo la volverá a ejecutar.
    await sql`ALTER TABLE promotions ADD COLUMN IF NOT EXISTS pay_y INTEGER DEFAULT 0`;
    await sql`ALTER TABLE products DROP COLUMN IF EXISTS promo_code`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS promo_price DECIMAL(10, 2) DEFAULT NULL`;
}
