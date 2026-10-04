// Admin application script
document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('loginSection');
    const adminDashboard = document.getElementById('adminDashboard');
    const loginForm = document.getElementById('loginForm');
    const authCheckUrl = '/api/admin-auth?action=check';
    const loginUrl = '/api/admin-auth?action=login';
    const logoutUrl = '/api/admin-auth?action=logout';

    const REQUEST_HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' };

    checkAuth().then(authenticated => {
        if (authenticated) {
            showDashboard();
        } else {
            showLogin();
        }
    }).catch(error => {
        console.error('Auth check failed:', error);
        showLogin();
    });

    async function checkAuth() {
        try {
            const response = await fetch(authCheckUrl);
            const data = await response.json();
            return data.authenticated;
        } catch (error) {
            console.error('Error checking auth:', error);
            return false;
        }
    }

    function showLogin() {
        if (loginSection) {
            loginSection.style.display = 'flex';
        }
        if (adminDashboard) {
            adminDashboard.style.display = 'none';
        }
    }

    function showDashboard() {
        if (loginSection) {
            loginSection.style.display = 'none';
        }
        if (adminDashboard) {
            adminDashboard.style.display = 'block';
        }
        initAdminApp();
    }

    async function initAdminApp() {
        initSidebar();
        initThemeToggle();
        await Promise.all([loadCategories(), loadPromotions(), loadProducts(), loadUsers()]);
        setupEventListeners();
    }

    // Theme toggle (admin)
    function initThemeToggle() {
        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.getElementById('themeIcon');
        if (!themeToggle) return;
        const currentTheme = localStorage.getItem('theme') || 'light';
        applyTheme(currentTheme);
        themeToggle.addEventListener('click', () => {
            const next = (document.documentElement.getAttribute('data-theme') || 'light') === 'light' ? 'dark' : 'light';
            applyTheme(next);
        });
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const themeIcon = document.getElementById('themeIcon');
        if (themeIcon) themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
        localStorage.setItem('theme', theme);
    }

    // Sidebar
    function initSidebar() {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');
        const overlay = document.getElementById('overlay');

        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.add('active');
                overlay.classList.add('active');
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            });
        }
    }

    // Load categories
    async function loadCategories() {
        try {
            const response = await fetch('/api/admin-resources?type=categories');
            const data = await response.json();
            if (data.success) {
                window.adminCategories = data.categories || [];
                renderCategorySelect(window.adminCategories);
                renderCategoriesTable(window.adminCategories);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    function renderCategorySelect(categories) {
        const selects = document.querySelectorAll('[data-category-select], select[name="category_id"]');
        selects.forEach(select => {
            const currentValue = select.value;
            select.innerHTML = '<option value="">Seleccionar categoría</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                if (currentValue && String(cat.id) === String(currentValue)) option.selected = true;
                select.appendChild(option);
            });
        });
    }

    function renderCategoriesTable(categories) {
        const tableBody = document.getElementById('categoriesTableBody');
        if (!tableBody) return;
        if (categories.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" class="loading">No hay categorías. Agrega una con el botón ➕.</td></tr>';
            return;
        }
        tableBody.innerHTML = categories.map(cat => `
            <tr>
                <td>${cat.id}</td>
                <td>${escapeHtml(cat.name)}</td>
                <td>${escapeHtml(cat.description || '-')}</td>
                <td>${cat.is_active ? '✓' : '✗'}</td>
                <td>
                    <button onclick="editCategory(${cat.id})" class="btn-edit">Editar</button>
                    <button onclick="deleteCategory(${cat.id})" class="btn-delete">Eliminar</button>
                </td>
            </tr>
        `).join('');
    }

    // Load promotions
    async function loadPromotions() {
        try {
            const response = await fetch('/api/admin-resources?type=promotions');
            const data = await response.json();
            if (data.success) {
                window.adminPromotions = data.promotions || [];
                renderPromotionsTable(window.adminPromotions);
            }
        } catch (error) {
            console.error('Error loading promotions:', error);
        }
    }

    // Load products
    async function loadProducts() {
        try {
            const response = await fetch('/api/admin-resources?type=products');
            const data = await response.json();
            if (data.success) {
                window.adminProducts = data.products || [];
                renderProductsTable(window.adminProducts);
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    // Load users
    async function loadUsers() {
        const tableBody = document.getElementById('usersTableBody');
        try {
            const response = await fetch('/api/admin-resources?type=users');
            const data = await response.json();
            if (data.success) {
                renderUsersTable(data.users || []);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="3" class="loading">Error al cargar usuarios</td></tr>';
        }
    }

    function renderUsersTable(users) {
        const tableBody = document.getElementById('usersTableBody');
        if (!tableBody) return;
        if (users.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="3" class="loading">No hay usuarios</td></tr>';
            return;
        }
        tableBody.innerHTML = users.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${escapeHtml(user.username)}</td>
                <td>${formatDate(user.created_at)}</td>
            </tr>
        `).join('');
    }

    // Render products table
    function renderProductsTable(products) {
        const tableBody = document.getElementById('productsTableBody');
        if (!tableBody) return;
        if (products.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="loading">No hay productos. Agrega uno con el botón ➕.</td></tr>';
            return;
        }
        tableBody.innerHTML = products.map(product => `
            <tr>
                <td>${product.id}</td>
                <td>${escapeHtml(product.name)}</td>
                <td>${escapeHtml(product.category_name || 'Sin categoría')}</td>
                <td>$${parseFloat(product.price).toFixed(2)}</td>
                <td>${product.is_available ? '✓' : '✗'}</td>
                <td>${product.is_promotional ? '✓' : '✗'}</td>
                <td>
                    <button onclick="editProduct(${product.id})" class="btn-edit">Editar</button>
                    <button onclick="deleteProduct(${product.id})" class="btn-delete">Eliminar</button>
                </td>
            </tr>
        `).join('');
    }

    // Render promotions table
    function renderPromotionsTable(promotions) {
        const tableBody = document.getElementById('promotionsTableBody');
        if (!tableBody) return;
        if (promotions.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="loading">No hay promociones. Agrega una con el botón ➕.</td></tr>';
            return;
        }
        tableBody.innerHTML = promotions.map(promo => `
            <tr>
                <td>${promo.id}</td>
                <td>${escapeHtml(promo.name)}</td>
                <td>${getDiscountTypeLabel(promo.discount_type)}</td>
                <td>${formatDiscountValue(promo)}</td>
                <td>${formatDiscountSummary(promo)}</td>
                <td>${promo.is_active ? '✓' : '✗'}</td>
                <td>
                    <button onclick="editPromotion(${promo.id})" class="btn-edit">Editar</button>
                    <button onclick="deletePromotion(${promo.id})" class="btn-delete">Eliminar</button>
                </td>
            </tr>
        `).join('');
    }

    function getDiscountTypeLabel(type) {
        const labels = {
            percentage: 'Porcentaje',
            fixed: 'Fijo',
            buy_x_get_y: 'Compra X paga Y',
            minimum: 'Mínimo'
        };
        return labels[type] || type;
    }

    function formatDiscountValue(promo) {
        if (promo.discount_type === 'percentage') return `${parseFloat(promo.discount_value)}%`;
        if (['fixed', 'minimum'].includes(promo.discount_type)) return `$${parseFloat(promo.discount_value).toFixed(2)}`;
        if (promo.discount_type === 'buy_x_get_y') return `Compra ${promo.buy_x_get_y || 0}`;
        return '-';
    }

    function formatDiscountSummary(promo) {
        if (promo.discount_type === 'buy_x_get_y') {
            return `Compra ${promo.buy_x_get_y || 0} paga ${promo.pay_y || 0}`;
        }
        return '-';
    }

    function formatDate(value) {
        if (!value) return '-';
        const d = new Date(value);
        return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('es-MX');
    }

    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Event listeners
    function setupEventListeners() {
        document.getElementById('categoryForm')?.addEventListener('submit', handleCategorySubmit);
        document.getElementById('productForm')?.addEventListener('submit', handleProductSubmit);
        document.getElementById('promotionForm')?.addEventListener('submit', handlePromotionSubmit);
        document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const targetId = link.getAttribute('href');
                if (targetId && targetId.startsWith('#')) {
                    const target = document.querySelector(targetId);
                    if (target) {
                        e.preventDefault();
                        target.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        });
    }

    // Login button (button onclick="handleLogin()")
    window.handleLogin = async function() {
        const form = document.getElementById('loginForm');
        if (!form) return;

        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(loginUrl, {
                method: 'POST',
                headers: REQUEST_HEADERS,
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.success) {
                showNotification(result.message, 'success');
                setTimeout(() => showDashboard(), 800);
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showNotification('Error al iniciar sesión', 'error');
        }
    };

    // Show / hide forms (this is what was broken)
    window.showProductForm = function(product = null) {
        const formContainer = document.getElementById('productFormContainer');
        const form = document.getElementById('productForm');
        if (!form || !formContainer) return;
        form.reset();
        form.querySelector('[name="id"]').value = '';
        if (product) populateProductForm(product);
        formContainer.style.display = 'block';
        renderCategorySelect(window.adminCategories || []);
        document.getElementById('products-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    window.hideProductForm = function() {
        const formContainer = document.getElementById('productFormContainer');
        if (formContainer) formContainer.style.display = 'none';
    };

    window.showCategoryForm = function(category = null) {
        const formContainer = document.getElementById('categoryFormContainer');
        const form = document.getElementById('categoryForm');
        if (!form || !formContainer) return;
        form.reset();
        form.querySelector('[name="id"]').value = '';
        if (category) populateCategoryForm(category);
        formContainer.style.display = 'block';
        document.getElementById('categories-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    window.hideCategoryForm = function() {
        const formContainer = document.getElementById('categoryFormContainer');
        if (formContainer) formContainer.style.display = 'none';
    };

    window.showPromotionForm = function(promotion = null) {
        const formContainer = document.getElementById('promotionFormContainer');
        const form = document.getElementById('promotionForm');
        if (!form || !formContainer) return;
        form.reset();
        form.querySelector('[name="id"]').value = '';
        if (promotion) populatePromotionForm(promotion);
        formContainer.style.display = 'block';
        document.getElementById('promotions-section')?.scrollIntoView({ behavior: 'smooth' });
    };

    window.hidePromotionForm = function() {
        const formContainer = document.getElementById('promotionFormContainer');
        if (formContainer) formContainer.style.display = 'none';
    };

    // Submit handlers
    async function handleCategorySubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;
        delete data.id;

        try {
            const url = id ? `/api/admin-resources?type=categories&id=${id}` : '/api/admin-resources?type=categories';
            const method = id ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method,
                headers: REQUEST_HEADERS,
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.success) {
                showNotification(result.message, 'success');
                hideCategoryForm();
                await loadCategories();
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('Error saving category:', error);
            showNotification('Error al guardar categoría', 'error');
        }
    }

    async function handleProductSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;
        delete data.id;

        try {
            const url = id ? `/api/admin-resources?type=products&id=${id}` : '/api/admin-resources?type=products';
            const method = id ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method,
                headers: REQUEST_HEADERS,
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.success) {
                showNotification(result.message, 'success');
                hideProductForm();
                await loadProducts();
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('Error saving product:', error);
            showNotification('Error al guardar producto', 'error');
        }
    }

    async function handlePromotionSubmit(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        const id = data.id;
        delete data.id;

        try {
            const url = id ? `/api/admin-resources?type=promotions&id=${id}` : '/api/admin-resources?type=promotions';
            const method = id ? 'PUT' : 'POST';
            const response = await fetch(url, {
                method,
                headers: REQUEST_HEADERS,
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (result.success) {
                showNotification(result.message, 'success');
                hidePromotionForm();
                await loadPromotions();
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('Error saving promotion:', error);
            showNotification('Error al guardar promoción', 'error');
        }
    }

    // Logout
    async function handleLogout() {
        try {
            await fetch(logoutUrl, { method: 'POST', headers: REQUEST_HEADERS });
            window.location.href = '/admin.html';
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }

    // Edit / delete product
    window.editProduct = function(productId) {
        const product = (window.adminProducts || []).find(p => Number(p.id) === Number(productId));
        if (!product) return showNotification('Producto no encontrado', 'error');
        showProductForm(product);
    };

    window.deleteProduct = async function(productId) {
        if (!confirm('¿Estás seguro de eliminar este producto?')) return;
        try {
            const response = await fetch(`/api/admin-resources?type=products&id=${productId}`, {
                method: 'DELETE',
                headers: REQUEST_HEADERS
            });
            const result = await response.json();
            if (result.success) {
                showNotification(result.message, 'success');
                await loadProducts();
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            showNotification('Error al eliminar producto', 'error');
        }
    };

    // Edit / delete category
    window.editCategory = function(categoryId) {
        const category = (window.adminCategories || []).find(c => Number(c.id) === Number(categoryId));
        if (!category) return showNotification('Categoría no encontrada', 'error');
        showCategoryForm(category);
    };

    window.deleteCategory = async function(categoryId) {
        if (!confirm('¿Estás seguro de eliminar esta categoría? Los productos quedarán sin categoría.')) return;
        try {
            const response = await fetch(`/api/admin-resources?type=categories&id=${categoryId}`, {
                method: 'DELETE',
                headers: REQUEST_HEADERS
            });
            const result = await response.json();
            if (result.success) {
                showNotification(result.message, 'success');
                await loadCategories();
                await loadProducts();
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            showNotification('Error al eliminar categoría', 'error');
        }
    };

    // Edit / delete promotion
    window.editPromotion = function(promotionId) {
        const promotion = (window.adminPromotions || []).find(p => Number(p.id) === Number(promotionId));
        if (!promotion) return showNotification('Promoción no encontrada', 'error');
        showPromotionForm(promotion);
    };

    window.deletePromotion = async function(promotionId) {
        if (!confirm('¿Estás seguro de eliminar esta promoción?')) return;
        try {
            const response = await fetch(`/api/admin-resources?type=promotions&id=${promotionId}`, {
                method: 'DELETE',
                headers: REQUEST_HEADERS
            });
            const result = await response.json();
            if (result.success) {
                showNotification(result.message, 'success');
                await loadPromotions();
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('Error deleting promotion:', error);
            showNotification('Error al eliminar promoción', 'error');
        }
    };

    // Populate forms (for editing)
    function populateProductForm(product) {
        const form = document.getElementById('productForm');
        if (!form) return;
        form.querySelector('[name="id"]').value = product.id;
        form.querySelector('[name="name"]').value = product.name || '';
        form.querySelector('[name="description"]').value = product.description || '';
        form.querySelector('[name="price"]').value = product.price;
        form.querySelector('[name="category_id"]').value = product.category_id || '';
        form.querySelector('[name="is_available"]').value = String(product.is_available);
        form.querySelector('[name="is_promotional"]').value = String(product.is_promotional);
        form.querySelector('[name="promo_code"]').value = product.promo_code || '';
    }

    function populateCategoryForm(category) {
        const form = document.getElementById('categoryForm');
        if (!form) return;
        form.querySelector('[name="id"]').value = category.id;
        form.querySelector('[name="name"]').value = category.name || '';
        form.querySelector('[name="description"]').value = category.description || '';
        const isActive = form.querySelector('[name="is_active"]');
        if (isActive) isActive.value = String(category.is_active);
    }

    function populatePromotionForm(promotion) {
        const form = document.getElementById('promotionForm');
        if (!form) return;
        form.querySelector('[name="id"]').value = promotion.id;
        form.querySelector('[name="name"]').value = promotion.name || '';
        form.querySelector('[name="description"]').value = promotion.description || '';
        form.querySelector('[name="discount_type"]').value = promotion.discount_type;
        form.querySelector('[name="discount_value"]').value = promotion.discount_value || 0;
        form.querySelector('[name="min_purchase"]').value = promotion.min_purchase || 0;
        form.querySelector('[name="buy_x_get_y"]').value = promotion.buy_x_get_y || 0;
        form.querySelector('[name="start_date"]').value = promotion.start_date || '';
        form.querySelector('[name="end_date"]').value = promotion.end_date ? String(promotion.end_date).split('T')[0] : '';
        form.querySelector('[name="is_active"]').value = String(promotion.is_active);
    }

    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
});