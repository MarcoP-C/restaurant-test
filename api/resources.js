// CRUD centralizado para categorías, productos y promociones
// /api/resources?type=categories|products|promotions
export default async function handler(req, res) {
    const { type } = req.query;

    if (req.method === 'GET') {
        if (!type || !['categories', 'products', 'promotions'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Parámetro "type" requerido: categories|products|promotions'
            });
        }

        const { sql } = require('./db');

        try {
            let query, params = [];

            switch (type) {
                case 'categories':
                    query = `
                        SELECT id, name, slug, description, is_active, created_at, updated_at
                        FROM categories
                        WHERE is_active = true
                        ORDER BY name ASC
                    `;
                    break;

                case 'products':
                    query = `
                        SELECT p.*, c.name as category_name, c.slug as category_slug
                        FROM products p
                        LEFT JOIN categories c ON p.category_id = c.id
                        WHERE p.is_available = true
                        ORDER BY p.created_at DESC
                    `;
                    break;

                case 'promotions':
                    query = `
                        SELECT
                            id, name, description, discount_type, discount_value,
                            min_purchase, buy_x_get_y, is_active,
                            start_date, end_date, created_at
                        FROM promotions
                        WHERE is_active = true
                            AND NOW() >= start_date
                            AND NOW() <= end_date
                        ORDER BY end_date ASC
                    `;
                    break;
            }

            const result = await sql(query, params);

            // Para productos, agregar imágenes
            if (type === 'products') {
                const productsWithImages = await Promise.all(
                    result.map(async (product) => {
                        const imagesResult = await sql`
                            SELECT image_url
                            FROM product_images
                            WHERE product_id = ${product.id}
                            ORDER BY is_primary DESC, created_at ASC
                            LIMIT 10
                        `;
                        return { ...product, images: imagesResult.map(img => img.image_url) };
                    })
                );
                return res.status(200).json({ success: true, products: productsWithImages });
            }

            return res.status(200).json({ success: true, [type]: result });

        } catch (error) {
            console.error(`Error fetching ${type}:`, error);
            return res.status(500).json({
                success: false,
                message: `Error al obtener ${type}`
            });
        }

    } else {
        return res.status(405).json({ success: false, message: 'Método no permitido' });
    }
}
