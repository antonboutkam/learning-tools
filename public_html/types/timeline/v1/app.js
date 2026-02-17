const params = new URLSearchParams(window.location.search);
const dataUrl = params.get("data");
let uniqueId = params.get("unique_id");

const titleEl = document.getElementById("title");
const subtitleEl = document.getElementById("subtitle");
const introEl = document.getElementById("intro");
const statusEl = document.getElementById("status");
const timelineEl = document.getElementById("timeline");
const surfaceEl = timelineEl.querySelector(".timeline__surface");
const ticksEl = document.getElementById("ticks");
const eventsEl = document.getElementById("events");

let currentData = null;
let raf = null;

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = isError ? "status error" : "status";
}

function safeText(value) {
  return typeof value === "string" ? value : "";
}

function parseDate(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatRange(start, end) {
  try {
    const fmt = new Intl.DateTimeFormat("nl-NL", { year: "numeric", month: "short", day: "2-digit" });
    return `${fmt.format(start)} – ${fmt.format(end)}`;
  } catch {
    return `${start.toISOString()} – ${end.toISOString()}`;
  }
}

function formatEventMeta(date, scale) {
  try {
    const opts =
      scale === "uur"
        ? { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }
        : scale === "dag"
          ? { year: "numeric", month: "short", day: "2-digit" }
          : scale === "maand"
            ? { year: "numeric", month: "long" }
            : yearStepForScale(scale) > 0
	              ? { year: "numeric" }
	              : { year: "numeric", month: "short" };
    return new Intl.DateTimeFormat("nl-NL", opts).format(date);
  } catch {
    return date.toISOString();
  }
}

function quarterLabel(date) {
  const q = Math.floor(date.getMonth() / 3) + 1;
  return `Q${q} ${date.getFullYear()}`;
}

function decadeLabel(date) {
  const start = Math.floor(date.getFullYear() / 10) * 10;
  return `${start}s`;
}

function yearStepForScale(scale) {
  if (scale === "jaar") return 1;
  if (scale === "2 jaar") return 2;
  if (scale === "3 jaar") return 3;
  if (scale === "4 jaar") return 4;
  if (scale === "5 jaar") return 5;
  if (scale === "decennium") return 10;
  return 0;
}

function addUnit(date, scale, n) {
  const d = new Date(date.getTime());
  if (scale === "uur") d.setHours(d.getHours() + n);
  else if (scale === "dag") d.setDate(d.getDate() + n);
  else if (scale === "maand") d.setMonth(d.getMonth() + n);
  else if (scale === "kwartaal") d.setMonth(d.getMonth() + 3 * n);
  else {
    const yearStep = yearStepForScale(scale);
    if (yearStep > 0) d.setFullYear(d.getFullYear() + yearStep * n);
  }
  return d;
}

function tickLabel(date, scale) {
  if (scale === "kwartaal") return quarterLabel(date);
  if (scale === "decennium") return decadeLabel(date);
  try {
    const opts =
      scale === "uur"
        ? { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }
        : scale === "dag"
          ? { day: "2-digit", month: "short" }
	        : scale === "maand"
	            ? { month: "short", year: "numeric" }
	            : { year: "numeric" };
    return new Intl.DateTimeFormat("nl-NL", opts).format(date);
  } catch {
    return date.toISOString();
  }
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeDirection(value) {
  return value === "boven-naar-beneden" ? "vertical" : "horizontal";
}

function sideForEvent(direction, placement, idx) {
  if (direction === "horizontal") {
    if (placement === "boven") return "top";
    if (placement === "onder") return "bottom";
    return idx % 2 === 0 ? "top" : "bottom";
  }
  if (placement === "links") return "left";
  if (placement === "rechts") return "right";
  return idx % 2 === 0 ? "left" : "right";
}

function resolveUrl(value, baseUrl) {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function buildTickEl(t, label) {
  const el = document.createElement("div");
  el.className = "tick";
  el.dataset.t = String(t);
  el.innerHTML = `<div class="tick__line"></div><div class="tick__label"></div>`;
  el.querySelector(".tick__label").textContent = label;
  return el;
}

function buildEventEl(event, { direction, scale, baseUrl, idx }) {
  const el = document.createElement("div");
  el.className = "event";
  el.dataset.side = sideForEvent(direction, event.placement, idx);
  el.setAttribute("role", "listitem");

  const linkUrl = resolveUrl(event.linkUrl, baseUrl);
  const bubble = document.createElement(linkUrl ? "a" : "div");
  bubble.className = linkUrl ? "bubble bubble--link" : "bubble";
  if (linkUrl) {
    bubble.href = linkUrl;
    bubble.target = "_blank";
    bubble.rel = "noopener noreferrer";
  }

  const meta = document.createElement("div");
  meta.className = "bubble__meta";
  meta.textContent = formatEventMeta(event.dateObj, scale);

  const title = document.createElement("div");
  title.className = "bubble__title";
  title.textContent = safeText(event.title);

  const subtitleText = safeText(event.subtitle);
  const subtitle = subtitleText ? document.createElement("div") : null;
  if (subtitle) {
    subtitle.className = "bubble__subtitle";
    subtitle.textContent = subtitleText;
  }

  const desc = document.createElement("p");
  desc.className = "bubble__desc";
  desc.textContent = safeText(event.description);

  bubble.appendChild(meta);
  bubble.appendChild(title);
  if (subtitle) bubble.appendChild(subtitle);
  bubble.appendChild(desc);

  const imgUrl = resolveUrl(event.imageUrl, baseUrl);
  if (imgUrl) {
    const media = document.createElement("div");
    media.className = "bubble__media";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = "";
    img.src = imgUrl;
    img.addEventListener("load", layout);
    img.addEventListener("error", layout);
    media.appendChild(img);
    bubble.appendChild(media);
  }

  el.appendChild(bubble);
  return el;
}

function assignLanes(events, getPosPx, getSizePx, gapPx) {
  const lanes = [];
  const out = new Map();
  events.forEach((ev) => {
    const pos = getPosPx(ev);
    const size = getSizePx(ev);
    const start = pos - size / 2;
    const end = pos + size / 2;
    let laneIndex = -1;
    for (let i = 0; i < lanes.length; i += 1) {
      if (start > lanes[i] + gapPx) {
        laneIndex = i;
        lanes[i] = end;
        break;
      }
    }
    if (laneIndex === -1) {
      laneIndex = lanes.length;
      lanes.push(end);
    }
    out.set(ev, laneIndex);
  });
  return out;
}

function layout() {
  if (!currentData) return;
  if (raf) cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    raf = null;
    const direction = normalizeDirection(currentData.direction);
    const viewportMinHeightPxRaw = currentData?.viewport?.minHeightPx;
    const viewportMinHeightPx =
      Number.isFinite(viewportMinHeightPxRaw) && viewportMinHeightPxRaw > 0 ? Math.trunc(viewportMinHeightPxRaw) : 0;
    const viewportMinWidthPxRaw = currentData?.viewport?.minWidthPx;
    const viewportMinWidthPx =
      Number.isFinite(viewportMinWidthPxRaw) && viewportMinWidthPxRaw > 0 ? Math.trunc(viewportMinWidthPxRaw) : 0;

    if (surfaceEl) {
      surfaceEl.style.minWidth = viewportMinWidthPx ? `${viewportMinWidthPx}px` : "";
    }
    timelineEl.classList.toggle("timeline--scroll", Boolean(viewportMinWidthPx));

    const baseMinHeight = Math.max(direction === "vertical" ? 560 : 420, viewportMinHeightPx);
    const css = getComputedStyle(timelineEl);
    const currentMin = Number.parseFloat(css.getPropertyValue("min-height")) || 0;
    if (baseMinHeight && baseMinHeight > currentMin + 1) {
      timelineEl.style.minHeight = `${baseMinHeight}px`;
    }

    const surfaceRect = (surfaceEl || timelineEl).getBoundingClientRect();
    const width = Math.max(1, surfaceRect.width);
    const height = Math.max(1, surfaceRect.height);
    const pad = 12;
    const alongSize = direction === "horizontal" ? width : height;

    const alongAt = (t) => pad + clamp(t, 0, 1) * Math.max(1, alongSize - pad * 2);

    const eventNodes = Array.from(eventsEl.querySelectorAll(".event"));
    const events = eventNodes.map((node) => ({
      node,
      bubble: node.querySelector(".bubble"),
      side: node.dataset.side,
      t: Number.parseFloat(node.dataset.t || "0") || 0,
    }));

    const bySide = new Map();
    events.forEach((ev) => {
      if (!bySide.has(ev.side)) bySide.set(ev.side, []);
      bySide.get(ev.side).push(ev);
    });

    const lanesByEvent = new Map();
    for (const [side, list] of bySide.entries()) {
      list.sort((a, b) => alongAt(a.t) - alongAt(b.t));
      const laneMap = assignLanes(
        list,
        (ev) => alongAt(ev.t),
        (ev) => {
          const r = ev.bubble?.getBoundingClientRect?.();
          if (!r) return 200;
          return direction === "horizontal" ? r.width : r.height;
        },
        14
      );
      laneMap.forEach((lane, ev) => lanesByEvent.set(ev, lane));
    }

    const laneGap = Number.parseFloat(css.getPropertyValue("--lane-gap")) || 86;
    const bubbleGap = Number.parseFloat(css.getPropertyValue("--bubble-gap")) || 22;
    const safePad = Number.parseFloat(css.getPropertyValue("--safe-pad")) || 12;

    if (direction === "horizontal" && events.length) {
      let maxExtent = 0;
      events.forEach((ev) => {
        const lane = lanesByEvent.get(ev) ?? 0;
        const bubbleRect = ev.bubble?.getBoundingClientRect?.();
        const bubbleH = bubbleRect?.height || 160;
        const stem = bubbleGap + lane * laneGap;
        maxExtent = Math.max(maxExtent, stem + bubbleH + safePad);
      });
      const wanted = Math.max(baseMinHeight, Math.ceil(maxExtent * 2));
      if (Math.abs(wanted - currentMin) > 2) {
        timelineEl.style.minHeight = `${wanted}px`;
        layout();
        return;
      }
    }

    events.forEach((ev) => {
      const lane = lanesByEvent.get(ev) ?? 0;
      ev.node.style.setProperty("--lane", lane);
      const bubbleRect = ev.bubble?.getBoundingClientRect?.();

      if (direction === "horizontal") {
        const bubbleW = bubbleRect?.width || 320;
        const x = clamp(alongAt(ev.t), pad, width - pad);
        ev.node.style.left = `${x}px`;
        ev.node.style.top = `${height / 2}px`;

        const bubbleLeft = x - bubbleW / 2;
        const bubbleRight = x + bubbleW / 2;
        let shiftX = 0;
        if (bubbleLeft < pad) shiftX = pad - bubbleLeft;
        else if (bubbleRight > width - pad) shiftX = (width - pad) - bubbleRight;
        ev.node.style.setProperty("--bubble-shift-x", `${shiftX}px`);
      } else {
        const bubbleH = bubbleRect?.height || 160;
        const y = clamp(alongAt(ev.t), pad, height - pad);
        ev.node.style.top = `${y}px`;
        ev.node.style.left = `${width / 2}px`;

        const bubbleTop = y - bubbleH / 2;
        const bubbleBottom = y + bubbleH / 2;
        let shiftY = 0;
        if (bubbleTop < pad) shiftY = pad - bubbleTop;
        else if (bubbleBottom > height - pad) shiftY = (height - pad) - bubbleBottom;
        ev.node.style.setProperty("--bubble-shift-y", `${shiftY}px`);
      }
    });

    if (direction === "vertical") {
      timelineEl.style.minHeight = `${baseMinHeight}px`;
    }

    const tickNodes = Array.from(ticksEl.querySelectorAll(".tick"));
    tickNodes.forEach((node) => {
      const t = Number.parseFloat(node.dataset.t || "0") || 0;
      if (direction === "horizontal") {
        node.style.left = `${alongAt(t)}px`;
        node.style.top = `${height / 2}px`;
      } else {
        node.style.top = `${alongAt(t)}px`;
        node.style.left = `${width / 2}px`;
      }
    });
  });
}

function render(data, baseUrl) {
  currentData = data;

  const start = parseDate(data.startDate);
  const end = parseDate(data.endDate);
  if (!start || !end) {
    setStatus("Startdatum/einddatum ontbreken of zijn ongeldig.", true);
    return;
  }
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (!(endMs > startMs)) {
    setStatus("Einddatum moet na startdatum liggen.", true);
    return;
  }

  const direction = normalizeDirection(data.direction);
  timelineEl.classList.toggle("timeline--horizontal", direction === "horizontal");
  timelineEl.classList.toggle("timeline--vertical", direction === "vertical");

  titleEl.textContent = safeText(data.title) || "Timeline";
  subtitleEl.textContent = `${formatRange(start, end)} · schaal: ${safeText(data.scale) || "jaar"}`;

  if (typeof data.intro === "string" && data.intro.trim() !== "") {
    introEl.hidden = false;
    introEl.textContent = data.intro;
  } else {
    introEl.hidden = true;
    introEl.textContent = "";
  }

  const rawEvents = Array.isArray(data.events) ? data.events : [];
  const events = rawEvents
    .map((ev, idx) => {
      const dateObj = parseDate(ev?.date);
      if (!dateObj) return null;
      return {
        idx,
        dateObj,
        dateMs: dateObj.getTime(),
        title: safeText(ev?.title),
        subtitle: safeText(ev?.subtitle),
        description: safeText(ev?.description),
        placement: safeText(ev?.placement),
        imageUrl: safeText(ev?.imageUrl),
        linkUrl: safeText(ev?.linkUrl),
      };
    })
    .filter(Boolean);

  ticksEl.innerHTML = "";
  eventsEl.innerHTML = "";

  // Ticks
  const maxTicks = 48;
  const ticks = [];
  let cur = new Date(startMs);
  for (let i = 0; i < 5000; i += 1) {
    if (cur.getTime() > endMs) break;
    ticks.push(new Date(cur.getTime()));
    const next = addUnit(cur, safeText(data.scale) || "jaar", 1);
    if (next.getTime() === cur.getTime()) break;
    cur = next;
  }
  let step = 1;
  if (ticks.length > maxTicks) step = Math.ceil(ticks.length / maxTicks);
  for (let i = 0; i < ticks.length; i += step) {
    const t = ticks[i].getTime();
    const ratio = clamp((t - startMs) / (endMs - startMs), 0, 1);
    const el = buildTickEl(ratio, tickLabel(ticks[i], safeText(data.scale) || "jaar"));
    ticksEl.appendChild(el);
  }

  // Events
  events.sort((a, b) => a.dateMs - b.dateMs);
  events.forEach((ev, idx) => {
    const t = clamp((ev.dateMs - startMs) / (endMs - startMs), 0, 1);
    const node = buildEventEl(ev, { direction, scale: safeText(data.scale) || "jaar", baseUrl, idx });
    node.dataset.t = String(t);
    eventsEl.appendChild(node);
  });

  setStatus(events.length ? "" : "Geen momenten gevonden op de tijdlijn.");
  layout();
}

async function init() {
  if (!dataUrl) {
    setStatus("Geen data-URL opgegeven. Gebruik ?data=URL-naar-json", true);
    subtitleEl.textContent = "Data ontbreekt";
    return;
  }

  try {
    const res = await fetch(dataUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!uniqueId && typeof data?.unique_id === "string" && data.unique_id.trim() !== "") {
      uniqueId = data.unique_id.trim();
    }
    if (!uniqueId) {
      setStatus("unique_id is verplicht. Gebruik ?unique_id=...&data=URL-naar-json (of zet unique_id in de JSON).", true);
      subtitleEl.textContent = "Context ontbreekt";
      return;
    }
    render(data, new URL(dataUrl, window.location.href).toString());
  } catch (err) {
    console.error(err);
    setStatus("Kan data niet laden. Controleer de data-URL.", true);
    subtitleEl.textContent = "Fout";
  }
}

window.addEventListener("resize", () => {
  if (!currentData) return;
  layout();
});

init();
