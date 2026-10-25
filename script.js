"use strict";

if (typeof lucide !== "undefined") {
  lucide.createIcons();
}

// ======================================================
// 1. SELECT ELEMENTS
// ======================================================

// HEADER STATS

const todayTotalValue = document.getElementById("todayTotalValue");
const sessionsValue = document.getElementById("sessionsValue");
const currentStreakValue = document.getElementById("currentStreakValue");
const totalHoursValue = document.getElementById("totalHoursValue");

const settingsBtn = document.getElementById("settingsBtn");

// CURRENT SESSION

const modeSelect = document.getElementById("modeSelect");
const titleInput = document.getElementById("titleInput");
const noteInput = document.getElementById("noteInput");

// TIMER

const timerDisplay = document.getElementById("timerDisplay");
const timerStatus = document.getElementById("timerStatus");
const statusText = document.getElementById("statusText");

// TIMER BUTTONS

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const stopSaveBtn = document.getElementById("stopSaveBtn");
const resetBtn = document.getElementById("resetBtn");

// CURRENT SESSION STATS

const sessionTodayTotalValue = document.querySelector(
  ".main-stat:nth-child(1) > div > span",
);

const sessionsTodayValue = document.querySelector(
  ".main-stat:nth-child(2) > div > span",
);

const averageSessionValue = document.querySelector(
  ".main-stat:nth-child(3) > div > span",
);

// LEAVE PAGE WARNING

const previewMessageBtn = document.getElementById("previewMessageBtn");
const leaveWarningToggle = document.getElementById("leaveWarningToggle");

const leaveWarningTitle = document.querySelector(".leave-warning-left h3");
const leaveWarningDescription = document.querySelector(".leave-warning-left p");

// SESSION HISTORY

const sessionHistoryGrid = document.getElementById("sessionHistoryGrid");
const searchInput = document.getElementById("searchInput");

const filterButtons = document.querySelectorAll(
  ".session-history-filters button",
);

// IMPORT / EXPORT / CLEAR

const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const clearAllBtn = document.getElementById("clearAllBtn");

// PRODUCTIVITY STATS

const longestSessionValue = document.getElementById("longestSessionValue");
const weeklyTotalValue = document.getElementById("weeklyTotalValue");
const deepFocusValue = document.getElementById("deepFocusValue");
const bestDayValue = document.getElementById("bestDayValue");

// ======================================================
// 2. STATE
// ======================================================

let sessions = [];

let timerState = "idle";
let elapsedMs = 0;
let runningSince = null;
let sessionStartedAt = null;
let timerIntervalId = null;

let activeFilter = "all";
let searchQuery = "";

let leaveWarningEnabled = true;

// ======================================================
// 3. SAVE / LOAD DATA
// ======================================================

function saveData() {
  localStorage.setItem("devSessionTrackerData", JSON.stringify(sessions));
}

function loadData() {
  try {
    const storedData = localStorage.getItem("devSessionTrackerData");

    if (!storedData) return;

    const parsedData = JSON.parse(storedData);

    if (!Array.isArray(parsedData)) {
      sessions = [];
      return;
    }

    sessions = parsedData.filter((session) => isValidImportedSession(session));
  } catch (error) {
    console.error("Failed to load sessions:", error);
    sessions = [];
  }
}

// ======================================================
// 4. TIMER
// ======================================================

function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formattedHours = String(hours).padStart(2, "0");
  const formattedMinutes = String(minutes).padStart(2, "0");
  const formattedSeconds = String(seconds).padStart(2, "0");

  return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
}

function getElapsedTime() {
  if (timerState === "running" && runningSince !== null) {
    return elapsedMs + (Date.now() - runningSince);
  }

  return elapsedMs;
}

function updateTimerDisplay() {
  const currentTime = getElapsedTime();

  timerDisplay.textContent = formatTime(currentTime);
}

function updateTimerStatus() {
  timerStatus.classList.remove("running", "paused");

  if (timerState === "running") {
    timerStatus.classList.add("running");
    statusText.textContent = "Running";
  } else if (timerState === "paused") {
    timerStatus.classList.add("paused");
    statusText.textContent = "Paused";
  } else {
    statusText.textContent = "Idle";
  }
}

function startTimer() {
  if (timerState === "running") return;

  const now = Date.now();

  if (sessionStartedAt === null) {
    sessionStartedAt = now;
  }

  runningSince = now;
  timerState = "running";

  clearInterval(timerIntervalId);

  timerIntervalId = setInterval(() => {
    updateTimerDisplay();
  }, 250);

  updateTimerDisplay();
  updateTimerStatus();
  saveActiveTimerState();
  updateTimerButtons();
}

function pauseTimer() {
  if (timerState !== "running") return;

  elapsedMs = getElapsedTime();

  runningSince = null;
  timerState = "paused";

  clearInterval(timerIntervalId);
  timerIntervalId = null;

  updateTimerDisplay();
  updateTimerStatus();
  saveActiveTimerState();
  updateTimerButtons();
}

function stopTimer() {
  if (timerState === "idle") return null;

  const completedSession = {
    startedAt: sessionStartedAt,
    endedAt: Date.now(),
    durationMs: getElapsedTime(),
  };

  clearInterval(timerIntervalId);

  timerIntervalId = null;
  timerState = "idle";
  elapsedMs = 0;
  runningSince = null;
  sessionStartedAt = null;

  updateTimerDisplay();
  updateTimerStatus();
  updateTimerButtons();

  clearStoredActiveTimer();

  return completedSession;
}

// ======================================================
// 5. SESSION MANAGEMENT
// ======================================================

function saveSession() {
  const title = titleInput.value.trim();

  if (!title) return;
  if (timerState === "idle") return;

  const completedSession = stopTimer();

  const newSession = {
    id: crypto.randomUUID(),
    title: title,
    note: noteInput.value.trim(),
    mode: modeSelect.value,
    ...completedSession,
  };

  sessions.unshift(newSession);

  saveData();

  clearSessionInputs();
  updateUI();
}

function clearAllSessions() {
  if (sessions.length === 0) return;

  const confirmed = window.confirm(
    "Are you sure you want to delete all saved sessions? This action cannot be undone.",
  );

  if (!confirmed) return;

  sessions = [];

  saveData();
  updateUI();
}

// ======================================================
// 6. SESSION HISTORY
// ======================================================

function formatSessionDate(timestamp) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function createSessionCard(session) {
  const card = document.createElement("article");

  card.className = "session-card";
  card.dataset.sessionId = session.id;

  card.innerHTML = `
   <div class="session-card-top">
      <h4 class="session-card-title"></h4>
      <span class="session-card-duration"></span>
    </div>

    <p class="session-card-note"></p>

    <div class="session-card-footer">
      <div class="session-card-meta">
        <span class="session-card-mode"></span>
        <span class="session-card-date"></span>
      </div>

      <div class="session-card-actions">
        <button
          type="button"
          class="session-edit-btn"
          data-action="edit"
          aria-label="Edit session"
        >
          <i data-lucide="pencil"></i>
        </button>

        <button
          type="button"
          class="session-delete-btn"
          data-action="delete"
          aria-label="Delete session"
        >
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    </div> 
  `;

  const modeLabels = {
    focus: "Focus Mode",
    learning: "Learning Mode",
    "deep-work": "Deep Work Mode",
  };

  const titleElement = card.querySelector(".session-card-title");
  const noteElement = card.querySelector(".session-card-note");
  const durationElement = card.querySelector(".session-card-duration");
  const modeElement = card.querySelector(".session-card-mode");
  const dateElement = card.querySelector(".session-card-date");

  titleElement.textContent = session.title;
  durationElement.textContent = formatTime(session.durationMs);
  modeElement.textContent = modeLabels[session.mode] || "Focus Mode";
  dateElement.textContent = formatSessionDate(session.startedAt);

  if (session.note) {
    noteElement.textContent = session.note;
  } else {
    noteElement.remove();
  }

  return card;
}

function renderSessionHistory(visibleSessions = sessions) {
  const fragment = document.createDocumentFragment();

  if (visibleSessions.length === 0) {
    const emptyMessage = document.createElement("p");

    emptyMessage.className = "session-history-empty";

    emptyMessage.textContent =
      sessions.length === 0
        ? "No sessions yet. Start your first coding session!"
        : "No sessions match your search or filter.";

    fragment.appendChild(emptyMessage);
  } else {
    visibleSessions.forEach((session) => {
      const card = createSessionCard(session);

      fragment.appendChild(card);
    });
  }

  sessionHistoryGrid.replaceChildren(fragment);

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
}

function deleteSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);

  if (!session) return;

  const confirmed = window.confirm(
    `Are you sure you want to delete "${session.title}"?`,
  );

  if (!confirmed) return;

  sessions = sessions.filter((item) => item.id !== sessionId);

  saveData();
  updateUI();
}

function editSession(sessionId) {
  const session = sessions.find((item) => item.id === sessionId);

  if (!session) return;

  const updatedTitle = window.prompt("Edit session title:", session.title);

  if (updatedTitle === null) return;

  const title = updatedTitle.trim();

  if (!title) {
    window.alert("Session title cannot be empty.");
    return;
  }

  const updatedNote = window.prompt("Edit session note:", session.note || "");

  if (updatedNote === null) return;

  session.title = title;
  session.note = updatedNote.trim();

  saveData();
  updateUI();
}

function handleSessionHistoryClick(event) {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const card = button.closest(".session-card");

  if (!card) return;

  const sessionId = card.dataset.sessionId;
  const action = button.dataset.action;

  if (action === "edit") {
    editSession(sessionId);
  }

  if (action === "delete") {
    deleteSession(sessionId);
  }
}

// ======================================================
// 7. SEARCH / FILTER
// ======================================================

function filterSessions() {
  const today = new Date();

  const startOfWeek = new Date(today);
  const dayOfWeek = (today.getDay() + 6) % 7;

  startOfWeek.setDate(today.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const filteredSessions = sessions.filter((session) => {
    const title = session.title.toLowerCase();
    const note = (session.note || "").toLowerCase();

    const matchesSearch =
      title.includes(searchQuery) || note.includes(searchQuery);

    const sessionDate = new Date(session.startedAt);

    let matchesDate = true;

    if (activeFilter === "today") {
      matchesDate = sessionDate.toDateString() === today.toDateString();
    }

    if (activeFilter === "thisWeek") {
      matchesDate = sessionDate >= startOfWeek && sessionDate <= today;
    }

    return matchesSearch && matchesDate;
  });

  renderSessionHistory(filteredSessions);
}

function handleSearch() {
  searchQuery = searchInput.value.trim().toLowerCase();

  filterSessions();
}

function handleFilterClick(event) {
  const button = event.target.closest("button[data-filter]");

  if (!button) return;

  activeFilter = button.dataset.filter;

  filterButtons.forEach((filterButton) => {
    filterButton.classList.toggle("active", filterButton === button);
  });

  filterSessions();
}

// ======================================================
// 8. IMPORT / EXPORT
// ======================================================

function exportSessions() {
  if (sessions.length === 0) {
    alert("No sessions to export.");
    return;
  }

  const jsonData = JSON.stringify(sessions, null, 2);

  const blob = new Blob([jsonData], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = `dev-session-tracker-${new Date().toISOString().slice(0, 10)}.json`;

  document.body.appendChild(link);

  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function isValidImportedSession(session) {
  return (
    session !== null &&
    typeof session === "object" &&
    typeof session.id === "string" &&
    session.id.length > 0 &&
    typeof session.title === "string" &&
    session.title.trim().length > 0 &&
    typeof session.note === "string" &&
    ["focus", "learning", "deep-work"].includes(session.mode) &&
    Number.isFinite(session.startedAt) &&
    Number.isFinite(session.endedAt) &&
    Number.isFinite(session.durationMs) &&
    session.durationMs >= 0
  );
}

function importSessions() {
  const fileInput = document.createElement("input");

  fileInput.type = "file";
  fileInput.accept = ".json,application/json";

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];

    if (!file) return;

    try {
      const fileContent = await file.text();
      const importedData = JSON.parse(fileContent);

      if (!Array.isArray(importedData)) {
        alert("Invalid JSON format. Expected an array of sessions.");
        return;
      }

      const isValid = importedData.every((session) =>
        isValidImportedSession(session),
      );

      if (!isValid) {
        alert("The JSON file contains invalid sessions.");
        return;
      }

      const existingIds = new Set(sessions.map((session) => session.id));

      let importedCount = 0;

      importedData.forEach((session) => {
        if (existingIds.has(session.id)) return;

        sessions.push(session);
        existingIds.add(session.id);

        importedCount++;
      });

      if (importedCount > 0) {
        sessions.sort((a, b) => b.startedAt - a.startedAt);

        saveData();
        updateUI();
      }

      alert(`Successfully imported ${importedCount} new sessions.`);
    } catch (error) {
      console.error("Import failed:", error);
      alert("Failed to import JSON file.");
    }
  });

  fileInput.click();
}

// ======================================================
// 9. STATISTICS
// ======================================================

function formatDuration(milliseconds) {
  const totalMinutes = Math.floor(milliseconds / 60000);

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function getStartOfDay(timestamp) {
  const date = new Date(timestamp);

  date.setHours(0, 0, 0, 0);

  return date.getTime();
}

function getStartOfWeek(timestamp) {
  const date = new Date(timestamp);

  date.setHours(0, 0, 0, 0);

  const dayOfWeek = (date.getDay() + 6) % 7;

  date.setDate(date.getDate() - dayOfWeek);

  return date.getTime();
}

function calculateCurrentStreak() {
  const activeDays = new Set(
    sessions.map((session) => getStartOfDay(session.startedAt)),
  );

  const currentDay = new Date();

  currentDay.setHours(0, 0, 0, 0);

  if (!activeDays.has(currentDay.getTime())) {
    currentDay.setDate(currentDay.getDate() - 1);
  }

  let streak = 0;

  while (activeDays.has(currentDay.getTime())) {
    streak++;

    currentDay.setDate(currentDay.getDate() - 1);
  }

  return streak;
}

function updateComparison(element, current, previous, usePoints = false) {
  if (!element) return;

  if (current === 0 && previous === 0) {
    element.textContent = "No change from last week";
    element.style.color = "var(--text-muted)";
    return;
  }

  if (!usePoints && previous === 0) {
    element.textContent = "New this week";
    element.style.color = "var(--success)";
    return;
  }

  const difference = usePoints
    ? current - previous
    : Math.round(((current - previous) / previous) * 100);

  const roundedDifference = Math.round(difference);
  const sign = roundedDifference > 0 ? "+" : "";

  const unit = usePoints ? "pts" : "%";

  element.textContent = `${sign}${roundedDifference}${unit} from last week`;

  element.style.color =
    roundedDifference > 0
      ? "var(--success)"
      : roundedDifference < 0
        ? "var(--danger)"
        : "var(--text-muted)";
}

function updateStatistics() {
  const now = Date.now();

  const todayStart = getStartOfDay(now);
  const weekStart = getStartOfWeek(now);

  const previousWeekDate = new Date(weekStart);

  previousWeekDate.setDate(previousWeekDate.getDate() - 7);

  const previousWeekStart = previousWeekDate.getTime();

  const totalMs = sessions.reduce(
    (total, session) => total + session.durationMs,
    0,
  );

  const todaySessions = sessions.filter(
    (session) => getStartOfDay(session.startedAt) === todayStart,
  );

  const todayMs = todaySessions.reduce(
    (total, session) => total + session.durationMs,
    0,
  );

  const weeklySessions = sessions.filter(
    (session) => session.startedAt >= weekStart && session.startedAt <= now,
  );

  const weeklyMs = weeklySessions.reduce(
    (total, session) => total + session.durationMs,
    0,
  );

  const previousWeekSessions = sessions.filter(
    (session) =>
      session.startedAt >= previousWeekStart && session.startedAt < weekStart,
  );

  const previousWeekMs = previousWeekSessions.reduce(
    (total, session) => total + session.durationMs,
    0,
  );

  const averageMs = sessions.length > 0 ? totalMs / sessions.length : 0;

  const streak = calculateCurrentStreak();

  todayTotalValue.textContent = formatDuration(todayMs);
  sessionsValue.textContent = sessions.length;

  currentStreakValue.textContent = `${streak} ${streak === 1 ? "day" : "days"}`;

  totalHoursValue.textContent = formatDuration(totalMs);

  sessionTodayTotalValue.textContent = formatDuration(todayMs);
  sessionsTodayValue.textContent = todaySessions.length;
  averageSessionValue.textContent = formatDuration(averageMs);

  const longestSession = sessions.reduce((longest, session) => {
    if (!longest || session.durationMs > longest.durationMs) {
      return session;
    }

    return longest;
  }, null);

  const longestDateElement =
    longestSessionValue.parentElement.querySelector(".date");

  if (longestSession) {
    longestSessionValue.textContent = formatDuration(longestSession.durationMs);

    if (longestDateElement) {
      longestDateElement.textContent = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(longestSession.startedAt));
    }
  } else {
    longestSessionValue.textContent = "0m";

    if (longestDateElement) {
      longestDateElement.textContent = "No sessions yet";
    }
  }

  weeklyTotalValue.textContent = formatDuration(weeklyMs);

  const weeklyComparison = weeklyTotalValue.parentElement.querySelector(
    ".success-text, .percentage",
  );

  updateComparison(weeklyComparison, weeklyMs, previousWeekMs);

  const deepWorkMs = weeklySessions
    .filter((session) => session.mode === "deep-work")
    .reduce((total, session) => total + session.durationMs, 0);

  const previousDeepWorkMs = previousWeekSessions
    .filter((session) => session.mode === "deep-work")
    .reduce((total, session) => total + session.durationMs, 0);

  const deepFocusScore =
    weeklyMs > 0 ? Math.round((deepWorkMs / weeklyMs) * 100) : 0;

  const previousDeepFocusScore =
    previousWeekMs > 0
      ? Math.round((previousDeepWorkMs / previousWeekMs) * 100)
      : 0;

  deepFocusValue.textContent = `${deepFocusScore} / 100`;

  const deepFocusComparison = deepFocusValue.parentElement.querySelector(
    ".success-text, .percentage",
  );

  updateComparison(
    deepFocusComparison,
    deepFocusScore,
    previousDeepFocusScore,
    true,
  );

  const dailyTotals = new Map();

  sessions.forEach((session) => {
    const day = getStartOfDay(session.startedAt);

    const currentTotal = dailyTotals.get(day) || 0;

    dailyTotals.set(day, currentTotal + session.durationMs);
  });

  let bestDay = null;
  let bestDayDuration = 0;

  dailyTotals.forEach((duration, day) => {
    if (duration > bestDayDuration) {
      bestDayDuration = duration;
      bestDay = day;
    }
  });

  const bestDayTotalElement = bestDayValue.parentElement.querySelector(".date");

  if (bestDay !== null) {
    bestDayValue.textContent = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
    }).format(new Date(bestDay));

    if (bestDayTotalElement) {
      bestDayTotalElement.textContent = `${formatDuration(bestDayDuration)} total`;
    }
  } else {
    bestDayValue.textContent = "—";

    if (bestDayTotalElement) {
      bestDayTotalElement.textContent = "No sessions yet";
    }
  }
}

// ======================================================
// 10. LEAVE PAGE WARNING
// ======================================================

const ACTIVE_TIMER_KEY = "devSessionTrackerActiveTimer";
const LEAVE_WARNING_KEY = "devSessionTrackerLeaveWarning";

function saveActiveTimerState() {
  if (timerState === "idle") return;

  const activeTimerData = {
    timerState: timerState,
    elapsedMs: getElapsedTime(),
    sessionStartedAt: sessionStartedAt,
    title: titleInput.value,
    note: noteInput.value,
    mode: modeSelect.value,
  };

  try {
    localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(activeTimerData));
  } catch (error) {
    console.error("Failed to save active timer:", error);
  }
}

function restoreActiveTimerState() {
  try {
    const storedData = localStorage.getItem(ACTIVE_TIMER_KEY);

    if (!storedData) return;

    const savedTimer = JSON.parse(storedData);

    if (
      !savedTimer ||
      !["running", "paused"].includes(savedTimer.timerState) ||
      !Number.isFinite(savedTimer.elapsedMs) ||
      savedTimer.elapsedMs < 0 ||
      !Number.isFinite(savedTimer.sessionStartedAt)
    ) {
      return;
    }

    elapsedMs = savedTimer.elapsedMs;
    sessionStartedAt = savedTimer.sessionStartedAt;

    runningSince = null;
    timerState = "paused";

    titleInput.value =
      typeof savedTimer.title === "string" ? savedTimer.title : "";

    noteInput.value =
      typeof savedTimer.note === "string" ? savedTimer.note : "";

    const validModes = ["focus", "learning", "deep-work"];

    if (validModes.includes(savedTimer.mode)) {
      modeSelect.value = savedTimer.mode;
    }

    updateTimerDisplay();
    updateTimerStatus();
  } catch (error) {
    console.error("Failed to restore active timer:", error);
  }
}

function clearStoredActiveTimer() {
  try {
    localStorage.removeItem(ACTIVE_TIMER_KEY);
  } catch (error) {
    console.error("Failed to clear active timer:", error);
  }
}

function updateLeaveWarningUI() {
  leaveWarningToggle.checked = leaveWarningEnabled;

  leaveWarningTitle.textContent = leaveWarningEnabled
    ? "Leave page warning enabled"
    : "Leave page warning disabled";

  leaveWarningDescription.textContent = leaveWarningEnabled
    ? "You'll be notified before leaving if a timer is running and not saved."
    : "Leave page notifications are currently disabled.";
}

function loadLeaveWarningSetting() {
  try {
    const storedSetting = localStorage.getItem(LEAVE_WARNING_KEY);

    if (storedSetting !== null) {
      leaveWarningEnabled = storedSetting === "true";
    }
  } catch (error) {
    console.error("Failed to load warning setting:", error);
  }

  updateLeaveWarningUI();
}

function handleLeaveWarningToggle() {
  leaveWarningEnabled = leaveWarningToggle.checked;

  try {
    localStorage.setItem(LEAVE_WARNING_KEY, String(leaveWarningEnabled));
  } catch (error) {
    console.error("Failed to save warning setting:", error);
  }

  updateLeaveWarningUI();
}

function previewLeaveWarning() {
  alert(
    "Preview: You have an unsaved coding session. Are you sure you want to leave this page?",
  );
}

function handleBeforeUnload(event) {
  if (!leaveWarningEnabled) return;

  if (timerState !== "running") return;

  event.preventDefault();
  event.returnValue = "";
}

// ======================================================
// 11. SETTINGS
// ======================================================

let settingsDialog = null;

function createSettingsDialog() {
  const dialog = document.createElement("dialog");

  dialog.className = "settings-dialog";

  dialog.innerHTML = `
    <div class="settings-dialog-content">
      <div class="settings-dialog-header">
        <div>
          <h2>Settings</h2>
          <p>Customize your Dev Session Tracker.</p>
        </div>

        <button
          class="settings-close-btn"
          type="button"
          aria-label="Close settings"
        >
          <i data-lucide="x"></i>
        </button>
      </div>

      <div class="settings-dialog-body">
        <label class="settings-option">
          <div class="settings-option-info">
            <i data-lucide="shield-check"></i>

            <div>
              <h3>Leave Page Warning</h3>
              <p>Show a warning before leaving an active session.</p>
            </div>
          </div>

          <input
            type="checkbox"
            id="settingsLeaveWarningToggle"
          />
        </label>

        <div class="settings-option">
          <div class="settings-option-info">
            <i data-lucide="save"></i>

            <div>
              <h3>Auto Save</h3>
              <p>Your active session is backed up automatically.</p>
            </div>
          </div>

          <span class="settings-status">Enabled</span>
        </div>

        <div class="settings-option">
          <div class="settings-option-info">
            <i data-lucide="database"></i>

            <div>
              <h3>Saved Sessions</h3>
              <p>Sessions stored in this browser.</p>
            </div>
          </div>

          <span
            class="settings-count"
            id="settingsSavedSessions"
          >0</span>
        </div>
      </div>

      <button class="settings-done-btn" type="button">
        Done
      </button>
    </div>
  `;

  const closeBtn = dialog.querySelector(".settings-close-btn");
  const doneBtn = dialog.querySelector(".settings-done-btn");
  const warningToggle = dialog.querySelector("#settingsLeaveWarningToggle");

  closeBtn.addEventListener("click", () => dialog.close());

  doneBtn.addEventListener("click", () => dialog.close());

  warningToggle.addEventListener("change", () => {
    leaveWarningToggle.checked = warningToggle.checked;

    handleLeaveWarningToggle();
  });

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  document.body.appendChild(dialog);

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  return dialog;
}

function openSettings() {
  if (!settingsDialog) {
    settingsDialog = createSettingsDialog();
  }

  const warningToggle = settingsDialog.querySelector(
    "#settingsLeaveWarningToggle",
  );

  const savedSessionsCount = settingsDialog.querySelector(
    "#settingsSavedSessions",
  );

  warningToggle.checked = leaveWarningEnabled;
  savedSessionsCount.textContent = sessions.length;

  if (!settingsDialog.open) {
    settingsDialog.showModal();
  }
}

function closeSettings() {
  if (!settingsDialog || !settingsDialog.open) return;

  settingsDialog.close();
}

// ======================================================
// 12. UPDATE UI
// ======================================================

function updateTimerButtons() {
  const isIdle = timerState === "idle";
  const isRunning = timerState === "running";
  const isPaused = timerState === "paused";

  startBtn.disabled = isRunning;
  pauseBtn.disabled = !isRunning;
  stopSaveBtn.disabled = isIdle;

  const startBtnText = startBtn.querySelector("span");

  if (startBtnText) {
    startBtnText.textContent = isPaused ? "Resume" : "Start";
  }
}

function clearSessionInputs() {
  titleInput.value = "";
  noteInput.value = "";
  modeSelect.value = "focus";
}

function updateUI() {
  updateTimerDisplay();
  updateTimerStatus();
  updateTimerButtons();

  filterSessions();
  updateStatistics();
}

// ======================================================
// 13. RESET
// ======================================================

function resetTimer() {
  if (timerState !== "idle") {
    const confirmed = window.confirm(
      "Are you sure you want to reset the current session? Unsaved progress will be lost.",
    );

    if (!confirmed) return;
  }

  clearInterval(timerIntervalId);
  timerIntervalId = null;

  timerState = "idle";
  elapsedMs = 0;
  runningSince = null;
  sessionStartedAt = null;

  clearStoredActiveTimer();
  clearSessionInputs();

  updateTimerDisplay();
  updateTimerStatus();
  updateTimerButtons();
}

// ======================================================
// 14. EVENT LISTENERS
// ======================================================

startBtn.addEventListener("click", startTimer);
pauseBtn.addEventListener("click", pauseTimer);
stopSaveBtn.addEventListener("click", saveSession);
resetBtn.addEventListener("click", resetTimer);

sessionHistoryGrid.addEventListener("click", handleSessionHistoryClick);

searchInput.addEventListener("input", handleSearch);

filterButtons.forEach((button) => {
  button.addEventListener("click", handleFilterClick);
});

exportBtn.addEventListener("click", exportSessions);
importBtn.addEventListener("click", importSessions);
clearAllBtn.addEventListener("click", clearAllSessions);

previewMessageBtn.addEventListener("click", previewLeaveWarning);

leaveWarningToggle.addEventListener("change", handleLeaveWarningToggle);

window.addEventListener("beforeunload", handleBeforeUnload);
window.addEventListener("pagehide", saveActiveTimerState);

titleInput.addEventListener("input", saveActiveTimerState);
noteInput.addEventListener("input", saveActiveTimerState);
modeSelect.addEventListener("change", saveActiveTimerState);

settingsBtn.addEventListener("click", openSettings);

// ======================================================
// 15. INITIALIZE APP
// ======================================================

function initApp() {
  loadData();
  loadLeaveWarningSetting();
  restoreActiveTimerState();

  updateUI();

  setInterval(saveActiveTimerState, 3000);
  setInterval(updateStatistics, 60000);
}

initApp();
