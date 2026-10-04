# Restaurant Test — Sistema de Menú

Sistema de menú de restaurante con HTML/CSS/JavaScript vanilla + Vercel Functions + Neon PostgreSQL.

## 📱 Vista pública (`/`)

- Menú de productos con **carruseles de imágenes** (rotación automática, flechas y puntos)
- Filtro de categorías con **botones (chips)**, no dropdowns
- **Precios con promoción**: el precio promocional se muestra como principal y el original tachado, con el ahorro
- Promociones activas con vigencia
- Tema claro/oscuro persistente
- Redes sociales en el pie de página (configuradas desde el panel)
- Menú hamburguesa responsive + modal de detalle de producto

## 🔧 Panel de administración (`/admin.html`)

- **Una vista por menú**: Productos, Categorías, Promociones, Usuarios y Configuración
- **Asistente (wizard) por pasos** para crear/editar registros, con indicador de progreso, validación y confirmación final
- CRUD completo de productos, categorías y promociones
- **Productos**:
  - Precio original + precio promocional (obligatorio si la promoción está activa y siempre menor al original)
  - Selección de **una o más imágenes** (máx. 6) desde el equipo, con compresión automática en el navegador, o por URL
  - La primera imagen es la principal
- **Categorías**: nombre, descripción y estado activo
- **Promociones**: porcentaje, monto fijo, "Compra X paga Y" (ej. 2x1) y mínimo de compra, con vigencia
- **Configuración**:
  - Redes sociales (Facebook, Instagram, TikTok, WhatsApp) mostradas en el sitio público
  - Cambio de contraseña
  - Prueba de conexión a la base de datos
- Tema claro/oscuro, toasts, modales de confirmación

## 🗄️ Base de datos (Neon PostgreSQL)

El esquema se crea/migra automáticamente en la primera petición (idempotente):

```
categories (id, name, slug, description, is_active, timestamps)
products (id, name, slug, description, price, promo_price, is_available,
          category_id → categories, is_promotional, timestamps)
product_images (id, product_id → products, image_url, is_primary, created_at)
promotions (id, name, description, discount_type, discount_value, min_purchase,
            buy_x_get_y, pay_y, is_active, start_date, end_date, created_at)
admins (id, username, password_hash, created_at)
settings (key, value, updated_at)   -- redes sociales etc.
```

Migraciones automáticas para bases existentes: agrega `products.promo_price`, `promotions.pay_y`, crea `settings` y elimina el obsoleto `products.promo_code`.

## 🚀 Instalación y despliegue

### 1. Variables de entorno (en Vercel)

- `DATABASE_URL` — connection string de Neon
- `ADMIN_PASSWORD` — contraseña del admin (mínimo 8 caracteres; **no** uses `changeme123`)
- `SESSION_SECRET` — cadena aleatoria de 16+ caracteres para firmar sesiones

### 2. Desplegar

1. Sube el repo a GitHub e impórtalo en Vercel
2. Framework Preset: **Other** · Build Command: vacío · Output Directory: vacío
3. Configura las variables de entorno anteriores
4. Deploy

### 3. Primer acceso al panel

En `/admin.html`, inicia sesión con usuario `admin` y la contraseña de `ADMIN_PASSWORD`.
Si no existe ningún admin, se crea automáticamente en ese primer login. Después cámbiala desde **Configuración → Seguridad**.

## 📡 API

**Pública** (`GET /api/resources?type=...`): `categories`, `products` (con imágenes y `promo_price`), `promotions` (solo vigentes y activas), `settings`.

**Panel** (requiere sesión; las escrituras además exigen `X-Requested-With: fetch` y mismo origen):

- `GET/POST/PUT/DELETE /api/admin-resources?type=categories|products|promotions[&id=N]`
- `GET/POST /api/admin-resources?type=users|settings`
- `POST /api/admin-auth?action=login|logout|password` · `GET /api/admin-auth?action=check`
- `GET /api/test-db`

## 📦 Estructura del proyecto

```
restaurant-test/
├── api/
│   ├── _db.js               # conexión + creación/migración del esquema
│   ├── _auth.js             # sesiones firmadas (HMAC) + protección CSRF
│   ├── _utils.js            # helpers compartidos
│   ├── admin-auth.js        # login/logout/check/cambio de contraseña
│   ├── admin-resources.js   # CRUD admin + settings
│   ├── resources.js         # lectura pública
│   └── test-db.js           # prueba de conexión
├── public/
│   ├── index.html           # sitio público
│   ├── admin.html           # panel de administración
│   ├── script.js            # lógica del sitio público
│   ├── admin-script.js      # lógica del panel
│   └── styles.css           # estilos compartidos (tema claro/oscuro)
├── package.json
├── vercel.json
├── .env.example
└── README.md
```

## 🔐 Seguridad

- Sin credenciales en el frontend; todo pasa por Vercel Functions
- bcrypt para contraseñas + cookies de sesión firmadas (HttpOnly, SameSite)
- Cambiar la contraseña invalida las sesiones anteriores
- Protección CSRF en escrituras (mismo origen + cabecera `X-Requested-With`)

## 📝 Notas

- Las imágenes se comprimen en el navegador (máx. 1200px, JPEG ~82%) y se guardan en la base como data URLs. Para catálogos grandes, considera Vercel Blob o Cloudinary.
- El sitio público usa caché de CDN corta (`s-maxage=10`): los cambios del panel se ven en segundos.

## 📄 Licencia

MIT
