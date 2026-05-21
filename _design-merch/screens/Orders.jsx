// screens/Orders.jsx — история заказов

function OrdersScreen({ goTo, ordersList }) {
  const { MOCK_ORDERS, PRODUCTS } = window.MERCH_DATA;
  const orders = [...ordersList, ...MOCK_ORDERS];

  return (
    <div className="orders">
      <header className="orders-head">
        <div>
          <div className="kicker">Мои заказы</div>
          <h1 className="display">История&nbsp;и&nbsp;статусы</h1>
        </div>
        <Button variant="ghost" onClick={() => goTo('catalog')}>← В каталог</Button>
      </header>

      <div className="orders-list">
        {orders.map(o => (
          <article key={o.id} className="order">
            <div className="order-top">
              <div className="order-meta">
                <span className="order-id">{o.id}</span>
                <span className="order-date">Оформлен {o.placed}</span>
              </div>
              <Pill tone={o.statusTone}>{o.status}</Pill>
            </div>

            <div className="order-mid">
              <div className="order-thumbs">
                {o.items.map((it, i) => {
                  const p = PRODUCTS.find(p => p.id === it.id);
                  return (
                    <div key={i} className="order-thumb" style={{ background: p?.bg }}>
                      {p && <ProductArt product={p} size="xs"/>}
                    </div>
                  );
                })}
              </div>
              <div className="order-items">
                {o.items.map((it, i) => (
                  <div key={i} className="order-item">
                    <b>{it.name}</b>
                    <span>{it.variant} · {it.qty} шт.</span>
                  </div>
                ))}
              </div>
              <div className="order-side">
                <span className="kicker">{o.eta.startsWith('Получено') ? 'Получено' : 'Доставка'}</span>
                <p>{o.eta}</p>
                <p className="order-side-mute">{o.delivery}</p>
              </div>
            </div>

            <div className="order-foot">
              <button className="link-btn">Подробнее →</button>
              {o.statusTone === 'done' && <button className="link-btn">Заказать так&nbsp;же</button>}
              {o.statusTone === 'progress' && <button className="link-btn">Где посылка?</button>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { OrdersScreen });
