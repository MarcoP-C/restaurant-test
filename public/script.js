// Main application script
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('load', initApp);
});

async function initApp() {
    try {
        console.log('Initializing app...');

        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = document.querySelector('.theme-icon');
        const navMenu = document.getElementById('navMenu');
        const hamburger = document.querySelector('.hamburger');
        const categoryFilter = document.getElementById('categoryFilter');
        const productsContainer = document.getElementById('productsContainer');
        const promotionsContainer = document.getElementById('promotionsContainer');
        const productModal = document.getElementById('productModal');
        const modalClose = document.getElementById('modalClose');
        const modalBody = document.getElementById('modalBody');

        // Theme Management
        let currentTheme = localStorage.getItem('theme') || 'light';
        applyTheme(currentTheme);

        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                currentTheme = (document.documentElement.getAttribute('data-theme') || 'light') === 'light' ? 'dark' : 'light';
                applyTheme(currentTheme);
            });
        }

        function applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            if (themeIcon) themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
            localStorage.setItem('theme', theme);
        }

        // Mobile Menu
        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('active');
            });
        });

        // Data storage
        let products = [];
        let categories = [];
        let promotions = [];
        let currentCategory = '';

        async function loadData() {
            try {
                await Promise.all([loadCategories(), loadPromotions(), loadProducts()]);
                renderProducts();
                renderPromotions();
            } catch (error) {
                console.error('Error loading data:', error);
                showError();
            }
        }

        async function loadCategories() {
            try {
                const response = await fetch('/api/resources?type=categories');
                const data = await response.json();
                if (data.success) {
                    categories = data.categories || [];
                    renderCategoryFilter();
                }
            } catch (error) {
                console.error('Error loading categories:', error);
            }
        }

        async function loadPromotions() {
            try {
                const response = await fetch('/api/resources?type=promotions');
                const data = await response.json();
                if (data.success) {
                    promotions = data.promotions || [];
                }
            } catch (error) {
                console.error('Error loading promotions:', error);
            }
        }

        async function loadProducts() {
            try {
                const response = await fetch('/api/resources?type=products');
                const data = await response.json();
                if (data.success) {
                    products = data.products || [];
                }
            } catch (error) {
                console.error('Error loading products:', error);
            }
        }

        function renderCategoryFilter() {
            if (!categoryFilter) return;
            const defaultOption = categoryFilter.options[0];
            categoryFilter.innerHTML = '';
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categoryFilter.appendChild(option);
            });
            categoryFilter.appendChild(defaultOption);
        }

        if (categoryFilter) {
            categoryFilter.addEventListener('change', (e) => {
                currentCategory = e.target.value;
                renderProducts();
            });
        }

        function renderProducts() {
            const filteredProducts = currentCategory
                ? products.filter(p => String(p.category_id) === String(currentCategory))
                : products;

            if (!productsContainer) return;
            if (filteredProducts.length === 0) {
                productsContainer.innerHTML = '<p class="loading">No hay productos disponibles</p>';
                return;
            }

            productsContainer.innerHTML = filteredProducts.map(product => `
                <div class="product-card ${product.is_promotional ? 'is-promotional' : ''}" data-product-id="${product.id}">
                    ${product.images && product.images.length > 0 ? `
                        <img src="${escapeHtml(product.images[0])}" alt="${escapeHtml(product.name)}" class="product-image">
                    ` : `
                        <div class="product-image placeholder" aria-hidden="true">🍔</div>
                    `}
                    <div class="product-info">
                        <div class="product-category">${escapeHtml(product.category_name || 'Sin categoría')}</div>
                        <h3 class="product-title">${escapeHtml(product.name)}</h3>
                        <p class="product-description">${escapeHtml(product.description || 'Sin descripción')}</p>
                        <div class="product-price">
                            <div class="price-container">
                                <span class="current-price">$${parseFloat(product.price).toFixed(2)}</span>
                                ${product.is_promotional ? `
                                    <span class="original-price">$${(parseFloat(product.price) * 1.2).toFixed(2)}</span>
                                ` : ''}
                            </div>
                            ${product.is_promotional ? `
                                <span class="promo-code">OFERTA</span>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `).join('');

            document.querySelectorAll('.product-card').forEach(card => {
                card.addEventListener('click', () => {
                    const productId = parseInt(card.dataset.productId);
                    showProductModal(productId);
                });
            });
        }

        function renderPromotions() {
            if (!promotionsContainer) return;
            if (promotions.length === 0) {
                promotionsContainer.innerHTML = '<p class="loading">No hay promociones activas</p>';
                return;
            }

            promotionsContainer.innerHTML = promotions.map(promo => {
                const discountText = getDiscountText(promo);
                return `
                    <div class="promotion-card">
                        <h3>${escapeHtml(promo.name)}</h3>
                        <div class="discount">${discountText}</div>
                        <p class="description">${escapeHtml(promo.description || '')}</p>
                        <p class="validity">Válido hasta: ${new Date(promo.end_date).toLocaleDateString('es-MX')}</p>
                    </div>
                `;
            }).join('');
        }

        function getDiscountText(promo) {
            const value = parseFloat(promo.discount_value);
            if (promo.discount_type === 'percentage') {
                return `-${value.toFixed(2)}%`;
            } else if (promo.discount_type === 'fixed') {
                return `-$${value.toFixed(2)}`;
            } else if (promo.discount_type === 'buy_x_get_y') {
                const buy = promo.buy_x_get_y || 0;
                const pay = promo.pay_y || 0;
                return `Compra ${buy} paga ${pay}`;
            } else if (promo.discount_type === 'minimum') {
                const min = parseFloat(promo.min_purchase);
                return `Min. $${min.toFixed(2)}`;
            }
            return `$${value.toFixed(2)}`;
        }

        function showProductModal(productId) {
            const product = products.find(p => p.id === productId);
            if (!product) return;
            renderModal(product);
            if (productModal) {
                productModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        }

        function renderModal(product) {
            if (!modalBody) return;
            modalBody.innerHTML = `
                ${product.is_promotional ? `
                    <div class="modal-badge">OFERTA ESPECIAL</div>
                ` : ''}
                <h2>${escapeHtml(product.name)}</h2>
                <div class="price">$${parseFloat(product.price).toFixed(2)}</div>
                <p class="description">${escapeHtml(product.description || 'Sin descripción')}</p>
                ${product.images && product.images.length > 0 ? `
                    <div class="images">
                        ${product.images.map(img => `
                            <img src="${escapeHtml(img)}" alt="${escapeHtml(product.name)}">
                        `).join('')}
                    </div>
                ` : ''}
                <div class="category">${escapeHtml(product.category_name || 'Sin categoría')}</div>
            `;
        }

        function closeModal() {
            if (!productModal) return;
            productModal.classList.remove('active');
            document.body.style.overflow = '';
        }

        if (modalClose) modalClose.addEventListener('click', closeModal);
        if (productModal) {
            productModal.addEventListener('click', (e) => {
                if (e.target === productModal) closeModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && productModal && productModal.classList.contains('active')) {
                closeModal();
            }
        });

        function showError() {
            if (productsContainer) {
                productsContainer.innerHTML = `
                    <div style="text-align:center;padding:2rem;">
                        <p style="color:var(--accent-color);">Error al cargar los productos</p>
                        <p style="color:var(--text-tertiary);margin-top:0.5rem;">Por favor intenta nuevamente más tarde</p>
                    </div>
                `;
            }
            if (promotionsContainer) {
                promotionsContainer.innerHTML = `
                    <div style="text-align:center;padding:2rem;">
                        <p style="color:var(--accent-color);">Error al cargar las promociones</p>
                        <p style="color:var(--text-tertiary);margin-top:0.5rem;">Por favor intenta nuevamente más tarde</p>
                    </div>
                `;
            }
        }

        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });

        loadData();
    } catch (error) {
        console.error('initApp failed:', error);
    }
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