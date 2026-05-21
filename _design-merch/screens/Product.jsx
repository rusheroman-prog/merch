// screens/Product.jsx — карточка товара

const { useState: useStateProd } = React;

function ProductScreen({ productId, goTo, addToCart }) {
  const { PRODUCTS } = window.MERCH_DATA;
  const product = PRODUCTS.find(p => p.id === productId) || PRODUCTS[0];

  const [size, setSize]   = useStateProd(product.sizes[Math.min(2, product.sizes.length-1)]);
  const [color, setColor] = useStateProd(product.colors[0]);
  const [qty, setQty]     = useStateProd(1);
  const [view, setView]   = useStateProd(0); // 0,1,2 — псевдо-ракурсы

  const related = PRODUCTS.filter(p => p.cat === product.cat && p.id !== product.id).slice(0, 4);

  return (
    <div className="product">
      <nav className="bread">
        <button onClick={() => goTo('catalog')}>Каталог</button>
        <span>/</span>
        <span>{product.kind}</span>
        <span>/</span>
        <span className="bread-now">{product.name}</span>
      </nav>

      <div className="product-main">
        <div className="product-gallery">
          <div className="gallery-big" style={{ background: product.bg }}>
            <ProductArt product={product} size="xl" />
            {product.badge && <span className="prod-badge">{product.badge}</span>}
          </div>
          <div className="gallery-thumbs">
            {[0,1,2].map(i => (
              <button key={i} className={`thumb ${view === i ? 'is-on' : ''}`} onClick={() => setView(i)} style={{ background: product.bg }}>
                <ProductArt product={product} size="xs"/>
                <span className="thumb-lbl">{['Спереди','Сзади','В деталях'][i]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="product-info">
          <div className="kicker">{product.kind}</div>
          <h1 className="prod-title">{product.name}</h1>
          <p className="prod-desc">{product.desc}</p>

          <div className="prod-tags">
            <Pill>Бесплатно для сотрудника</Pill>
            <Pill tone="muted">{product.stock}</Pill>
            <Pill tone="muted">~5 рабочих дней</Pill>
          </div>

          <div className="prod-section">
            <div className="prod-section-head">
              <span className="prod-section-label">Цвет</span>
              <span className="prod-section-val">{color.label}</span>
            </div>
            <div className="swatches">
              {product.colors.map(c => (
                <ColorSwatch key={c.id} color={c} selected={c.id === color.id} onClick={() => setColor(c)} />
              ))}
            </div>
          </div>

          {product.sizes.length > 1 && (
            <div className="prod-section">
              <div className="prod-section-head">
                <span className="prod-section-label">Размер</span>
                <button className="link-btn">Таблица размеров →</button>
              </div>
              <SizePicker sizes={product.sizes} value={size} onChange={setSize}/>
            </div>
          )}

          <div className="prod-section">
            <div className="prod-section-head">
              <span className="prod-section-label">Количество</span>
              <span className="prod-section-hint">макс. {product.weight >= 2 ? 1 : product.weight === 1 ? 2 : 5} шт.</span>
            </div>
            <Stepper value={qty} onChange={setQty} min={1} max={product.weight >= 2 ? 1 : product.weight === 1 ? 2 : 5} />
          </div>

          <div className="prod-cta">
            <Button size="lg" onClick={() => { addToCart(product, { size, color: color.id, qty }); goTo('cart'); }}>
              Добавить в заявку
            </Button>
            <Button variant="ghost" size="lg" onClick={() => { addToCart(product, { size, color: color.id, qty }); }}>
              + ещё одну, продолжить смотреть
            </Button>
          </div>

          <div className="prod-specs">
            <div><span>Тип</span><b>{product.kind}</b></div>
            <div><span>Доставка</span><b>В офис или на выдачу</b></div>
            <div><span>Производство</span><b>Локальная фабрика</b></div>
            <div><span>Упаковка</span><b>Крафтовая, без пластика</b></div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <section className="related">
          <div className="related-head">
            <h2 className="section-title">Подойдёт сюда же</h2>
            <button className="link-btn" onClick={() => goTo('catalog')}>Весь каталог →</button>
          </div>
          <div className="grid grid-cols-4">
            {related.map(p => (
              <ProductCard key={p.id} product={p} onOpen={() => goTo('product', p.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

Object.assign(window, { ProductScreen });
