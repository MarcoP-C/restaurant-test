// Lógica de la página pública
document.addEventListener('DOMContentLoaded', () => {
    /* ---------------- Estado ---------------- */
    let products = [];
    let categories = [];
    let promotions = [];
    let currentCategory = null; // null = todas
    let carouselTimers = [];
    let currentPage = 1;
    const PAGE_SIZE = 12;

    /* ---------------- Referencias ---------------- */
    const siteHeader = document.getElementById('siteHeader');
    const navList = document.getElementById('navList');
    const menuToggle = document.getElementById('menuToggle');
    const themeToggle = document.getElementById('themeToggle');
    const chipsRow = document.getElementById('chipsRow');
    const productsGrid = document.getElementById('productsGrid');
    const promosGrid = document.getElementById('promosGrid');
    const socialLinks = document.getElementById('socialLinks');
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    const productModal = document.getElementById('productModal');
    const modalClose = document.getElementById('modalClose');
    const modalBody = document.getElementById('modalBody');

    /* ---------------- Tema claro/oscuro ---------------- */
    const SUN_ICON = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>';
    const MOON_ICON = '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>';

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        if (themeToggle) themeToggle.innerHTML = theme === 'dark' ? SUN_ICON : MOON_ICON;
    }

    applyTheme(localStorage.getItem('theme') || 'dark');

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            applyTheme(current === 'light' ? 'dark' : 'light');
        });
    }

    /* ---------------- Menú móvil ---------------- */
    if (menuToggle && navList) {
        menuToggle.addEventListener('click', () => navList.classList.toggle('open'));
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => navList.classList.remove('open'));
        });
    }

    /* ---------------- Efecto del header al hacer scroll ---------------- */
    window.addEventListener('scroll', () => {
        if (siteHeader) siteHeader.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });

    /* ---------------- Carga de datos ---------------- */
    async function loadAll() {
        await Promise.all([loadSettings(), loadCategories(), loadPromotions(), loadProducts()]);
    }

    async function fetchJson(url) {
        const response = await fetch(url);
        return response.json();
    }

    async function loadSettings() {
        try {
            const data = await fetchJson('/api/resources?type=settings');
            if (data.success && data.settings) renderSocialLinks(data.settings);
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async function loadCategories() {
        try {
            const data = await fetchJson('/api/resources?type=categories');
            if (data.success) {
                categories = data.categories || [];
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            categories = [];
        }
        renderChips();
    }

    async function loadPromotions() {
        try {
            const data = await fetchJson('/api/resources?type=promotions');
            if (data.success) {
                promotions = data.promotions || [];
            }
        } catch (error) {
            console.error('Error loading promotions:', error);
            promotions = [];
        }
        renderPromotions();
    }

    async function loadProducts() {
        try {
            const data = await fetchJson('/api/resources?type=products');
            if (data.success) {
                products = data.products || [];
                renderProducts();
            }
        } catch (error) {
            console.error('Error loading products:', error);
            productsGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><p>No pudimos cargar el menú. Inténtalo más tarde.</p></div>';
        }
    }

    /* ---------------- Redes sociales (footer) ---------------- */
    const SOCIAL_ICONS = {
        facebook_url: { label: 'Facebook', svg: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>' },
        instagram_url: { label: 'Instagram', svg: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>' },
        tiktok_url: { label: 'TikTok', svg: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.06 6.15-1.62.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.51 2.87 1.06-.08 2.06-.71 2.62-1.62.18-.29.29-.61.29-.94.02-2.71.01-5.42.02-8.13.03-1.21.53-2.37 1.35-3.29 1.17-1.3 2.93-2.05 4.71-2.02z"/></svg>' },
        whatsapp_url: { label: 'WhatsApp', svg: '<svg fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' }
    };

    function renderSocialLinks(settings) {
        if (!socialLinks) return;
        const entries = Object.entries(SOCIAL_ICONS).filter(([key]) => settings[key]);
        if (entries.length === 0) {
            socialLinks.innerHTML = '<span class="cell-muted">Muy pronto</span>';
            return;
        }
        socialLinks.innerHTML = '';
        for (const [key, meta] of entries) {
            const link = document.createElement('a');
            link.className = 'social-link';
            link.href = settings[key];
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.setAttribute('aria-label', meta.label);
            link.title = meta.label;
            link.innerHTML = meta.svg;
            socialLinks.appendChild(link);
        }
    }

    /* ---------------- Chips de categorías (botones) ---------------- */
    function renderChips() {
        if (!chipsRow) return;
        chipsRow.innerHTML = '';

        const all = document.createElement('button');
        all.className = 'chip' + (currentCategory === null ? ' active' : '');
        all.textContent = '🍽️ Todos';
        all.addEventListener('click', () => {
            currentCategory = null;
            currentPage = 1;
            renderChips();
            renderProducts();
        });
        chipsRow.appendChild(all);

        for (const category of categories) {
            const chip = document.createElement('button');
            chip.className = 'chip' + (String(currentCategory) === String(category.id) ? ' active' : '');
            chip.textContent = category.name;
            chip.addEventListener('click', () => {
                currentCategory = category.id;
                currentPage = 1;
                renderChips();
                renderProducts();
            });
            chipsRow.appendChild(chip);
        }
    }

    /* ---------------- Precios con promoción ---------------- */
    function getPromoPricing(product) {
        const price = Number(product.price);
        const promoActive = Boolean(
            product.is_promotional &&
            product.promo_price !== null &&
            product.promo_price !== undefined &&
            Number(product.promo_price) > 0 &&
            Number(product.promo_price) < price
        );
        return {
            price,
            promoActive,
            current: promoActive ? Number(product.promo_price) : price,
            original: price,
            saving: promoActive ? price - Number(product.promo_price) : 0
        };
    }

    function money(value) {
        return '$' + value.toFixed(2);
    }

    /* ---------------- Carruseles ---------------- */
    function stopCarousels() {
        carouselTimers.forEach(timer => clearInterval(timer));
        carouselTimers = [];
    }

    function initCarousels() {
        stopCarousels();
        document.querySelectorAll('[data-carousel]').forEach(track => {
            const slides = Array.from(track.querySelectorAll('.carousel-slide'));
            if (slides.length <= 1) return;

            const carouselId = track.dataset.carousel;
            let index = slides.findIndex(slide => slide.classList.contains('active'));
            if (index < 0) index = 0;

            const goTo = (nextIndex) => {
                index = ((nextIndex % slides.length) + slides.length) % slides.length;
                slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
                document.querySelectorAll(`[data-dot="${carouselId}"]`).forEach((dot, i) => {
                    dot.classList.toggle('active', i === index);
                });
            };

            let timer = null;
            const start = () => {
                stop();
                timer = setInterval(() => goTo(index + 1), 4000);
                carouselTimers.push(timer);
            };
            const stop = () => {
                if (timer) {
                    clearInterval(timer);
                    timer = null;
                }
            };

            const container = track.closest('.carousel');
            const prevBtn = container.querySelector('[data-dir="prev"]');
            const nextBtn = container.querySelector('[data-dir="next"]');
            if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); goTo(index - 1); start(); });
            if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); goTo(index + 1); start(); });
            container.querySelectorAll('[data-dot-index]').forEach(dot => {
                dot.addEventListener('click', (e) => { e.stopPropagation(); goTo(Number(dot.dataset.dotIndex)); start(); });
            });

            container.addEventListener('mouseenter', stop);
            container.addEventListener('mouseleave', start);

            start();
        });
    }

    function carouselHtml(product, images, showBadge, promoActive) {
        if (images.length === 0) {
            return `<div class="carousel"><div class="carousel-placeholder">🍔</div>${showBadge && promoActive ? '<span class="offer-badge">Oferta</span>' : ''}</div>`;
        }
        const slides = images.map((img, i) => `
            <div class="carousel-slide ${i === 0 ? 'active' : ''}">
                <img src="${escapeHtml(img)}" alt="${escapeHtml(product.name)} — imagen ${i + 1}" loading="lazy">
            </div>
        `).join('');
        const controls = images.length > 1 ? `
            <button class="carousel-arrow prev" data-dir="prev" aria-label="Imagen anterior">‹</button>
            <button class="carousel-arrow next" data-dir="next" aria-label="Imagen siguiente">›</button>
            <div class="carousel-dots">
                ${images.map((_, i) => `<button class="carousel-dot ${i === 0 ? 'active' : ''}" data-dot="${product.id}" data-dot-index="${i}" aria-label="Ir a imagen ${i + 1}"></button>`).join('')}
            </div>
        ` : '';
        return `
            <div class="carousel">
                <div class="carousel-track" data-carousel="${product.id}">${slides}</div>
                ${controls}
                ${showBadge && promoActive ? '<span class="offer-badge">Oferta</span>' : ''}
            </div>
        `;
    }

    /* ---------------- Render de productos ---------------- */
    function renderProducts() {
        if (!productsGrid) return;
        stopCarousels();

        const filtered = currentCategory !== null
            ? products.filter(p => String(p.category_id) === String(currentCategory))
            : products;

        if (filtered.length === 0) {
            productsGrid.innerHTML = '<div class="empty-state"><div class="empty-icon">🛎️</div><p>No hay productos en esta categoría todavía.</p></div>';
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }

        const pageProducts = filtered.slice(0, currentPage * PAGE_SIZE);
        const hasMore = pageProducts.length < filtered.length;

        productsGrid.innerHTML = pageProducts.map(product => {
            const pricing = getPromoPricing(product);
            const images = (product.images || []).slice(0, 10);
            const hasImage = images.length > 0;
            return `
                <article class="product-card fade-in ${pricing.promoActive ? 'is-promotional' : ''}" ${!hasImage ? 'style="--has-image:0"' : ''} data-product-id="${product.id}" tabindex="0" role="button" aria-label="Ver ${escapeHtml(product.name)}">
                    ${carouselHtml(product, images, true, pricing.promoActive)}
                    <div class="product-body">
                        <span class="product-category">${escapeHtml(product.category_name || 'Sin categoría')}</span>
                        <h3 class="product-title font-display">${escapeHtml(product.name)}</h3>
                        <p class="product-desc">${escapeHtml(product.description || 'Sin descripción')}</p>
                        <div class="product-price-row">
                            <div>
                                <span class="price-current">${money(pricing.current)}</span>
                                ${pricing.promoActive ? `<span class="price-original">${money(pricing.original)}</span>` : ''}
                            </div>
                            ${pricing.promoActive ? `<span class="price-saving">Ahorras ${money(pricing.saving)}</span>` : ''}
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        if (loadMoreBtn) {
            loadMoreBtn.style.display = hasMore ? 'inline-flex' : 'none';
            const remaining = filtered.length - pageProducts.length;
            loadMoreBtn.innerHTML = hasMore
                ? `Ver más platillos ↓ <span style="opacity:0.75;font-size:0.82em">(${remaining} restantes)</span>`
                : '✓ Todos los platillos cargados';
        }

        requestAnimationFrame(() => {
            productsGrid.querySelectorAll('.fade-in').forEach(card => card.classList.add('visible'));
        });

        initCarousels();
        productsGrid.querySelectorAll('.product-card').forEach(card => {
            const open = () => showProductModal(Number(card.dataset.productId));
            card.addEventListener('click', open);
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open();
                }
            });
        });
    }

    function loadMore() {
        currentPage++;
        renderProducts();
        const grid = document.getElementById('productsGrid');
        if (grid) {
            grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMore);
    }

    /* ---------------- Render de promociones ---------------- */
    function getDiscountText(promo) {
        const value = Number(promo.discount_value) || 0;
        switch (promo.discount_type) {
            case 'percentage':
                return `-${value.toFixed(0)}%`;
            case 'fixed':
                return `-${money(value)}`;
            case 'buy_x_get_y': {
                const buy = promo.buy_x_get_y || 0;
                const pay = promo.pay_y || 0;
                return `Compra ${buy} paga ${pay}`;
            }
            case 'minimum': {
                const min = Number(promo.min_purchase) || 0;
                return `Desde ${money(min)}`;
            }
            default:
                return money(value);
        }
    }

    function renderPromotions() {
        if (!promosGrid) return;
        if (promotions.length === 0) {
            promosGrid.innerHTML = '<div class="promo-empty"><span>🎈</span><span>Por ahora no hay promociones vigentes. ¡Vuelve pronto!</span></div>';
            return;
        }

        promosGrid.innerHTML = promotions.map(promo => {
            const endDate = promo.end_date ? new Date(promo.end_date + 'T23:59:59') : null;
            const validUntil = endDate && !isNaN(endDate.getTime())
                ? `Válido hasta ${endDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}`
                : '';
            return `
                <article class="promo-card">
                    <div class="promo-head">
                        <span class="promo-discount">${escapeHtml(getDiscountText(promo))}</span>
                    </div>
                    <h3 class="font-display">${escapeHtml(promo.name)}</h3>
                    ${promo.description ? `<p class="promo-desc">${escapeHtml(promo.description)}</p>` : ''}
                    ${validUntil ? `<span class="promo-validity">📅 ${validUntil}</span>` : ''}
                </article>
            `;
        }).join('');
    }

    /* ---------------- Modal de detalle ---------------- */
    function showProductModal(productId) {
        const product = products.find(p => Number(p.id) === productId);
        if (!product || !modalBody) return;

        const pricing = getPromoPricing(product);
        const images = (product.images || []).slice(0, 10);

        modalBody.innerHTML = `
            ${carouselHtml(product, images, true, pricing.promoActive)}
            <div class="modal-body">
                <h2 class="font-display">${escapeHtml(product.name)}</h2>
                <div class="product-price-row" style="margin-bottom:0.9rem">
                    <div>
                        <span class="price-current">${money(pricing.current)}</span>
                        ${pricing.promoActive ? `<span class="price-original">${money(pricing.original)}</span>` : ''}
                    </div>
                    ${pricing.promoActive ? `<span class="price-saving">Ahorras ${money(pricing.saving)}</span>` : ''}
                </div>
                <p class="product-desc">${escapeHtml(product.description || 'Sin descripción')}</p>
                <div class="modal-meta">
                    <span class="pill pill-type">${escapeHtml(product.category_name || 'Sin categoría')}</span>
                    ${pricing.promoActive ? '<span class="pill pill-promo">🔥 En oferta</span>' : ''}
                </div>
            </div>
        `;

        productModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        initCarousels();
    }

    function closeModal() {
        if (!productModal) return;
        productModal.classList.remove('active');
        document.body.style.overflow = '';
        stopCarousels();
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

    /* ---------------- Scroll suave ---------------- */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const target = document.querySelector(anchor.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    /* ---------------- Utilidades ---------------- */
    function escapeHtml(value) {
        if (value === null || value === undefined) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* ---------------- Inicio ---------------- */
    loadAll();
});
