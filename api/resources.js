// Lectura pública de datos: /api/resources?type=categories|products|promotions|settings
import { getDb } from './_db.js';
import {
    TIMEZONE,
    badRequest,
    handleError,
    methodNotAllowed,
    sendJson,
    withNumbers
} from './_utils.js';

const TYPES = ['categories', 'products', 'promotions', 'settings'];

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return methodNotAllowed(res, ['GET']);
    }

    const type = String(req.query?.type || '');
    if (!TYPES.includes(type)) {
        return badRequest(res, 'Parámetro "type" requerido: categories|products|promotions|settings');
    }

    try {
        const sql = await getDb();
        let rows;

        switch (type) {
            case 'categories':
                rows = await sql`
                    SELECT id, name, slug, description
                    FROM categories
                    WHERE is_active = true
                    ORDER BY name ASC
                `;
                break;

            case 'products':
                rows = await listProducts(sql);
                break;

            case 'promotions':
                rows = (await sql`
                    SELECT id, name, description, discount_type, discount_value,
                           min_purchase, buy_x_get_y, pay_y,
                           to_char(start_date, 'YYYY-MM-DD') AS start_date,
                           to_char(end_date, 'YYYY-MM-DD') AS end_date
                    FROM promotions
                    WHERE is_active = true
                      AND (NOW() AT TIME ZONE ${TIMEZONE}) BETWEEN promotions.start_date AND promotions.end_date
                    ORDER BY promotions.end_date ASC
                `).map((row) => withNumbers(row, ['discount_value', 'min_purchase']));
                break;

            case 'settings': {
                const settingRows = await sql`SELECT key, value FROM settings`;
                const settings = Object.create(null);
                for (const row of settingRows) settings[row.key] = row.value;
                rows = [settings];
                break;
            }
        }

        // Caché corta en el CDN: los cambios del admin se ven en segundos.
        res.setHeader('Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30');
        if (type === 'settings') {
            return sendJson(res, 200, { success: true, settings: rows[0] });
        }
        return sendJson(res, 200, { success: true, [type]: rows });
    } catch (error) {
        return handleError(res, error, `resources:${type}`);
    }
}

async function listProducts(sql) {
    const products = await sql`
        SELECT p.id, p.name, p.slug, p.description, p.price, p.promo_price, p.category_id,
               p.is_promotional, c.name AS category_name, c.slug AS category_slug
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE p.is_available = true
          AND (c.id IS NULL OR c.is_active = true)
        ORDER BY p.created_at DESC, p.id DESC
    `;

    // Todas las imágenes en una sola consulta (en lugar de una por producto).
    const images = await sql`
        SELECT i.product_id, i.image_url
        FROM product_images i
        JOIN products p ON p.id = i.product_id
        WHERE p.is_available = true
        ORDER BY i.is_primary DESC, i.created_at ASC, i.id ASC
    `;

    const byProduct = new Map();
    for (const image of images) {
        const list = byProduct.get(image.product_id) || [];
        if (list.length < 10) list.push(image.image_url);
        byProduct.set(image.product_id, list);
    }

    return products.map((product) => ({
        ...withNumbers(product, ['price', 'promo_price']),
        images: byProduct.get(product.id) || []
    }));
}
