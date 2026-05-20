// Sidebar — mirrors the real go2shelter product structure (Polish labels)
function Sidebar({ route, setRoute, alertCount }) {
  // Structure modelled on the actual product screenshot:
  // - "System" and "Administracja" are expandable groups (here, collapsed)
  // - Then a long flat list of operational tools
  const items = [
    { id: "system",      label: "System",                icon: <Icons.Cog />,      group: true },
    { id: "admin",       label: "Administracja",         icon: <Icons.Users />,    group: true },
    { id: "drones-radar",label: "Radar dronów",          icon: <Icons.Signal /> },
    { id: "news",        label: "Aktualności",           icon: <Icons.News /> },
    { id: "unassigned",  label: "Nieprzypisane incydenty",icon: <Icons.AlertCircle /> },
    { id: "dashboard",   label: "Incydenty",             icon: <Icons.Triangle /> },
    { id: "incidents-map",label: "Mapa incydentów",      icon: <Icons.Map /> },
    { id: "courses",     label: "Kursy",                 icon: <Icons.Book /> },
    { id: "markers",     label: "Znaczniki",             icon: <Icons.MapPin /> },
    { id: "markers-map", label: "Mapa znaczników",       icon: <Icons.Map /> },
    { id: "drones",      label: "Zarządzanie dronami",   icon: <Icons.Drone /> },
    { id: "monitoring",  label: "Monitoring gminy",      icon: <Icons.Eye /> },
    { id: "resources",   label: "Zasoby",                icon: <Icons.Shelter />,  group: true },
  ];

  return (
    <aside className="sidebar">
      <div className="demo-tag">Panel Wojewody</div>
      <div className="sidebar-logo">
        <img src="assets/logo-go2shelter.png" alt="go2shelter" />
      </div>

      <div className="nav-group">
        {items.map(it => (
          <button key={it.id}
                  className={"nav-item " + (route === it.id ? "active" : "") + (it.group ? " has-children" : "")}
                  onClick={() => setRoute(it.id)}>
            <span className="ico">{it.icon}</span>
            <span className="label">{it.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

window.Sidebar = Sidebar;
