// Admin application script
document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('loginSection');
    const adminDashboard = document.getElementById('adminDashboard');
    const loginForm = document.getElementById('loginForm');
    const authCheckUrl = '/api/admin-auth?action=check';
    const loginUrl = '/api/admin-auth?action=login';
    const logoutUrl = '/api/admin-auth?action=logout';

    // Check authentication on page load
    checkAuth().then(authenticated => {
        if (authenticated) {
            showDashboard();
        } else {
            showLogin();
        }
    }).catch(error => {
        console.error('Auth check failed:', error);
        // Si falla, mostrar login
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
        // Load sidebar toggle
        initSidebar();

        // Load data
        await Promise.all([loadCategories(), loadPromotions(), loadProducts()]);

        // Set up event listeners
        setupEventListeners();
    }

    // Initialize sidebar
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
                renderCategorySelect(data.categories || []);
            }
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    // Render category select in forms
    function renderCategorySelect(categories) {
        const selects = document.querySelectorAll('[data-category-select]');
        selects.forEach(select => {
            const currentValues = select.value.split(',').filter(v => v);
            select.innerHTML = '<option value="">Seleccionar categoría</option>';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                if (currentValues.includes(String(cat.id))) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        });
    }

    // Load promotions
    async function loadPromotions() {
        try {
            const response = await fetch('/api/admin-resources?type=promotions');
            const data = await response.json();

            if (data.success) {
                renderPromotionsTable(data.promotions || []);
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
                renderProductsTable(data.products || []);
            }
        } catch (error) {
            console.error('Error loading products:', error);
        }
    }

    // Render products table
    function renderProductsTable(products) {
        const tableBody = document.getElementById('productsTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = products.map(product => `
            <tr>
                <td>${product.id}</td>
                <td>${product.name}</td>
                <td>${product.category_name || 'Sin categoría'}</td>
                <td>$${parseFloat(product.price).toFixed(2)}</td>
                <td>${product.is_available ? '✓' : '✗'}</td>
                <td>${product.is_promotional ? '✓' : '✗'}</td>
                <td>
                    <button onclick="editProduct(${product.id})" class="btn-edit">Editar</button>
                    <button onclick="deleteProduct(${product.id})" class="btn-delete">Eliminar</button>
                </td>
            </tr>
        `).join('');

        // Store products in global variable for editing
        window.adminProducts = products;
    }

    // Render promotions table
    function renderPromotionsTable(promotions) {
        const tableBody = document.getElementById('promotionsTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = promotions.map(promo => `
            <tr>
                <td>${promo.id}</td>
                <td>${promo.name}</td>
                <td>${promo.discount_type}</td>
                <td>${promo.discount_value}</td>
                <td>${promo.buy_x_get_y > 0 ? `Compra ${promo.buy_x_get_y} paga ${promo.buy_x_get_y + promo.buy_x_get_y}` : '-'}</td>
                <td>${promo.is_active ? '✓' : '✗'}</td>
                <td>
                    <button onclick="editPromotion(${promo.id})" class="btn-edit">Editar</button>
                    <button onclick="deletePromotion(${promo.id})" class="btn-delete">Eliminar</button>
                </td>
            </tr>
        `).join('');

        // Store promotions in global variable for editing
        window.adminPromotions = promotions;
    }

    // Setup event listeners
    function setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', handleLogin);
        }

        // Category form
        document.getElementById('categoryForm')?.addEventListener('submit', handleCategorySubmit);

        // Product form
        document.getElementById('productForm')?.addEventListener('submit', handleProductSubmit);

        // Promotion form
        document.getElementById('promotionForm')?.addEventListener('submit', handlePromotionSubmit);

        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
    }

    // Handle login
    async function handleLogin(e) {
        e.preventDefault();

        const form = e.target;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        try {
            const response = await fetch(loginUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                showNotification(result.message, 'success');
                setTimeout(() => {
                    showDashboard();
                }, 1000);
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            showNotification('Error al iniciar sesión', 'error');
        }
    }

    // Show product form
    window.showProductForm = function() {
        const form = document.getElementById('productForm');
        if (form) {
            form.reset();
            form.querySelector('[name="id"]').value = '';
            document.getElementById('products-section').scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Show category form
    window.showCategoryForm = function() {
        const form = document.getElementById('categoryForm');
        if (form) {
            form.reset();
            form.querySelector('[name="id"]').value = '';
            document.getElementById('categories-section').scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Hide category form
    window.hideCategoryForm = function() {
        const formContainer = document.getElementById('categoryFormContainer');
        if (formContainer) {
            formContainer.style.display = 'none';
        }
    };

    // Show promotion form
    window.showPromotionForm = function() {
        const form = document.getElementById('promotionForm');
        if (form) {
            form.reset();
            form.querySelector('[name="id"]').value = '';
            document.getElementById('promotions-section').scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Hide promotion form
    window.hidePromotionForm = function() {
        const formContainer = document.getElementById('promotionFormContainer');
        if (formContainer) {
            formContainer.style.display = 'none';
        }
    };

    // Handle category form submit
    async function handleCategorySubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        try {
            const url = data.id ? `/api/admin/categories?id=${data.id}` : '/api/admin/categories';
            const method = data.id ? 'PUT' : 'POST';
            delete data.id;

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                showNotification(result.message, 'success');
                e.target.reset();
                await loadCategories();
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('Error saving category:', error);
            showNotification('Error al guardar categoría', 'error');
        }
    }

    // Handle product form submit
    async function handleProductSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        try {
            const url = data.id ? `/api/admin/products?id=${data.id}` : '/api/admin/products';
            const method = data.id ? 'PUT' : 'POST';
            delete data.id;

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                showNotification(result.message, 'success');
                e.target.reset();
                await loadProducts();
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('Error saving product:', error);
            showNotification('Error al guardar producto', 'error');
        }
    }

    // Handle promotion form submit
    async function handlePromotionSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        try {
            const url = data.id ? `/api/admin/promotions?id=${data.id}` : '/api/admin/promotions';
            const method = data.id ? 'PUT' : 'POST';
            delete data.id;

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (result.success) {
                showNotification(result.message, 'success');
                e.target.reset();
                await loadPromotions();
            } else {
                showNotification(result.message, 'error');
            }
        } catch (error) {
            console.error('Error saving promotion:', error);
            showNotification('Error al guardar promoción', 'error');
        }
    }

    // Handle logout
    async function handleLogout() {
        try {
            await fetch(logoutUrl, { method: 'POST' });
            window.location.href = '/admin.html';
        } catch (error) {
            console.error('Error logging out:', error);
        }
    }

    // Show product form
    window.showProductForm = function() {
        const form = document.getElementById('productForm');
        if (form) {
            form.reset();
            form.querySelector('[name="id"]').value = '';
            document.getElementById('products-section').scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Hide product form
    window.hideProductForm = function() {
        const formContainer = document.getElementById('productFormContainer');
        if (formContainer) {
            formContainer.style.display = 'none';
        }
    };

    // Show notification
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // Global functions for inline handlers
    window.editProduct = async function(productId) {
        const product = window.adminProducts.find(p => p.id === productId);
        if (!product) return;

        const response = await fetch('/api/admin-resources?type=products');
        const data = await response.json();

        if (data.success) {
            const product = data.products.find(p => p.id === productId);
            populateProductForm(product);
        }
    };

    window.deleteProduct = async function(productId) {
        if (!confirm('¿Estás seguro de eliminar este producto?')) return;

        try {
            const response = await fetch('/api/admin-resources?type=products', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: productId })
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

    window.editPromotion = async function(promotionId) {
        const promotion = window.adminPromotions.find(p => p.id === promotionId);
        if (!promotion) return;

        populatePromotionForm(promotion);
    };

    window.deletePromotion = async function(promotionId) {
        if (!confirm('¿Estás seguro de eliminar esta promoción?')) return;

        try {
            const response = await fetch('/api/admin-resources?type=promotions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: promotionId })
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

    // Populate product form
    function populateProductForm(product) {
        const form = document.getElementById('productForm');
        if (!form) return;

        form.querySelector('[name="id"]').value = product.id;
        form.querySelector('[name="name"]').value = product.name;
        form.querySelector('[name="description"]').value = product.description || '';
        form.querySelector('[name="price"]').value = product.price;
        form.querySelector('[name="category_id"]').value = product.category_id || '';
        form.querySelector('[name="is_available"]').value = product.is_available;
        form.querySelector('[name="is_promotional"]').value = product.is_promotional;
        form.querySelector('[name="promo_code"]').value = product.promo_code || '';

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Populate promotion form
    function populatePromotionForm(promotion) {
        const form = document.getElementById('promotionForm');
        if (!form) return;

        form.querySelector('[name="id"]').value = promotion.id;
        form.querySelector('[name="name"]').value = promotion.name;
        form.querySelector('[name="description"]').value = promotion.description || '';
        form.querySelector('[name="discount_type"]').value = promotion.discount_type;
        form.querySelector('[name="discount_value"]').value = promotion.discount_value;
        form.querySelector('[name="min_purchase"]').value = promotion.min_purchase || 0;
        form.querySelector('[name="buy_x_get_y"]').value = promotion.buy_x_get_y || 0;
        form.querySelector('[name="start_date"]').value = promotion.start_date || new Date().toISOString().split('T')[0];
        form.querySelector('[name="end_date"]').value = promotion.end_date.split('T')[0];
        form.querySelector('[name="is_active"]').value = promotion.is_active;

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});
