// CRUD de administración: /api/admin-resources?type=categories|products|promotions|users[&id=N]
//   GET    -> lista            POST -> crea
//   PUT    -> reemplaza (el formulario envía todos los campos)
//   DELETE -> elimina
// Todas las operaciones exigen sesión de administrador.
import { getDb } from './_db.js';
import { requireAdmin } from './_auth.js';
import {
    badRequest,
    cleanText,
    getBody,
    handleError,
    methodNotAllowed,
    sendJson,
    slugify,
    toBool,
    toDateOnly,
    toInt,
    toNumber,
    todayInTimeZone,
    withNumbers
} from './_utils.js';

const TYPES = ['categories', 'products', 'promotions', 'users'];
const DISCOUNT_TYPES = ['percentage', 'fixed', 'buy_x_get_y', 'minimum'];
const MAX_MONEY = 99999999.99;

export default async function handler(req, res) {
    try {
        const admin = await requireAdmin(req, res);
        if (!admin) return; // requireAdmin ya respondió 401/403

        const type = String(req.query?.type || '');
        if (!TYPES.includes(type)) {
            return badRequest(res, 'Parámetro "type" requerido: categories|products|promotions|users');
        }

        const sql = await getDb();

        switch (req.method) {
            case 'GET':
                return await list(sql, type, res);
            case 'POST':
                return await create(sql, type, req, res);
            case 'PUT':
                return await update(sql, type, readId(req), req, res);
            case 'DELETE':
                return await remove(sql, type, readId(req), res);
            default:
                return methodNotAllowed(res, ['GET', 'POST', 'PUT', 'DELETE']);
        }
    } catch (error) {
        return handleError(res, error, 'admin-resources');
    }
}

function readId(req) {
    const id = toInt(req.query?.id ?? getBody(req).id);
    return id !== null && id > 0 ? id : null;
}

function notFound(res, message) {
    return sendJson(res, 404, { success: false, message });
}

/* ------------------------------ Listados ------------------------------ */

async function list(sql, type, res) {
    switch (type) {
        case 'categories': {
            const rows = await sql`
                SELECT id, name, slug, description, is_active, created_at, updated_at
                FROM categories
                ORDER BY name ASC
            `;
            return sendJson(res, 200, { success: true, categories: rows });
        }
        case 'products': {
            const rows = await sql`
                SELECT p.id, p.name, p.slug, p.description, p.price, p.category_id,
                       p.is_available, p.is_promotional, p.promo_code,
                       p.created_at, p.updated_at, c.name AS category_name
                FROM products p
                LEFT JOIN categories c ON c.id = p.category_id
                ORDER BY p.created_at DESC, p.id DESC
            `;
            return sendJson(res, 200, {
                success: true,
                products: rows.map((row) => withNumbers(row, ['price']))
            });
        }
        case 'promotions': {
            const rows = await sql`
                SELECT id, name, description, discount_type, discount_value,
                       min_purchase, buy_x_get_y, pay_y, is_active,
                       to_char(start_date, 'YYYY-MM-DD') AS start_date,
                       to_char(end_date, 'YYYY-MM-DD') AS end_date,
                       created_at
                FROM promotions
                ORDER BY promotions.end_date DESC, id DESC
            `;
            return sendJson(res, 200, {
                success: true,
                promotions: rows.map((row) => withNumbers(row, ['discount_value', 'min_purchase']))
            });
        }
        case 'users': {
            // Nunca se expone password_hash.
            const rows = await sql`SELECT id, username, created_at FROM admins ORDER BY id ASC`;
            return sendJson(res, 200, { success: true, users: rows });
        }
    }
}

/* ----------------------------- Validaciones ----------------------------- */

function validateCategory(body) {
    const name = cleanText(body.name);
    if (!name) return { error: 'El nombre es requerido' };
    if (name.length > 100) return { error: 'El nombre no puede superar 100 caracteres' };

    const description = cleanText(body.description);
    if (description && description.length > 2000) return { error: 'La descripción es demasiado larga' };

    return { value: { name, description, is_active: toBool(body.is_active, true) } };
}

function validateProduct(body) {
    const name = cleanText(body.name);
    if (!name) return { error: 'El nombre es requerido' };
    if (name.length > 255) return { error: 'El nombre no puede superar 255 caracteres' };

    const description = cleanText(body.description);
    if (description && description.length > 2000) return { error: 'La descripción es demasiado larga' };

    const price = toNumber(body.price);
    if (price === null) return { error: 'El precio es requerido y debe ser un número' };
    if (price < 0 || price > MAX_MONEY) return { error: 'El precio está fuera de rango' };

    let categoryId = null;
    if (body.category_id !== undefined && body.category_id !== null && body.category_id !== '') {
        categoryId = toInt(body.category_id);
        if (categoryId === null || categoryId < 1) return { error: 'Categoría inválida' };
    }

    const promoCode = cleanText(body.promo_code);
    if (promoCode && promoCode.length > 50) return { error: 'El código de promoción no puede superar 50 caracteres' };

    return {
        value: {
            name,
            description,
            price: Math.round(price * 100) / 100,
            category_id: categoryId,
            is_available: toBool(body.is_available, true),
            is_promotional: toBool(body.is_promotional, false),
            promo_code: promoCode
        }
    };
}

function validatePromotion(body) {
    const name = cleanText(body.name);
    if (!name) return { error: 'El nombre es requerido' };
    if (name.length > 255) return { error: 'El nombre no puede superar 255 caracteres' };

    const description = cleanText(body.description);
    if (description && description.length > 2000) return { error: 'La descripción es demasiado larga' };

    const discountType = String(body.discount_type || '');
    if (!DISCOUNT_TYPES.includes(discountType)) return { error: 'Tipo de descuento inválido' };

    // Solo cuenta el campo que corresponde al tipo; el resto se guarda en 0.
    let discountValue = 0;
    let minPurchase = 0;
    let buy = 0;
    let pay = 0;

    switch (discountType) {
        case 'percentage': {
            discountValue = toNumber(body.discount_value);
            if (discountValue === null || discountValue <= 0 || discountValue > 100) {
                return { error: 'El porcentaje debe ser mayor que 0 y no superar 100' };
            }
            break;
        }
        case 'fixed': {
            discountValue = toNumber(body.discount_value);
            if (discountValue === null || discountValue <= 0 || discountValue > MAX_MONEY) {
                return { error: 'El descuento fijo debe ser mayor que 0' };
            }
            break;
        }
        case 'buy_x_get_y': {
            buy = toInt(body.buy_x_get_y);
            pay = toInt(body.pay_y);
            if (buy === null || pay === null || buy < 2 || pay < 1 || pay >= buy) {
                return { error: 'En "Compra X paga Y", X debe ser al menos 2 y Y debe ser menor que X (mínimo 1)' };
            }
            break;
        }
        case 'minimum': {
            minPurchase = toNumber(body.min_purchase);
            if (minPurchase === null || minPurchase <= 0 || minPurchase > MAX_MONEY) {
                return { error: 'El mínimo de compra debe ser mayor que 0' };
            }
            break;
        }
    }

    let startDate = todayInTimeZone();
    if (body.start_date !== undefined && body.start_date !== null && body.start_date !== '') {
        startDate = toDateOnly(body.start_date);
        if (!startDate) return { error: 'La fecha de inicio no es válida' };
    }

    const endDate = toDateOnly(body.end_date);
    if (!endDate) return { error: 'La fecha de fin es requerida y debe ser válida' };
    if (endDate < startDate) return { error: 'La fecha de fin no puede ser anterior a la de inicio' };

    return {
        value: {
            name,
            description,
            discount_type: discountType,
            discount_value: Math.round(discountValue * 100) / 100,
            min_purchase: Math.round(minPurchase * 100) / 100,
            buy_x_get_y: buy,
            pay_y: pay,
            start_date: startDate,
            end_date: endDate,
            is_active: toBool(body.is_active, true)
        }
    };
}

/* ------------------------------- Ayudantes ------------------------------ */

async function slugTaken(sql, table, slug, excludeId) {
    const rows = table === 'categories'
        ? await sql`SELECT 1 FROM categories WHERE slug = ${slug} AND id <> ${excludeId} LIMIT 1`
        : await sql`SELECT 1 FROM products WHERE slug = ${slug} AND id <> ${excludeId} LIMIT 1`;
    return rows.length > 0;
}

// Evita el error por slug duplicado: "pizza", "pizza-2", "pizza-3"...
async function uniqueSlug(sql, table, base, excludeId = 0) {
    let candidate = base;
    for (let n = 2; n < 100; n += 1) {
        if (!(await slugTaken(sql, table, candidate, excludeId))) return candidate;
        candidate = `${base}-${n}`;
    }
    return `${base}-${Date.now()}`;
}

async function categoryExists(sql, id) {
    const rows = await sql`SELECT 1 FROM categories WHERE id = ${id} LIMIT 1`;
    return rows.length > 0;
}

/* -------------------------------- Crear -------------------------------- */

async function create(sql, type, req, res) {
    const body = getBody(req);

    switch (type) {
        case 'categories': {
            const { error, value } = validateCategory(body);
            if (error) return badRequest(res, error);

            const slug = await uniqueSlug(sql, 'categories', slugify(value.name));
            const rows = await sql`
                INSERT INTO categories (name, slug, description, is_active)
                VALUES (${value.name}, ${slug}, ${value.description}, ${value.is_active})
                RETURNING id, name, slug, description, is_active
            `;
            return sendJson(res, 201, { success: true, category: rows[0], message: 'Categoría creada' });
        }

        case 'products': {
            const { error, value } = validateProduct(body);
            if (error) return badRequest(res, error);
            if (value.category_id !== null && !(await categoryExists(sql, value.category_id))) {
                return badRequest(res, 'La categoría seleccionada no existe');
            }

            const slug = await uniqueSlug(sql, 'products', slugify(value.name));
            const rows = await sql`
                INSERT INTO products (name, slug, description, price, category_id, is_available, is_promotional, promo_code)
                VALUES (${value.name}, ${slug}, ${value.description}, ${value.price}, ${value.category_id},
                        ${value.is_available}, ${value.is_promotional}, ${value.promo_code})
                RETURNING id, name, slug
            `;
            return sendJson(res, 201, { success: true, product: rows[0], message: 'Producto creado' });
        }

        case 'promotions': {
            const { error, value } = validatePromotion(body);
            if (error) return badRequest(res, error);

            const rows = await sql`
                INSERT INTO promotions (name, description, discount_type, discount_value, min_purchase,
                                        buy_x_get_y, pay_y, is_active, start_date, end_date)
                VALUES (${value.name}, ${value.description}, ${value.discount_type}, ${value.discount_value},
                        ${value.min_purchase}, ${value.buy_x_get_y}, ${value.pay_y}, ${value.is_active},
                        ${value.start_date + 'T00:00:00'}, ${value.end_date + 'T23:59:59'})
                RETURNING id, name
            `;
            return sendJson(res, 201, { success: true, promotion: rows[0], message: 'Promoción creada' });
        }

        default:
            return methodNotAllowed(res, ['GET']);
    }
}

/* ------------------------------ Actualizar ------------------------------ */

async function update(sql, type, id, req, res) {
    if (type === 'users') return methodNotAllowed(res, ['GET']);
    if (id === null) return badRequest(res, 'ID es requerido');

    const body = getBody(req);

    switch (type) {
        case 'categories': {
            const { error, value } = validateCategory(body);
            if (error) return badRequest(res, error);

            const current = (await sql`SELECT name, slug FROM categories WHERE id = ${id} LIMIT 1`)[0];
            if (!current) return notFound(res, 'Categoría no encontrada');

            const slug = current.name === value.name
                ? current.slug
                : await uniqueSlug(sql, 'categories', slugify(value.name), id);

            const rows = await sql`
                UPDATE categories
                SET name = ${value.name}, slug = ${slug}, description = ${value.description},
                    is_active = ${value.is_active}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                RETURNING id, name, slug, description, is_active
            `;
            return sendJson(res, 200, { success: true, category: rows[0], message: 'Categoría actualizada' });
        }

        case 'products': {
            const { error, value } = validateProduct(body);
            if (error) return badRequest(res, error);
            if (value.category_id !== null && !(await categoryExists(sql, value.category_id))) {
                return badRequest(res, 'La categoría seleccionada no existe');
            }

            const current = (await sql`SELECT name, slug FROM products WHERE id = ${id} LIMIT 1`)[0];
            if (!current) return notFound(res, 'Producto no encontrado');

            const slug = current.name === value.name
                ? current.slug
                : await uniqueSlug(sql, 'products', slugify(value.name), id);

            const rows = await sql`
                UPDATE products
                SET name = ${value.name}, slug = ${slug}, description = ${value.description},
                    price = ${value.price}, category_id = ${value.category_id},
                    is_available = ${value.is_available}, is_promotional = ${value.is_promotional},
                    promo_code = ${value.promo_code}, updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                RETURNING id, name, slug
            `;
            return sendJson(res, 200, { success: true, product: rows[0], message: 'Producto actualizado' });
        }

        case 'promotions': {
            const { error, value } = validatePromotion(body);
            if (error) return badRequest(res, error);

            const rows = await sql`
                UPDATE promotions
                SET name = ${value.name}, description = ${value.description},
                    discount_type = ${value.discount_type}, discount_value = ${value.discount_value},
                    min_purchase = ${value.min_purchase}, buy_x_get_y = ${value.buy_x_get_y},
                    pay_y = ${value.pay_y}, is_active = ${value.is_active},
                    start_date = ${value.start_date + 'T00:00:00'}, end_date = ${value.end_date + 'T23:59:59'}
                WHERE id = ${id}
                RETURNING id, name
            `;
            if (rows.length === 0) return notFound(res, 'Promoción no encontrada');
            return sendJson(res, 200, { success: true, promotion: rows[0], message: 'Promoción actualizada' });
        }
    }
}

/* ------------------------------- Eliminar ------------------------------- */

async function remove(sql, type, id, res) {
    if (type === 'users') return methodNotAllowed(res, ['GET']);
    if (id === null) return badRequest(res, 'ID es requerido');

    switch (type) {
        case 'categories': {
            // Los productos de esa categoría quedan "sin categoría" (ON DELETE SET NULL).
            const rows = await sql`DELETE FROM categories WHERE id = ${id} RETURNING id`;
            if (rows.length === 0) return notFound(res, 'Categoría no encontrada');
            return sendJson(res, 200, { success: true, message: 'Categoría eliminada' });
        }
        case 'products': {
            const rows = await sql`DELETE FROM products WHERE id = ${id} RETURNING id`;
            if (rows.length === 0) return notFound(res, 'Producto no encontrado');
            return sendJson(res, 200, { success: true, message: 'Producto eliminado' });
        }
        case 'promotions': {
            const rows = await sql`DELETE FROM promotions WHERE id = ${id} RETURNING id`;
            if (rows.length === 0) return notFound(res, 'Promoción no encontrada');
            return sendJson(res, 200, { success: true, message: 'Promoción eliminada' });
        }
    }
}
