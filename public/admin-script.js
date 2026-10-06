// Lógica del panel de administración
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    /* ==================== Constantes y estado ==================== */
    const REQUEST_HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' };
    const MAX_IMAGES = 6;

    const state = {
        categories: [],
        products: [],
        promotions: [],
        users: [],
        settings: {},
        currentView: 'products'
    };

    const VIEW_META = {
        products: { title: 'Productos' },
        categories: { title: 'Categorías' },
        promotions: { title: 'Promociones' },
        users: { title: 'Usuarios' },
        settings: { title: 'Configuración' }
    };

    /* ==================== Referencias ==================== */
    const loginScreen = document.getElementById('loginScreen');
    const loginForm = document.getElementById('loginForm');
    const loginBtn = document.getElementById('loginBtn');
    const adminShell = document.getElementById('adminShell');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const menuToggle = document.getElementById('menuToggle');
    const themeToggle = document.getElementById('themeToggle');
    const topbarTitle = document.getElementById('topbarTitle');
    const logoutBtn = document.getElementById('logoutBtn');

    const productsTableBody = document.getElementById('productsTableBody');
    const categoriesTableBody = document.getElementById('categoriesTableBody');
    const promotionsTableBody = document.getElementById('promotionsTableBody');
    const usersTableBody = document.getElementById('usersTableBody');

    const addProductBtn = document.getElementById('addProductBtn');
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const addPromotionBtn = document.getElementById('addPromotionBtn');

    const socialForm = document.getElementById('socialForm');
    const passwordForm = document.getElementById('passwordForm');
    const testDbBtn = document.getElementById('testDbBtn');

    const wizardOverlay = document.getElementById('wizardOverlay');
    const wizardTitle = document.getElementById('wizardTitle');
    const wizardSubtitle = document.getElementById('wizardSubtitle');
    const wizardStepsEl = document.getElementById('wizardSteps');
    const wizardBody = document.getElementById('wizardBody');
    const wizardFooter = document.getElementById('wizardFooter');
    const wizardCloseBtn = document.getElementById('wizardClose');

    const confirmOverlay = document.getElementById('confirmOverlay');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmMessage = document.getElementById('confirmMessage');
    const confirmOkBtn = document.getElementById('confirmOk');
    const confirmCancelBtn = document.getElementById('confirmCancel');

    /* ==================== Utilidades ==================== */
    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function money(value) {
        return '$' + (Number(value) || 0).toFixed(2);
    }

    function formatDate(value, withYear = true) {
        if (!value) return '—';
        const date = new Date(String(value).includes('T') ? value : value + 'T12:00:00');
        if (isNaN(date.getTime())) return '—';
        return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: withYear ? 'numeric' : undefined });
    }

    function todayISO() {
        return new Date().toISOString().split('T')[0];
    }

    function showToast(message, type = 'info') {
        let root = document.querySelector('.toast-root');
        if (!root) {
            root = document.createElement('div');
            root.className = 'toast-root';
            document.body.appendChild(root);
        }
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : '💬';
        toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
        root.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => toast.remove(), 300);
        }, 3400);
    }

    async function fetchJson(url, options = {}) {
        const response = await fetch(url, options);
        const data = await response.json().catch(() => ({ success: false, message: 'Respuesta inválida del servidor' }));
        return { ok: response.ok, status: response.status, data };
    }

    /* ==================== Confirmación ==================== */
    let confirmResolver = null;

    function showConfirm({ title = '¿Confirmar acción?', message = '' } = {}) {
        return new Promise((resolve) => {
            confirmTitle.textContent = title;
            confirmMessage.textContent = message;
            confirmOverlay.classList.add('active');
            confirmResolver = resolve;
        });
    }

    function settleConfirm(result) {
        confirmOverlay.classList.remove('active');
        if (confirmResolver) {
            confirmResolver(result);
            confirmResolver = null;
        }
    }

    confirmOkBtn.addEventListener('click', () => settleConfirm(true));
    confirmCancelBtn.addEventListener('click', () => settleConfirm(false));
    confirmOverlay.addEventListener('click', (e) => {
        if (e.target === confirmOverlay) settleConfirm(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && confirmOverlay.classList.contains('active')) settleConfirm(false);
    });

    /* ==================== Tema claro/oscuro ==================== */
    const SUN_ICON = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>';
    const MOON_ICON = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>';

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (themeToggle) themeToggle.innerHTML = theme === 'dark' ? SUN_ICON : MOON_ICON;
    }

    applyTheme(localStorage.getItem('theme') || 'light');

    themeToggle.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        applyTheme(current === 'light' ? 'dark' : 'light');
    });

    /* ==================== Autenticación ==================== */
    async function checkAuth() {
        try {
            const { data } = await fetchJson('/api/admin-auth?action=check');
            return Boolean(data.authenticated);
        } catch (error) {
            console.error('Error checking auth:', error);
            return false;
        }
    }

    function showLogin() {
        loginScreen.classList.add('active');
        adminShell.classList.remove('active');
    }

    function showShell() {
        loginScreen.classList.remove('active');
        adminShell.classList.add('active');
        initAdmin();
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUser').value.trim();
        const password = document.getElementById('loginPass').value;
        if (!username || !password) return;

        loginBtn.disabled = true;
        loginBtn.textContent = 'Iniciando sesión…';

        try {
            const { ok, data } = await fetchJson('/api/admin-auth?action=login', {
                method: 'POST',
                headers: REQUEST_HEADERS,
                body: JSON.stringify({ username, password })
            });
            if (ok && data.success) {
                showToast(data.message || 'Login exitoso', 'success');
                setTimeout(showShell, 500);
            } else {
                showToast(data.message || 'Usuario o contraseña incorrectos', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showToast('Error al iniciar sesión', 'error');
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Iniciar sesión';
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/admin-auth?action=logout', { method: 'POST', headers: REQUEST_HEADERS });
        } catch (error) {
            console.error('Logout error:', error);
        }
        window.location.reload();
    });

    /* ==================== Navegación por vistas ==================== */
    function switchView(viewName) {
        if (!VIEW_META[viewName]) return;
        state.currentView = viewName;

        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        const target = document.getElementById(`view-${viewName}`);
        if (target) target.classList.add('active');

        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        topbarTitle.textContent = VIEW_META[viewName].title;
        closeMobileSidebar();
        window.scrollTo({ top: 0 });
    }

    function initNav() {
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
            item.addEventListener('click', () => switchView(item.dataset.view));
        });
    }

    /* ==================== Sidebar móvil ==================== */
    function closeMobileSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    }

    function initSidebarMobile() {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.add('open');
            sidebarOverlay.classList.add('active');
        });
        sidebarOverlay.addEventListener('click', closeMobileSidebar);
    }

    /* ==================== Carga de datos ==================== */
    async function loadAll() {
        await Promise.all([loadCategories(), loadProducts(), loadPromotions(), loadUsers(), loadSettings()]);
    }

    async function loadCategories() {
        try {
            const { ok, data } = await fetchJson('/api/admin-resources?type=categories');
            if (ok && data.success) {
                state.categories = data.categories || [];
                renderCategoriesTable();
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    async function loadProducts() {
        try {
            const { ok, data } = await fetchJson('/api/admin-resources?type=products');
            if (ok && data.success) {
                state.products = data.products || [];
                renderProductsTable();
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    async function loadPromotions() {
        try {
            const { ok, data } = await fetchJson('/api/admin-resources?type=promotions');
            if (ok && data.success) {
                state.promotions = data.promotions || [];
                renderPromotionsTable();
            }
        } catch (error) {
            console.error('Error loading promotions:', error);
        }
    }

    async function loadUsers() {
        try {
            const { ok, data } = await fetchJson('/api/admin-resources?type=users');
            if (ok && data.success) {
                state.users = data.users || [];
                renderUsersTable();
            }
        } catch (error) {
            console.error('Error loading users:', error);
        }
    }

    async function loadSettings() {
        try {
            const { ok, data } = await fetchJson('/api/admin-resources?type=settings');
            if (ok && data.success) {
                state.settings = data.settings || {};
                fillSettingsForm();
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    /* ==================== Render de tablas ==================== */
    function emptyRow(colspan, icon, text) {
        return `<tr><td colspan="${colspan}"><div class="empty-state"><div class="empty-icon">${icon}</div><p>${text}</p></div></td></tr>`;
    }

    function getPromoPricing(product) {
        const price = Number(product.price) || 0;
        const promoActive = Boolean(
            product.is_promotional &&
            product.promo_price !== null &&
            product.promo_price !== undefined &&
            Number(product.promo_price) > 0 &&
            Number(product.promo_price) < price
        );
        return { price, promoActive, current: promoActive ? Number(product.promo_price) : price };
    }

    function renderProductsTable() {
        if (state.products.length === 0) {
            productsTableBody.innerHTML = emptyRow(6, '🍽️', 'No hay productos todavía. Agrega el primero con el asistente.');
            return;
        }

        productsTableBody.innerHTML = state.products.map(product => {
            const pricing = getPromoPricing(product);
            const firstImage = (product.images || [])[0];
            const thumb = firstImage
                ? `<img class="cell-thumb" src="${escapeHtml(firstImage)}" alt="">`
                : `<span class="cell-thumb placeholder">🍔</span>`;
            const priceCell = pricing.promoActive
                ? `<span class="cell-strong">${money(pricing.current)}</span> <span class="price-original" style="font-size:0.78rem">${money(pricing.price)}</span>`
                : `<span class="cell-strong">${money(pricing.price)}</span>`;
            return `
                <tr>
                    <td>
                        <div class="cell-product">
                            ${thumb}
                            <div>
                                <div class="cell-strong">${escapeHtml(product.name)}</div>
                                <div class="cell-muted">#${product.id}</div>
                            </div>
                        </div>
                    </td>
                    <td>${escapeHtml(product.category_name || 'Sin categoría')}</td>
                    <td>${priceCell}</td>
                    <td><span class="pill ${product.is_available ? 'pill-ok' : 'pill-off'}">${product.is_available ? 'Disponible' : 'Agotado'}</span></td>
                    <td>${pricing.promoActive ? '<span class="pill pill-promo">🔥 En oferta</span>' : '<span class="pill pill-off">Sin promo</span>'}</td>
                    <td>
                        <div class="row-actions">
                            <button class="btn-icon" data-action="edit" data-id="${product.id}" title="Editar" aria-label="Editar">✏️</button>
                            <button class="btn-icon danger" data-action="delete" data-id="${product.id}" title="Eliminar" aria-label="Eliminar">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        bindRowActions(productsTableBody, 'products');
    }

    function renderCategoriesTable() {
        if (state.categories.length === 0) {
            categoriesTableBody.innerHTML = emptyRow(4, '📂', 'No hay categorías todavía. Crea una para organizar tu menú.');
            return;
        }

        categoriesTableBody.innerHTML = state.categories.map(category => `
            <tr>
                <td>
                    <div class="cell-strong">${escapeHtml(category.name)}</div>
                    <div class="cell-muted">#${category.id}</div>
                </td>
                <td class="cell-muted">${category.description ? escapeHtml(category.description) : '—'}</td>
                <td><span class="pill ${category.is_active ? 'pill-ok' : 'pill-off'}">${category.is_active ? 'Activa' : 'Inactiva'}</span></td>
                <td>
                    <div class="row-actions">
                        <button class="btn-icon" data-action="edit" data-id="${category.id}" title="Editar" aria-label="Editar">✏️</button>
                        <button class="btn-icon danger" data-action="delete" data-id="${category.id}" title="Eliminar" aria-label="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');

        bindRowActions(categoriesTableBody, 'categories');
    }

    function getDiscountDetail(promo) {
        switch (promo.discount_type) {
            case 'percentage':
                return `${Number(promo.discount_value).toFixed(0)}% de descuento`;
            case 'fixed':
                return `${money(promo.discount_value)} de descuento`;
            case 'buy_x_get_y':
                return `Compra ${promo.buy_x_get_y || 0} y paga ${promo.pay_y || 0}`;
            case 'minimum':
                return `Válido en compras desde ${money(promo.min_purchase)}`;
            default:
                return '—';
        }
    }

    function getDiscountTypeLabel(type) {
        const labels = {
            percentage: 'Porcentaje',
            fixed: 'Monto fijo',
            buy_x_get_y: 'Compra X paga Y',
            minimum: 'Mínimo de compra'
        };
        return labels[type] || type;
    }

    function renderPromotionsTable() {
        if (state.promotions.length === 0) {
            promotionsTableBody.innerHTML = emptyRow(6, 'No hay promociones todavía. Crea una para atraer más clientes.');
            return;
        }

        promotionsTableBody.innerHTML = state.promotions.map(promo => `
            <tr>
                <td>
                    <div class="cell-strong">${escapeHtml(promo.name)}</div>
                    <div class="cell-muted">${(promo.description || '').slice(0, 70) || 'Sin descripción'}</div>
                </td>
                <td><span class="pill pill-type">${getDiscountTypeLabel(promo.discount_type)}</span></td>
                <td>${escapeHtml(getDiscountDetail(promo))}</td>
                <td class="cell-muted">${formatDate(promo.start_date, false)} — ${formatDate(promo.end_date)}</td>
                <td><span class="pill ${promo.is_active ? 'pill-ok' : 'pill-off'}">${promo.is_active ? 'Activa' : 'Inactiva'}</span></td>
                <td>
                    <div class="row-actions">
                        <button class="btn-icon" data-action="edit" data-id="${promo.id}" title="Editar" aria-label="Editar">✏️</button>
                        <button class="btn-icon danger" data-action="delete" data-id="${promo.id}" title="Eliminar" aria-label="Eliminar">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');

        bindRowActions(promotionsTableBody, 'promotions');
    }

    function renderUsersTable() {
        if (state.users.length === 0) {
            usersTableBody.innerHTML = emptyRow(3, '👤', 'No hay usuarios registrados.');
            return;
        }

        usersTableBody.innerHTML = state.users.map(user => `
            <tr>
                <td class="cell-muted">#${user.id}</td>
                <td class="cell-strong">${escapeHtml(user.username)}</td>
                <td class="cell-muted">${formatDate(user.created_at)}</td>
            </tr>
        `).join('');
    }

    function findRecord(entity, id) {
        const key = entity === 'promotions' ? 'promotions' : entity;
        return (state[key] || []).find(item => Number(item.id) === Number(id)) || null;
    }

    function bindRowActions(tbody, entity) {
        tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
            btn.addEventListener('click', () => openWizard(entity, findRecord(entity, Number(btn.dataset.id))));
        });
        tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
            btn.addEventListener('click', () => deleteRecord(entity, Number(btn.dataset.id)));
        });
    }

    async function deleteRecord(entity, id) {
        const record = findRecord(entity, id);
        const name = record ? (record.name || `#${id}`) : `#${id}`;
        const confirmed = await showConfirm({
            title: `¿Eliminar ${name}?`,
            message: entity === 'categories'
                ? 'Los productos de esta categoría quedarán sin categoría. Esta acción no se puede deshacer.'
                : 'Esta acción no se puede deshacer.'
        });
        if (!confirmed) return;

        try {
            const { ok, data } = await fetchJson(`/api/admin-resources?type=${entity}&id=${id}`, {
                method: 'DELETE',
                headers: REQUEST_HEADERS
            });
            if (ok && data.success) {
                showToast(data.message || 'Eliminado', 'success');
                if (entity === 'categories') {
                    await Promise.all([loadCategories(), loadProducts()]);
                } else {
                    await { products: loadProducts, categories: loadCategories, promotions: loadPromotions }[entity]();
                }
            } else {
                showToast(data.message || 'No se pudo eliminar', 'error');
            }
        } catch (error) {
            console.error('Error deleting:', error);
            showToast('Error al eliminar', 'error');
        }
    }

    /* ==================== Configuración (redes, contraseña, test) ==================== */
    function fillSettingsForm() {
        document.querySelectorAll('[data-setting]').forEach(input => {
            input.value = state.settings[input.dataset.setting] || '';
        });
    }

    socialForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const settings = {};
        document.querySelectorAll('[data-setting]').forEach(input => {
            settings[input.dataset.setting] = input.value.trim();
        });

        try {
            const { ok, data } = await fetchJson('/api/admin-resources?type=settings', {
                method: 'POST',
                headers: REQUEST_HEADERS,
                body: JSON.stringify({ settings })
            });
            if (ok && data.success) {
                state.settings = data.settings || settings;
                showToast(data.message || 'Configuración guardada', 'success');
            } else {
                showToast(data.message || 'No se pudo guardar', 'error');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            showToast('Error al guardar la configuración', 'error');
        }
    });

    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const current = document.getElementById('currentPassword').value;
        const next = document.getElementById('newPassword').value;
        if (!current || !next) return;

        try {
            const { ok, data } = await fetchJson('/api/admin-auth?action=password', {
                method: 'POST',
                headers: REQUEST_HEADERS,
                body: JSON.stringify({ current_password: current, new_password: next })
            });
            if (ok && data.success) {
                showToast(data.message || 'Contraseña actualizada', 'success');
                passwordForm.reset();
            } else {
                showToast(data.message || 'No se pudo actualizar la contraseña', 'error');
            }
        } catch (error) {
            console.error('Error changing password:', error);
            showToast('Error al cambiar la contraseña', 'error');
        }
    });

    testDbBtn.addEventListener('click', async () => {
        testDbBtn.disabled = true;
        testDbBtn.textContent = 'Probando…';
        try {
            const { ok, data } = await fetchJson('/api/test-db');
            if (ok && data.success) {
                showToast(data.message || 'Conexión correcta', 'success');
            } else {
                showToast(data.message || 'Sin conexión', 'error');
            }
        } catch (error) {
            console.error('Error testing db:', error);
            showToast('Error al probar la conexión', 'error');
        } finally {
            testDbBtn.disabled = false;
            testDbBtn.textContent = 'Probar conexión';
        }
    });

    /* ==================== Compresión de imágenes ==================== */
    function compressImageFile(file, maxDim = 1200, quality = 0.82) {
        return new Promise((resolve, reject) => {
            if (!/^image\//.test(file.type)) {
                reject(new Error('Solo se permiten archivos de imagen'));
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
                        const canvas = document.createElement('canvas');
                        canvas.width = Math.max(1, Math.round(img.width * scale));
                        canvas.height = Math.max(1, Math.round(img.height * scale));
                        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                        resolve(canvas.toDataURL('image/jpeg', quality));
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = () => reject(new Error('No se pudo leer la imagen'));
                img.src = reader.result;
            };
            reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
            reader.readAsDataURL(file);
        });
    }

    /* ==================== Asistente (wizard) ==================== */
    const wizardState = {
        entity: null,
        editingId: null,
        stepIndex: 0,
        data: {}
    };

    /* ---------- Componentes reutilizables de formulario ---------- */
    function switchRow(name, label, desc, checked) {
        return `
            <div class="switch-row">
                <div class="switch-info">
                    <span class="switch-label">${label}</span>
                    <span class="switch-desc">${desc}</span>
                </div>
                <label class="switch">
                    <input type="checkbox" name="${name}" ${checked ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
        `;
    }

    function fieldText(name, label, value, placeholder = '', type = 'text', hint = '') {
        return `
            <div class="form-group">
                <label for="wiz-${name}">${label}</label>
                <input type="${type}" id="wiz-${name}" name="${name}" value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(placeholder)}">
                ${hint ? `<p class="field-hint">${hint}</p>` : ''}
                <p class="field-error" data-error-for="${name}"></p>
            </div>
        `;
    }

    function fieldTextarea(name, label, value, placeholder = '') {
        return `
            <div class="form-group">
                <label for="wiz-${name}">${label}</label>
                <textarea id="wiz-${name}" name="${name}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value ?? '')}</textarea>
                <p class="field-error" data-error-for="${name}"></p>
            </div>
        `;
    }

    function fieldNumber(name, label, value, placeholder = '', hint = '', step = '0.01') {
        return `
            <div class="form-group">
                <label for="wiz-${name}">${label}</label>
                <input type="number" step="${step}" id="wiz-${name}" name="${name}" value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(placeholder)}">
                ${hint ? `<p class="field-hint">${hint}</p>` : ''}
                <p class="field-error" data-error-for="${name}"></p>
            </div>
        `;
    }

    function fieldSelect(name, label, options, selected) {
        return `
            <div class="form-group">
                <label for="wiz-${name}">${label}</label>
                <select id="wiz-${name}" name="${name}">
                    ${options.map(opt => `<option value="${escapeHtml(opt.value)}" ${String(opt.value) === String(selected ?? '') ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}
                </select>
                <p class="field-error" data-error-for="${name}"></p>
            </div>
        `;
    }

    function fieldDate(name, label, value, hint = '') {
        return `
            <div class="form-group">
                <label for="wiz-${name}">${label}</label>
                <input type="date" id="wiz-${name}" name="${name}" value="${escapeHtml(value ?? '')}">
                ${hint ? `<p class="field-hint">${hint}</p>` : ''}
                <p class="field-error" data-error-for="${name}"></p>
            </div>
        `;
    }

    function categoryOptions() {
        const options = [{ value: '', label: 'Sin categoría' }];
        state.categories.forEach(cat => options.push({ value: cat.id, label: cat.name }));
        return options;
    }

    function reviewItem(label, value) {
        return `<div class="review-item"><div class="review-label">${label}</div><div class="review-value">${value}</div></div>`;
    }

    /* ---------- Definición de asistentes ---------- */
    const WIZARDS = {
        products: {
            newTitle: 'Nuevo producto',
            editTitle: 'Editar producto',
            newSub: 'Crea un platillo para el menú en 4 pasos',
            steps: [
                /* Paso 1: información */
                {
                    label: 'Información',
                    render: (d) => `
                        ${fieldText('name', 'Nombre del producto', d.name, 'Ej. Hamburguesa clásica')}
                        ${fieldTextarea('description', 'Descripción', d.description, 'Ingredientes, presentación, detalles…')}
                        ${fieldNumber('price', 'Precio original ($)', d.price, '0.00', 'Precio de lista antes de promociones')}
                        ${fieldSelect('category_id', 'Categoría', categoryOptions(), d.category_id)}
                        ${switchRow('is_available', 'Disponible', 'Se muestra en el menú público', d.is_available !== false)}
                    `,
                    validate: (d) => {
                        const invalid = [];
                        if (!String(d.name || '').trim()) invalid.push('name');
                        const price = Number(d.price);
                        if (!d.price || isNaN(price) || price <= 0) invalid.push('price');
                        if (invalid.length) {
                            return { error: 'Revisa el nombre y un precio mayor a 0', invalid };
                        }
                        return null;
                    }
                },
                /* Paso 2: promoción */
                {
                    label: 'Promoción',
                    render: (d) => `
                        ${switchRow('is_promotional', 'Producto en promoción', 'Actívalo para mostrar precio de oferta', Boolean(d.is_promotional))}
                        ${d.is_promotional
                            ? fieldNumber('promo_price', 'Precio promocional ($)', d.promo_price, '0.00', `Debe ser menor al precio original (${money(d.price)})`, '0.01')
                            : ''}
                        <p class="field-hint" style="margin-top:0.4rem">💡 El precio promocional se muestra como precio principal en la carta, con el original tachado.</p>
                    `,
                    bind: () => {
                        const toggle = wizardBody.querySelector('[name="is_promotional"]');
                        if (toggle) {
                            toggle.addEventListener('change', () => {
                                collectStep();
                                renderWizardBody();
                            });
                        }
                    },
                    validate: (d) => {
                        if (!d.is_promotional) return null;
                        const invalid = [];
                        const price = Number(d.price);
                        const promo = Number(d.promo_price);
                        if (!d.promo_price || isNaN(promo) || promo <= 0) invalid.push('promo_price');
                        else if (promo >= price) invalid.push('promo_price');
                        if (invalid.length) {
                            return {
                                error: isNaN(promo) || promo <= 0
                                    ? 'El precio promocional es obligatorio y debe ser mayor a 0'
                                    : 'El precio promocional debe ser menor al precio original',
                                invalid
                            };
                        }
                        return null;
                    }
                },
                /* Paso 3: imágenes */
                {
                    label: 'Imágenes',
                    render: (d) => {
                        const images = d.images || [];
                        return `
                            <p class="field-hint" style="margin-bottom:1rem">📷 Selecciona una o más imágenes (máx. ${MAX_IMAGES}). Se comprimen automáticamente y la primera será la principal. En la carta se muestran en carrusel.</p>
                            <div class="image-grid">
                                ${images.map((img, i) => `
                                    <div class="image-thumb">
                                        <img src="${escapeHtml(img)}" alt="Imagen ${i + 1}">
                                        ${i === 0 ? '<span class="thumb-badge">Principal</span>' : ''}
                                        <button type="button" class="thumb-remove" data-remove-image="${i}" aria-label="Quitar imagen ${i + 1}">✕</button>
                                    </div>
                                `).join('')}
                                ${images.length < MAX_IMAGES ? `
                                    <button type="button" class="image-add" id="wizImgPick">
                                        <span class="plus">＋</span>
                                        <span>Agregar</span>
                                    </button>
                                ` : ''}
                            </div>
                            <input type="file" id="wizImgInput" accept="image/*" multiple hidden>
                            ${images.length < MAX_IMAGES ? `
                                <div class="image-url-row">
                                    <input type="url" id="wizImgUrl" placeholder="…o pega una URL de imagen (https://…)">
                                    <button type="button" class="btn btn-secondary btn-sm" id="wizImgUrlAdd">Añadir URL</button>
                                </div>
                            ` : ''}
                        `;
                    },
                    bind: () => {
                        const input = wizardBody.querySelector('#wizImgInput');
                        const pick = wizardBody.querySelector('#wizImgPick');
                        const urlInput = wizardBody.querySelector('#wizImgUrl');
                        const urlAdd = wizardBody.querySelector('#wizImgUrlAdd');

                        if (pick && input) {
                            pick.addEventListener('click', () => input.click());
                        }

                        if (input) {
                            input.addEventListener('change', async () => {
                                const files = Array.from(input.files || []);
                                input.value = '';
                                if (files.length === 0) return;
                                let added = 0;
                                for (const file of files) {
                                    if ((wizardState.data.images || []).length >= MAX_IMAGES) {
                                        showToast(`Máximo ${MAX_IMAGES} imágenes por producto`, 'error');
                                        break;
                                    }
                                    try {
                                        const dataUrl = await compressImageFile(file);
                                        wizardState.data.images.push(dataUrl);
                                        added++;
                                    } catch (err) {
                                        showToast(err.message || 'No se pudo procesar una imagen', 'error');
                                    }
                                }
                                if (added > 0) {
                                    showToast(`${added} imagen${added > 1 ? 'es' : ''} agregada${added > 1 ? 's' : ''}`, 'success');
                                    renderWizardBody();
                                }
                            });
                        }

                        if (urlAdd && urlInput) {
                            urlAdd.addEventListener('click', () => {
                                const url = urlInput.value.trim();
                                if (!url) return;
                                if (!/^(https?:\/\/|data:image\/)/i.test(url)) {
                                    showToast('La URL debe iniciar con http(s):// o ser una imagen', 'error');
                                    return;
                                }
                                if ((wizardState.data.images || []).length >= MAX_IMAGES) {
                                    showToast(`Máximo ${MAX_IMAGES} imágenes por producto`, 'error');
                                    return;
                                }
                                wizardState.data.images.push(url);
                                showToast('Imagen agregada', 'success');
                                renderWizardBody();
                            });
                        }

                        wizardBody.querySelectorAll('[data-remove-image]').forEach(btn => {
                            btn.addEventListener('click', () => {
                                wizardState.data.images.splice(Number(btn.dataset.removeImage), 1);
                                renderWizardBody();
                            });
                        });
                    }
                },
                /* Paso 4: confirmación */
                {
                    label: 'Confirmar',
                    render: (d) => {
                        const images = d.images || [];
                        const category = state.categories.find(c => String(c.id) === String(d.category_id));
                        return `
                            <div class="review-grid">
                                ${reviewItem('Nombre', escapeHtml(d.name || '—'))}
                                ${reviewItem('Categoría', escapeHtml(category ? category.name : 'Sin categoría'))}
                                ${reviewItem('Precio original', money(d.price))}
                                ${reviewItem('Promoción', d.is_promotional
                                    ? `Sí — ${money(d.promo_price)} <span class="price-original" style="font-size:0.8rem">${money(d.price)}</span>`
                                    : 'Sin promoción')}
                                ${reviewItem('Disponible', d.is_available !== false ? 'Sí' : 'No')}
                            </div>
                            <p class="field-hint" style="margin:1rem 0 0.6rem">Descripción</p>
                            <p class="cell-muted">${escapeHtml(d.description || 'Sin descripción')}</p>
                            <p class="field-hint" style="margin:1.2rem 0 0.6rem">Imágenes (${images.length})</p>
                            <div class="review-images">
                                ${images.length > 0
                                    ? images.map((img, i) => `<img src="${escapeHtml(img)}" alt="Imagen ${i + 1}">`).join('')
                                    : '<span class="cell-muted">Sin imágenes (se mostrará un ícono)</span>'}
                            </div>
                        `;
                    }
                }
            ],
            defaults: () => ({
                name: '', description: '', price: '', category_id: '',
                is_available: true, is_promotional: false, promo_price: '', images: []
            }),
            fromRecord: (p) => ({
                name: p.name || '',
                description: p.description || '',
                price: p.price ?? '',
                category_id: p.category_id ?? '',
                is_available: p.is_available !== false,
                is_promotional: Boolean(p.is_promotional),
                promo_price: p.promo_price ?? '',
                images: (p.images || []).slice(0, MAX_IMAGES)
            }),
            payload: (d) => ({
                name: String(d.name || '').trim(),
                description: String(d.description || '').trim() || null,
                price: Number(d.price),
                category_id: d.category_id ? Number(d.category_id) : null,
                is_available: d.is_available !== false,
                is_promotional: Boolean(d.is_promotional),
                promo_price: d.is_promotional ? Number(d.promo_price) : null,
                images: d.images || []
            }),
            reload: loadProducts
        },

        categories: {
            newTitle: 'Nueva categoría',
            editTitle: 'Editar categoría',
            newSub: 'Organiza tu menú en dos pasos',
            steps: [
                {
                    label: 'Información',
                    render: (d) => `
                        ${fieldText('name', 'Nombre de la categoría', d.name, 'Ej. Postres')}
                        ${fieldTextarea('description', 'Descripción', d.description, '¿Qué tipo de platillos incluye?')}
                        ${switchRow('is_active', 'Categoría activa', 'Visible en el sitio público', d.is_active !== false)}
                    `,
                    validate: (d) => {
                        if (!String(d.name || '').trim()) {
                            return { error: 'El nombre es obligatorio', invalid: ['name'] };
                        }
                        return null;
                    }
                },
                {
                    label: 'Confirmar',
                    render: (d) => `
                        <div class="review-grid">
                            ${reviewItem('Nombre', escapeHtml(d.name || '—'))}
                            ${reviewItem('Estado', d.is_active !== false ? '<span class="pill pill-ok">Activa</span>' : '<span class="pill pill-off">Inactiva</span>')}
                        </div>
                        <p class="field-hint" style="margin:1rem 0 0.6rem">Descripción</p>
                        <p class="cell-muted">${escapeHtml(d.description || 'Sin descripción')}</p>
                    `
                }
            ],
            defaults: () => ({ name: '', description: '', is_active: true }),
            fromRecord: (c) => ({
                name: c.name || '',
                description: c.description || '',
                is_active: c.is_active !== false
            }),
            payload: (d) => ({
                name: String(d.name || '').trim(),
                description: String(d.description || '').trim() || null,
                is_active: d.is_active !== false
            }),
            reload: loadCategories
        },

        promotions: {
            newTitle: 'Nueva promoción',
            editTitle: 'Editar promoción',
            newSub: 'Configura el descuento y su vigencia en tres pasos',
            steps: [
                /* Paso 1: tipo y monto */
                {
                    label: 'Descuento',
                    render: (d) => {
                        const type = d.discount_type || 'percentage';
                        const valueField = type === 'percentage'
                            ? fieldNumber('discount_value', 'Porcentaje de descuento', d.discount_value, 'Ej. 20', 'Ej. 20% de descuento sobre el precio', '0.01')
                            : type === 'fixed'
                                ? fieldNumber('discount_value', 'Monto de descuento ($)', d.discount_value, 'Ej. 15', 'Se resta al precio del producto', '0.01')
                                : type === 'minimum'
                                    ? fieldNumber('min_purchase', 'Compra mínima ($)', d.min_purchase, 'Ej. 100', 'La promoción aplica en compras desde este monto', '0.01')
                                    : `
                                        <div class="form-row">
                                            ${fieldNumber('buy_x_get_y', 'Compra (X)', d.buy_x_get_y || '2', 'Ej. 2', 'Cantidad que el cliente compra', '1')}
                                            ${fieldNumber('pay_y', 'Paga (Y)', d.pay_y || '1', 'Ej. 1', 'Cantidad que el cliente paga', '1')}
                                        </div>
                                    `;
                        return `
                            ${fieldText('name', 'Nombre de la promoción', d.name, 'Ej. 2x1 en hamburguesas')}
                            ${fieldTextarea('description', 'Descripción', d.description, 'Condiciones, detalles…')}
                            ${fieldSelect('discount_type', 'Tipo de descuento', [
                                { value: 'percentage', label: 'Porcentaje (%)' },
                                { value: 'fixed', label: 'Monto fijo ($)' },
                                { value: 'buy_x_get_y', label: 'Compra X paga Y (ej. 2x1)' },
                                { value: 'minimum', label: 'Mínimo de compra' }
                            ], type)}
                            ${valueField}
                        `;
                    },
                    bind: () => {
                        const select = wizardBody.querySelector('[name="discount_type"]');
                        if (select) {
                            select.addEventListener('change', () => {
                                collectStep();
                                renderWizardBody();
                            });
                        }
                    },
                    validate: (d) => {
                        const invalid = [];
                        if (!String(d.name || '').trim()) invalid.push('name');
                        const type = d.discount_type || 'percentage';

                        if (type === 'percentage' || type === 'fixed') {
                            const value = Number(d.discount_value);
                            if (!d.discount_value || isNaN(value) || value <= 0) invalid.push('discount_value');
                            else if (type === 'percentage' && value > 100) invalid.push('discount_value');
                        } else if (type === 'minimum') {
                            const min = Number(d.min_purchase);
                            if (!d.min_purchase || isNaN(min) || min <= 0) invalid.push('min_purchase');
                        } else if (type === 'buy_x_get_y') {
                            const buy = Number(d.buy_x_get_y);
                            const pay = Number(d.pay_y);
                            if (!d.buy_x_get_y || isNaN(buy) || buy < 2) invalid.push('buy_x_get_y');
                            else if (!d.pay_y || isNaN(pay) || pay < 1 || pay >= buy) invalid.push('pay_y');
                        }

                        if (invalid.length) {
                            return { error: 'Revisa los campos del descuento', invalid };
                        }
                        return null;
                    }
                },
                /* Paso 2: vigencia */
                {
                    label: 'Vigencia',
                    render: (d) => `
                        <div class="form-row">
                            ${fieldDate('start_date', 'Fecha de inicio', d.start_date, 'Si la dejas vacía inicia hoy')}
                            ${fieldDate('end_date', 'Fecha de fin', d.end_date, 'Obligatoria')}
                        </div>
                        ${switchRow('is_active', 'Promoción activa', 'Visible en el sitio público mientras esté vigente', d.is_active !== false)}
                    `,
                    validate: (d) => {
                        const invalid = [];
                        if (!d.end_date) invalid.push('end_date');
                        else if (d.start_date && d.end_date < d.start_date) invalid.push('end_date');
                        if (invalid.length) {
                            return {
                                error: d.end_date && d.start_date && d.end_date < d.start_date
                                    ? 'La fecha de fin no puede ser anterior a la de inicio'
                                    : 'La fecha de fin es obligatoria',
                                invalid
                            };
                        }
                        return null;
                    }
                },
                /* Paso 3: confirmación */
                {
                    label: 'Confirmar',
                    render: (d) => {
                        const type = d.discount_type || 'percentage';
                        let detail = '—';
                        if (type === 'percentage') detail = `${Number(d.discount_value).toFixed(0)}% de descuento`;
                        else if (type === 'fixed') detail = `${money(d.discount_value)} de descuento`;
                        else if (type === 'minimum') detail = `Desde ${money(d.min_purchase)} de compra`;
                        else if (type === 'buy_x_get_y') detail = `Compra ${d.buy_x_get_y} y paga ${d.pay_y}`;
                        return `
                            <div class="review-grid">
                                ${reviewItem('Nombre', escapeHtml(d.name || '—'))}
                                ${reviewItem('Tipo', getDiscountTypeLabel(type))}
                                ${reviewItem('Detalle', escapeHtml(detail))}
                                ${reviewItem('Inicio', d.start_date ? formatDate(d.start_date) : 'Hoy')}
                                ${reviewItem('Fin', formatDate(d.end_date))}
                                ${reviewItem('Estado', d.is_active !== false ? '<span class="pill pill-ok">Activa</span>' : '<span class="pill pill-off">Inactiva</span>')}
                            </div>
                            <p class="field-hint" style="margin:1rem 0 0.6rem">Descripción</p>
                            <p class="cell-muted">${escapeHtml(d.description || 'Sin descripción')}</p>
                        `;
                    }
                }
            ],
            defaults: () => ({
                name: '', description: '', discount_type: 'percentage',
                discount_value: '', min_purchase: '', buy_x_get_y: '2', pay_y: '1',
                start_date: todayISO(), end_date: '', is_active: true
            }),
            fromRecord: (p) => ({
                name: p.name || '',
                description: p.description || '',
                discount_type: p.discount_type || 'percentage',
                discount_value: p.discount_value ?? '',
                min_purchase: p.min_purchase ?? '',
                buy_x_get_y: p.buy_x_get_y || '2',
                pay_y: p.pay_y || '1',
                start_date: p.start_date || todayISO(),
                end_date: p.end_date || '',
                is_active: p.is_active !== false
            }),
            payload: (d) => {
                const type = d.discount_type || 'percentage';
                return {
                    name: String(d.name || '').trim(),
                    description: String(d.description || '').trim() || null,
                    discount_type: type,
                    discount_value: (type === 'percentage' || type === 'fixed') ? Number(d.discount_value) : 0,
                    min_purchase: type === 'minimum' ? Number(d.min_purchase) : 0,
                    buy_x_get_y: type === 'buy_x_get_y' ? Number(d.buy_x_get_y) : 0,
                    pay_y: type === 'buy_x_get_y' ? Number(d.pay_y) : 0,
                    start_date: d.start_date || '',
                    end_date: d.end_date,
                    is_active: d.is_active !== false
                };
            },
            reload: loadPromotions
        }
    };

    /* ---------- Motor del asistente ---------- */
    function openWizard(entity, record = null) {
        const wizard = WIZARDS[entity];
        if (!wizard) return;

        wizardState.entity = entity;
        wizardState.editingId = record ? Number(record.id) : null;
        wizardState.stepIndex = 0;
        wizardState.data = record ? wizard.fromRecord(record) : wizard.defaults();
        if (!Array.isArray(wizardState.data.images)) wizardState.data.images = [];

        renderWizard();
        wizardOverlay.classList.add('active');
        wizardOverlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
    }

    function closeWizard() {
        wizardOverlay.classList.remove('active');
        wizardOverlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        wizardState.entity = null;
        wizardState.editingId = null;
    }

    function renderWizard() {
        const wizard = WIZARDS[wizardState.entity];
        if (!wizard) return;

        wizardTitle.textContent = wizardState.editingId ? wizard.editTitle : wizard.newTitle;
        wizardSubtitle.textContent = wizardState.editingId
            ? `Editando “${wizardState.data.name || '#'}”`
            : wizard.newSub;

        renderWizardSteps();
        renderWizardBody();
        renderWizardFooter();
    }

    function renderWizardSteps() {
        const wizard = WIZARDS[wizardState.entity];
        wizardStepsEl.innerHTML = wizard.steps.map((step, i) => {
            const stateClass = i < wizardState.stepIndex ? 'done' : (i === wizardState.stepIndex ? 'current' : '');
            const dot = i < wizardState.stepIndex ? '✓' : String(i + 1);
            const connector = i < wizard.steps.length - 1
                ? `<span class="wstep-connector ${i < wizardState.stepIndex ? 'done' : ''}"></span>`
                : '';
            return `
                <div class="wstep ${stateClass}">
                    <span class="wstep-dot">${dot}</span>
                    <span class="wstep-label">${step.label}</span>
                </div>
                ${connector}
            `;
        }).join('');
    }

    function renderWizardBody() {
        const wizard = WIZARDS[wizardState.entity];
        const step = wizard.steps[wizardState.stepIndex];
        wizardBody.innerHTML = step.render(wizardState.data);
        wizardBody.scrollTop = 0;
        if (step.bind) step.bind();
    }

    function renderWizardFooter() {
        const wizard = WIZARDS[wizardState.entity];
        const isLast = wizardState.stepIndex === wizard.steps.length - 1;

        wizardFooter.innerHTML = `
            <div class="footer-left">
                <button class="btn btn-ghost" data-wiz="cancel">Cancelar</button>
            </div>
            <div class="footer-right">
                ${wizardState.stepIndex > 0 ? '<button class="btn btn-secondary" data-wiz="back">← Atrás</button>' : ''}
                <button class="btn btn-primary" data-wiz="next">${isLast ? '💾 Guardar' : 'Siguiente →'}</button>
            </div>
        `;

        wizardFooter.querySelector('[data-wiz="cancel"]').addEventListener('click', closeWizard);
        const backBtn = wizardFooter.querySelector('[data-wiz="back"]');
        if (backBtn) backBtn.addEventListener('click', () => {
            collectStep();
            wizardState.stepIndex -= 1;
            renderWizard();
        });
        wizardFooter.querySelector('[data-wiz="next"]').addEventListener('click', handleWizardNext);
    }

    function collectStep() {
        wizardBody.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => {
            if (el.type === 'checkbox') {
                wizardState.data[el.name] = el.checked;
            } else {
                wizardState.data[el.name] = el.value;
            }
        });
    }

    function markInvalid(fields = []) {
        wizardBody.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
        fields.forEach(name => {
            const el = wizardBody.querySelector(`[name="${name}"]`);
            if (el) el.classList.add('invalid');
        });
    }

    function handleWizardNext() {
        const wizard = WIZARDS[wizardState.entity];
        const step = wizard.steps[wizardState.stepIndex];

        collectStep();

        if (step.validate) {
            const result = step.validate(wizardState.data);
            if (result && result.error) {
                showToast(result.error, 'error');
                markInvalid(result.invalid || []);
                return;
            }
        }

        if (wizardState.stepIndex < wizard.steps.length - 1) {
            wizardState.stepIndex += 1;
            renderWizard();
        } else {
            submitWizard();
        }
    }

    async function submitWizard() {
        const wizard = WIZARDS[wizardState.entity];
        const entityKey = wizardState.entity;
        const payload = wizard.payload(wizardState.data);
        const editing = wizardState.editingId;
        const url = editing
            ? `/api/admin-resources?type=${entityKey}&id=${editing}`
            : `/api/admin-resources?type=${entityKey}`;

        try {
            const { ok, data } = await fetchJson(url, {
                method: editing ? 'PUT' : 'POST',
                headers: REQUEST_HEADERS,
                body: JSON.stringify(payload)
            });

            if (ok && data.success) {
                showToast(data.message || 'Guardado', 'success');
                closeWizard();
                await wizard.reload();
                switchView(entityKey);
            } else {
                showToast(data.message || 'No se pudo guardar', 'error');
            }
        } catch (error) {
            console.error('Error saving:', error);
            showToast('Error al guardar', 'error');
        }
    }

    wizardCloseBtn.addEventListener('click', closeWizard);
    wizardOverlay.addEventListener('click', (e) => {
        if (e.target === wizardOverlay) closeWizard();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && wizardOverlay.classList.contains('active')) closeWizard();
    });

    /* ==================== Inicialización del panel ==================== */
    let adminInitialized = false;

    function initAdmin() {
        if (adminInitialized) return;
        adminInitialized = true;

        initNav();
        initSidebarMobile();
        switchView('products');

        addProductBtn.addEventListener('click', () => openWizard('products'));
        addCategoryBtn.addEventListener('click', () => openWizard('categories'));
        addPromotionBtn.addEventListener('click', () => openWizard('promotions'));

        loadAll();
    }

    /* ==================== Arranque ==================== */
    checkAuth().then(authenticated => {
        if (authenticated) {
            showShell();
        } else {
            showLogin();
        }
    }).catch(() => showLogin());
});
