// Dashboard ("Pulpit") — mirrors the real go2shelter product layout.
// Row 1: 4 KPI cards
// Row 2: 1 KPI card + quick-actions card (3 circular buttons + dots)
// Row 3: 2 split list cards (incidents by status, news by category)
function Dashboard({ onOpenBroadcast }) {
  const [muted, setMuted] = React.useState(false);

  return (
    <div className="stack-md">
      <TopBar
        title="Pulpit"
        crumbs={["Home", "Pulpit"]}
      />

      <div className="content">
        {/* Row 1: 4 KPIs */}
        <div className="grid-4" style={{ marginBottom: 14 }}>
          <Kpi icon={<Icons.Triangle />}    value="22" label="Liczba incydentów" />
          <Kpi icon={<Icons.Bell />}        value="0"  label="Nowe incydenty (dzisiaj)" />
          <Kpi icon={<Icons.News />}        value="19" label="Newsy" />
          <Kpi icon={<Icons.Speaker />}     value="6"  label="Aktywne alerty" />
        </div>

        {/* Row 2: 1 KPI + quick-actions card (3 columns wide) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 3fr",
            gap: 14,
            marginBottom: 20,
          }}
        >
          <Kpi icon={<Icons.Users />} value="15" label="Nieprzypisane incydenty" />
          <div className="quick-actions">
            <button
              className="btn-circ"
              onClick={() => setMuted(!muted)}
              title={muted ? "Włącz dźwięk" : "Wycisz alerty"}
            >
              {muted ? <Icons.BellOff /> : <Icons.BellOff />}
            </button>
            <button
              className="btn-circ"
              onClick={onOpenBroadcast}
              title="Nadaj komunikat"
            >
              <Icons.Speaker />
            </button>
            <button className="btn-circ" title="Więcej akcji">
              <Icons.Dots />
            </button>
            <div style={{ flex: 1 }} />
          </div>
        </div>

        {/* Row 3: split list cards */}
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <SplitListCard
            title="Podział incydentów według statusu"
            rows={[
              { label: "Nowe",          count: 11 },
              { label: "Weryfikacja",   count:  1 },
              { label: "Zaakceptowane", count:  7 },
              { label: "Odrzucone",     count:  3 },
              { label: "Zamknięte",     count: 26 },
            ]}
          />
          <SplitListCard
            title="Newsy według kategorii"
            rows={[
              { label: "Zagrożenia sanitarne i zdrowotne", count:  4 },
              { label: "Bezpieczeństwo i obrona",          count: 11 },
              { label: "Społeczność i komunikaty urzędów", count:  2 },
              { label: "Pogoda i klęski żywiołowe",        count:  1 },
              { label: "Informacje techniczne",            count:  1 },
            ]}
          />
        </div>
      </div>

      <div className="fab-stack">
        <button className="fab" title="Szukaj"><Icons.Search /></button>
        <button className="fab" title="Udostępnij"><Icons.Share /></button>
        <button className="fab" title="Inne"><Icons.Dots /></button>
      </div>
    </div>
  );
}

function Kpi({ icon, value, label, tone }) {
  return (
    <div className={"kpi-card " + (tone || "")}>
      <div className="kpi-ico">{icon}</div>
      <div className="kpi-body">
        <div className="kpi-value">{value}</div>
        <div className="kpi-label">{label}</div>
      </div>
    </div>
  );
}

function SplitListCard({ title, rows }) {
  return (
    <div className="card">
      <div className="card-head">
        <div
          className="card-title"
          style={{ fontSize: 13, color: "rgb(var(--fg-2))", fontWeight: 500 }}
        >
          {title}
        </div>
        <button
          className="btn-ghost btn btn-icon"
          style={{ height: 28, width: 28, padding: 0 }}
        >
          <Icons.Dots />
        </button>
      </div>
      <div className="list">
        {rows.map((r, i) => (
          <div key={i} className="list-row">
            <span>{r.label}</span>
            <div className="row-meta">
              <span className="count-pill">{r.count}</span>
              <span className="chevron"><Icons.ChevronR /></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
