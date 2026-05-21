// screens/Confirm.jsx — подтверждение заявки

function ConfirmScreen({ goTo, lastOrder }) {
  if (!lastOrder) {
    return (
      <div className="confirm">
        <h1 className="display">Заявка отправлена.</h1>
        <Button onClick={() => goTo('catalog')}>В каталог</Button>
      </div>
    );
  }
  const { PRODUCTS } = window.MERCH_DATA;
  const lines = lastOrder.items.map(l => ({ ...l, product: PRODUCTS.find(p => p.id === l.id) }));

  return (
    <div className="confirm">
      <div className="confirm-card">
        <div className="confirm-mark">
          <svg viewBox="0 0 80 80" width="64" height="64" aria-hidden>
            <circle cx="40" cy="40" r="38" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".25"/>
            <path d="M24 42 L36 54 L58 28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="kicker">Заявка отправлена</div>
        <h1 className="display">Спасибо. Мы&nbsp;собираем.</h1>
        <p className="lead">
          Заявка <b>{lastOrder.id}</b> ушла в&nbsp;HR и&nbsp;логистику. Когда отправим — пришлём уведомление в корпоративный мессенджер.
        </p>

        <div className="confirm-timeline">
          {[
            { t: 'Заявка получена', d: 'сегодня', state: 'done' },
            { t: 'Согласование',    d: '1–2 рабочих дня', state: 'now' },
            { t: 'Сборка и упаковка', d: '2–3 дня', state: 'next' },
            { t: 'Доставка',        d: lastOrder.eta || '~5 дней', state: 'next' },
          ].map((s, i) => (
            <div key={i} className={`tl-step tl-${s.state}`}>
              <div className="tl-dot"/>
              <div className="tl-body">
                <div className="tl-title">{s.t}</div>
                <div className="tl-hint">{s.d}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="confirm-recap">
          <h3 className="aside-title">Что мы везём</h3>
          <ul className="check-list">
            {lines.map((l, i) => {
              const color = l.product?.colors.find(c => c.id === l.color);
              return (
                <li key={i}>
                  <div className="check-list-art" style={{ background: l.product?.bg }}>
                    {l.product && <ProductArt product={l.product} size="xs"/>}
                  </div>
                  <div className="check-list-info">
                    <b>{l.product?.name}</b>
                    <span>{color?.label} · {l.size} · {l.qty} шт.</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="confirm-recap-foot">
            <div>
              <span className="kicker">Доставка</span>
              <p>{lastOrder.delivery}</p>
            </div>
            <div>
              <span className="kicker">Ожидаемое получение</span>
              <p>{lastOrder.eta}</p>
            </div>
          </div>
        </div>

        <div className="confirm-cta">
          <Button onClick={() => goTo('orders')}>К моим заказам →</Button>
          <Button variant="ghost" onClick={() => goTo('catalog')}>Вернуться в каталог</Button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ConfirmScreen });
