// screens/Cart.jsx — корзина (заявка)

function CartScreen({ goTo, cart, updateLine, removeLine }) {
  const { PRODUCTS, USER } = window.MERCH_DATA;
  const lines = cart.map(l => ({ ...l, product: PRODUCTS.find(p => p.id === l.id) }));

  const totalUnits = lines.reduce((s, l) => s + l.qty, 0);
  const totalLarge = lines.reduce((s, l) => s + (l.product.weight >= 1 ? l.qty : 0), 0);

  if (lines.length === 0) {
    return (
      <div className="cart-empty">
        <div className="cart-empty-pattern"><UzumTilePattern size={280}/></div>
        <div className="kicker">Заявка</div>
        <h1 className="display">Пока пусто.</h1>
        <p className="lead">Положите сюда что-нибудь из каталога — потом отправите одной заявкой.</p>
        <Button onClick={() => goTo('catalog')} size="lg">Открыть каталог</Button>
      </div>
    );
  }

  return (
    <div className="cart">
      <header className="cart-head">
        <div>
          <div className="kicker">Заявка · черновик</div>
          <h1 className="display">Соберите всё в одну&nbsp;заявку</h1>
        </div>
        <button className="link-btn" onClick={() => goTo('catalog')}>← Продолжить выбор</button>
      </header>

      <div className="cart-body">
        <div className="cart-lines">
          {lines.map((l, i) => (
            <CartLine
              key={`${l.id}-${l.size}-${l.color}-${i}`}
              line={l}
              onQty={(qty) => updateLine(i, { qty })}
              onRemove={() => removeLine(i)}
            />
          ))}
        </div>

        <aside className="cart-aside">
          <div className="cart-summary">
            <h3 className="aside-title">Итого по&nbsp;заявке</h3>
            <div className="sum-row"><span>Позиций</span><b>{lines.length}</b></div>
            <div className="sum-row"><span>Всего штук</span><b>{totalUnits}</b></div>
            <div className="sum-row"><span>Из них крупных</span><b>{totalLarge}</b></div>
            <hr/>
            <div className="sum-row sum-row-big">
              <span>К оплате</span>
              <b><em>0&nbsp;₽</em></b>
            </div>
            <div className="sum-note">
              Сотрудники не платят. Заявка отправляется в HR и логистику&nbsp;на&nbsp;согласование.
            </div>
            <Button size="lg" onClick={() => goTo('checkout')}>Оформить заявку →</Button>
          </div>

          <div className="cart-limits">
            <h3 className="aside-title">Ваши лимиты</h3>
            <QuotaBar
              label="Крупные позиции"
              used={USER.quotaLargeUsed + totalLarge}
              total={USER.quotaLargeTotal}
              accent="var(--accent)"
            />
            <QuotaBar
              label="Мелкие позиции"
              used={USER.quotaSmallUsed + (totalUnits - totalLarge)}
              total={USER.quotaSmallTotal}
              accent="var(--accent-2)"
            />
            <div className="cart-limits-hint">
              После отправки заявки лимит обновится. Если превышение — HR согласует индивидуально.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CartLine({ line, onQty, onRemove }) {
  const { product } = line;
  const color = product.colors.find(c => c.id === line.color) || product.colors[0];
  return (
    <article className="cart-line">
      <div className="cart-line-art">
        <ProductArt product={product} size="sm"/>
      </div>
      <div className="cart-line-info">
        <div className="kicker">{product.kind}</div>
        <h3>{product.name}</h3>
        <div className="cart-line-variant">
          <span className="cart-variant-chip">
            <span className="card-color" style={{ background: color.swatch }}/>
            {color.label}
          </span>
          <span className="cart-variant-chip">{line.size}</span>
        </div>
      </div>
      <div className="cart-line-qty">
        <Stepper value={line.qty} onChange={onQty} min={1} max={product.weight >= 2 ? 1 : product.weight === 1 ? 2 : 5} />
        <button className="cart-line-rm" onClick={onRemove}>Убрать</button>
      </div>
    </article>
  );
}

Object.assign(window, { CartScreen, CartLine });
