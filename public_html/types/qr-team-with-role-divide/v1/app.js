const appEl = document.getElementById("app");
const params = new URLSearchParams(window.location.search);

const state = {
  mode: params.get("mode") === "mobile" ? "mobile" : "screen",
  dataUrl: params.get("data"),
  uniqueId: params.get("unique_id"),
  sessionCode: params.get("session"),
  participantId: null,
  config: null,
  session: null,
  joinUrl: "",
  joinName: "",
  localStartPressed: false,
  lastError: "",
  pollingHandle: null,
  renderHandle: null,
  busy: {
    join: false,
    assignTeams: false,
    startTeacher: false,
    saveConsent: false,
    shake: false,
    upload: false,
    mobileReady: false,
  },
};

const POLL_MS = 2000;
const RENDER_MS = 500;
const TEAM_THEMES = {
  yellow: {
    key: "yellow",
    label: "Geel",
    baseTop: "#fff8cf",
    baseBottom: "#f6e8ad",
    glow: "rgba(246, 196, 66, 0.28)",
    accent: "#c79600",
    accentDark: "#7f5a00",
    soft: "rgba(246, 196, 66, 0.14)",
    line: "rgba(199, 150, 0, 0.24)",
  },
  green: {
    key: "green",
    label: "Groen",
    baseTop: "#ddf5df",
    baseBottom: "#c3e9c7",
    glow: "rgba(63, 169, 96, 0.26)",
    accent: "#2f8f46",
    accentDark: "#1f5c2d",
    soft: "rgba(63, 169, 96, 0.14)",
    line: "rgba(47, 143, 70, 0.24)",
  },
  purple: {
    key: "purple",
    label: "Paars",
    baseTop: "#ece2ff",
    baseBottom: "#d8c3ff",
    glow: "rgba(130, 92, 226, 0.28)",
    accent: "#7b57d1",
    accentDark: "#4d338f",
    soft: "rgba(123, 87, 209, 0.14)",
    line: "rgba(123, 87, 209, 0.24)",
  },
  orange: {
    key: "orange",
    label: "Oranje",
    baseTop: "#ffe7cf",
    baseBottom: "#ffd2aa",
    glow: "rgba(239, 139, 58, 0.28)",
    accent: "#d86d1b",
    accentDark: "#8f4309",
    soft: "rgba(239, 139, 58, 0.14)",
    line: "rgba(216, 109, 27, 0.24)",
  },
  pink: {
    key: "pink",
    label: "Roze",
    baseTop: "#ffe1ef",
    baseBottom: "#ffc8de",
    glow: "rgba(232, 91, 156, 0.26)",
    accent: "#cf4d8b",
    accentDark: "#8e2f5f",
    soft: "rgba(207, 77, 139, 0.14)",
    line: "rgba(207, 77, 139, 0.24)",
  },
  blue: {
    key: "blue",
    label: "Blauw",
    baseTop: "#dff1ff",
    baseBottom: "#c7defb",
    glow: "rgba(64, 133, 255, 0.26)",
    accent: "#2b78d0",
    accentDark: "#184c87",
    soft: "rgba(43, 120, 208, 0.14)",
    line: "rgba(43, 120, 208, 0.24)",
  },
  red: {
    key: "red",
    label: "Rood",
    baseTop: "#ffe0dc",
    baseBottom: "#ffc9c1",
    glow: "rgba(216, 81, 81, 0.28)",
    accent: "#c54848",
    accentDark: "#832b2b",
    soft: "rgba(197, 72, 72, 0.14)",
    line: "rgba(197, 72, 72, 0.24)",
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function storageKeyParticipant(sessionCode) {
  return `learning-tools:qr-role-divide:${sessionCode}:participant-id`;
}

function storageKeyName(sessionCode) {
  return `learning-tools:qr-role-divide:${sessionCode}:name`;
}

function setError(message) {
  state.lastError = message || "";
  render();
}

function clearError() {
  state.lastError = "";
}

function buildJoinUrl(sessionCode) {
  const url = new URL(window.location.href);
  url.searchParams.delete("data");
  url.searchParams.delete("unique_id");
  url.searchParams.delete("participant");
  url.searchParams.set("mode", "mobile");
  url.searchParams.set("session", sessionCode);
  return url.toString();
}

function buildQrUrl(joinUrl) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=420x420&data=${encodeURIComponent(joinUrl)}`;
}

function formatSeconds(totalSeconds) {
  const safe = Math.max(0, Math.ceil(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function getTheme(colorKey) {
  return TEAM_THEMES[colorKey] || TEAM_THEMES.blue;
}

function getScreenThemeKeys(session) {
  if (!session) {
    return ["blue", "orange", "pink"];
  }
  if (Array.isArray(session.teams) && session.teams.length) {
    return session.teams.map((team) => team.colorKey || "blue");
  }
  if (Array.isArray(session.teamPalette) && session.teamPalette.length) {
    return session.teamPalette;
  }
  return ["blue", "orange", "pink"];
}

function applyThemeVars(session = state.session) {
  const rootStyle = document.documentElement.style;
  const screenKeys = getScreenThemeKeys(session);
  const screenThemeA = getTheme(screenKeys[0]);
  const screenThemeB = getTheme(screenKeys[1] || screenKeys[0]);
  const screenThemeC = getTheme(screenKeys[2] || screenKeys[0]);

  rootStyle.setProperty("--screen-glow-1", screenThemeA.glow);
  rootStyle.setProperty("--screen-glow-2", screenThemeB.glow);
  rootStyle.setProperty("--screen-glow-3", screenThemeC.glow);
  rootStyle.setProperty("--screen-base-1", screenThemeA.baseTop);
  rootStyle.setProperty("--screen-base-2", screenThemeB.baseBottom);

  const mobileKey =
    session?.myTeam?.colorKey ||
    session?.me?.teamColorKey ||
    session?.teamPalette?.[0] ||
    "blue";
  const mobileTheme = getTheme(mobileKey);

  rootStyle.setProperty("--mobile-glow-1", mobileTheme.glow);
  rootStyle.setProperty("--mobile-glow-2", screenThemeB.glow);
  rootStyle.setProperty("--mobile-base-1", mobileTheme.baseTop);
  rootStyle.setProperty("--mobile-base-2", mobileTheme.baseBottom);
  rootStyle.setProperty("--brand", mobileTheme.accent);
  rootStyle.setProperty("--brand-dark", mobileTheme.accentDark);
  rootStyle.setProperty("--team-accent", mobileTheme.accent);
  rootStyle.setProperty("--team-accent-dark", mobileTheme.accentDark);
  rootStyle.setProperty("--team-soft", mobileTheme.soft);
  rootStyle.setProperty("--team-line", mobileTheme.line);
}

function teamCardStyle(team) {
  const theme = getTheme(team.colorKey);
  return [
    `--team-card-soft:${theme.soft}`,
    `--team-card-line:${theme.line}`,
    `--team-card-accent:${theme.accent}`,
    `--team-card-accent-dark:${theme.accentDark}`,
  ].join(";");
}

function stageLabel(stage) {
  if (stage === "lobby") return "Lobby";
  if (stage === "teams") return "Teams klaar";
  if (stage === "round_running") return "Ronde actief";
  if (stage === "round_wait") return "Schudfase";
  if (stage === "finished") return "Afgerond";
  return "Onbekend";
}

function apiUrl(action, query = {}) {
  const url = new URL("api.php", window.location.href);
  url.searchParams.set("action", action);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

async function apiJson(action, options = {}) {
  const method = options.method || "GET";
  const url = apiUrl(action, options.query || {});
  const init = { method, cache: "no-store" };
  if (options.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(url, init);
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("Ongeldig antwoord van de server.");
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function apiUpload(formData) {
  const response = await fetch(apiUrl("upload_capture"), {
    method: "POST",
    body: formData,
    cache: "no-store",
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("Ongeldig upload-antwoord van de server.");
  }
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function loadConfig() {
  if (!state.dataUrl) {
    throw new Error("Geen data-URL gevonden. Gebruik ?data=... in de schermversie.");
  }
  const response = await fetch(state.dataUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Kon data niet laden (${response.status}).`);
  }
  return response.json();
}

function getCountdown(session = state.session) {
  if (!session || !session.timing) return null;
  const now = Date.now();
  if (session.stage === "round_running" && session.timing.roundEndsAtMs) {
    const remainingMs = session.timing.roundEndsAtMs - now;
    return {
      kind: "round",
      remainingMs,
      remainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
    };
  }
  if (session.stage === "round_wait" && session.timing.waitEndsAtMs) {
    const remainingMs = session.timing.waitEndsAtMs - now;
    return {
      kind: "wait",
      remainingMs,
      remainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
    };
  }
  return null;
}

function applyBodyState() {
  const countdown = getCountdown();
  document.body.classList.toggle("is-mobile", state.mode === "mobile");
  document.body.classList.toggle("is-screen", state.mode === "screen");
  document.body.classList.remove("warning-flash", "danger-overlay");

  if (!countdown || countdown.kind !== "round") return;
  if (countdown.remainingSeconds <= 10 && countdown.remainingSeconds > 0) {
    document.body.classList.add("danger-overlay");
    return;
  }
  const seconds = countdown.remainingSeconds;
  if (seconds <= 30 && seconds > 10 && seconds % 10 === 0) {
    document.body.classList.add("warning-flash");
  }
}

function getMobileDangerOverlay() {
  const countdown = getCountdown();
  if (
    state.mode !== "mobile" ||
    !countdown ||
    countdown.kind !== "round" ||
    countdown.remainingSeconds > 10 ||
    countdown.remainingSeconds <= 0
  ) {
    return "";
  }
  return `
    <div class="danger-overlay-card">
      <div>
        <strong>${countdown.remainingSeconds}</strong>
        <span>Laatste seconden</span>
      </div>
    </div>
  `;
}

function teamMembersHtml(members, meId) {
  return members
    .map((member) => {
      const captureBits = [];
      if (member.captureMode) {
        captureBits.push(member.captureMode === "video" ? "Video-opname" : "Audio-opname");
      }
      if (member.captureSubmitted) {
        captureBits.push("Ingeleverd");
      }
      if (member.captureAlternative) {
        captureBits.push("Alternatief");
      }

      return `
        <div class="member-item">
          <div>
            <div class="member-name ${member.id === meId ? "me" : ""}">
              ${member.icon ? `${escapeHtml(member.icon)} ` : ""}${escapeHtml(member.name)}
            </div>
            <div class="muted small">${captureBits.length ? escapeHtml(captureBits.join(" • ")) : "&nbsp;"}</div>
          </div>
          <div class="member-role">${escapeHtml(member.roleName || "Nog geen rol")}</div>
        </div>
      `;
    })
    .join("");
}

function renderScreen() {
  if (!state.config) {
    appEl.innerHTML = `
      <div class="loading-card">
        <p>Configuratie wordt geladen...</p>
        ${state.lastError ? `<p class="error-text">${escapeHtml(state.lastError)}</p>` : ""}
      </div>
    `;
    return;
  }

  const session = state.session;
  if (!session) {
    appEl.innerHTML = `
      <div class="loading-card">
        <p>Sessie wordt voorbereid...</p>
        ${state.lastError ? `<p class="error-text">${escapeHtml(state.lastError)}</p>` : ""}
      </div>
    `;
    return;
  }

  const countdown = getCountdown(session);
  const joinUrl = state.joinUrl || buildJoinUrl(session.code);
  const qrUrl = buildQrUrl(joinUrl);
  const participantsHtml = session.participants.length
    ? session.participants
        .map(
          (participant) => `
            <span class="badge">
              <strong>${escapeHtml(participant.icon || "•")}</strong>
              <span>${escapeHtml(participant.name)}</span>
            </span>
          `
        )
        .join("")
    : "";

  const timerText = countdown
    ? countdown.kind === "round"
      ? `Ronde loopt nog ${formatSeconds(countdown.remainingSeconds)}`
      : `Nieuwe ronde start over ${formatSeconds(countdown.remainingSeconds)}`
    : session.stage === "teams"
      ? "Teams zijn ingedeeld. Wacht op de docent om te starten."
      : session.stage === "finished"
        ? "Alle rondes zijn afgerond."
        : "Wacht op studenten en deel daarna teams in.";

  const controls = `
    <div class="control-row">
      <button
        class="button-primary"
        data-action="assign-teams"
        ${session.stage === "round_running" || session.stage === "round_wait" ? "disabled" : ""}
        ${state.busy.assignTeams ? "disabled" : ""}
      >
        Teams indelen
      </button>
      <button
        class="button-secondary"
        data-action="start-teacher"
        ${session.stage !== "teams" ? "disabled" : ""}
        ${state.busy.startTeacher ? "disabled" : ""}
      >
        Starten
      </button>
    </div>
  `;

  const statusCard = state.lastError
    ? `
      <div class="callout danger">
        <strong>Fout</strong>
        <p class="status-line">${escapeHtml(state.lastError)}</p>
      </div>
    `
    : `
      <div class="callout">
        <strong>Status</strong>
        <p class="status-line">${escapeHtml(timerText)}</p>
      </div>
    `;

  const teamCards = session.teams.length
    ? session.teams
        .map(
          (team) => `
            <article class="team-card" style="${teamCardStyle(team)}">
              <div class="section-title">
                <h3>${escapeHtml(team.name)}</h3>
                <span class="tag">${escapeHtml(team.members.length)} deelnemers</span>
              </div>
              <div class="member-list">
                ${teamMembersHtml(team.members, null)}
              </div>
            </article>
          `
        )
        .join("")
    : "";

  const rightStats = `
    <div class="stat-grid stat-grid-compact">
      <div class="stat">
        <span>Aangemeld</span>
        <strong>${escapeHtml(String(session.participantCount))}</strong>
      </div>
      <div class="stat">
        <span>Teams</span>
        <strong>${escapeHtml(String(session.teams.length || 0))}</strong>
      </div>
      <div class="stat">
        <span>Ronde</span>
        <strong>${escapeHtml(`${session.currentRoundNumber}/${session.totalRounds}`)}</strong>
      </div>
    </div>
  `;

  appEl.innerHTML = `
    <div class="screen-layout">
      <section class="panel">
        <div class="hero">
          <div>
            <h1>${escapeHtml(session.title)}</h1>
            <p>${escapeHtml(session.description || "Studenten scannen, teams worden verdeeld en rollen rouleren automatisch per ronde.")}</p>
          </div>
        </div>
        <div class="stat-grid stat-grid-single">
          <div class="stat">
            <span>Sessiecode</span>
            <strong>${escapeHtml(session.code)}</strong>
          </div>
        </div>

        <div class="qr-panel">
          <div class="qr-box">
            <img src="${escapeHtml(qrUrl)}" alt="QR code om deel te nemen" />
            <p>Scan de QR code met je telefoon om verder te gaan</p>
            <span class="code-block">${escapeHtml(joinUrl)}</span>
          </div>
          <div class="screen-participants">
            <div class="badge-row">${participantsHtml}</div>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="section-title">
          <h2>Teams</h2>
          <span class="tag">Ronde ${escapeHtml(`${session.currentRoundNumber}/${session.totalRounds}`)}</span>
        </div>
        ${rightStats}
        ${statusCard}
        ${controls}
        <div class="timer-hero">
          <div class="timer-number">${escapeHtml(countdown ? formatSeconds(countdown.remainingSeconds) : "—")}</div>
        </div>
        <div class="team-grid">${teamCards}</div>
      </section>
    </div>
  `;
}

function renderJoinForm(session) {
  return `
    <div class="inline-join">
      <div class="field">
        <label class="field-label" for="join-name">Naam</label>
        <input id="join-name" name="join-name" type="text" maxlength="80" value="${escapeHtml(state.joinName)}" placeholder="Bijvoorbeeld: Samira" />
      </div>
      <div class="join-actions">
        <button class="button-primary" data-action="join-session" ${state.busy.join ? "disabled" : ""}>Opslaan</button>
        <span class="tag">Sessie ${escapeHtml(session.code)}</span>
      </div>
      ${state.lastError ? `<p class="error-text">${escapeHtml(state.lastError)}</p>` : ""}
    </div>
  `;
}

function renderConsentCards(session) {
  const tasks = session.teamCaptureTasks || [];
  if (!tasks.length) return "";

  return tasks
    .map((task) => {
      const helper = task.captureMode === "video" ? "video-opname" : "audio-opname";
      let body = "";

      if (task.submitted) {
        body = `<p class="upload-status">De opname voor ${escapeHtml(task.roleName)} is al ingeleverd.</p>`;
      } else if (task.anyDeclined) {
        body = `
          <div class="callout warning">
            <strong>Geen volledige toestemming</strong>
            <p>De opname voor ${escapeHtml(task.roleName)} mag niet gemaakt worden. ${escapeHtml(task.holderName)} ziet nu de alternatieve opdracht.</p>
          </div>
        `;
      } else if (task.isHolder && task.allApproved) {
        body = `
          <div class="callout good">
            <strong>Iedereen is akkoord</strong>
            <p>Maak nu je ${escapeHtml(helper)} en lever die hier in.</p>
          </div>
          <div class="join-actions">
            <label class="file-input-label" for="upload-${escapeHtml(task.captureKey)}">Bestand kiezen</label>
            <input
              class="file-input"
              id="upload-${escapeHtml(task.captureKey)}"
              type="file"
              data-upload-key="${escapeHtml(task.captureKey)}"
              accept="${task.captureMode === "video" ? "video/*" : "audio/*"}"
              capture
            />
          </div>
        `;
      } else if (task.isHolder && task.allApproved === false && task.pendingCount > 0) {
        body = `<p class="muted">Wacht op toestemming van je team voordat je de ${escapeHtml(helper)} maakt.</p>`;
      } else if (!task.isHolder && task.myConsent === "approved") {
        body = `<p class="upload-status">Jij hebt al akkoord gegeven voor de ${escapeHtml(helper)} van ${escapeHtml(task.holderName)}.</p>`;
      } else if (!task.isHolder && task.myConsent === "declined") {
        body = `<p class="error-text">Jij hebt geen akkoord gegeven voor deze opname.</p>`;
      } else if (!task.isHolder) {
        body = `
          <p class="muted">${escapeHtml(task.holderName)} wil voor rol ${escapeHtml(task.roleName)} een ${escapeHtml(helper)} opnemen. Iedereen in het team moet akkoord geven.</p>
          <div class="consent-actions">
            <button class="button-primary" data-action="set-consent" data-capture-key="${escapeHtml(task.captureKey)}" data-approved="1">Akkoord</button>
            <button class="button-secondary" data-action="set-consent" data-capture-key="${escapeHtml(task.captureKey)}" data-approved="0">Niet akkoord</button>
          </div>
        `;
      }

      return `
        <section class="capture-card">
          <h3>${escapeHtml(task.roleName)} • ${escapeHtml(helper)}</h3>
          <p class="muted">${task.holderIcon ? `${escapeHtml(task.holderIcon)} ` : ""}${escapeHtml(task.holderName)} is deze ronde verantwoordelijk voor de opname.</p>
          ${body}
        </section>
      `;
    })
    .join("");
}

function renderMobile() {
  const session = state.session;
  if (!session) {
    appEl.innerHTML = `
      <div class="mobile-layout">
        <div class="loading-card">
          <p>Zoeken naar sessie...</p>
          ${state.lastError ? `<p class="error-text">${escapeHtml(state.lastError)}</p>` : ""}
        </div>
      </div>
    `;
    return;
  }

  const countdown = getCountdown(session);
  const me = session.me;
  const myTeam = session.myTeam;
  const myAssignment = session.myAssignment;
  const timerText = countdown
    ? countdown.kind === "round"
      ? `Nog ${formatSeconds(countdown.remainingSeconds)} voor deze rol`
      : `Nieuwe ronde over ${formatSeconds(countdown.remainingSeconds)}`
    : session.stage === "lobby"
      ? "Wacht op de docent om teams in te delen."
      : session.stage === "teams"
        ? "Wacht op de docent om de ronde te starten."
        : session.stage === "finished"
          ? "Alle rondes zijn afgerond."
          : "Sessie wordt bijgewerkt.";

  let content = "";
  if (!me) {
    content = `
      <section class="mobile-card">
        <div class="section-title">
          <h2>${escapeHtml(session.title)}</h2>
        </div>
        ${renderJoinForm(session)}
      </section>
    `;
  } else {
    const teamCard = myTeam
      ? `
        <section class="mobile-card">
          <div class="section-title">
            <h2>${escapeHtml(myTeam.name)}</h2>
            <span class="tag">${escapeHtml(String(myTeam.members.length))} teamleden</span>
          </div>
          <div class="member-list">
            ${teamMembersHtml(myTeam.members, me.id)}
          </div>
        </section>
      `
      : `
        <section class="mobile-card">
          <h2>Wachten op teamindeling</h2>
          <p class="muted">Je bent aangemeld. Zodra de docent teams indeelt, zie je hier jouw team.</p>
        </section>
      `;

    let roleCard = "";
    if (session.stage === "teams" && myTeam) {
      roleCard = `
        <section class="mobile-card">
          <h2>Klaar om te starten</h2>
          <p class="muted">Je team is bekend. Zodra de docent op het grote scherm op “Starten” drukt, ga je automatisch door naar je rol.</p>
          <button class="button-primary" data-action="mobile-ready" ${state.busy.mobileReady ? "disabled" : ""}>
            Starten
          </button>
          ${state.localStartPressed ? `<p class="upload-status">Je bent klaar om te starten. Wachten op de docent...</p>` : ""}
        </section>
      `;
    } else if (session.stage === "round_running" && myAssignment) {
      roleCard = `
        <section class="mobile-card">
          <div class="section-title">
            <h2>${escapeHtml(myAssignment.roleName)}</h2>
            <span class="tag">Ronde ${escapeHtml(`${session.currentRoundNumber}/${session.totalRounds}`)}</span>
          </div>
          <div class="timer-hero">
            <div class="timer-number">${escapeHtml(formatSeconds(countdown?.remainingSeconds || 0))}</div>
            <p class="muted">${escapeHtml(timerText)}</p>
          </div>
          <div class="instruction-list">
            ${myAssignment.instructions.map((instruction) => `<span class="instruction-pill">${escapeHtml(instruction)}</span>`).join("")}
          </div>
          ${
            myAssignment.captureMode && myAssignment.captureBlocked
              ? `
                <div class="callout warning">
                  <strong>Alternatieve opdracht</strong>
                  <p>${escapeHtml(myAssignment.alternativeInstruction || "Voer de alternatieve opdracht uit die de docent heeft voorbereid.")}</p>
                </div>
              `
              : ""
          }
        </section>
      `;
    } else if (session.stage === "round_wait") {
      roleCard = `
        <section class="mobile-card">
          <h2>Tijd is op</h2>
          <p class="muted">De rollen worden zo gehusseld. Klik op “Schudden” om alvast door te gaan naar de wachtruimte.</p>
          ${
            session.me?.hasShaken
              ? `<div class="callout"><strong>Wachten op andere studenten</strong><p>Je scherm start vanzelf opnieuw zodra de nieuwe ronde begint.</p></div>`
              : `<button class="button-danger" data-action="shake" ${state.busy.shake ? "disabled" : ""}>Schudden</button>`
          }
          <p class="muted">${escapeHtml(timerText)}</p>
        </section>
      `;
    } else if (session.stage === "finished") {
      roleCard = `
        <section class="mobile-card">
          <h2>Afgerond</h2>
          <p class="muted">Alle rondes zijn gespeeld. Bespreek de uitkomst met je docent of klas.</p>
        </section>
      `;
    }

    content = `
      <section class="mobile-card">
        <div class="section-title">
          <h2>${escapeHtml(session.title)}</h2>
        </div>
        <p class="muted">${escapeHtml(timerText)}</p>
      </section>
      ${teamCard}
      ${roleCard}
      ${renderConsentCards(session)}
      ${state.lastError ? `<section class="mobile-card"><p class="error-text">${escapeHtml(state.lastError)}</p></section>` : ""}
    `;
  }

  appEl.innerHTML = `
    <div class="mobile-layout">
      <div class="mobile-header">
        <div class="pill-row">
          ${me?.icon ? `<span class="pill"><strong>${escapeHtml(me.icon)}</strong><span>${escapeHtml(me.name)}</span></span>` : ""}
        </div>
        <h1>${escapeHtml(session.title)}</h1>
        <p>${escapeHtml(session.description || "Sluit aan bij je team, pak je rol en werk per ronde toe naar een gezamenlijke oplossing.")}</p>
      </div>
      <div class="mobile-stack">${content}</div>
      ${getMobileDangerOverlay()}
    </div>
  `;
}

function render() {
  applyThemeVars();
  applyBodyState();
  if (state.mode === "screen") {
    renderScreen();
  } else {
    renderMobile();
  }
}

async function pollState() {
  if (!state.sessionCode) return;
  try {
    const payload = await apiJson("state", {
      query: {
        session: state.sessionCode,
        participantId: state.participantId,
      },
    });
    clearError();
    state.session = payload.session;
    state.joinUrl = buildJoinUrl(payload.session.code);

    if (payload.session.me?.id) {
      state.participantId = payload.session.me.id;
      window.localStorage.setItem(storageKeyParticipant(payload.session.code), payload.session.me.id);
      window.localStorage.setItem(storageKeyName(payload.session.code), payload.session.me.name);
      state.joinName = payload.session.me.name;
    } else if (state.mode === "mobile" && state.participantId && !payload.session.me) {
      window.localStorage.removeItem(storageKeyParticipant(state.sessionCode));
      state.participantId = null;
    }
    ensureLoops();
    if (state.mode === "mobile" && !payload.session.me && document.activeElement?.id === "join-name") {
      return;
    }
    render();
  } catch (error) {
    setError(error.message);
  }
}

function ensureLoops() {
  if (!state.pollingHandle) {
    state.pollingHandle = window.setInterval(() => {
      pollState();
    }, POLL_MS);
  }
  const needsLiveRender =
    state.mode === "screen" ||
    Boolean(state.session?.me && ["teams", "round_running", "round_wait", "finished"].includes(state.session.stage));
  if (needsLiveRender && !state.renderHandle) {
    state.renderHandle = window.setInterval(() => {
      render();
    }, RENDER_MS);
  }
  if (!needsLiveRender && state.renderHandle) {
    window.clearInterval(state.renderHandle);
    state.renderHandle = null;
  }
}

async function initScreen() {
  if (!state.uniqueId) {
    throw new Error("Gebruik voor het grote scherm een URL met ?unique_id=...");
  }
  state.config = await loadConfig();
  const payload = await apiJson("init_screen", {
    method: "POST",
    body: {
      uniqueId: state.uniqueId,
      config: state.config,
    },
  });
  state.session = payload.session;
  state.sessionCode = payload.session.code;
  state.joinUrl = buildJoinUrl(payload.session.code);
}

async function initMobile() {
  if (!state.sessionCode) {
    throw new Error("Gebruik voor mobiel een URL met ?mode=mobile&session=...");
  }
  const savedParticipantId = window.localStorage.getItem(storageKeyParticipant(state.sessionCode));
  const savedName = window.localStorage.getItem(storageKeyName(state.sessionCode));
  if (savedParticipantId) {
    state.participantId = savedParticipantId;
  }
  if (savedName) {
    state.joinName = savedName;
  }
}

async function joinSession() {
  const input = document.getElementById("join-name");
  const name = (input?.value || state.joinName || "").trim();
  if (!name) {
    setError("Vul eerst je naam in.");
    return;
  }
  state.busy.join = true;
  render();
  try {
    const payload = await apiJson("join", {
      method: "POST",
      body: {
        sessionCode: state.sessionCode,
        participantId: state.participantId,
        name,
      },
    });
    clearError();
    state.session = payload.session;
    state.participantId = payload.session.me?.id || payload.participantId || null;
    state.joinName = name;
    if (state.participantId) {
      window.localStorage.setItem(storageKeyParticipant(state.sessionCode), state.participantId);
      window.localStorage.setItem(storageKeyName(state.sessionCode), name);
    }
  } catch (error) {
    setError(error.message);
  } finally {
    state.busy.join = false;
    render();
  }
}

async function assignTeams() {
  state.busy.assignTeams = true;
  render();
  try {
    const payload = await apiJson("assign_teams", {
      method: "POST",
      body: { sessionCode: state.sessionCode },
    });
    clearError();
    state.session = payload.session;
  } catch (error) {
    setError(error.message);
  } finally {
    state.busy.assignTeams = false;
    render();
  }
}

async function startTeacher() {
  state.busy.startTeacher = true;
  render();
  try {
    const payload = await apiJson("teacher_start", {
      method: "POST",
      body: { sessionCode: state.sessionCode },
    });
    clearError();
    state.session = payload.session;
  } catch (error) {
    setError(error.message);
  } finally {
    state.busy.startTeacher = false;
    render();
  }
}

async function mobileReady() {
  if (!state.participantId) return;
  state.busy.mobileReady = true;
  state.localStartPressed = true;
  render();
  try {
    const payload = await apiJson("mobile_ready", {
      method: "POST",
      body: {
        sessionCode: state.sessionCode,
        participantId: state.participantId,
      },
    });
    clearError();
    state.session = payload.session;
  } catch (error) {
    setError(error.message);
  } finally {
    state.busy.mobileReady = false;
    render();
  }
}

async function setConsent(captureKey, approved) {
  if (!state.participantId || !captureKey) return;
  state.busy.saveConsent = true;
  render();
  try {
    const payload = await apiJson("set_consent", {
      method: "POST",
      body: {
        sessionCode: state.sessionCode,
        participantId: state.participantId,
        captureKey,
        approved,
      },
    });
    clearError();
    state.session = payload.session;
  } catch (error) {
    setError(error.message);
  } finally {
    state.busy.saveConsent = false;
    render();
  }
}

async function shakeRound() {
  if (!state.participantId) return;
  state.busy.shake = true;
  render();
  try {
    const payload = await apiJson("shake", {
      method: "POST",
      body: {
        sessionCode: state.sessionCode,
        participantId: state.participantId,
      },
    });
    clearError();
    state.session = payload.session;
  } catch (error) {
    setError(error.message);
  } finally {
    state.busy.shake = false;
    render();
  }
}

async function uploadCapture(input) {
  const file = input.files?.[0];
  const captureKey = input.dataset.uploadKey;
  if (!file || !captureKey || !state.participantId) return;
  state.busy.upload = true;
  render();
  try {
    const formData = new FormData();
    formData.append("sessionCode", state.sessionCode);
    formData.append("participantId", state.participantId);
    formData.append("captureKey", captureKey);
    formData.append("media", file);
    const payload = await apiUpload(formData);
    clearError();
    state.session = payload.session;
  } catch (error) {
    setError(error.message);
  } finally {
    state.busy.upload = false;
    input.value = "";
    render();
  }
}

appEl.addEventListener("click", (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;

  const action = target.dataset.action;
  if (action === "join-session") {
    joinSession();
  }
  if (action === "assign-teams") {
    assignTeams();
  }
  if (action === "start-teacher") {
    startTeacher();
  }
  if (action === "mobile-ready") {
    mobileReady();
  }
  if (action === "set-consent") {
    setConsent(target.dataset.captureKey, target.dataset.approved === "1");
  }
  if (action === "shake") {
    shakeRound();
  }
});

appEl.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.dataset.uploadKey) {
    uploadCapture(target);
  }
});

appEl.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.id === "join-name") {
    state.joinName = target.value;
  }
});

appEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.id === "join-name") {
    event.preventDefault();
    joinSession();
  }
});

async function init() {
  try {
    if (state.mode === "screen") {
      await initScreen();
    } else {
      await initMobile();
    }
    await pollState();
    ensureLoops();
  } catch (error) {
    setError(error.message);
    render();
  }
}

render();
init();
