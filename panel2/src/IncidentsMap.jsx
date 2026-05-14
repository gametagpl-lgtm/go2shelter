// Real GIS data — Lubelskie voivodeship + all 213 gminy.
// Source: waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy (data from
// Polish Geoportal, Aug 2025, simplified ~5%, EPSG:4326). Properties use
// JPT_KOD_JE (TERYT — Lubelskie = "06") and JPT_NAZWA_ (name).
// We download the whole-Poland file once, filter to Lubelskie client-side,
// and cache the filtered subset (~400 KB) in localStorage.
const BOUNDARY_URL = "https://cdn.jsdelivr.net/gh/waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy@master/wojewodztwa.json";
const GMINY_URL    = "https://cdn.jsdelivr.net/gh/waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy@master/gminy.json";
const CACHE_KEY    = "g2s_lubelskie_geojson_v1";

// ~30 gminy across Lubelskie — used for placing the incident markers
// (looked up by name). Polygons + labels come from the GeoJSON above.
const GMINY_INDEX = {
  "Lublin":             [51.2465, 22.5684],
  "Chełm":              [51.1432, 23.4716],
  "Zamość":             [50.7233, 23.2517],
  "Biała Podlaska":     [52.0325, 23.1149],
  "Puławy":             [51.4170, 21.9685],
  "Świdnik":            [51.2196, 22.6963],
  "Łuków":              [51.9296, 22.3826],
  "Lubartów":           [51.4604, 22.6071],
  "Kraśnik":            [50.9239, 22.2287],
  "Tomaszów Lubelski":  [50.4474, 23.4170],
  "Hrubieszów":         [50.8054, 23.8910],
  "Włodawa":            [51.5476, 23.5519],
  "Krasnystaw":         [50.9836, 23.1737],
  "Janów Lubelski":     [50.7038, 22.4145],
  "Łęczna":             [51.3015, 22.8843],
  "Parczew":            [51.6404, 22.9087],
  "Radzyń Podlaski":    [51.7836, 22.6175],
  "Międzyrzec Podlaski":[51.9870, 22.7826],
  "Bełżyce":            [51.1771, 22.2858],
  "Opole Lubelskie":    [51.1473, 21.9728],
  "Biłgoraj":           [50.5414, 22.7220],
};

// Active incidents at specific gminy with threat level + brief title.
const INCIDENTS = [
  { id: "#A-2847", gmina: "Lublin",            level: "alarm",    title: "Skażenie chemiczne — ul. Mełgiewska", time: "14:07", op: "D. Nowak" },
  { id: "#A-2846", gmina: "Hrubieszów",        level: "critical", title: "Naruszenie granicy państwa",          time: "13:42", op: "System (AI)" },
  { id: "#A-2845", gmina: "Puławy",            level: "warn",     title: "Awaria w zakładach azotowych",        time: "12:18", op: "M. Kowalska" },
  { id: "#A-2844", gmina: "Chełm",             level: "warn",     title: "Podtopienia — rzeka Uherka",          time: "11:55", op: "System (AI)" },
  { id: "#A-2843", gmina: "Włodawa",           level: "watch",    title: "Wzmożony ruch pojazdów wojskowych",   time: "11:12", op: "J. Marek" },
  { id: "#A-2842", gmina: "Zamość",            level: "watch",    title: "Burza z gradem — ostrzeżenie IMGW",   time: "10:30", op: "System (AI)" },
  { id: "#A-2841", gmina: "Tomaszów Lubelski", level: "watch",    title: "Pożar lasu — Roztocze",               time: "09:14", op: "K. Wójcik" },
  { id: "#A-2840", gmina: "Biała Podlaska",    level: "calm",     title: "Ćwiczenia obrony cywilnej",            time: "08:00", op: "L. Czarnecka" },
  { id: "#A-2839", gmina: "Kraśnik",           level: "calm",     title: "Test syren — sektor 03",              time: "07:30", op: "System (AI)" },
  { id: "#A-2838", gmina: "Janów Lubelski",    level: "warn",     title: "Wyciek paliwa — droga 19",             time: "Wczoraj 22:14", op: "P. Lis" },
  { id: "#A-2837", gmina: "Międzyrzec Podlaski", level: "calm",   title: "Komunikat informacyjny",              time: "Wczoraj 18:00", op: "System (AI)" },
];

const THREAT_COLOR = {
  calm:     "rgb(102, 153, 153)",
  watch:    "rgb(225, 169, 0)",
  warn:     "rgb(232, 130, 45)",
  alarm:    "rgb(225, 77, 77)",
  critical: "rgb(163, 35, 35)",
};
const THREAT_LABEL = {
  calm: "Calm", watch: "Watch", warn: "Warning", alarm: "Alarm", critical: "Critical",
};

// Pull a usable gmina display name out of any of the property keys
// polska-geojson has used historically.
function gminaName(feature) {
  const p = feature.properties || {};
  const raw = p.nazwa || p.name || p.NAZWA || p.NAME || p.JPT_NAZWA_ || p.gmina || "";
  // strip "gmina " / "miasto " prefixes for display
  return String(raw).replace(/^(gmina|miasto|m\.)\s+/i, "");
}

// Centroid of the largest polygon ring — used for label placement.
function featureCentroid(feature) {
  const g = feature.geometry;
  if (!g) return null;
  let ring;
  if (g.type === "Polygon") ring = g.coordinates[0];
  else if (g.type === "MultiPolygon") {
    ring = g.coordinates.reduce((a, b) => (a[0].length > b[0].length ? a : b))[0];
  } else return null;
  let lat = 0, lng = 0;
  ring.forEach(([x, y]) => { lng += x; lat += y; });
  return [lat / ring.length, lng / ring.length];
}

function IncidentsMap() {
  const mapEl = React.useRef(null);
  const mapRef = React.useRef(null);
  const layersRef = React.useRef({ gminy: null, labels: null, boundary: null, incidents: null });
  const [selected, setSelected] = React.useState(INCIDENTS[0]);
  const [filter, setFilter] = React.useState("all");
  const [zoom, setZoom] = React.useState(8);
  const [geo, setGeo] = React.useState({ loading: true, boundary: null, gminy: null, error: null });

  // Fetch GIS data once. We try localStorage first (filtered subset ~400 KB),
  // then fall back to fetching the whole-Poland file + filtering client-side.
  React.useEffect(() => {
    let cancelled = false;

    // Try cache first
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        if (data && data.boundary && data.gminy) {
          setGeo({ loading: false, boundary: data.boundary, gminy: data.gminy, error: null });
          return;
        }
      }
    } catch (e) { /* no cache */ }

    Promise.all([
      fetch(BOUNDARY_URL).then(r => { if (!r.ok) throw new Error("boundary " + r.status); return r.json(); }),
      fetch(GMINY_URL).then(r => { if (!r.ok) throw new Error("gminy " + r.status); return r.json(); }),
    ])
      .then(([woj, gminy]) => {
        if (cancelled) return;
        const boundary = {
          type: "FeatureCollection",
          features: woj.features.filter(f => f.properties.JPT_KOD_JE === "06"),
        };
        const gminyFiltered = {
          type: "FeatureCollection",
          features: gminy.features.filter(f => (f.properties.JPT_KOD_JE || "").startsWith("06")),
        };
        setGeo({ loading: false, boundary, gminy: gminyFiltered, error: null });
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ boundary, gminy: gminyFiltered }));
        } catch (e) { /* quota — non-fatal */ }
      })
      .catch((err) => {
        console.warn("Map data load failed:", err);
        if (!cancelled) setGeo({ loading: false, boundary: null, gminy: null, error: String(err) });
      });
    return () => { cancelled = true; };
  }, []);

  // Initialize the map (once)
  React.useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(mapEl.current, {
      center: [51.30, 22.85],
      zoom: 8,
      minZoom: 7,
      maxZoom: 13,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);

    map.on("zoomend", () => setZoom(map.getZoom()));
  }, []);

  // Render gmina polygons + voivodeship boundary once data is loaded
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || geo.loading) return;

    // Clean up any previous run (route revisits)
    Object.values(layersRef.current).forEach(l => l && map.removeLayer(l));

    // Gmina polygons — subtle dark fill, thin border, hover emphasis
    if (geo.gminy) {
      const gminyLayer = L.geoJSON(geo.gminy, {
        style: {
          color: "rgb(60, 70, 90)",
          weight: 0.8,
          fillColor: "rgb(6, 182, 212)",
          fillOpacity: 0.04,
        },
        onEachFeature: (feature, layer) => {
          const name = gminaName(feature);
          layer.bindTooltip(name, { sticky: true, className: "g2s-tooltip", direction: "top" });
          layer.on("mouseover", () => layer.setStyle({ fillOpacity: 0.20, weight: 1.5, color: "rgb(6, 182, 212)" }));
          layer.on("mouseout",  () => gminyLayer.resetStyle(layer));
        },
      }).addTo(map);
      layersRef.current.gminy = gminyLayer;

      // Persistent labels at higher zoom
      const labelGroup = L.layerGroup();
      geo.gminy.features.forEach((f) => {
        const c = featureCentroid(f);
        if (!c) return;
        const name = gminaName(f);
        const lbl = L.marker(c, {
          icon: L.divIcon({
            className: "gmina-label",
            html: `<span>${name}</span>`,
            iconSize: null,
          }),
          interactive: false,
          keyboard: false,
        });
        labelGroup.addLayer(lbl);
      });
      labelGroup.addTo(map);
      layersRef.current.labels = labelGroup;
    }

    // Voivodeship boundary — heavy cyan outline on top
    if (geo.boundary) {
      const boundaryLayer = L.geoJSON(geo.boundary, {
        style: { color: "rgb(6, 182, 212)", weight: 2.5, opacity: 0.95, fill: false },
        interactive: false,
      }).addTo(map);
      layersRef.current.boundary = boundaryLayer;
      try {
        map.fitBounds(boundaryLayer.getBounds(), { padding: [20, 20] });
      } catch (e) { /* no-op */ }
    }
  }, [geo]);

  // Render / update incident markers when filter changes (or after data loads)
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layersRef.current.incidents) map.removeLayer(layersRef.current.incidents);
    const layer = L.layerGroup().addTo(map);
    layersRef.current.incidents = layer;

    const list = filter === "all" ? INCIDENTS : INCIDENTS.filter((i) => i.level === filter);
    list.forEach((inc) => {
      const pos = GMINY_INDEX[inc.gmina];
      if (!pos) return;
      const color = THREAT_COLOR[inc.level];
      const pulse = inc.level === "alarm" || inc.level === "critical";

      L.circleMarker(pos, {
        radius: 16, weight: 0, fillColor: color, fillOpacity: 0.18,
        className: pulse ? "incident-halo pulse" : "incident-halo",
      }).addTo(layer);

      const marker = L.circleMarker(pos, {
        radius: 7, color: "#0A0C16", weight: 2, fillColor: color, fillOpacity: 1,
      }).addTo(layer);

      marker.bindPopup(
        `<div class="g2s-popup">
           <div class="g2s-popup-head" style="border-left-color:${color}">
             <div class="g2s-popup-id">${inc.id}</div>
             <div class="g2s-popup-level" style="color:${color}">${THREAT_LABEL[inc.level].toUpperCase()}</div>
           </div>
           <div class="g2s-popup-title">${inc.title}</div>
           <div class="g2s-popup-meta">${inc.gmina} · ${inc.time} · ${inc.op}</div>
         </div>`,
        { closeButton: false, offset: [0, -4] }
      );
      marker.on("click", () => setSelected(inc));
    });
  }, [filter, geo]);

  const levels = [
    { id: "all",      label: "Wszystkie", count: INCIDENTS.length, color: "rgb(148, 163, 184)" },
    { id: "critical", label: THREAT_LABEL.critical, count: INCIDENTS.filter(i=>i.level==="critical").length, color: THREAT_COLOR.critical },
    { id: "alarm",    label: THREAT_LABEL.alarm,    count: INCIDENTS.filter(i=>i.level==="alarm").length,    color: THREAT_COLOR.alarm },
    { id: "warn",     label: THREAT_LABEL.warn,     count: INCIDENTS.filter(i=>i.level==="warn").length,     color: THREAT_COLOR.warn },
    { id: "watch",    label: THREAT_LABEL.watch,    count: INCIDENTS.filter(i=>i.level==="watch").length,    color: THREAT_COLOR.watch },
    { id: "calm",     label: THREAT_LABEL.calm,     count: INCIDENTS.filter(i=>i.level==="calm").length,     color: THREAT_COLOR.calm },
  ];

  const visibleIncidents = filter === "all" ? INCIDENTS : INCIDENTS.filter(i => i.level === filter);

  // Density-aware label visibility — show labels only when zoomed in
  const labelClass = "map-stage zoom-" + zoom;

  return (
    <div className="stack-md">
      <TopBar title="Mapa incydentów" crumbs={["Home", "Mapa incydentów"]} />

      <div className="content">
        <div className={labelClass}>
          <div ref={mapEl} className="leaflet-map" />

          {geo.loading && (
            <div className="map-overlay map-loading">
              <span className="map-spinner"></span>
              <div>
                <div>Pobieranie granic gmin…</div>
                <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                  Źródło: Geoportal · pierwszy ładunek może potrwać kilka sekund
                </div>
              </div>
            </div>
          )}
          {geo.error && (
            <div className="map-overlay map-error">
              Nie udało się załadować danych GIS.
              <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>{geo.error}</div>
            </div>
          )}

          {/* Top-left legend / filter */}
          <div className="map-overlay map-legend">
            <div className="map-overlay-eyebrow">Poziom zagrożenia</div>
            <div className="legend-rows">
              {levels.map(l => (
                <button
                  key={l.id}
                  className={"legend-row " + (filter === l.id ? "active" : "")}
                  onClick={() => setFilter(l.id)}
                >
                  <span className="legend-dot" style={{ background: l.color }}></span>
                  <span className="legend-label">{l.label}</span>
                  <span className="legend-count">{l.count}</span>
                </button>
              ))}
            </div>
            <div className="legend-hint">
              Zbliż mapę (≥ 10), aby zobaczyć nazwy gmin.
            </div>
          </div>

          {/* Top-right meta */}
          <div className="map-overlay map-meta">
            <div className="map-overlay-eyebrow">Województwo Lubelskie</div>
            <div className="map-meta-grid">
              <div>
                <div className="map-meta-value">{geo.gminy ? geo.gminy.features.length : 213}</div>
                <div className="map-meta-label">gmin</div>
              </div>
              <div>
                <div className="map-meta-value">{INCIDENTS.length}</div>
                <div className="map-meta-label">incydentów</div>
              </div>
              <div>
                <div className="map-meta-value" style={{ color: "rgb(225, 77, 77)" }}>
                  {INCIDENTS.filter(i => i.level === "alarm" || i.level === "critical").length}
                </div>
                <div className="map-meta-label">krytycznych</div>
              </div>
            </div>
          </div>

          {/* Bottom incident list */}
          <div className="map-overlay map-list">
            <div className="map-overlay-eyebrow" style={{ padding: "12px 14px 6px" }}>
              Aktywne incydenty <span style={{ color: "rgb(var(--fg-4))", marginLeft: 6 }}>· {visibleIncidents.length}</span>
            </div>
            <div className="map-list-scroll">
              {visibleIncidents.map((inc) => (
                <button
                  key={inc.id}
                  className={"map-list-row " + (selected.id === inc.id ? "active" : "")}
                  onClick={() => {
                    setSelected(inc);
                    const pos = GMINY_INDEX[inc.gmina];
                    if (pos && mapRef.current) {
                      mapRef.current.flyTo(pos, 10, { duration: 0.6 });
                    }
                  }}
                >
                  <span className="map-list-dot" style={{ background: THREAT_COLOR[inc.level] }}></span>
                  <div className="map-list-body">
                    <div className="map-list-title">{inc.title}</div>
                    <div className="map-list-meta">
                      <span className="mono">{inc.id}</span>
                      <span>·</span>
                      <span>{inc.gmina}</span>
                      <span>·</span>
                      <span>{inc.time}</span>
                    </div>
                  </div>
                  <span className={"badge t-" + inc.level} style={{
                    background: THREAT_COLOR[inc.level],
                    color: inc.level === "watch" ? "#2a1f00" : "#fff",
                  }}>
                    {THREAT_LABEL[inc.level]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

window.IncidentsMap = IncidentsMap;
