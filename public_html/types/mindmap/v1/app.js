(function () {
  const STORAGE_PREFIX = "learning-tools-mindmap:";
  const NODE_WIDTH_FALLBACK = 132;
  const NODE_HEIGHT_FALLBACK = 132;
  const PALETTE = {
    zand: { label: "Zand", fill: "#e8d8bf", ink: "#3d2d1e" },
    koraal: { label: "Koraal", fill: "#ef9b87", ink: "#3a150d" },
    goud: { label: "Goud", fill: "#f0c35f", ink: "#3a2804" },
    mos: { label: "Mos", fill: "#8dc38f", ink: "#15361a" },
    hemel: { label: "Hemel", fill: "#8bc8f2", ink: "#08293d" },
    indigo: { label: "Indigo", fill: "#a9afe8", ink: "#1a1d46" },
    leisteen: { label: "Leisteen", fill: "#c4ced8", ink: "#23303b" }
  };
  const CONNECTION_STYLES = {
    lijn: "Lijn",
    pijl: "Pijl",
    stippellijn: "Stippellijn",
    veel: "Veel",
    "veel-op-veel": "Veel-op-veel"
  };

  const params = new URLSearchParams(window.location.search);
  const dataUrl = params.get("data") || "";
  const titleEl = document.getElementById("title");
  const introEl = document.getElementById("intro");
  const toolbarEl = document.getElementById("toolbar");
  const canvasEl = document.getElementById("canvas");
  const viewportEl = document.getElementById("viewport");
  const nodesEl = document.getElementById("nodes");
  const edgesEl = document.getElementById("edges");
  const legendEl = document.getElementById("legend");
  const statusEl = document.getElementById("status");
  const addNodeBtn = document.getElementById("addNodeBtn");
  const addConnectionBtn = document.getElementById("addConnectionBtn");
  const manageConnectionsBtn = document.getElementById("manageConnectionsBtn");
  const reflowBtn = document.getElementById("reflowBtn");
  const spreadInput = document.getElementById("spreadInput");
  const zoomOutBtn = document.getElementById("zoomOutBtn");
  const zoomResetBtn = document.getElementById("zoomResetBtn");
  const zoomInBtn = document.getElementById("zoomInBtn");
  const canvasAddBtn = document.getElementById("canvasAddBtn");
  const scrollExtentEl = document.getElementById("scrollExtent");

  const nodeModalEl = document.getElementById("nodeModal");
  const nodeModalTitleEl = document.getElementById("nodeModalTitle");
  const nodeFormEl = document.getElementById("nodeForm");
  const nodeLabelInput = document.getElementById("nodeLabelInput");
  const nodeColorInput = document.getElementById("nodeColorInput");
  const nodeUrlInput = document.getElementById("nodeUrlInput");
  const nodeXInput = document.getElementById("nodeXInput");
  const nodeYInput = document.getElementById("nodeYInput");
  const deleteNodeBtn = document.getElementById("deleteNodeBtn");

  const connectionModalEl = document.getElementById("connectionModal");
  const connectionModalTitleEl = document.getElementById("connectionModalTitle");
  const connectionFormEl = document.getElementById("connectionForm");
  const connectionFromInput = document.getElementById("connectionFromInput");
  const connectionToInput = document.getElementById("connectionToInput");
  const connectionStyleInput = document.getElementById("connectionStyleInput");
  const deleteConnectionBtn = document.getElementById("deleteConnectionBtn");

  let config = {
    unique_id: "",
    title: "Mindmap",
    intro: "",
    theme: "licht",
    readOnly: true,
    showGrid: true,
    centerNodeId: "",
    autoLayout: true,
    spread: 0.75,
    nodes: [],
    connections: []
  };
  let state = {
    nodes: [],
    connections: []
  };
  let derived = {
    nodes: [],
    connections: []
  };
  let ui = {
    draggingNodeId: null,
    draggingSatelliteId: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    dragMoved: false,
    suppressNodeClick: false,
    panning: false,
    panMoved: false,
    suppressCanvasClick: false,
    panStartX: 0,
    panStartY: 0,
    panOriginX: 0,
    panOriginY: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    spread: 0.75,
    selectedNodeIds: [],
    pendingNodePoint: null,
    editingNodeId: null,
    editingConnectionId: null,
    connectionMode: false
  };

  function setStatus(message, kind) {
    statusEl.textContent = message || "";
    statusEl.className = kind === "error" ? "status error" : "status";
  }

  function storageKey() {
    return `${STORAGE_PREFIX}${String(config.unique_id || "").trim()}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;");
  }

  function normalizeTheme(value) {
    return value === "donker" ? "donker" : "licht";
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function canvasRect() {
    return canvasEl.getBoundingClientRect();
  }

  function viewportPointFromClient(clientX, clientY) {
    const rect = canvasRect();
    return {
      x: (clientX - rect.left + canvasEl.scrollLeft - ui.panX) / ui.zoom,
      y: (clientY - rect.top + canvasEl.scrollTop - ui.panY) / ui.zoom
    };
  }

  function totalSatelliteCount(nodes = state.nodes) {
    return nodes.reduce((sum, node) => sum + (Array.isArray(node.satellites) ? node.satellites.length : 0), 0);
  }

  function virtualCanvasSize() {
    const nodeCount = Math.max(1, state.nodes.length);
    const satelliteCount = totalSatelliteCount();
    const complexity = nodeCount + satelliteCount * 0.8;
    const spread = Math.max(0.45, ui.spread || 0.75);
    const baseWidth = Math.max(1800, Math.round(canvasEl.clientWidth / Math.max(ui.zoom, 0.001)));
    const baseHeight = Math.max(1250, Math.round(canvasEl.clientHeight / Math.max(ui.zoom, 0.001)));
    return {
      width: Math.max(baseWidth, Math.round(900 + complexity * 210 * spread)),
      height: Math.max(baseHeight, Math.round(700 + complexity * 155 * spread))
    };
  }

  function withinCanvasX(value) {
    const { width } = virtualCanvasSize();
    return clamp(Math.round(Number(value) || 0), 60, Math.max(60, width - 60));
  }

  function withinCanvasY(value) {
    const { height } = virtualCanvasSize();
    return clamp(Math.round(Number(value) || 0), 44, Math.max(44, height - 44));
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40);
  }

  function nodeById(nodeId) {
    return state.nodes.find((node) => node.id === nodeId) || null;
  }

  function derivedNodeById(nodeId) {
    return derived.nodes.find((node) => node.id === nodeId) || null;
  }

  function normalizeUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const baseUrl = document.referrer || window.location.href;
      return new URL(raw, baseUrl).toString();
    } catch (_) {
      return "";
    }
  }

  function nodeDiameterFromLabel(label, isSatellite) {
    const text = String(label || "").trim();
    const words = text ? text.split(/\s+/) : [];
    const longest = words.reduce((max, word) => Math.max(max, word.length), 0);
    const base = isSatellite ? 84 : 118;
    const byLength = text.length * (isSatellite ? 1.25 : 1.65);
    const byWord = longest * (isSatellite ? 2.4 : 3.2);
    return clamp(Math.round(base + byLength + byWord), isSatellite ? 82 : 110, isSatellite ? 148 : 210);
  }

  function resolveNodeCollisions(nodes, width, height) {
    const arranged = nodes.map((node) => ({ ...node }));
    for (let step = 0; step < 36; step += 1) {
      let moved = false;
      for (let i = 0; i < arranged.length; i += 1) {
        for (let j = i + 1; j < arranged.length; j += 1) {
          const a = arranged[i];
          const b = arranged[j];
          const ax = a.x;
          const ay = a.y;
          const bx = b.x;
          const by = b.y;
          let dx = bx - ax;
          let dy = by - ay;
          let distance = Math.hypot(dx, dy);
          const minDistance = (a.size + b.size) / 2 + 34 * (ui.spread || 0.75);
          if (distance >= minDistance) continue;
          if (distance < 0.001) {
            dx = 1;
            dy = 0;
            distance = 1;
          }
          const overlap = (minDistance - distance) / 2;
          const nx = dx / distance;
          const ny = dy / distance;
          if (!a.isFixed) {
            a.x = clamp(a.x - nx * overlap, a.size / 2 + 40, width - a.size / 2 - 40);
            a.y = clamp(a.y - ny * overlap, a.size / 2 + 40, height - a.size / 2 - 40);
          }
          if (!b.isFixed) {
            b.x = clamp(b.x + nx * overlap, b.size / 2 + 40, width - b.size / 2 - 40);
            b.y = clamp(b.y + ny * overlap, b.size / 2 + 40, height - b.size / 2 - 40);
          }
          moved = true;
        }
      }
      if (!moved) break;
    }
    return arranged;
  }

  function buildAdjacency(nodes, connections) {
    const adjacency = new Map();
    nodes.forEach((node) => adjacency.set(node.id, new Set()));
    connections.forEach((connection) => {
      if (!adjacency.has(connection.from) || !adjacency.has(connection.to)) return;
      adjacency.get(connection.from).add(connection.to);
      adjacency.get(connection.to).add(connection.from);
    });
    return adjacency;
  }

  function pickCenterNodeId(nodes, connections, preferredId) {
    if (preferredId && nodes.some((node) => node.id === preferredId)) return preferredId;
    if (!nodes.length) return "";
    const adjacency = buildAdjacency(nodes, connections);
    let winner = nodes[0].id;
    let bestDegree = adjacency.get(winner)?.size || 0;
    nodes.forEach((node) => {
      const degree = adjacency.get(node.id)?.size || 0;
      if (degree > bestDegree) {
        winner = node.id;
        bestDegree = degree;
      }
    });
    return winner;
  }

  function radialLayout(nodes, connections, centerNodeId) {
    if (!nodes.length) return nodes;
    const centerId = pickCenterNodeId(nodes, connections, centerNodeId);
    const adjacency = buildAdjacency(nodes, connections);
    const depthMap = new Map([[centerId, 0]]);
    const queue = [centerId];
    while (queue.length) {
      const current = queue.shift();
      const depth = depthMap.get(current) || 0;
      (adjacency.get(current) || new Set()).forEach((neighborId) => {
        if (depthMap.has(neighborId)) return;
        depthMap.set(neighborId, depth + 1);
        queue.push(neighborId);
      });
    }

    const unvisited = nodes
      .map((node) => node.id)
      .filter((nodeId) => !depthMap.has(nodeId));
    let detachedDepth = Math.max(1, ...Array.from(depthMap.values())) + 1;
    unvisited.forEach((nodeId) => {
      depthMap.set(nodeId, detachedDepth);
      detachedDepth += 1;
    });

    const layers = new Map();
    nodes.forEach((node) => {
      const depth = depthMap.get(node.id) || 0;
      if (!layers.has(depth)) layers.set(depth, []);
      layers.get(depth).push(node);
    });

    const { width, height } = virtualCanvasSize();
    const centerX = Math.round(width / 2);
    const centerY = Math.round(height / 2);
    const spread = ui.spread || 0.75;
    const ringGap = Math.max(220, Math.min(width, height) * 0.2) * spread;

    const positioned = nodes.map((node) => ({ ...node }));
    positioned.forEach((node) => {
      const depth = depthMap.get(node.id) || 0;
      if (depth === 0) {
        node.x = centerX;
        node.y = centerY;
        return;
      }
      const layerNodes = (layers.get(depth) || []).slice().sort((a, b) => a.label.localeCompare(b.label, "nl"));
      const index = layerNodes.findIndex((item) => item.id === node.id);
      const count = Math.max(1, layerNodes.length);
      const baseAngle = depth % 2 === 0 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / count;
      const angle = baseAngle + (index / count) * Math.PI * 2;
      const radius = ringGap * depth + (count > 8 ? 36 * spread * (index % 2) : 0);
      node.x = withinCanvasX(centerX + Math.cos(angle) * radius);
      node.y = withinCanvasY(centerY + Math.sin(angle) * radius);
    });
    return positioned;
  }

  function connectionId(connection) {
    return `${connection.from}__${connection.to}__${connection.style}`;
  }

  function normalizeNode(node, index) {
    const fallbackLabel = `Woord ${index + 1}`;
    const rawLabel = String(node?.label || node?.woord || fallbackLabel).trim();
    const normalizedLabel = rawLabel || fallbackLabel;
    const rawId = String(node?.id || "").trim();
    return {
      id: rawId || `${slugify(normalizedLabel) || "node"}-${index + 1}`,
      label: normalizedLabel,
      linkUrl: normalizeUrl(node?.linkUrl),
      color: PALETTE[node?.color] ? node.color : "hemel",
      x: withinCanvasX(node?.x ?? 180 + index * 120),
      y: withinCanvasY(node?.y ?? 160 + index * 40),
      satellites: Array.isArray(node?.satellites)
        ? node.satellites
            .map((item) => {
              if (typeof item === "string") {
                const label = String(item || "").trim();
                return label ? { label, linkUrl: "" } : null;
              }
              if (!item || typeof item !== "object") return null;
              const label = String(item.label || "").trim();
              if (!label) return null;
              return {
                label,
                linkUrl: normalizeUrl(item.linkUrl),
                position: item.position && typeof item.position === "object"
                  ? {
                      x: withinCanvasX(item.position.x),
                      y: withinCanvasY(item.position.y)
                    }
                  : null
              };
            })
            .filter(Boolean)
            .slice(0, 12)
        : []
    };
  }

  function normalizeConnection(connection) {
    const style = CONNECTION_STYLES[connection?.style] ? connection.style : "lijn";
    return {
      from: String(connection?.from || "").trim(),
      to: String(connection?.to || "").trim(),
      style
    };
  }

  function dedupeNodes(nodes) {
    const seen = new Set();
    return nodes.filter((node, index) => {
      const key = node.id || `node-${index}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function sanitizeConnections(nodes, connections) {
    const nodeIds = new Set(nodes.map((node) => node.id));
    const seen = new Set();
    return connections
      .map(normalizeConnection)
      .filter((connection) => connection.from && connection.to && connection.from !== connection.to)
      .filter((connection) => nodeIds.has(connection.from) && nodeIds.has(connection.to))
      .filter((connection) => {
        const key = connectionId(connection);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function loadPersistedState() {
    if (config.readOnly || !config.unique_id) return null;
    try {
      const raw = window.localStorage.getItem(storageKey());
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function saveState() {
    if (config.readOnly || !config.unique_id) return;
    try {
      const payload = {
        nodes: state.nodes,
        connections: state.connections
      };
      window.localStorage.setItem(storageKey(), JSON.stringify(payload));
    } catch (_) {}
  }

  async function loadConfig() {
    const data = dataUrl
      ? await fetch(dataUrl, { cache: "no-store" }).then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
      : {};
    const raw = data && typeof data === "object" ? data : {};
    const uniqueId =
      params.get("mindmap_id") ||
      params.get("unique_id") ||
      raw.unique_id ||
      raw.mindmap_id ||
      "";
    const nodes = Array.isArray(raw.nodes) ? raw.nodes.map(normalizeNode) : [];
    const connections = Array.isArray(raw.connections) ? raw.connections : [];
    return {
      unique_id: String(uniqueId || "").trim(),
      title: String(raw.title || "Mindmap").trim() || "Mindmap",
      intro: String(raw.intro || raw.description || "").trim(),
      theme: normalizeTheme(raw.theme),
      readOnly: raw.readOnly !== false,
      showGrid: raw.showGrid !== false,
      centerNodeId: String(raw.centerNodeId || "").trim(),
      autoLayout: raw.autoLayout !== false,
      spread: clamp(Number(raw.spread ?? 0.75) || 0.75, 0.45, 1.4),
      nodes: dedupeNodes(nodes),
      connections: sanitizeConnections(nodes, connections)
    };
  }

  function bootState() {
    const persisted = loadPersistedState();
    if (persisted) {
      const nodes = dedupeNodes(Array.isArray(persisted.nodes) ? persisted.nodes.map(normalizeNode) : config.nodes);
      const connections = sanitizeConnections(nodes, Array.isArray(persisted.connections) ? persisted.connections : config.connections);
      return { nodes, connections };
    }
    return {
      nodes: config.nodes.slice(),
      connections: config.connections.slice()
    };
  }

  function applyTheme() {
    document.body.classList.toggle("theme-dark", config.theme === "donker");
  }

  function fillColorOptions() {
    nodeColorInput.innerHTML = "";
    Object.entries(PALETTE).forEach(([value, meta]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = meta.label;
      nodeColorInput.appendChild(option);
    });
  }

  function fillConnectionStyleOptions() {
    connectionStyleInput.innerHTML = "";
    Object.entries(CONNECTION_STYLES).forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      connectionStyleInput.appendChild(option);
    });
  }

  function fillNodeSelectOptions(selectedFrom, selectedTo) {
    const options = state.nodes
      .map((node) => `<option value="${escapeHtml(node.id)}">${escapeHtml(node.label)} (${escapeHtml(node.id)})</option>`)
      .join("");
    connectionFromInput.innerHTML = options;
    connectionToInput.innerHTML = options;
    if (selectedFrom) connectionFromInput.value = selectedFrom;
    if (selectedTo) connectionToInput.value = selectedTo;
  }

  function updateToolbar() {
    zoomResetBtn.textContent = `${Math.round(ui.zoom * 100)}%`;
    spreadInput.value = String(Math.round((ui.spread || 0.75) * 100));
    toolbarEl.hidden = false;
    addNodeBtn.hidden = config.readOnly;
    addConnectionBtn.hidden = config.readOnly;
    manageConnectionsBtn.hidden = config.readOnly;
    legendEl.textContent = config.readOnly
      ? `Deze mindmap staat in alleen-lezen modus. Zoom: ${Math.round(ui.zoom * 100)}%. Sleep de achtergrond om te pannen.`
      : ui.connectionMode
        ? "Klik eerst op de bron-node en daarna op de doel-node, of open 'Verbinding kiezen' voor dropdown-selectie."
        : `Klik op een lege plek om een woord toe te voegen. Klik op een node om die te wijzigen of te verwijderen. Versleep nodes om de layout aan te passen. Zoom: ${Math.round(ui.zoom * 100)}%.`;
  }

  function applyViewportTransform() {
    const { width, height } = virtualCanvasSize();
    viewportEl.style.width = `${width}px`;
    viewportEl.style.height = `${height}px`;
    edgesEl.style.width = `${width}px`;
    edgesEl.style.height = `${height}px`;
    scrollExtentEl.style.width = `${Math.max(canvasEl.clientWidth, Math.ceil(width * ui.zoom + Math.abs(ui.panX) + 240))}px`;
    scrollExtentEl.style.height = `${Math.max(canvasEl.clientHeight, Math.ceil(height * ui.zoom + Math.abs(ui.panY) + 240))}px`;
    viewportEl.style.transform = `translate(${ui.panX}px, ${ui.panY}px) scale(${ui.zoom})`;
  }

  function buildDerivedGraph() {
    const { width: canvasWidth, height: canvasHeight } = virtualCanvasSize();
    const derivedNodes = state.nodes.map((node) => ({
      ...node,
      isSatellite: false,
      parentId: null,
      size: nodeDiameterFromLabel(node.label, false),
      isFixed: node.id === ui.draggingNodeId
    }));
    const derivedConnections = state.connections.map((connection) => ({ ...connection, generated: false }));
    state.nodes.forEach((node) => {
      const items = Array.isArray(node.satellites) ? node.satellites : [];
      if (!items.length) return;
      const parentNode = derivedNodes.find((item) => item.id === node.id);
      const parentSize = parentNode?.size || NODE_WIDTH_FALLBACK;
      const spread = ui.spread || 0.75;
      const baseRadius = parentSize / 2 + (130 + items.length * 13) * spread;
      items.forEach((item, index) => {
        const size = nodeDiameterFromLabel(item.label, true);
        const angle = -Math.PI / 2 + (index / items.length) * Math.PI * 2;
        const satelliteId = `${node.id}__satellite_${index + 1}`;
        const savedPosition = item.position && typeof item.position === "object" ? item.position : null;
        const radius = baseRadius + (index % 2 === 0 ? 0 : 28 * spread);
        derivedNodes.push({
          id: satelliteId,
          label: item.label,
          linkUrl: item.linkUrl || "",
          color: node.color,
          x: withinCanvasX(savedPosition?.x ?? (node.x + Math.cos(angle) * radius)),
          y: withinCanvasY(savedPosition?.y ?? (node.y + Math.sin(angle) * radius)),
          satellites: [],
          isSatellite: true,
          parentId: node.id,
          size,
          isFixed: Boolean(savedPosition) || satelliteId === ui.draggingSatelliteId
        });
        derivedConnections.push({
          from: node.id,
          to: satelliteId,
          style: "stippellijn",
          generated: true
        });
      });
    });
    derived = {
      nodes: resolveNodeCollisions(derivedNodes, canvasWidth, canvasHeight),
      connections: derivedConnections
    };
  }

  function graphBounds() {
    if (!derived.nodes.length) {
      return {
        minX: 0,
        minY: 0,
        maxX: canvasEl.clientWidth,
        maxY: canvasEl.clientHeight
      };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    derived.nodes.forEach((node) => {
      const radius = (node.size || NODE_WIDTH_FALLBACK) / 2;
      minX = Math.min(minX, node.x - radius);
      minY = Math.min(minY, node.y - radius);
      maxX = Math.max(maxX, node.x + radius);
      maxY = Math.max(maxY, node.y + radius);
    });
    return { minX, minY, maxX, maxY };
  }

  function fitViewportToGraph() {
    buildDerivedGraph();
    const bounds = graphBounds();
    const padding = 48;
    const width = Math.max(1, bounds.maxX - bounds.minX + padding * 2);
    const height = Math.max(1, bounds.maxY - bounds.minY + padding * 2);
    const availableWidth = Math.max(240, canvasEl.clientWidth);
    const availableHeight = Math.max(240, canvasEl.clientHeight);
    const fitZoom = Math.min(1.4, Math.max(0.02, Math.min(availableWidth / width, availableHeight / height, 1)));
    ui.zoom = fitZoom;
    ui.panX = ((availableWidth - width * fitZoom) / 2) - (bounds.minX - padding) * fitZoom;
    ui.panY = ((availableHeight - height * fitZoom) / 2) - (bounds.minY - padding) * fitZoom;
    canvasEl.scrollLeft = 0;
    canvasEl.scrollTop = 0;
    buildDerivedGraph();
  }

  function edgeEndpoint(fromNode, toNode) {
    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const angle = Math.atan2(dy, dx);
    const fromRadiusX = (fromNode.size || NODE_WIDTH_FALLBACK) / 2;
    const fromRadiusY = (fromNode.size || NODE_HEIGHT_FALLBACK) / 2;
    const toRadiusX = (toNode.size || NODE_WIDTH_FALLBACK) / 2;
    const toRadiusY = (toNode.size || NODE_HEIGHT_FALLBACK) / 2;
    return {
      startX: fromNode.x + Math.cos(angle) * fromRadiusX,
      startY: fromNode.y + Math.sin(angle) * fromRadiusY,
      endX: toNode.x - Math.cos(angle) * toRadiusX,
      endY: toNode.y - Math.sin(angle) * toRadiusY,
      angle
    };
  }

  function createSvg(tag) {
    return document.createElementNS("http://www.w3.org/2000/svg", tag);
  }

  function addCrowFoot(group, x, y, angle) {
    const size = 14;
    const spread = 0.6;
    const lineA = createSvg("path");
    const lineB = createSvg("path");
    const lineC = createSvg("path");
    const ax = x - Math.cos(angle - spread) * size;
    const ay = y - Math.sin(angle - spread) * size;
    const bx = x - Math.cos(angle) * size;
    const by = y - Math.sin(angle) * size;
    const cx = x - Math.cos(angle + spread) * size;
    const cy = y - Math.sin(angle + spread) * size;
    [lineA, lineB, lineC].forEach((line) => {
      line.setAttribute("class", "edge");
      line.setAttribute("data-style", "veel");
    });
    lineA.setAttribute("d", `M ${x} ${y} L ${ax} ${ay}`);
    lineB.setAttribute("d", `M ${x} ${y} L ${bx} ${by}`);
    lineC.setAttribute("d", `M ${x} ${y} L ${cx} ${cy}`);
    group.appendChild(lineA);
    group.appendChild(lineB);
    group.appendChild(lineC);
  }

  function renderEdges() {
    const defs = edgesEl.querySelector("defs");
    edgesEl.innerHTML = "";
    if (defs) edgesEl.appendChild(defs);
    const { width, height } = virtualCanvasSize();
    edgesEl.setAttribute("viewBox", `0 0 ${Math.round(width)} ${Math.round(height)}`);

    derived.connections.forEach((connection) => {
      const fromNode = derived.nodes.find((node) => node.id === connection.from);
      const toNode = derived.nodes.find((node) => node.id === connection.to);
      if (!fromNode || !toNode) return;
      const edge = edgeEndpoint(fromNode, toNode);
      const group = createSvg("g");
      const line = createSvg("path");
      const hit = createSvg("path");
      line.setAttribute("class", "edge");
      line.setAttribute("data-style", connection.style);
      line.setAttribute("d", `M ${edge.startX} ${edge.startY} L ${edge.endX} ${edge.endY}`);
      if (connection.style === "pijl") {
        line.setAttribute("marker-end", "url(#arrow-head)");
      }
      hit.setAttribute("class", "edge-hit");
      hit.setAttribute("d", line.getAttribute("d"));
      hit.dataset.connectionId = connectionId(connection);
      group.appendChild(line);
      group.appendChild(hit);

      if (connection.style === "veel" || connection.style === "veel-op-veel") {
        addCrowFoot(group, edge.endX, edge.endY, edge.angle);
      }
      if (connection.style === "veel-op-veel") {
        addCrowFoot(group, edge.startX, edge.startY, edge.angle + Math.PI);
      }

      edgesEl.appendChild(group);
    });
  }

  function renderNodes() {
    nodesEl.innerHTML = "";
    derived.nodes.forEach((node) => {
      const palette = PALETTE[node.color] || PALETTE.hemel;
      const el = document.createElement(node.isSatellite ? "div" : "button");
      if (!node.isSatellite) el.type = "button";
      el.className = "node";
      if (node.isSatellite) el.classList.add("node--satellite");
      if (node.linkUrl) el.classList.add("node--link");
      if (config.readOnly) el.classList.add("is-readonly");
      if (ui.selectedNodeIds.includes(node.id)) el.classList.add("is-selected");
      el.dataset.nodeId = node.id;
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
      el.style.setProperty("--node-size", `${node.size || NODE_WIDTH_FALLBACK}px`);
      el.style.background = `linear-gradient(180deg, ${palette.fill}, rgba(255,255,255,0.22))`;
      el.style.color = palette.ink;
      el.innerHTML = `
        <span class="node__label">${escapeHtml(node.label)}</span>
        <span class="node__meta">${escapeHtml(node.id)}</span>
      `;
      nodesEl.appendChild(el);
    });
  }

  function render() {
    titleEl.textContent = config.title;
    introEl.textContent = config.intro || "";
    introEl.hidden = !config.intro;
    canvasEl.classList.toggle("canvas--no-grid", !config.showGrid);
    buildDerivedGraph();
    applyViewportTransform();
    renderNodes();
    renderEdges();
    fillNodeSelectOptions();
    updateToolbar();
  }

  function resetSelection() {
    ui.selectedNodeIds = [];
    ui.connectionMode = false;
    render();
  }

  function openModal(modalEl) {
    modalEl.hidden = false;
  }

  function closeModal(modalEl) {
    modalEl.hidden = true;
  }

  function openNodeModal(nodeId, point) {
    ui.editingNodeId = nodeId || null;
    ui.pendingNodePoint = point || null;
    const node = nodeId ? nodeById(nodeId) : null;
    nodeModalTitleEl.textContent = node ? "Woord wijzigen" : "Woord toevoegen";
    nodeLabelInput.value = node?.label || "";
    nodeColorInput.value = node?.color || "hemel";
    nodeUrlInput.value = node?.linkUrl || "";
    nodeXInput.value = String(node?.x ?? point?.x ?? Math.round(canvasEl.clientWidth / 2));
    nodeYInput.value = String(node?.y ?? point?.y ?? Math.round(canvasEl.clientHeight / 2));
    deleteNodeBtn.hidden = !node;
    openModal(nodeModalEl);
    window.setTimeout(() => nodeLabelInput.focus(), 10);
  }

  function openConnectionModal(connection) {
    ui.editingConnectionId = connection ? connectionId(connection) : null;
    fillNodeSelectOptions(connection?.from, connection?.to);
    connectionStyleInput.value = connection?.style || "lijn";
    deleteConnectionBtn.hidden = !connection;
    connectionModalTitleEl.textContent = connection ? "Verbinding wijzigen" : "Verbinding toevoegen";
    openModal(connectionModalEl);
  }

  function upsertNode(payload) {
    const label = String(payload.label || "").trim();
    if (!label) {
      setStatus("Een node moet een woord bevatten.", "error");
      return false;
    }
    const nodeId = ui.editingNodeId || `${slugify(label) || "node"}-${Date.now().toString(36).slice(-4)}`;
    const currentNode = state.nodes.find((node) => node.id === nodeId) || null;
    const exists = Boolean(currentNode);
    const nextNode = {
      id: nodeId,
      label,
      linkUrl: normalizeUrl(payload.url),
      color: PALETTE[payload.color] ? payload.color : "hemel",
      x: withinCanvasX(payload.x),
      y: withinCanvasY(payload.y),
      satellites: currentNode?.satellites || []
    };
    state.nodes = exists
      ? state.nodes.map((node) => (node.id === nodeId ? nextNode : node))
      : state.nodes.concat(nextNode);
    state.nodes = dedupeNodes(state.nodes);
    if (config.autoLayout && !exists) {
      state.nodes = radialLayout(state.nodes, state.connections, config.centerNodeId);
      fitViewportToGraph();
    }
    state.connections = sanitizeConnections(state.nodes, state.connections);
    saveState();
    render();
    setStatus(exists ? `Woord '${label}' bijgewerkt.` : `Woord '${label}' toegevoegd.`);
    return true;
  }

  function removeNode(nodeId) {
    const node = nodeById(nodeId);
    if (!node) return;
    state.nodes = state.nodes.filter((item) => item.id !== nodeId);
    state.connections = state.connections.filter((connection) => connection.from !== nodeId && connection.to !== nodeId);
    saveState();
    render();
    setStatus(`Woord '${node.label}' verwijderd. Bijbehorende verbindingen zijn ook verwijderd.`);
  }

  function upsertConnection(payload) {
    const from = String(payload.from || "").trim();
    const to = String(payload.to || "").trim();
    const style = CONNECTION_STYLES[payload.style] ? payload.style : "lijn";
    if (!from || !to || from === to) {
      setStatus("Kies twee verschillende woorden voor een verbinding.", "error");
      return false;
    }
    if (!nodeById(from) || !nodeById(to)) {
      setStatus("De gekozen woorden bestaan niet meer.", "error");
      return false;
    }
    const nextConnection = { from, to, style };
    const targetId = ui.editingConnectionId;
    if (targetId) {
      state.connections = state.connections.filter((connection) => connectionId(connection) !== targetId);
    }
    state.connections = sanitizeConnections(state.nodes, state.connections.concat(nextConnection));
    if (config.autoLayout) {
      state.nodes = radialLayout(state.nodes, state.connections, config.centerNodeId);
      fitViewportToGraph();
    }
    saveState();
    render();
    const fromLabel = nodeById(from)?.label || from;
    const toLabel = nodeById(to)?.label || to;
    setStatus(`Verbinding ${fromLabel} → ${toLabel} opgeslagen.`);
    return true;
  }

  function removeConnectionById(targetId) {
    state.connections = state.connections.filter((connection) => connectionId(connection) !== targetId);
    saveState();
    render();
    setStatus("Verbinding verwijderd.");
  }

  function positionFromPointer(event) {
    return {
      x: withinCanvasX(viewportPointFromClient(event.clientX, event.clientY).x),
      y: withinCanvasY(viewportPointFromClient(event.clientX, event.clientY).y)
    };
  }

  function startConnectionSelection(nodeId) {
    if (!ui.connectionMode) return;
    if (!ui.selectedNodeIds.length) {
      ui.selectedNodeIds = [nodeId];
      render();
      setStatus(`Bron gekozen: ${nodeById(nodeId)?.label || nodeId}. Klik nu op de doel-node.`);
      return;
    }
    const sourceId = ui.selectedNodeIds[0];
    if (sourceId === nodeId) {
      setStatus("Kies een andere node als doel.", "error");
      return;
    }
    ui.selectedNodeIds = [sourceId, nodeId];
    render();
    openConnectionModal({ from: sourceId, to: nodeId, style: "lijn" });
  }

  function handleNodePointerDown(event, nodeId) {
    if (config.readOnly) return;
    const derivedNode = derivedNodeById(nodeId);
    const node = nodeById(nodeId);
    if (derivedNode?.isSatellite) {
      event.stopPropagation();
      ui.draggingSatelliteId = nodeId;
      ui.dragMoved = false;
      const point = viewportPointFromClient(event.clientX, event.clientY);
      ui.dragOffsetX = point.x - derivedNode.x;
      ui.dragOffsetY = point.y - derivedNode.y;
      return;
    }
    if (!node) return;
    event.stopPropagation();
    ui.draggingNodeId = nodeId;
    ui.dragMoved = false;
    const point = viewportPointFromClient(event.clientX, event.clientY);
    ui.dragOffsetX = point.x - node.x;
    ui.dragOffsetY = point.y - node.y;
  }

  function handleCanvasPointerMove(event) {
    if (!config.readOnly && ui.draggingSatelliteId) {
      const satellite = derivedNodeById(ui.draggingSatelliteId);
      if (!satellite) return;
      const point = viewportPointFromClient(event.clientX, event.clientY);
      satellite.x = withinCanvasX(point.x - ui.dragOffsetX);
      satellite.y = withinCanvasY(point.y - ui.dragOffsetY);
      ui.dragMoved = true;
      renderDerivedOnly();
      return;
    }
    if (!config.readOnly && ui.draggingNodeId) {
      const node = nodeById(ui.draggingNodeId);
      if (!node) return;
      const point = viewportPointFromClient(event.clientX, event.clientY);
      node.x = withinCanvasX(point.x - ui.dragOffsetX);
      node.y = withinCanvasY(point.y - ui.dragOffsetY);
      ui.dragMoved = true;
      render();
      return;
    }
    if (ui.panning) {
      ui.panX = ui.panOriginX + (event.clientX - ui.panStartX);
      ui.panY = ui.panOriginY + (event.clientY - ui.panStartY);
      ui.panMoved = true;
      render();
      return;
    }
    if (!config.readOnly) {
      const rect = canvasRect();
      const insideCanvas =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!insideCanvas) {
        canvasAddBtn.hidden = true;
        return;
      }
      canvasAddBtn.hidden = false;
      canvasAddBtn.style.left = `${event.clientX - rect.left}px`;
      canvasAddBtn.style.top = `${event.clientY - rect.top}px`;
    }
  }

  function handlePointerUp() {
    if (ui.draggingSatelliteId) {
      if (ui.dragMoved) {
        persistSatellitePosition(ui.draggingSatelliteId);
        ui.suppressNodeClick = true;
        saveState();
        render();
        setStatus("Orbit-bol verplaatst.");
      }
      ui.draggingSatelliteId = null;
      ui.dragMoved = false;
    }
    if (ui.draggingNodeId) {
      ui.draggingNodeId = null;
      if (ui.dragMoved) {
        ui.suppressNodeClick = true;
        saveState();
        render();
        setStatus("Node verplaatst.");
      }
      ui.dragMoved = false;
    }
    if (ui.panning) {
      if (ui.panMoved) ui.suppressCanvasClick = true;
      ui.panning = false;
      ui.panMoved = false;
      setStatus("");
    }
  }

  function persistSatellitePosition(satelliteId) {
    const satellite = derivedNodeById(satelliteId);
    if (!satellite?.parentId) return;
    const parent = state.nodes.find((node) => node.id === satellite.parentId);
    if (!parent || !Array.isArray(parent.satellites)) return;
    const match = satelliteId.match(/__satellite_(\d+)$/);
    const satelliteIndex = match ? Number.parseInt(match[1], 10) - 1 : -1;
    if (satelliteIndex < 0 || !parent.satellites[satelliteIndex]) return;
    parent.satellites = parent.satellites.map((item, index) => {
      if (index !== satelliteIndex) return item;
      return {
        label: item.label,
        linkUrl: item.linkUrl || "",
        position: {
          x: satellite.x,
          y: satellite.y
        }
      };
    });
  }

  function renderDerivedOnly() {
    applyViewportTransform();
    renderNodes();
    renderEdges();
    updateToolbar();
  }

  function beginPan(event) {
    if (event.target.closest(".node")) return;
    if (event.target.closest(".modal")) return;
    ui.panning = true;
    ui.panStartX = event.clientX;
    ui.panStartY = event.clientY;
    ui.panOriginX = ui.panX;
    ui.panOriginY = ui.panY;
    ui.panMoved = false;
    canvasAddBtn.hidden = true;
    setStatus("Canvas verschuiven...");
  }

  function zoomAt(clientX, clientY, direction) {
    const rect = canvasRect();
    const focalX = clientX - rect.left + canvasEl.scrollLeft;
    const focalY = clientY - rect.top + canvasEl.scrollTop;
    const nextZoom = clamp(ui.zoom * direction, 0.02, 2.4);
    if (Math.abs(nextZoom - ui.zoom) < 0.001) return;
    const worldX = (focalX - ui.panX) / ui.zoom;
    const worldY = (focalY - ui.panY) / ui.zoom;
    ui.zoom = nextZoom;
    ui.panX = focalX - worldX * ui.zoom;
    ui.panY = focalY - worldY * ui.zoom;
    render();
  }

  function bindEvents() {
    addNodeBtn.addEventListener("click", () => {
      openNodeModal(null, { x: Math.round(canvasEl.clientWidth / 2), y: Math.round(canvasEl.clientHeight / 2) });
    });

    addConnectionBtn.addEventListener("click", () => {
      ui.connectionMode = true;
      ui.selectedNodeIds = [];
      render();
      setStatus("Klik op twee nodes om een verbinding te maken.");
    });

    manageConnectionsBtn.addEventListener("click", () => {
      ui.connectionMode = false;
      ui.selectedNodeIds = [];
      render();
      openConnectionModal(null);
    });

    reflowBtn.addEventListener("click", () => {
      state.nodes = radialLayout(state.nodes, state.connections, config.centerNodeId);
      fitViewportToGraph();
      saveState();
      render();
      setStatus("Mindmap opnieuw radiaal verdeeld.");
    });

    spreadInput.addEventListener("input", () => {
      ui.spread = clamp(Number(spreadInput.value) / 100, 0.45, 1.4);
      state.nodes = radialLayout(state.nodes, state.connections, config.centerNodeId);
      fitViewportToGraph();
      render();
    });

    spreadInput.addEventListener("change", () => {
      saveState();
      setStatus(`Spread ingesteld op ${Math.round(ui.spread * 100)}%.`);
    });

    zoomOutBtn.addEventListener("click", () => {
      zoomAt(canvasRect().left + canvasEl.clientWidth / 2, canvasRect().top + canvasEl.clientHeight / 2, 1 / 1.16);
    });

    zoomInBtn.addEventListener("click", () => {
      zoomAt(canvasRect().left + canvasEl.clientWidth / 2, canvasRect().top + canvasEl.clientHeight / 2, 1.16);
    });

    zoomResetBtn.addEventListener("click", () => {
      fitViewportToGraph();
      render();
      setStatus("Zoom opnieuw passend gemaakt.");
    });

    canvasEl.addEventListener("click", (event) => {
      if (config.readOnly) return;
      if (ui.suppressCanvasClick) {
        ui.suppressCanvasClick = false;
        return;
      }
      if (ui.connectionMode) return;
      if (event.target.closest(".node")) return;
      if (event.target.closest(".edge-hit")) return;
      const point = positionFromPointer(event);
      openNodeModal(null, point);
    });

    canvasEl.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      if (ui.connectionMode && !event.target.closest(".node")) return;
      if (event.target.closest(".node")) return;
      beginPan(event);
    });

    window.addEventListener("pointermove", handleCanvasPointerMove);
    canvasEl.addEventListener("pointerleave", () => {
      canvasAddBtn.hidden = true;
    });
    canvasEl.addEventListener("wheel", (event) => {
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomAt(event.clientX, event.clientY, direction);
    }, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("resize", render);

    nodesEl.addEventListener("pointerdown", (event) => {
      const button = event.target.closest(".node");
      if (!button) return;
      handleNodePointerDown(event, button.dataset.nodeId);
    });

    nodesEl.addEventListener("click", (event) => {
      const button = event.target.closest(".node");
      if (!button) return;
      const activeNode = derivedNodeById(button.dataset.nodeId);
      if (ui.suppressNodeClick) {
        ui.suppressNodeClick = false;
        return;
      }
      if (activeNode?.linkUrl && (config.readOnly || button.classList.contains("node--satellite"))) {
        window.open(activeNode.linkUrl, "_blank", "noopener,noreferrer");
        return;
      }
      if (button.classList.contains("node--satellite")) return;
      const nodeId = button.dataset.nodeId;
      if (!config.readOnly && ui.connectionMode) {
        startConnectionSelection(nodeId);
        return;
      }
      if (config.readOnly) return;
      openNodeModal(nodeId);
    });

    edgesEl.addEventListener("click", (event) => {
      const hit = event.target.closest(".edge-hit");
      if (!hit || config.readOnly) return;
      const connection = state.connections.find((item) => connectionId(item) === hit.dataset.connectionId);
      if (connection) openConnectionModal(connection);
    });

    nodeFormEl.addEventListener("submit", (event) => {
      event.preventDefault();
      const ok = upsertNode({
        label: nodeLabelInput.value,
        url: nodeUrlInput.value,
        color: nodeColorInput.value,
        x: nodeXInput.value,
        y: nodeYInput.value
      });
      if (!ok) return;
      closeModal(nodeModalEl);
      ui.editingNodeId = null;
      ui.pendingNodePoint = null;
    });

    connectionFormEl.addEventListener("submit", (event) => {
      event.preventDefault();
      const ok = upsertConnection({
        from: connectionFromInput.value,
        to: connectionToInput.value,
        style: connectionStyleInput.value
      });
      if (!ok) return;
      closeModal(connectionModalEl);
      ui.editingConnectionId = null;
      ui.connectionMode = false;
      ui.selectedNodeIds = [];
    });

    deleteNodeBtn.addEventListener("click", () => {
      if (!ui.editingNodeId) return;
      removeNode(ui.editingNodeId);
      closeModal(nodeModalEl);
      ui.editingNodeId = null;
    });

    deleteConnectionBtn.addEventListener("click", () => {
      if (!ui.editingConnectionId) return;
      removeConnectionById(ui.editingConnectionId);
      closeModal(connectionModalEl);
      ui.editingConnectionId = null;
      ui.connectionMode = false;
      ui.selectedNodeIds = [];
    });

    document.querySelectorAll("[data-close-modal]").forEach((button) => {
      button.addEventListener("click", () => {
        closeModal(nodeModalEl);
        closeModal(connectionModalEl);
        ui.editingNodeId = null;
        ui.editingConnectionId = null;
        resetSelection();
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeModal(nodeModalEl);
        closeModal(connectionModalEl);
        resetSelection();
        setStatus("");
      }
    });
  }

  async function init() {
    fillColorOptions();
    fillConnectionStyleOptions();
    try {
      config = await loadConfig();
      ui.spread = config.spread;
      applyTheme();
      state = bootState();
      if (config.autoLayout) {
        state.nodes = radialLayout(state.nodes, state.connections, config.centerNodeId);
      }
      fitViewportToGraph();
      bindEvents();
      render();
      if (!state.nodes.length) {
        setStatus("Er zijn nog geen nodes geconfigureerd.", "error");
      }
    } catch (error) {
      console.error(error);
      setStatus(`Kon mindmap-data niet laden: ${error.message}`, "error");
    }
  }

  init();
})();
