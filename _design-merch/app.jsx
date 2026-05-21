// app.jsx — top-level App: header, footer, view router, cart state, tweaks

const { useState: useStateApp, useEffect: useEffectApp } = React;

const PALETTES = {
  uzum: {
    name: 'Uzum светлый',
    bg:        '#ffffff',
    surface:   '#ffffff',
    surfaceAlt:'#f6f3ff',
    ink:       '#1a0d3a',
    inkMute:   '#6b6585',
    border:    '#ece6fa',
    accent:    '#7000FF',
    accentInk: '#ffffff',
    'accent-2':'#FF88DE',
    chip:      '#f1ebff',
  },
  lilac: {
    name: 'Лиловая дымка',
    bg:        '#f3eeff',
    surface:   '#ffffff',
    surfaceAlt:'#ebe3ff',
    ink:       '#220d5c',
    inkMute:   '#6b5a9c',
    border:    '#dccdff',
    accent:    '#5000AA',
    accentInk: '#ffffff',
    'accent-2':'#FF88DE',
    chip:      '#e3d5ff',
  },
  midnight: {
    name: 'Тёмный фиолет',
    bg:        '#1a0a4a',
    surface:   '#251463',
    surfaceAlt:'#2e1b75',
    ink:       '#f3eeff',
    inkMute:   '#a89dd1',
    border:    '#3b287f',
    accent:    '#7000FF',
    accentInk: '#ffffff',
    'accent-2':'#FF88DE',
    chip:      '#2e1b75',
  },
  pinkpop: {
    name: 'Розовый pop',
    bg:        '#fff5fc',
    surface:   '#ffffff',
    surfaceAlt:'#ffeaf6',
    ink:       '#1a0d3a',
    inkMute:   '#6b6585',
    border:    '#ffd6ee',
    accent:    '#FF88DE',
    accentInk: '#1a0d3a',
    'accent-2':'#7000FF',
    chip:      '#ffe2f3',
  },
};

const FONTS = {
  uzum: { display: '"TT Uzum", ui-sans-serif, system-ui', body: '"Nunito", ui-sans-serif, system-ui' },
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "paletteId": "uzum",
  "fontPair": "uzum",
  "layout": "grid",
  "density": "regular",
  "showLimits": true
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [view, setView]            = useStateApp('catalog');     // catalog | product | cart | checkout | confirm | orders | welcome
  const [openProductId, setOpenPid]= useStateApp(null);
  const [cart, setCart]            = useStateApp([]);
  const [lastOrder, setLastOrder]  = useStateApp(null);
  const [ordersList, setOrders]    = useStateApp([]);
  const [toast, setToast]          = useStateApp(null);

  const palette = PALETTES[t.paletteId] || PALETTES.uzum;
  const fonts   = FONTS[t.fontPair]    || FONTS.uzum;

  // apply theme vars
  useEffectApp(() => {
    const r = document.documentElement;
    Object.entries(palette).forEach(([k, v]) => {
      if (k === 'name') return;
      r.style.setProperty(`--${k}`, v);
    });
    r.style.setProperty('--font-display', fonts.display);
    r.style.setProperty('--font-body',    fonts.body);
    r.style.setProperty('--density', t.density === 'compact' ? '.92' : t.density === 'comfy' ? '1.08' : '1');
  }, [t.paletteId, t.fontPair, t.density]);

  // scroll to top on view change
  useEffectApp(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, [view, openProductId]);

  function goTo(v, id) {
    setView(v);
    if (id) setOpenPid(id);
  }

  function addToCart(product, opts) {
    setCart(prev => {
      // merge identical variant
      const idx = prev.findIndex(l => l.id === product.id && l.size === opts.size && l.color === opts.color);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Math.min(5, next[idx].qty + (opts.qty || 1)) };
        return next;
      }
      return [...prev, { id: product.id, size: opts.size, color: opts.color, qty: opts.qty || 1 }];
    });
    setToast(`Добавили: ${product.name}`);
  }
  function updateLine(i, patch) {
    setCart(prev => prev.map((l, j) => j === i ? { ...l, ...patch } : l));
  }
  function removeLine(i) {
    setCart(prev => prev.filter((_, j) => j !== i));
  }

  function submitOrder(opts) {
    const { OFFICES } = window.MERCH_DATA;
    const officeLabel = OFFICES.find(o => o.id === opts.office)?.label || '';
    const delivery = opts.mode === 'office' ? `Доставка в офис · ${window.MERCH_DATA.USER.office}`
                   : opts.mode === 'pickup' ? `Самовывоз · ${officeLabel}`
                   : `Курьером · ${opts.address}`;
    const eta = opts.urgent ? 'Постараемся к концу недели' : 'Ожидаемо через 5–7 рабочих дней';
    const id = 'M-2026-' + (200 + Math.floor(Math.random() * 800));
    const { PRODUCTS } = window.MERCH_DATA;
    const order = {
      id,
      placed: 'сегодня',
      status: 'Согласование',
      statusTone: 'progress',
      eta,
      delivery,
      items: cart.map(l => {
        const p = PRODUCTS.find(p => p.id === l.id);
        const color = p?.colors.find(c => c.id === l.color);
        return {
          id: l.id,
          name: p?.name,
          variant: `${l.size} · ${color?.label}`,
          size: l.size,
          color: l.color,
          qty: l.qty,
        };
      }),
    };
    setLastOrder(order);
    setOrders(prev => [order, ...prev]);
    setCart([]);
    setView('confirm');
  }

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);

  return (
    <div className={`app density-${t.density}`}>
      <Header view={view} goTo={goTo} cartCount={cartCount}/>

      <main className="page">
        {view === 'catalog'  && <CatalogScreen goTo={goTo} addToCart={addToCart} layout={t.layout} palette={palette}/>}
        {view === 'product'  && <ProductScreen productId={openProductId} goTo={goTo} addToCart={addToCart}/>}
        {view === 'cart'     && <CartScreen goTo={goTo} cart={cart} updateLine={updateLine} removeLine={removeLine}/>}
        {view === 'checkout' && <CheckoutScreen goTo={goTo} cart={cart} submitOrder={submitOrder}/>}
        {view === 'confirm'  && <ConfirmScreen goTo={goTo} lastOrder={lastOrder}/>}
        {view === 'orders'   && <OrdersScreen goTo={goTo} ordersList={ordersList}/>}
        {view === 'welcome'  && <WelcomeScreen goTo={goTo} addToCart={addToCart}/>}
      </main>

      <Footer/>

      <Toast message={toast} onDone={() => setToast(null)}/>

      <TweaksPanel>
        <TweakSection label="Тема"/>
        <TweakSelect
          label="Палитра"
          value={t.paletteId}
          options={Object.keys(PALETTES).map(id => ({ value: id, label: PALETTES[id].name }))}
          onChange={(v) => setTweak('paletteId', v)}
        />
        <TweakRadio
          label="Плотность"
          value={t.density}
          options={['compact','regular','comfy']}
          onChange={(v) => setTweak('density', v)}
        />

        <TweakSection label="Layout каталога"/>
        <TweakRadio
          label="Сетка"
          value={t.layout}
          options={[
            { value: 'grid',      label: 'Сетка' },
            { value: 'editorial', label: 'Редакц.' },
            { value: 'list',      label: 'Список' },
          ]}
          onChange={(v) => setTweak('layout', v)}
        />

        <TweakSection label="Поведение"/>
        <TweakToggle
          label="Показывать лимиты"
          value={t.showLimits}
          onChange={(v) => setTweak('showLimits', v)}
        />

        <TweakSection label="Перейти к экрану"/>
        <TweakButton onClick={() => goTo('catalog')}>Каталог</TweakButton>
        <TweakButton onClick={() => goTo('product', 'hoodie-team')}>Карточка товара</TweakButton>
        <TweakButton onClick={() => goTo('cart')}>Корзина</TweakButton>
        <TweakButton onClick={() => goTo('checkout')}>Оформление</TweakButton>
        <TweakButton onClick={() => goTo('confirm')}>Подтверждение</TweakButton>
        <TweakButton onClick={() => goTo('orders')}>Мои заказы</TweakButton>
        <TweakButton onClick={() => goTo('welcome')}>Welcome-pack</TweakButton>
      </TweaksPanel>
    </div>
  );
}

function Header({ view, goTo, cartCount }) {
  const { USER } = window.MERCH_DATA;
  const nav = [
    { id: 'catalog', label: 'Каталог' },
    { id: 'welcome', label: 'Welcome-pack' },
    { id: 'orders',  label: 'Мои заказы' },
  ];
  return (
    <header className="site-head">
      <div className="head-inner">
        <a className="brand" onClick={(e) => { e.preventDefault(); goTo('catalog'); }} href="#">
          <UzumMark size={32}/>
          <span className="brand-name">uzum&nbsp;<span className="brand-name-soft">мерч</span></span>
          <span className="brand-sub">внутренний&nbsp;портал</span>
        </a>

        <nav className="head-nav">
          {nav.map(n => (
            <a key={n.id} href="#"
               className={`nav-link ${view === n.id || (n.id === 'catalog' && view === 'product') ? 'is-on' : ''}`}
               onClick={(e) => { e.preventDefault(); goTo(n.id); }}>
              {n.label}
            </a>
          ))}
        </nav>

        <div className="head-side">
          <button className="head-icon-btn" aria-label="Поиск">
            <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4"/><path d="M11 11 L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          </button>
          <button className="head-cart" onClick={() => goTo('cart')} aria-label="Заявка">
            <svg width="16" height="16" viewBox="0 0 16 16"><path d="M2 3 L4 3 L5.5 11 L13 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><circle cx="6.5" cy="13.5" r="1" fill="currentColor"/><circle cx="11.5" cy="13.5" r="1" fill="currentColor"/><path d="M5 5 L14 5 L13 9 L5.5 9" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
            <span>Заявка</span>
            {cartCount > 0 && <span className="head-cart-badge">{cartCount}</span>}
          </button>
          <a className="head-user" href="#" onClick={e => e.preventDefault()}>
            <span className="head-user-avatar">{USER.name.split(' ').map(s => s[0]).join('')}</span>
            <span className="head-user-info">
              <span className="head-user-name">{USER.name}</span>
              <span className="head-user-team">{USER.team}</span>
            </span>
          </a>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-foot">
      <div className="foot-inner">
        <div className="foot-brand">
          <div className="kicker">Мерч-портал · uzum</div>
          <p>Внутренний ресурс. Только для&nbsp;сотрудников. По&nbsp;вопросам — пишите HR-боту в&nbsp;корпоративный мессенджер или на&nbsp;<a href="#" onClick={e => e.preventDefault()}>merch@uzum.tech</a>.</p>
        </div>
        <div className="foot-cols">
          <div>
            <div className="kicker">Помощь</div>
            <ul><li>Таблица размеров</li><li>Возврат и обмен</li><li>FAQ</li></ul>
          </div>
          <div>
            <div className="kicker">Документы</div>
            <ul><li>Политика использования</li><li>Правила лимитов</li><li>Гид по бренду</li></ul>
          </div>
          <div>
            <div className="kicker">Команда</div>
            <ul><li>HR · @hrbot</li><li>Логистика · @merchbot</li><li>Бренд · @brand</li></ul>
          </div>
        </div>
      </div>
      <div className="foot-bar">
        <span>© 2026 · Внутренний&nbsp;портал · версия 2.4.1</span>
        <span>Сделано командой People&nbsp;Operations</span>
      </div>
    </footer>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
