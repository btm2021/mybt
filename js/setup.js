window.BacktestApp = window.BacktestApp || {};

(function (app) {
  const STORAGE_KEY = "manualBacktestState_v1";
  const DEFAULT_CAPITAL = 1000;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { symbols: [], selectedSymbolId: null, activeView: "dashboard" };
      }
      const parsed = JSON.parse(raw);
      return {
        symbols: Array.isArray(parsed.symbols) ? parsed.symbols : [],
        selectedSymbolId: parsed.selectedSymbolId || null,
        activeView: parsed.activeView || "dashboard"
      };
    } catch (error) {
      console.warn("Unable to read localStorage:", error);
      return { symbols: [], selectedSymbolId: null, activeView: "dashboard" };
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function generateId(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
  }

  function toOneDecimal(value) {
    if (!Number.isFinite(value)) return "0.0";
    return (Math.round(value * 10) / 10).toFixed(1);
  }

  function formatTimestamp(isoString) {
    return new Date(isoString).toLocaleString();
  }

  const state = loadState();

  const dom = {
    viewButtons: Array.from(document.querySelectorAll(".nav-btn")),
    views: {
      dashboard: document.getElementById("dashboardView"),
      backtest: document.getElementById("backtestView")
    },
    summaryCardsEl: document.getElementById("summaryCards"),
    modeStatsTableBody: document.querySelector("#modeStatsTable tbody"),
    symbolStatsEl: document.getElementById("symbolStats"),
    capitalStrategiesEl: document.getElementById("capitalStrategies"),
    globalWinRateNote: document.getElementById("globalWinRateNote"),
    symbolForm: document.getElementById("symbolForm"),
    symbolNameInput: document.getElementById("symbolName"),
    symbolExchangeInput: document.getElementById("symbolExchange"),
    symbolTimeframeInput: document.getElementById("symbolTimeframe"),
    symbolIndicatorsInput: document.getElementById("symbolIndicators"),
    symbolCommentInput: document.getElementById("symbolComment"),
    symbolListEl: document.getElementById("symbolList"),
    activeSymbolInfo: document.getElementById("activeSymbolInfo"),
    tradeForm: document.getElementById("tradeForm"),
    tradeHistoryEl: document.getElementById("tradeHistory"),
    tradeEditor: document.getElementById("tradeEditor"),
    tradeEditorMeta: document.getElementById("tradeEditorMeta"),
    tradeEditorBigWin: document.getElementById("tradeEditorBigWin"),
    backtestModeSelect: document.getElementById("backtestMode"),
    singleIndicatorGroup: document.getElementById("singleIndicatorGroup"),
    multiIndicatorGroup: document.getElementById("multiIndicatorGroup"),
    primaryIndicatorInput: document.getElementById("primaryIndicator"),
    indicatorComboInput: document.getElementById("indicatorCombo"),
    roeInput: document.getElementById("roeInput"),
    notesInput: document.getElementById("notesInput"),
    bigWinToggle: document.getElementById("bigWinToggle"),
    resultButtons: Array.from(document.querySelectorAll(".button-row button"))
  };

  app.constants = { STORAGE_KEY, DEFAULT_CAPITAL };
  app.state = state;
  app.dom = dom;
  app.utils = {
    saveState,
    generateId,
    toOneDecimal,
    formatTimestamp
  };
})(window.BacktestApp);


