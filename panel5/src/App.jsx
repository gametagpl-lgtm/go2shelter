function App() {
  const [route, setRoute] = React.useState("dashboard");

  let screen;
  switch (route) {
    case "dashboard":      screen = <Dashboard />; break;
    case "incidents-map":  screen = <IncidentsMap />; break;
    default:               screen = <Dashboard />;
  }

  return (
    <div className="app-shell">
      <Sidebar route={route} setRoute={setRoute} />
      <main className="main" data-screen-label={route === "incidents-map" ? "02 Mapa incydentów" : "01 Pulpit"}>
        {screen}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
