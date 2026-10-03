// CRUD completo para categorías, productos y promociones (admin)
// /api/admin/resources?type=categories|products|promotions
export default async function handler(req, res) {
    const { type } = req.query;

    if (req.method === 'GET') {
        // Obtener recursos (con y sin activo)
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
                    query = 'SELECT * FROM categories ORDER BY name ASC';
                    break;

                case 'products':
                    query = `
                        SELECT p.*, c.name as category_name
                        FROM products p
                        LEFT JOIN categories c ON p.category_id = c.id
                        ORDER BY p.created_at DESC
                    `;
                    break;

                case 'promotions':
                    query = 'SELECT * FROM promotions ORDER BY end_date DESC';
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

    } else if (req.method === 'POST') {
        // Crear nuevo recurso
        if (!type || !['categories', 'products', 'promotions'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Parámetro "type" requerido: categories|products|promotions'
            });
        }

        try {
            const { sql } = require('./db');

            switch (type) {
                case 'categories':
                    const { name, description } = req.body;
                    if (!name) {
                        return res.status(400).json({ success: false, message: 'Nombre es requerido' });
                    }

                    const slug = name.toLowerCase()
                        .normalize('NFD')
                        .replace(/[̀-ͯ]/g, '')
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)/g, '');

                    const result = await sql`
                        INSERT INTO categories (name, slug, description)
                        VALUES (${name}, ${slug}, ${description || null})
                        RETURNING *
                    `;

                    return res.status(201).json({ success: true, category: result[0], message: 'Categoría creada' });

                case 'products':
                    const { name: pName, description: pDesc, price, category_id, is_available, is_promotional, promo_code } = req.body;
                    if (!pName || !price) {
                        return res.status(400).json({ success: false, message: 'Nombre y precio son requeridos' });
                    }

                    const slug = pName.toLowerCase()
                        .normalize('NFD')
                        .replace(/[̀-ͯ]/g, '')
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/(^-|-$)/g, '');

                    const result = await sql`
                        INSERT INTO products (name, slug, description, price, category_id, is_available, is_promotional, promo_code)
                        VALUES (${pName}, ${slug}, ${pDesc || null}, ${price}, ${category_id || null}, ${is_available !== undefined ? is_available : true}, ${is_promotional || false}, ${promo_code || null})
                        RETURNING *
                    `;

                    return res.status(201).json({ success: true, product: result[0], message: 'Producto creado' });

                case 'promotions':
                    const { name: promoName, description: promoDesc, discount_type, discount_value, min_purchase, buy_x_get_y, start_date, end_date, is_active } = req.body;
                    if (!promoName || !discount_type || !discount_value || !end_date) {
                        return res.status(400).json({ success: false, message: 'Campos requeridos: name, discount_type, discount_value, end_date' });
                    }

                    const result = await sql`
                        INSERT INTO promotions (name, description, discount_type, discount_value, min_purchase, buy_x_get_y, start_date, end_date, is_active)
                        VALUES (${promoName}, ${promoDesc || null}, ${discount_type}, ${discount_value}, ${min_purchase || 0}, ${buy_x_get_y || 0}, ${start_date || 'CURRENT_TIMESTAMP'}, ${end_date}, ${is_active || true})
                        RETURNING *
                    `;

                    return res.status(201).json({ success: true, promotion: result[0], message: 'Promoción creada' });
            }

        } catch (error) {
            console.error(`Error creating ${type}:`, error);
            return res.status(500).json({
                success: false,
                message: `Error al crear ${type}`
            });
        }

    } else if (req.method === 'PUT') {
        // Actualizar recurso
        if (!type || !['categories', 'products', 'promotions'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Parámetro "type" requerido: categories|products|promotions'
            });
        }

        try {
            const { sql } = require('./db');

            const { id, ...data } = req.body;

            switch (type) {
                case 'categories':
                    const updates = [];
                    const params = [];

                    if (data.name) { updates.push('name = $1'); params.push(data.name); params.push(generateSlug(data.name)); }
                    if (data.description !== undefined) { updates.push('description = $2'); params.push(data.description); }
                    if (data.is_active !== undefined) { updates.push('is_active = $3'); params.push(data.is_active); }

                    if (updates.length === 0) {
                        return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
                    }

                    params.push(id);
                    const query = `UPDATE categories SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`;

                    const result = await sql(query, params);

                    if (result.length === 0) {
                        return res.status(404).json({ success: false, message: 'Categoría no encontrada' });
                    }

                    return res.status(200).json({ success: true, category: result[0], message: 'Categoría actualizada' });

                case 'products':
                    const updatesP = [];
                    const paramsP = [];

                    if (data.name !== undefined) { updatesP.push('name = $1'); paramsP.push(data.name); paramsP.push(generateSlug(data.name)); }
                    if (data.description !== undefined) { updatesP.push('description = $2'); paramsP.push(data.description); }
                    if (data.price !== undefined) { updatesP.push('price = $3'); paramsP.push(data.price); }
                    if (data.category_id !== undefined) { updatesP.push('category_id = $4'); paramsP.push(data.category_id); }
                    if (data.is_available !== undefined) { updatesP.push('is_available = $5'); paramsP.push(data.is_available); }
                    if (data.is_promotional !== undefined) { updatesP.push('is_promotional = $6'); paramsP.push(data.is_promotional); }
                    if (data.promo_code !== undefined) { updatesP.push('promo_code = $7'); paramsP.push(data.promo_code); }

                    if (updatesP.length === 0) {
                        return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
                    }

                    paramsP.push(id);
                    const queryP = `UPDATE products SET ${updatesP.join(', ')} WHERE id = $${paramsP.length} RETURNING *`;

                    const resultP = await sql(queryP, paramsP);

                    if (resultP.length === 0) {
                        return res.status(404).json({ success: false, message: 'Producto no encontrado' });
                    }

                    return res.status(200).json({ success: true, product: resultP[0], message: 'Producto actualizado' });

                case 'promotions':
                    const updatesPr = [];
                    const paramsPr = [];

                    if (data.name !== undefined) { updatesPr.push('name = $1'); paramsPr.push(data.name); }
                    if (data.description !== undefined) { updatesPr.push('description = $2'); paramsPr.push(data.description); }
                    if (data.discount_type !== undefined) { updatesPr.push('discount_type = $3'); paramsPr.push(data.discount_type); }
                    if (data.discount_value !== undefined) { updatesPr.push('discount_value = $4'); paramsPr.push(data.discount_value); }
                    if (data.min_purchase !== undefined) { updatesPr.push('min_purchase = $5'); paramsPr.push(data.min_purchase); }
                    if (data.buy_x_get_y !== undefined) { updatesPr.push('buy_x_get_y = $6'); paramsPr.push(data.buy_x_get_y); }
                    if (data.is_active !== undefined) { updatesPr.push('is_active = $7'); paramsPr.push(data.is_active); }
                    if (data.start_date !== undefined) { updatesPr.push('start_date = $8'); paramsPr.push(data.start_date); }
                    if (data.end_date !== undefined) { updatesPr.push('end_date = $9'); paramsPr.push(data.end_date); }

                    if (updatesPr.length === 0) {
                        return res.status(400).json({ success: false, message: 'No hay campos para actualizar' });
                    }

                    paramsPr.push(id);
                    const queryPr = `UPDATE promotions SET ${updatesPr.join(', ')} WHERE id = $${paramsPr.length} RETURNING *`;

                    const resultPr = await sql(queryPr, paramsPr);

                    if (resultPr.length === 0) {
                        return res.status(404).json({ success: false, message: 'Promoción no encontrada' });
                    }

                    return res.status(200).json({ success: true, promotion: resultPr[0], message: 'Promoción actualizada' });
            }

        } catch (error) {
            console.error(`Error updating ${type}:`, error);
            return res.status(500).json({
                success: false,
                message: `Error al actualizar ${type}`
            });
        }

    } else if (req.method === 'DELETE') {
        // Eliminar recurso
        if (!type || !['categories', 'products', 'promotions'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Parámetro "type" requerido: categories|products|promotions'
            });
        }

        try {
            const { sql } = require('./db');
            const { id } = req.body;

            if (!id) {
                return res.status(400).json({ success: false, message: 'ID es requerido' });
            }

            const query = `DELETE FROM ${type} WHERE id = $1 RETURNING *`;
            const result = await sql(query, [id]);

            if (result.length === 0) {
                return res.status(404).json({ success: false, message: `${type} no encontrado` });
            }

            return res.status(200).json({ success: true, [type]: result[0], message: `${type} eliminado` });

        } catch (error) {
            console.error(`Error deleting ${type}:`, error);
            return res.status(500).json({
                success: false,
                message: `Error al eliminar ${type}`
            });
        }
    }

    return res.status(405).json({ success: false, message: 'Método no permitido' });
}

function generateSlug(name) {
    return name.toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}
