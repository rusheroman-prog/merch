// screens/Catalog.jsx — каталог с фильтрами; поддерживает 3 layout варианта

const { useState: useStateCat, useMemo: useMemoCat } = React;

function CatalogScreen({ goTo, addToCart, layout, palette }) {
  const { CATEGORIES, PRODUCTS, USER } = window.MERCH_DATA;
  const [cat, setCat] = useStateCat('all');
  const [kindFilter, setKindFilter] = useStateCat(null);
  const [sizeFilter, setSizeFilter] = useStateCat(null);
  const [search, setSearch] = useStateCat('');

  const filtered = useMemoCat(() => {
    return PRODUCTS.filter(p => {
      if (cat !== 'all' && p.cat !== cat) return false;
      if (kindFilter && p.kind !== kindFilter) return false;
      if (sizeFilter && !p.sizes.includes(sizeFilter)) return false;
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [cat, kindFilter, sizeFilter, search]);

  // unique kinds for filter
  const allKinds = useMemoCat(() => {
    const set = new Set(PRODUCTS.map(p => p.kind));
    return Array.from(set);
  }, []);

  // Featured product for editorial layout
  const featured = PRODUCTS.find(p => p.id === 'hoodie-team');
  const otherProducts = filtered.filter(p => p.id !== (layout === 'editorial' ? featured.id : null));

  return (
    <div className="catalog">
      {/* Hero — приветствие + лимиты */}
      <section className="hero">
        <div className="hero-greeting">
          <div className="kicker">Внутренний магазин · команда</div>
          <h1 className="display">
            Привет, {USER.name.split(' ')[0]}.<br/>
            <em>Что-нибудь</em> подберём?
          </h1>
          <p className="lead">
            Здесь вся командная экипировка, канцелярия и подарочные наборы. Бесплатно — нужно только&nbsp;оставить заявку, всё придёт в офис или на выдачу.
          </p>
          <div className="hero-actions">
            <Button onClick={() => document.querySelector('.grid')?.scrollIntoView ? null : null}>Посмотреть каталог ↓</Button>
            <Button variant="ghost" onClick={() => goTo('welcome')}>Welcome-pack для новичков →</Button>
          </div>
        </div>
        <aside className="hero-quota">
          <div className="quota-head-2">
            <span className="kicker">Ваши лимиты · 2-й квартал 2026</span>
          </div>
          <QuotaBar
            label="Крупные позиции (худи, рюкзаки)"
            used={USER.quotaLargeUsed}
            total={USER.quotaLargeTotal}
            accent={palette.accent}
          />
          <QuotaBar
            label="Мелкие позиции (стикеры, блокноты)"
            used={USER.quotaSmallUsed}
            total={USER.quotaSmallTotal}
            accent={palette.accent2}
          />
          <div className="quota-hint">
            Лимиты обновляются каждый квартал. По срочному вопросу — пишите HR-боту&nbsp;в&nbsp;корпоративный мессенджер.
          </div>
        </aside>
      </section>

      {/* Категории — горизонтальный сегмент */}
      <nav className="cat-nav" aria-label="Категории">
        {CATEGORIES.map(c => (
          <button
            key={c.id}
            className={`cat-pill ${cat === c.id ? 'is-on' : ''}`}
            onClick={() => { setCat(c.id); setKindFilter(null); }}
          >
            <span className="cat-pill-lbl">{c.label}</span>
            <span className="cat-pill-hint">{c.hint}</span>
          </button>
        ))}
      </nav>

      <div className="catalog-body">
        {/* Sidebar filters */}
        <aside className="filters">
          <div className="filters-block">
            <label className="filters-label">Поиск</label>
            <input
              className="filters-input"
              placeholder="Худи, шоппер, блокнот…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="filters-block">
            <div className="filters-label">Тип</div>
            <div className="filters-chips">
              {allKinds.map(k => (
                <button
                  key={k}
                  className={`chip ${kindFilter === k ? 'is-on' : ''}`}
                  onClick={() => setKindFilter(kindFilter === k ? null : k)}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="filters-block">
            <div className="filters-label">Размер</div>
            <div className="filters-chips">
              {window.MERCH_DATA.SIZES.map(s => (
                <button
                  key={s}
                  className={`chip chip-sq ${sizeFilter === s ? 'is-on' : ''}`}
                  onClick={() => setSizeFilter(sizeFilter === s ? null : s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {(kindFilter || sizeFilter || search) && (
            <button className="filters-reset" onClick={() => { setKindFilter(null); setSizeFilter(null); setSearch(''); }}>
              Сбросить фильтры
            </button>
          )}

          <div className="filters-note">
            <div className="kicker">Заказ</div>
            <p>Заявки уходят раз в неделю, по понедельникам. Если очень нужно срочно — отметьте в комментарии при оформлении.</p>
          </div>
        </aside>

        {/* Product grid */}
        <main className="grid-wrap">
          <div className="grid-head">
            <div className="grid-count">
              <span className="num">{filtered.length}</span> {decline(filtered.length, ['позиция','позиции','позиций'])}
            </div>
            <div className="grid-sort">
              <span className="kicker">Сортировка</span>
              <select className="sort-select" defaultValue="rec">
                <option value="rec">Рекомендуем</option>
                <option value="new">Сначала новые</option>
                <option value="abc">По алфавиту</option>
              </select>
            </div>
          </div>

          {layout === 'editorial' ? (
            <div className="grid grid-editorial">
              <ProductCard product={featured} onOpen={() => goTo('product', featured.id)} variant="hero" />
              {otherProducts.map(p => (
                <ProductCard key={p.id} product={p} onOpen={() => goTo('product', p.id)} />
              ))}
            </div>
          ) : layout === 'list' ? (
            <div className="grid grid-list">
              {filtered.map(p => (
                <ProductRow key={p.id} product={p} onOpen={() => goTo('product', p.id)} onAdd={() => addToCart(p, { size: p.sizes[0], color: p.colors[0].id, qty: 1 })} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols">
              {filtered.map(p => (
                <ProductCard key={p.id} product={p} onOpen={() => goTo('product', p.id)} />
              ))}
            </div>
          )}

          {filtered.length === 0 && (
            <div className="empty">
              <div className="empty-mark">∅</div>
              <h3>Ничего не нашлось</h3>
              <p>Сбросьте фильтры или загляните в другую категорию.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function ProductCard({ product, onOpen, variant }) {
  return (
    <article className={`card ${variant === 'hero' ? 'card-hero' : ''}`} onClick={onOpen}>
      <div className="card-art">
        <ProductArt product={product} size={variant === 'hero' ? 'lg' : 'md'} />
        {product.badge && <span className="card-badge">{product.badge}</span>}
      </div>
      <div className="card-body">
        <div className="card-top">
          <span className="card-kind">{product.kind}</span>
          <span className={`card-stock card-stock-${product.stock === 'В наличии' ? 'ok' : 'low'}`}>{product.stock}</span>
        </div>
        <h3 className="card-name">{product.name}</h3>
        <div className="card-meta">
          <div className="card-colors">
            {product.colors.slice(0, 4).map(c => (
              <span key={c.id} className="card-color" style={{ background: c.swatch }} title={c.label}/>
            ))}
            {product.colors.length > 4 && <span className="card-color-more">+{product.colors.length - 4}</span>}
          </div>
          <span className="card-sizes">{product.sizes.length === 1 ? product.sizes[0] : `${product.sizes[0]}–${product.sizes[product.sizes.length-1]}`}</span>
        </div>
      </div>
    </article>
  );
}

function ProductRow({ product, onOpen, onAdd }) {
  return (
    <article className="row" onClick={onOpen}>
      <div className="row-art">
        <ProductArt product={product} size="sm" />
      </div>
      <div className="row-body">
        <div className="row-top">
          <span className="card-kind">{product.kind}</span>
          {product.badge && <span className="card-badge card-badge-inline">{product.badge}</span>}
        </div>
        <h3 className="row-name">{product.name}</h3>
        <p className="row-desc">{product.desc}</p>
      </div>
      <div className="row-meta">
        <div className="row-colors">
          {product.colors.map(c => (
            <span key={c.id} className="card-color" style={{ background: c.swatch }} title={c.label}/>
          ))}
        </div>
        <span className="row-sizes">{product.sizes.length === 1 ? product.sizes[0] : `${product.sizes.length} размеров`}</span>
      </div>
      <div className="row-actions" onClick={e => e.stopPropagation()}>
        <Button variant="ghost" size="sm" onClick={onOpen}>Подробнее</Button>
        <Button size="sm" onClick={onAdd}>В заявку</Button>
      </div>
    </article>
  );
}

function decline(n, forms) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return forms[1];
  return forms[2];
}

Object.assign(window, { CatalogScreen, ProductCard, ProductRow });
