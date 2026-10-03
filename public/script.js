// Main application script
document.addEventListener('DOMContentLoaded', () => {
    // Esperar a que el DOM esté completamente cargado
    window.addEventListener('load', initApp);
});

async function initApp() {
    try {
        console.log('Initializing app...');

        const themeToggle = document.getElementById('themeToggle');
        const themeIcon = themeToggle.querySelector('.theme-icon');
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
                currentTheme = currentTheme === 'light' ? 'dark' : 'light';
                applyTheme(currentTheme);
            });
        }

        function applyTheme(theme) {
            document.documentElement.setAttribute('data-theme', theme);
            themeIcon.textContent = theme === 'light' ? '🌙' : '☀️';
            localStorage.setItem('theme', theme);
        }

        // Mobile Menu
        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => {
                navMenu.classList.toggle('active');
            });
        }

        // Close mobile menu on link click
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

        // Load data
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

    // Load categories
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

    // Load promotions
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

    // Load products
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

    // Render category filter
    function renderCategoryFilter() {
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

    // Filter products by category
    categoryFilter.addEventListener('change', (e) => {
        currentCategory = e.target.value;
        renderProducts();
    });

    // Render products
    function renderProducts() {
        const filteredProducts = currentCategory
            ? products.filter(p => p.category_id === parseInt(currentCategory))
            : products;

        if (filteredProducts.length === 0) {
            productsContainer.innerHTML = '<p class="loading">No hay productos disponibles</p>';
            return;
        }

        productsContainer.innerHTML = filteredProducts.map(product => `
            <div class="product-card ${product.is_promotional ? 'is-promotional' : ''}" data-product-id="${product.id}">
                ${product.images && product.images.length > 0 ? `
                    <img src="${product.images[0]}" alt="${product.name}" class="product-image">
                ` : `
                    <div class="product-image" style="display:flex;align-items:center;justify-content:center;background:var(--bg-tertiary);color:var(--text-tertiary);">
                        🍔
                    </div>
                `}
                <div class="product-info">
                    <div class="product-category">${product.category_name || 'Sin categoría'}</div>
                    <h3 class="product-title">${product.name}</h3>
                    <p class="product-description">${product.description || 'Sin descripción'}</p>
                    <div class="product-price">
                        <div class="price-container">
                            <span class="current-price">$${parseFloat(product.price).toFixed(2)}</span>
                            ${product.is_promotional ? `
                                <span class="original-price">$${parseFloat(product.price * 1.2).toFixed(2)}</span>
                            ` : ''}
                        </div>
                        ${product.is_promotional ? `
                            <span class="promo-code">OFERTA</span>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');

        // Add click listeners to product cards
        document.querySelectorAll('.product-card').forEach(card => {
            card.addEventListener('click', () => {
                const productId = parseInt(card.dataset.productId);
                showProductModal(productId);
            });
        });
    }

    // Render promotions
    function renderPromotions() {
        if (promotions.length === 0) {
            promotionsContainer.innerHTML = '<p class="loading">No hay promociones activas</p>';
            return;
        }

        promotionsContainer.innerHTML = promotions.map(promo => {
            const discountText = getDiscountText(promo);

            return `
                <div class="promotion-card">
                    <h3>${promo.name}</h3>
                    <div class="discount">${discountText}</div>
                    <p class="description">${promo.description || ''}</p>
                    <p class="validity">Válido hasta: ${new Date(promo.end_date).toLocaleDateString('es-MX')}</p>
                </div>
            `;
        }).join('');
    }

    // Get discount text based on discount type
    function getDiscountText(promo) {
        const value = parseFloat(promo.discount_value);

        if (promo.discount_type === 'percentage') {
            return `-${value.toFixed(2)}%`;
        } else if (promo.discount_type === 'fixed') {
            return `$${value.toFixed(2)}`;
        } else if (promo.discount_type === 'buy_x_get_y') {
            // Compra X paga Y: el usuario paga X y obtiene Y productos adicionales
            // Ejemplo: Compra 2 paga 1 → Compras 2, obtienes 1 gratis
            return `Compra ${promo.buy_x_get_y} obtienes ${promo.buy_x_get_y} gratis`;
        } else if (promo.discount_type === 'minimum') {
            const min = parseFloat(promo.min_purchase);
            return `Min. $${min.toFixed(2)}`;
        }
        return `$${promo.discount_value}`;
    }

    // Convert string to number
    function parseDecimal(value) {
        if (typeof value === 'string') {
            return parseFloat(value);
        }
        return parseFloat(value) || 0;
    }

    // Show product modal
    async function showProductModal(productId) {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        try {
            const response = await fetch(`/api/products/${productId}`);
            const data = await response.json();

            if (data.success) {
                renderModal(product, data.product);
                productModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        } catch (error) {
            console.error('Error loading product:', error);
        }
    }

    // Render modal
    function renderModal(product, productData) {
        const discountText = productData.is_promotional ? 'OFERTA ESPECIAL' : '';

        modalBody.innerHTML = `
            ${productData.is_promotional ? `
                <div style="background:var(--accent-color);color:white;padding:0.5rem 1rem;border-radius:6px;margin-bottom:1rem;text-align:center;">
                    ${discountText}
                </div>
            ` : ''}
            <h2>${productData.name}</h2>
            <div class="price">$${parseFloat(productData.price).toFixed(2)}</div>
            <p class="description">${productData.description || 'Sin descripción'}</p>
            ${productData.images && productData.images.length > 0 ? `
                <div class="images">
                    ${productData.images.map(img => `
                        <img src="${img}" alt="${productData.name}">
                    `).join('')}
                </div>
            ` : ''}
            <div class="category">${productData.category_name || 'Sin categoría'}</div>
        `;
    }

    // Close modal
    modalClose.addEventListener('click', closeModal);
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) {
            closeModal();
        }
    });

    function closeModal() {
        productModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && productModal.classList.contains('active')) {
            closeModal();
        }
    });

    // Error handler
    function showError() {
        console.log('Showing error message');
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

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Initialize
    loadData();
});
