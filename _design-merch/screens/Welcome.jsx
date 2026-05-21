// screens/Welcome.jsx — Welcome-pack для новичков

function WelcomeScreen({ goTo, addToCart }) {
  const { PRODUCTS } = window.MERCH_DATA;
  const pack = PRODUCTS.find(p => p.id === 'welcome');
  const contents = ['tee-base', 'tote', 'sticker-pack', 'notebook', 'pen'].map(id => PRODUCTS.find(p => p.id === id));

  return (
    <div className="welcome">
      <header className="welcome-head">
        <button className="link-btn" onClick={() => goTo('catalog')}>← В каталог</button>
      </header>

      <section className="welcome-hero">
        <div className="welcome-copy">
          <div className="kicker">Welcome-pack · для новичков</div>
          <h1 className="display">Здравствуйте, мы&nbsp;вам кое-что собрали.</h1>
          <p className="lead">
            Каждый новый сотрудник в&nbsp;первую неделю получает стартовый набор. Его&nbsp;не&nbsp;нужно заказывать — он&nbsp;приедет в&nbsp;офис вместе с пропуском.
            Этот экран — просто чтобы знали, что ждать.
          </p>
          <div className="welcome-meta">
            <div><span className="kicker">Доставка</span><p>В первую неделю после оффера</p></div>
            <div><span className="kicker">Стоимость</span><p>0&nbsp;₽ — компания дарит</p></div>
            <div><span className="kicker">Лимит</span><p>Один на сотрудника</p></div>
          </div>
        </div>
        <div className="welcome-box">
          <UzumTilePattern size={420} dense/>
          <div className="welcome-box-tag">упаковка · крафтовая&nbsp;коробка&nbsp;A4</div>
        </div>
      </section>

      <section className="welcome-contents">
        <h2 className="section-title">Внутри коробки</h2>
        <div className="welcome-grid">
          {contents.map(p => (
            <article key={p.id} className="welcome-card" onClick={() => goTo('product', p.id)}>
              <div className="welcome-card-art">
                <ProductArt product={p} size="sm"/>
              </div>
              <div>
                <div className="kicker">{p.kind}</div>
                <h3>{p.name}</h3>
                <p>{p.desc.split('.')[0]}.</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="welcome-faq">
        <h2 className="section-title">Часто&nbsp;спрашивают</h2>
        <div className="faq-grid">
          {[
            { q: 'Можно поменять размер футболки?',
              a: 'Да. До 7 дней с момента получения — напишите в HR-бот, обменяем.' },
            { q: 'А если что-то не подошло — что делать?',
              a: 'Возврат через HR-бот, либо принесите в офис. Через 7 дней — на ваше усмотрение, обмен невозможен.' },
            { q: 'Можно второй набор для члена семьи?',
              a: 'Welcome-pack только для новых сотрудников. Но в каталоге можно собрать похожую подборку отдельно.' },
            { q: 'Что если я работаю удалённо?',
              a: 'Привезём курьером по адресу, который укажете при найме. Сроки — до 10 рабочих дней.' },
          ].map((f, i) => (
            <div key={i} className="faq-item">
              <h4>{f.q}</h4>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { WelcomeScreen });
