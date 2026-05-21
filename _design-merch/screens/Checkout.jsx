// screens/Checkout.jsx — оформление заявки

const { useState: useStateCheck } = React;

function CheckoutScreen({ goTo, cart, submitOrder }) {
  const { PRODUCTS, USER, OFFICES } = window.MERCH_DATA;
  const lines = cart.map(l => ({ ...l, product: PRODUCTS.find(p => p.id === l.id) }));

  const [mode, setMode]       = useStateCheck('office');   // office | pickup | home
  const [office, setOffice]   = useStateCheck(OFFICES[0].id);
  const [address, setAddress] = useStateCheck('');
  const [urgent, setUrgent]   = useStateCheck(false);
  const [note, setNote]       = useStateCheck('');

  const canSubmit = mode === 'home' ? address.trim().length > 5 : true;

  return (
    <div className="checkout">
      <header className="cart-head">
        <div>
          <div className="kicker">Шаг 2 из 2 · оформление</div>
          <h1 className="display">Куда и&nbsp;как&nbsp;доставить?</h1>
        </div>
        <button className="link-btn" onClick={() => goTo('cart')}>← Назад в заявку</button>
      </header>

      <div className="checkout-body">
        <div className="check-cols">
          <section className="check-section">
            <h2 className="aside-title">Способ получения</h2>
            <div className="ship-options">
              {[
                { id: 'office',  title: 'В мой офис',         hint: 'Привезём вместе с другими заявками этой недели', eta: '~5 рабочих дней' },
                { id: 'pickup',  title: 'Самовывоз',          hint: 'Заберёте сами с одного из складов в городе',     eta: '2–3 дня после готовности' },
                { id: 'home',    title: 'Домой курьером',     hint: 'СДЭК или Boxberry, выберет логистика',           eta: '5–10 дней' },
              ].map(o => (
                <label key={o.id} className={`ship-opt ${mode === o.id ? 'is-on' : ''}`}>
                  <input type="radio" name="ship" checked={mode === o.id} onChange={() => setMode(o.id)}/>
                  <div className="ship-opt-body">
                    <div className="ship-opt-top">
                      <span className="ship-opt-title">{o.title}</span>
                      <span className="ship-opt-eta">{o.eta}</span>
                    </div>
                    <span className="ship-opt-hint">{o.hint}</span>
                  </div>
                </label>
              ))}
            </div>

            {mode === 'office' && (
              <div className="check-field">
                <label>Ваш офис по умолчанию</label>
                <div className="check-readonly">
                  <span>{USER.office}</span>
                  <button className="link-btn">Изменить в профиле →</button>
                </div>
              </div>
            )}

            {mode === 'pickup' && (
              <div className="check-field">
                <label>Куда заберёте?</label>
                <div className="pickup-list">
                  {OFFICES.map(o => (
                    <label key={o.id} className={`pickup-opt ${office === o.id ? 'is-on' : ''}`}>
                      <input type="radio" name="pickup" checked={office === o.id} onChange={() => setOffice(o.id)}/>
                      <div>
                        <div className="pickup-lbl">{o.label}</div>
                        <div className="pickup-hint">{o.hint}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {mode === 'home' && (
              <div className="check-field">
                <label>Адрес доставки</label>
                <input
                  className="check-input"
                  placeholder="Город, улица, дом, квартира, этаж"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
                <div className="check-hint">Адрес уйдёт только в логистику, в HR его не видно.</div>
              </div>
            )}
          </section>

          <section className="check-section">
            <h2 className="aside-title">Сроки и комментарий</h2>

            <label className="check-toggle">
              <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)}/>
              <div>
                <div className="check-toggle-title">Срочно — нужно к мероприятию</div>
                <div className="check-toggle-hint">Поставим пометку «срочно» и постараемся ускорить. Не гарантия.</div>
              </div>
            </label>

            <div className="check-field">
              <label>Комментарий для HR / логистики</label>
              <textarea
                className="check-textarea"
                placeholder="Например: подарок коллеге, нужен к 1 июня"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={4}
              />
            </div>
          </section>
        </div>

        <aside className="check-summary">
          <h3 className="aside-title">В заявке</h3>
          <ul className="check-list">
            {lines.map((l, i) => {
              const color = l.product.colors.find(c => c.id === l.color);
              return (
                <li key={i}>
                  <div className="check-list-art" style={{ background: l.product.bg }}>
                    <ProductArt product={l.product} size="xs"/>
                  </div>
                  <div className="check-list-info">
                    <b>{l.product.name}</b>
                    <span>{color?.label} · {l.size} · {l.qty} шт.</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <hr/>
          <div className="sum-row"><span>Получатель</span><b>{USER.name}</b></div>
          <div className="sum-row"><span>Команда</span><b>{USER.team}</b></div>
          <div className="sum-row sum-row-big"><span>К оплате</span><b><em>0&nbsp;₽</em></b></div>

          <Button size="lg" disabled={!canSubmit} onClick={() => submitOrder({ mode, office, address, urgent, note })}>
            Отправить заявку
          </Button>
          <div className="check-legal">
            Отправляя заявку, вы соглашаетесь с&nbsp;<a href="#" onClick={e => e.preventDefault()}>политикой использования корпоративного мерча</a>.
          </div>
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { CheckoutScreen });
