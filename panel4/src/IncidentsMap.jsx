// Real GIS data — Lubelskie voivodeship + all 213 gminy.
// Source: waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy (data from
// Polish Geoportal, Aug 2025, simplified ~5%, EPSG:4326). Properties use
// JPT_KOD_JE (TERYT — Lubelskie = "06") and JPT_NAZWA_ (name).
// We download the whole-Poland file once, filter to Lubelskie client-side,
// and cache the filtered subset (~400 KB) in localStorage.
const BOUNDARY_URL = "https://cdn.jsdelivr.net/gh/waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy@master/wojewodztwa.json";
const POWIATY_URL  = "https://cdn.jsdelivr.net/gh/waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy@master/powiaty.json";
const GMINY_URL    = "https://cdn.jsdelivr.net/gh/waszkiewiczja/GeoJSON-Polska-Wojewodztwa-Powiaty-Gminy@master/gminy.json";
const CACHE_KEY    = "g2s_lubelskie_geojson_v2";

// Zoom thresholds — three discrete tiers of administrative detail.
//   voivodeship : just the woj. outline
//   powiat      : powiat borders + labels
//   gmina       : gmina borders + labels
const ZOOM_POWIAT = 9;
const ZOOM_GMINA  = 11;
function tierForZoom(z) {
  if (z >= ZOOM_GMINA) return "gmina";
  if (z >= ZOOM_POWIAT) return "powiat";
  return "voivodeship";
}

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
// `mAgo` = minutes since the incident was reported — drives the time-range
// filter (1 h / 6 h / 12 h / 24 h / 72 h / all).
// `category` = short incident type label shown in lists/popups (was "#A-…").
// `status`   = workflow bucket for the right-side list tabs:
//              todo — "Do weryfikacji", inprog — "W trakcie weryfikacji",
//              accepted — "Zaakceptowane", rejected — "Odrzucone".
// `time` / `date` are pre-formatted for display.
const INCIDENTS = [
  { id: "#A-2847", category: "Skażenie chemiczne", gmina: "Lublin",            level: "alarm",    status: "inprog",   title: "Skażenie chemiczne — ul. Mełgiewska", time: "14:07", date: "20.05.2026", mAgo: 8,    op: "D. Nowak" },
  { id: "#A-2846", category: "Naruszenie granicy",  gmina: "Hrubieszów",        level: "critical", status: "accepted", title: "Naruszenie granicy państwa",          time: "13:42", date: "20.05.2026", mAgo: 33,   op: "System (AI)" },
  { id: "#A-2845", category: "Awaria przemysłowa",  gmina: "Puławy",            level: "warn",     status: "inprog",   title: "Awaria w zakładach azotowych",        time: "12:18", date: "20.05.2026", mAgo: 117,  op: "M. Kowalska" },
  { id: "#A-2844", category: "Powódź",              gmina: "Chełm",             level: "warn",     status: "accepted", title: "Podtopienia — rzeka Uherka",          time: "11:55", date: "20.05.2026", mAgo: 140,  op: "System (AI)" },
  { id: "#A-2843", category: "Aktywność wojskowa",  gmina: "Włodawa",           level: "watch",    status: "todo",     title: "Wzmożony ruch pojazdów wojskowych",   time: "11:12", date: "20.05.2026", mAgo: 183,  op: "J. Marek" },
  { id: "#A-2842", category: "Burza",               gmina: "Zamość",            level: "watch",    status: "todo",     title: "Burza z gradem — ostrzeżenie IMGW",   time: "10:30", date: "20.05.2026", mAgo: 225,  op: "System (AI)" },
  { id: "#A-2841", category: "Pożar",               gmina: "Tomaszów Lubelski", level: "watch",    status: "rejected", title: "Pożar lasu — Roztocze",               time: "09:14", date: "20.05.2026", mAgo: 301,  op: "K. Wójcik" },
  { id: "#A-2838", category: "Wypadek drogowy",     gmina: "Janów Lubelski",    level: "warn",     status: "accepted", title: "Wyciek paliwa — droga 19",             time: "22:14", date: "19.05.2026", mAgo: 960,  op: "P. Lis" },

  // ───── Wildfire sequence (last 72 h, east → west) ─────
  // One propagating fire front across central Lubelskie. Oldest pin = the
  // eastern origin (Mircze), newest pin = current front. All `critical`
  // per ops directive.
  { id: "#F-001", category: "Pożar", gmina: "Mircze",          level: "critical", status: "accepted", title: "Pożar lasu — źródło (strefa A1)",            time: "16:15", date: "17.05.2026", mAgo: 4200, op: "PSP Hrubieszów",  pos: [50.78, 23.90] },
  { id: "#F-002", category: "Pożar", gmina: "Białopole",       level: "critical", status: "accepted", title: "Pożar lasu — front +12 km W (strefa A2)",   time: "12:15", date: "18.05.2026", mAgo: 3000, op: "PSP Hrubieszów",  pos: [50.95, 23.55] },
  { id: "#F-003", category: "Pożar", gmina: "Krasnystaw",      level: "critical", status: "accepted", title: "Pożar lasu — linia ognia 8 km (strefa A3)",  time: "22:15", date: "18.05.2026", mAgo: 2400, op: "PSP Krasnystaw", pos: [51.05, 23.18] },
  { id: "#F-004", category: "Pożar", gmina: "Łęczna",           level: "critical", status: "inprog",   title: "Pożar lasu — ewakuacja sołectw (strefa A4)", time: "16:35", date: "19.05.2026", mAgo: 1300, op: "PSP Łęczna",     pos: [51.18, 22.78] },
  { id: "#F-005", category: "Pożar", gmina: "Niemce",          level: "critical", status: "inprog",   title: "Pożar lasu — zagrożenie Lublina (A5)",      time: "04:15", date: "20.05.2026", mAgo: 600,  op: "PSP Lublin",     pos: [51.22, 22.40] },
  { id: "#F-006", category: "Pożar", gmina: "Opole Lubelskie", level: "critical", status: "todo",     title: "Pożar lasu — ewakuacja Poniatowej (A6)",    time: "10:55", date: "20.05.2026", mAgo: 200,  op: "PSP Opole Lub.", pos: [51.14, 22.00] },
];

// Workflow buckets for the right-side incidents list.
const STATUSES = [
  { id: "todo",     label: "Do weryfikacji" },
  { id: "inprog",   label: "W trakcie" },
  { id: "accepted", label: "Zaakceptowane" },
  { id: "rejected", label: "Odrzucone" },
];

// Time-range options for the filter strip below the map.
const RANGES = [
  { id: "1h",  label: "1 h",     minutes: 60 },
  { id: "6h",  label: "6 h",     minutes: 360 },
  { id: "12h", label: "12 h",    minutes: 720 },
  { id: "24h", label: "24 h",    minutes: 1440 },
  { id: "72h", label: "72 h",    minutes: 4320 },
  { id: "all", label: "Wszystko", minutes: Infinity },
];

const THREAT_COLOR = {
  calm:     "rgb(102, 153, 153)",
  watch:    "rgb(225, 169, 0)",
  warn:     "rgb(232, 130, 45)",
  alarm:    "rgb(225, 77, 77)",
  critical: "rgb(163, 35, 35)",
};
const THREAT_LABEL = {
  calm: "Spokój", watch: "Obserwacja", warn: "Ostrzeżenie", alarm: "Alarm", critical: "Krytyczne",
};

// SVG path snippets per incident category — used inside L.divIcon for pins.
// All paths are designed in a 24×24 viewBox, 1.8 stroke, no fill except where noted.
const CATEGORY_ICON = {
  "Pożar":             '<path d="M12 3c1 3 4 4 4 8a4 4 0 11-8 0c0-2 1-3 1.5-4 .5 2 1.5 2 1.5 2 0-2-1-4 1-6z" fill="currentColor" stroke="none"/><path d="M9 17a3 3 0 006 0"/>',
  "Powódź":            '<path d="M12 3l5 8a5 5 0 11-10 0l5-8z" fill="currentColor" stroke="none"/><path d="M4 18c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1"/>',
  "Burza":              '<path d="M13 2L5 14h5l-1 8 9-12h-5l1-8z" fill="currentColor" stroke="none"/>',
  "Skażenie chemiczne": '<path d="M9 3h6"/><path d="M10 3v5l-5 9a3 3 0 002.6 4.5h8.8A3 3 0 0019 17l-5-9V3"/><circle cx="11" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="14" cy="17" r="1" fill="currentColor" stroke="none"/>',
  "Naruszenie granicy": '<path d="M4 4l16 16M4 20L20 4"/><path d="M3 12h18" stroke-dasharray="3 2"/>',
  "Awaria przemysłowa": '<path d="M3 21V11l5 3V11l5 3V7l8 6v8H3z"/><path d="M7 21v-3M11 21v-3M15 21v-3M19 21v-3"/>',
  "Aktywność wojskowa": '<circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  "Wypadek drogowy":    '<path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5"/><circle cx="12" cy="18" r="1.1" fill="currentColor" stroke="none"/>',
};

function categoryIcon(category) {
  return CATEGORY_ICON[category] || '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>';
}

// Pull a usable display name out of any of the property keys polska-geojson
// has used historically (works for woj/powiat/gmina features alike).
function featureName(feature) {
  const p = feature.properties || {};
  const raw = p.nazwa || p.name || p.NAZWA || p.NAME || p.JPT_NAZWA_ || p.gmina || "";
  // strip "gmina " / "powiat " / "miasto " prefixes for display
  return String(raw).replace(/^(gmina|powiat|miasto|m\.)\s+/i, "");
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

// ───── Random per-gmina incident generator ─────
// Seeded random so reloads give the same data (gmina name = seed).
const RANDOM_CATEGORIES = [
  "Pożar", "Powódź", "Burza", "Skażenie chemiczne",
  "Naruszenie granicy", "Awaria przemysłowa", "Aktywność wojskowa",
  "Wypadek drogowy",
];
const RANDOM_LEVELS   = ["watch", "watch", "warn", "warn", "alarm", "critical"];
const RANDOM_STATUSES = ["todo", "todo", "inprog", "inprog", "accepted", "accepted", "accepted", "rejected"];
const RANDOM_OPS = [
  "System (AI)", "D. Nowak", "M. Kowalska", "J. Marek", "K. Wójcik",
  "P. Lis", "L. Czarnecka", "A. Zając", "S. Jankowski", "T. Mazur",
];
function _hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function _mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// “Now” for synthetic timestamps — matches the curated incidents above.
const _NOW = new Date(2026, 4, 20, 14, 15);
function _fmtTime(mAgo) {
  const t = new Date(_NOW.getTime() - mAgo * 60 * 1000);
  const pad = n => String(n).padStart(2, "0");
  return {
    date: `${pad(t.getDate())}.${pad(t.getMonth() + 1)}.${t.getFullYear()}`,
    time: `${pad(t.getHours())}:${pad(t.getMinutes())}`,
  };
}
function _titleFor(category, gmina) {
  switch (category) {
    case "Pożar":              return `Pożar — gmina ${gmina}`;
    case "Powódź":             return `Podtopienia — gmina ${gmina}`;
    case "Burza":              return `Ostrzeżenie meteo — gmina ${gmina}`;
    case "Skażenie chemiczne": return `Sygnał o skażeniu — gmina ${gmina}`;
    case "Naruszenie granicy": return `Naruszenie granicy — ${gmina}`;
    case "Awaria przemysłowa": return `Awaria techniczna — gmina ${gmina}`;
    case "Aktywność wojskowa": return `Wzmożony ruch wojskowy — ${gmina}`;
    case "Wypadek drogowy":    return `Wypadek drogowy — gmina ${gmina}`;
    default: return `Zdarzenie — gmina ${gmina}`;
  }
}
function generateGminaIncidents(features) {
  if (!features) return [];
  const out = [];
  features.forEach((f, idx) => {
    const name = featureName(f);
    const c = featureCentroid(f);
    if (!c || !name) return;
    const rand = _mulberry32(_hash("g2s|" + name));
    const pick = arr => arr[Math.floor(rand() * arr.length)];
    const category = pick(RANDOM_CATEGORIES);
    const level    = pick(RANDOM_LEVELS);
    const status   = pick(RANDOM_STATUSES);
    const op       = pick(RANDOM_OPS);
    const mAgo     = Math.floor(rand() * 4320); // last 72 h
    const { date, time } = _fmtTime(mAgo);
    out.push({
      id: `#G-${String(idx).padStart(3, "0")}`,
      category, gmina: name, pos: c,
      level, status,
      title: _titleFor(category, name),
      time, date, mAgo, op,
      _generated: true,
    });
  });
  return out;
}

function IncidentsMap() {
  const mapEl = React.useRef(null);
  const mapRef = React.useRef(null);
  const layersRef = React.useRef({
    gminy: null, gminyLabels: null,
    powiaty: null, powiatyLabels: null,
    boundary: null, incidents: null,
  });
  const [selected, setSelected] = React.useState(INCIDENTS[0]);
  const [filter, setFilter] = React.useState("all");
  const [range, setRange] = React.useState("24h");
  const [zoom, setZoom] = React.useState(8);
  const [listOpen, setListOpen] = React.useState(true);
  const [statusTab, setStatusTab] = React.useState("todo");
  // Manual tier override — clicking the “Widok” pill cycles voivodeship
  // → powiat → gmina without changing the map zoom. Cleared as soon as
  // the user zooms (so the natural zoom→tier mapping resumes).
  const [tierOverride, setTierOverride] = React.useState(null);
  const [geo, setGeo] = React.useState({ loading: true, boundary: null, powiaty: null, gminy: null, error: null });
  const tier = tierOverride || tierForZoom(zoom);
  const cycleTier = () => {
    const order = ["voivodeship", "powiat", "gmina"];
    const i = order.indexOf(tier);
    setTierOverride(order[(i + 1) % order.length]);
  };

  // Fetch GIS data once. We try localStorage first (filtered subset ~400 KB),
  // then fall back to fetching the whole-Poland file + filtering client-side.
  React.useEffect(() => {
    let cancelled = false;

    // Try cache first
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        if (data && data.boundary && data.powiaty && data.gminy) {
          setGeo({ loading: false, boundary: data.boundary, powiaty: data.powiaty, gminy: data.gminy, error: null });
          return;
        }
      }
    } catch (e) { /* no cache */ }

    Promise.all([
      fetch(BOUNDARY_URL).then(r => { if (!r.ok) throw new Error("boundary " + r.status); return r.json(); }),
      fetch(POWIATY_URL).then(r => { if (!r.ok) throw new Error("powiaty " + r.status); return r.json(); }),
      fetch(GMINY_URL).then(r => { if (!r.ok) throw new Error("gminy " + r.status); return r.json(); }),
    ])
      .then(([woj, powiaty, gminy]) => {
        if (cancelled) return;
        const boundary = {
          type: "FeatureCollection",
          features: woj.features.filter(f => f.properties.JPT_KOD_JE === "06"),
        };
        const powiatyFiltered = {
          type: "FeatureCollection",
          features: powiaty.features.filter(f => (f.properties.JPT_KOD_JE || "").startsWith("06")),
        };
        const gminyFiltered = {
          type: "FeatureCollection",
          features: gminy.features.filter(f => (f.properties.JPT_KOD_JE || "").startsWith("06")),
        };
        setGeo({ loading: false, boundary, powiaty: powiatyFiltered, gminy: gminyFiltered, error: null });
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ boundary, powiaty: powiatyFiltered, gminy: gminyFiltered }));
        } catch (e) { /* quota — non-fatal */ }
      })
      .catch((err) => {
        console.warn("Map data load failed:", err);
        if (!cancelled) setGeo({ loading: false, boundary: null, powiaty: null, gminy: null, error: String(err) });
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

    map.on("zoomend", () => {
      setZoom(map.getZoom());
      setTierOverride(null);
    });
  }, []);

  // Render boundary + powiat + gmina layers once data is loaded.
  // Each tier is built once and shown/hidden by a separate effect that
  // listens to zoom changes.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || geo.loading) return;

    // Clean up any previous run (route revisits)
    Object.values(layersRef.current).forEach(l => l && map.removeLayer(l));
    layersRef.current = {
      gminy: null, gminyLabels: null,
      powiaty: null, powiatyLabels: null,
      boundary: null, incidents: null,
    };

    // ----- GMINY: thin borders + persistent labels (shown at gmina tier) -----
    // Polygons are purely visual — no click, no hover styling, no tooltip.
    // Click is reserved for incident pins.
    if (geo.gminy) {
      const gminyLayer = L.geoJSON(geo.gminy, {
        interactive: false,
        style: {
          color: "rgb(180, 195, 220)",
          weight: 1.2,
          opacity: 0.9,
          fillColor: "rgb(6, 182, 212)",
          fillOpacity: 0.05,
        },
      });
      layersRef.current.gminy = gminyLayer;

      const gminyLabels = L.layerGroup();
      geo.gminy.features.forEach((f) => {
        const c = featureCentroid(f);
        if (!c) return;
        const name = featureName(f);
        gminyLabels.addLayer(L.marker(c, {
          icon: L.divIcon({ className: "gmina-label", html: `<span>${name}</span>`, iconSize: null }),
          interactive: false, keyboard: false,
        }));
      });
      layersRef.current.gminyLabels = gminyLabels;
    }

    // ----- POWIATY: heavier borders + uppercase labels (shown at powiat tier) -----
    // Same as gminy — visual only.
    if (geo.powiaty) {
      const powiatyLayer = L.geoJSON(geo.powiaty, {
        interactive: false,
        style: {
          color: "rgb(155, 130, 240)",
          weight: 2,
          opacity: 0.9,
          fillColor: "rgb(120, 67, 233)",
          fillOpacity: 0.07,
        },
      });
      layersRef.current.powiaty = powiatyLayer;

      const powiatyLabels = L.layerGroup();
      geo.powiaty.features.forEach((f) => {
        const c = featureCentroid(f);
        if (!c) return;
        const name = featureName(f);
        powiatyLabels.addLayer(L.marker(c, {
          icon: L.divIcon({ className: "powiat-label", html: `<span>${name}</span>`, iconSize: null }),
          interactive: false, keyboard: false,
        }));
      });
      layersRef.current.powiatyLabels = powiatyLabels;
    }

    // ----- VOIVODESHIP boundary: always visible, heavy cyan outline on top -----
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

  // Show/hide the right tier whenever zoom OR override changes.
  // Borders follow `tier` (which may be overridden by clicking the View pill).
  // Labels follow ONLY the natural zoom — so manually switching tiers via
  // the pill shows just the borders, and labels reveal themselves once the
  // user zooms in to the matching level.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const { gminy, gminyLabels, powiaty, powiatyLabels, boundary } = layersRef.current;
    const t = tier;
    const natural = tierForZoom(zoom);
    const labelsAllowed = natural === t;

    const setOn = (layer, on) => {
      if (!layer) return;
      const has = map.hasLayer(layer);
      if (on && !has) layer.addTo(map);
      else if (!on && has) map.removeLayer(layer);
    };

    setOn(powiaty,       t === "powiat");
    setOn(powiatyLabels, t === "powiat" && labelsAllowed);
    setOn(gminy,         t === "gmina");
    setOn(gminyLabels,   t === "gmina"  && labelsAllowed);

    // Keep the voivodeship outline on top across all tiers
    if (boundary && map.hasLayer(boundary)) boundary.bringToFront();
  }, [tier, zoom, geo]);

  // Auto-generate one synthetic incident per gmina from the loaded GeoJSON.
  // Declared BEFORE the marker-rendering effect so the deps array can
  // reference `allIncidents` safely (no temporal dead zone).
  const generatedIncidents = React.useMemo(
    () => generateGminaIncidents(geo.gminy && geo.gminy.features),
    [geo.gminy]
  );
  const allIncidents = React.useMemo(
    () => INCIDENTS.concat(generatedIncidents),
    [generatedIncidents]
  );
  const rangeMinutes = (RANGES.find(r => r.id === range) || {}).minutes ?? Infinity;

  // Render / update incident markers when filter changes (or after data loads)
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layersRef.current.incidents) map.removeLayer(layersRef.current.incidents);
    const layer = L.layerGroup().addTo(map);
    layersRef.current.incidents = layer;

    const list = allIncidents
      .filter(i => i.mAgo <= rangeMinutes)
      .filter(i => filter === "all" || i.level === filter)
      .filter(i => i.status === statusTab);
    list.forEach((inc) => {
      const pos = inc.pos || GMINY_INDEX[inc.gmina];
      if (!pos) return;
      const color = THREAT_COLOR[inc.level];
      const pulse = inc.level === "alarm" || inc.level === "critical";

      // Outer halo — still a circleMarker so it scales with the map's CRS.
      // Lower base fillOpacity so the pulse reads more subtle.
      L.circleMarker(pos, {
        radius: 20, weight: 0, fillColor: color, fillOpacity: 0.10,
        className: "incident-halo pulse" + (pulse ? " strong" : ""),
      }).addTo(layer);

      // Pin itself — a div icon so we can render a category SVG inside.
      // --pin-color drives the pulse ring (keyframe in CSS) so it matches
      // the threat level color.
      const iconHtml = `
        <div class="incident-pin-inner" style="background:${color};--pin-color:${color}">
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            ${categoryIcon(inc.category)}
          </svg>
        </div>`;
      const marker = L.marker(pos, {
        icon: L.divIcon({
          className: "incident-pin",
          html: iconHtml,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -14],
          tooltipAnchor: [0, -14],
        }),
        keyboard: false,
        riseOnHover: true,
      }).addTo(layer);

      const cardHtml = `
        <div class="g2s-popup">
          <div class="g2s-popup-head" style="border-left-color:${color}">
            <div class="g2s-popup-id">${inc.category}</div>
            <div class="g2s-popup-level" style="color:${color}">${THREAT_LABEL[inc.level].toUpperCase()}</div>
          </div>
          <div class="g2s-popup-title">${inc.title}</div>
          <div class="g2s-popup-meta">${inc.gmina} · ${inc.date} ${inc.time} · ${inc.op}</div>
        </div>`;

      // Hover hint
      marker.bindTooltip(cardHtml, {
        className: "g2s-incident-tooltip",
        direction: "top",
        offset: [0, -6],
        opacity: 1,
      });
      // Click hint (same content)
      marker.bindPopup(cardHtml, { closeButton: false, offset: [0, -4] });
      marker.on("click", () => setSelected(inc));
    });
  }, [filter, range, statusTab, allIncidents, geo]);

  // Apply time-range filter first, then level filter on top of that.
  // The map shows everything matching the range + level + status filters
  // (so toggling a tab also filters the pins). The right-side list
  // applies an additional status tab filter for its own view.
  const byRange = allIncidents.filter(i => i.mAgo <= rangeMinutes);
  const visibleIncidents = filter === "all" ? byRange : byRange.filter(i => i.level === filter);
  const listIncidents = visibleIncidents.filter(i => i.status === statusTab);
  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s.id] = visibleIncidents.filter(i => i.status === s.id).length;
    return acc;
  }, {});

  const levels = [
    { id: "all",      label: "Wszystkie", count: byRange.length, color: "rgb(148, 163, 184)" },
    { id: "critical", label: THREAT_LABEL.critical, count: byRange.filter(i=>i.level==="critical").length, color: THREAT_COLOR.critical },
    { id: "alarm",    label: THREAT_LABEL.alarm,    count: byRange.filter(i=>i.level==="alarm").length,    color: THREAT_COLOR.alarm },
    { id: "warn",     label: THREAT_LABEL.warn,     count: byRange.filter(i=>i.level==="warn").length,     color: THREAT_COLOR.warn },
    { id: "watch",    label: THREAT_LABEL.watch,    count: byRange.filter(i=>i.level==="watch").length,    color: THREAT_COLOR.watch },
  ];

  // Density-aware label visibility — show labels only when zoomed in
  const labelClass = "map-stage zoom-" + zoom;

  // Sentence-case label for the meta tile + legend hints
  const TIER_LABEL = { voivodeship: "Województwo", powiat: "Powiat", gmina: "Gmina" };

  return (
    <div className="stack-md">
      <TopBar
        title="Mapa incydentów"
        crumbs={["Home", "Mapa incydentów"]}
        titleMeta={
          <>
            <span className="page-title-tag">
              <span className="tag-eyebrow">Województwo</span>
              <span className="tag-value">Lubelskie</span>
            </span>
            <button
              type="button"
              className="page-title-tag tier-tag tier-tag-button"
              onClick={cycleTier}
              title="Kliknij, aby przełączyć widok"
            >
              <span className="tag-eyebrow">Widok</span>
              <span className="tag-value">{TIER_LABEL[tier]}</span>
              <svg className="tier-tag-cycle" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 8a5 5 0 018-4l1.5 1.5" />
                <path d="M13 3v3h-3" />
                <path d="M13 8a5 5 0 01-8 4L3.5 10.5" />
                <path d="M3 13v-3h3" />
              </svg>
            </button>
          </>
        }
      />

      <div className="content">
        <div className="map-wrap">
        {/* Filters strip — threat level + time range, above the map */}
        <div className="map-filters">
          <div className="map-filter-group">
            <div className="map-filter-head">
              <div className="map-overlay-eyebrow">Poziom zagrożenia</div>
              <div className="map-filter-hint">
                {tier === "voivodeship" && "Przybliż, aby zobaczyć powiaty i gminy."}
                {tier === "powiat"      && "Powiaty województwa lubelskiego. Przybliż, aby zobaczyć gminy."}
                {tier === "gmina"       && "Gminy z granicami. Oddal, aby wrócić do powiatów."}
              </div>
            </div>
            <div className="filter-row">
              {levels.map(l => (
                <button
                  key={l.id}
                  className={"filter-chip " + (filter === l.id ? "active" : "")}
                  onClick={() => setFilter(l.id)}
                >
                  <span className="filter-chip-dot" style={{ background: l.color }}></span>
                  <span className="filter-chip-label">{l.label}</span>
                  <span className="filter-chip-count">{l.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="map-filter-divider" aria-hidden="true"></div>

          <div className="map-filter-group">
            <div className="map-filter-head">
              <div className="map-overlay-eyebrow">Przedział czasowy</div>
              <div className="map-filter-hint">
                Pokazuje incydenty zgłoszone w wybranym przedziale.
              </div>
            </div>
            <div className="filter-row">
              {RANGES.map(r => (
                <button
                  key={r.id}
                  className={"filter-chip range " + (range === r.id ? "active" : "")}
                  onClick={() => setRange(r.id)}
                >
                  <span className="filter-chip-label">{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={labelClass} data-tier={tier}>
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

          {/* Top-right meta moved below the map — see .map-meta block after .map-stage */}

          {/* Threat-level legend + time range filters moved below the map */}

          {/* Right-side incidents list */}
          <div className={"map-overlay map-list" + (listOpen ? "" : " is-collapsed")}>
            <div className="map-list-head">
              <div className="map-overlay-eyebrow">
                Aktywne incydenty <span className="map-list-count">· {listIncidents.length}</span>
              </div>
              <button
                className="map-list-toggle"
                onClick={() => setListOpen(false)}
                aria-label="Ukryj panel incydentów"
                title="Ukryj panel"
              >
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M7 5l6 5-6 5" />
                </svg>
              </button>
            </div>
            <div className="map-list-tabs" role="tablist">
              {STATUSES.map(s => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={statusTab === s.id}
                  className={"map-list-tab st-" + s.id + (statusTab === s.id ? " active" : "")}
                  onClick={() => setStatusTab(s.id)}
                  title={s.id === "inprog" ? "W trakcie weryfikacji" : s.label}
                >
                  <span className="map-list-tab-label">{s.label}</span>
                  <span className="map-list-tab-count">{statusCounts[s.id]}</span>
                </button>
              ))}
            </div>
            <div className="map-list-scroll">
              {listIncidents.length === 0 && (
                <div className="map-list-empty">
                  Brak incydentów w tej kategorii.
                </div>
              )}
              {listIncidents.map((inc) => (
                <button
                  key={inc.id}
                  className={"map-list-row " + (selected.id === inc.id ? "active" : "")}
                  onClick={() => {
                    setSelected(inc);
                    const pos = inc.pos || GMINY_INDEX[inc.gmina];
                    if (pos && mapRef.current) {
                      mapRef.current.flyTo(pos, 11, { duration: 0.6 });
                    }
                  }}
                >
                  <span className="map-list-dot" style={{ background: THREAT_COLOR[inc.level] }}></span>
                  <div className="map-list-body">
                    <div className="map-list-title">{inc.title}</div>
                    <div className="map-list-meta">
                      <span className="map-list-cat">{inc.category}</span>
                      <span>·</span>
                      <span>{inc.gmina}</span>
                      <span>·</span>
                      <span className="mono">{inc.date} {inc.time}</span>
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

          {/* Floating reopen button — only shown when panel is collapsed */}
          <button
            className={"map-list-open" + (listOpen ? "" : " is-visible")}
            onClick={() => setListOpen(true)}
            aria-label="Pokaż panel incydentów"
            title="Pokaż panel incydentów"
          >
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M13 5l-6 5 6 5" />
            </svg>
            <span>Incydenty</span>
            <span className="map-list-open-pill">{listIncidents.length}</span>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

window.IncidentsMap = IncidentsMap;
