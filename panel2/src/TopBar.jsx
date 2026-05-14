// TopBar — mirrors the real product (breadcrumb top, title below,
// language pill + circular avatar on the right). No prominent search.
function TopBar({ title, crumbs, systemStatus, primaryAction }) {
  return (
    <header className="top-bar">
      <div>
        {crumbs && (
          <div className="breadcrumbs">
            {crumbs.map((c, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className="sep">/</span>}
                <span className={i === crumbs.length - 1 ? "current" : ""}>{c}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <h1>{title}</h1>
      </div>
      <div className="top-actions">
        {systemStatus === "alarm" && (
          <div className="status-pill alarm">
            <span className="dot"></span>
            Alarm — Strefa 02
          </div>
        )}
        {primaryAction}
        <div className="lang-pill"><Icons.Globe />PL</div>
        <div className="user-avatar">JK</div>
      </div>
    </header>
  );
}

window.TopBar = TopBar;
