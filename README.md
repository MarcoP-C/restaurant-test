# Restaurant Test - Sistema de Menú

Sistema completo de menú de restaurante con HTML/CSS/JavaScript vanilla + Vercel Functions + Neon PostgreSQL.

## 📱 Vista Pública

- Ver menú de productos
- Filtrar por categorías
- Ver promociones activas
- Tema claro/oscuro
- Menú hamburguesa responsive
- Modal con detalles de producto

## 🔧 Vista Administrativa

- CRUD completo de productos
- CRUD completo de categorías
- CRUD completo de promociones
- Tipos de descuentos:
  - Porcentaje (%)
  - Fijo ($)
  - "Compra X paga Y" (ej: Compra 2 paga 1)
  - Mínimo de compra
- Sistema de autenticación básico para admin

## 🗄️ Base de Datos (Neon PostgreSQL)

```
categories
├── id
├── name
├── slug
├── description
├── is_active
└── timestamps

products
├── id
├── name
├── slug
├── description
├── price
├── is_available
├── category_id
├── is_promotional
├── promo_code
└── timestamps

promotions
├── id
├── name
├── description
├── discount_type
├── discount_value
├── min_purchase
├── buy_x_get_y
├── is_active
├── start_date
└── end_date

product_images
├── id
├── product_id
├── image_url
├── is_primary
└── timestamps

admins
├── id
├── username
├── password_hash
└── created_at
```

## 🚀 Instrucciones de Instalación

### Paso 1: Instalar dependencias

```bash
cd /Users/marcopc/restaurant-test
npm install
```

### Paso 2: Configurar variables de entorno

Copiar el archivo de ejemplo y configurar las variables:

```bash
cp .env.example .env
```

Editar `.env` y configurar:

```
DATABASE_URL=postgresql://tu-connection-string
ADMIN_PASSWORD=tu-password-seguro
```

**Opcional:** Si usas Vercel Storage, configura:

```
BUCKET_URL=https://storage-api-url.vercel.app
```

### Paso 3: Inicializar base de datos

Crear el admin por defecto y las categorías:

```bash
curl -X POST http://localhost:3000/api/admin/initial-setup
```

Esto creará:
- Usuario admin: `admin`
- Contraseña: `changeme123` (¡Cámbiala en producción!)

### Paso 4: Desplegar en Vercel

1. Crear repo en GitHub (si no existe)

2. En Vercel:
   - Importar repo `restaurant-test`
   - Framework Preset: **Other**
   - Build Command: dejar vacío
   - Output Directory: dejar vacío
   - Root Directory: `./`

3. Configurar variables de entorno en Vercel:
   - **DATABASE_URL**: tu connection string de Neon
   - **ADMIN_PASSWORD**: tu contraseña segura
   - **SESSION_SECRET**: `tu-secret-key-random`

4. Desplegar

### Paso 5: Acceder a la aplicación

**Vista pública:**
- URL de Vercel: `https://tu-proyecto.vercel.app`

**Vista administrativa:**
- URL: `https://tu-proyecto.vercel.app/admin.html`
- Usuario: `admin`
- Contraseña: la configurada en `ADMIN_PASSWORD`

## 🎨 Características

### Tema Claro/Oscuro

El proyecto soporta ambos temas automáticamente:
- Botón de cambio de tema en el header
- Preferencia guardada en localStorage
- Transiciones suaves entre temas

### Responsive

- Menú hamburguesa para móviles
- Grid de productos responsive
- Modales adaptativos
- Tablas con scroll horizontal en móviles

### Descuentos y Promociones

Soporta múltiples tipos de descuentos:
- **Porcentaje**: 20% de descuento
- **Fijo**: $5.00 de descuento
- **Compra X paga Y**: Compra 2 paga 1
- **Mínimo de compra**: Min. $50.00

### Gestión de Imágenes

- Múltiples imágenes por producto
- Imagen principal destacada
- API para subir imágenes (configurable)
- Placeholder si no hay imágenes

## 🔐 Seguridad

- **No hay credenciales en el frontend** - TODO pasa por Vercel Functions
- **Autenticación de admin** - bcrypt con hash
- **Cifrado de sesiones** - Cookie server-side
- **Prevenir exposición** - Variables de entorno en servidor

## 📦 Estructura del Proyecto

```
restaurant-test/
├── api/
│   ├── db.js
│   ├── test-db.js
│   ├── categories.js
│   ├── products.js
│   ├── promotions.js
│   └── admin/
│       ├── login.js
│       ├── logout.js
│       ├── auth-check.js
│       ├── categories.js
│       ├── products.js
│       ├── promotions.js
│       ├── products-images.js
│       └── initial-setup.js
├── public/
│   ├── index.html (vista pública)
│   ├── admin.html (vista admin)
│   ├── script.js
│   ├── admin-script.js
│   └── styles.css
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## 🛠️ Scripts

```bash
# Instalar dependencias
npm install

# Verificar sintaxis (si node está instalado)
node --check api/*.js

# Ejecutar en local con Vercel dev
vercel dev
```

## 🎯 Tipos de Descuento

### 1. Porcentaje
- **Ejemplo**: 20% de descuento
- **Valor**: 20
- **Tipo**: percentage
- **Efecto**: `Precio * (1 - 0.20)`

### 2. Fijo
- **Ejemplo**: $5.00 de descuento
- **Valor**: 5
- **Tipo**: fixed
- **Efecto**: `Precio - 5`

### 3. Compra X paga Y
- **Ejemplo**: Compra 2 paga 1
- **Valor**: 2
- **Tipo**: buy_x_get_y
- **Efecto**: `Compra X, obtienes Y`

### 4. Mínimo de compra
- **Ejemplo**: Min. $50.00
- **Valor**: 50
- **Tipo**: minimum
- **Efecto**: Solo aplica si el subtotal ≥ $50.00

## 📝 Notas Importantes

1. **Cambiar contraseña de admin**: Después de configurar en producción, cambie la contraseña en el panel de administración
2. **Imagen storage**: Para producción, considera usar Vercel Storage o Cloudinary
3. **Caching**: El proyecto actualmente hace fetch directo a la base de datos. Para producción, considera implementar caché
4. **Validación**: Puedes añadir más validaciones en los formularios
5. **SEO**: Puedes añadir meta tags y sitemap

## 🚀 Plan de Mejoras

- [ ] Implementar caché con Redis
- [ ] Integrar con Vercel Storage para imágenes
- [ ] Agregar búsquedas de productos
- [ ] Implementar filtros avanzados
- [ ] Agregar reseñas de usuarios
- [ ] Implementar carrito de compras
- [ ] Agregar calendario de eventos
- [ ] Integrar con pasarela de pagos
- [ ] Analytics y estadísticas
- [ ] Notificaciones push

## 📄 Licencia

MIT

## 👨‍💻 Autor

Claude Code

---

**¡Próximamente: Backend completo con más funcionalidades!**
