window.BacktestApp = window.BacktestApp || {};

(function (app) {
  const DEFAULT_CAPITAL = 10000;
  let isInitialized = false;

  async function loadState() {
    return app.loadingManager.withLoading(async () => {
      try {
        await ensureInit();
        
        app.loadingManager.updateMessage('Đang tải symbols...');
        const [symbols, settings] = await Promise.all([
          app.firebaseService.getSymbols(),
          app.firebaseService.getUserSettings()
        ]);
        
        // Load trades for each symbol
        app.loadingManager.updateMessage('Đang tải trades...');
        for (const symbol of symbols) {
          symbol.trades = await app.firebaseService.getTradesForSymbol(symbol.id);
        }
        
        return {
          symbols: symbols || [],
          selectedSymbolId: settings.selectedSymbolId || null,
          activeView: settings.activeView || "dashboard",
          activeStrategy: settings.activeStrategy || "fixed"
        };
      } catch (error) {
        console.warn("Unable to load state:", error);
        return { symbols: [], selectedSymbolId: null, activeView: "dashboard", activeStrategy: "fixed" };
      }
    }, 'Đang khởi tạo ứng dụng...');
  }

  async function saveState(state) {
    try {
      await ensureInit();
      
      await app.firebaseService.saveUserSettings({
        selectedSymbolId: state.selectedSymbolId,
        activeView: state.activeView,
        activeStrategy: state.activeStrategy
      });
    } catch (error) {
      console.error("Unable to save state:", error);
    }
  }

  // Version with loading for explicit saves
  async function saveStateWithLoading(state, message = 'Đang lưu...') {
    return app.loadingManager.withLoading(async () => {
      return saveState(state);
    }, message);
  }

  async function ensureInit() {
    if (!isInitialized) {
      try {
        await app.firebaseService.init();
        isInitialized = true;
        console.log('Firebase service initialized');
      } catch (error) {
        console.error("Firebase initialization failed:", error);
        throw error;
      }
    }
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

  // State will be loaded asynchronously
  const state = { 
    symbols: [], 
    selectedSymbolId: null, 
    activeView: "dashboard", 
    activeStrategy: "fixed",
    activeAnalysisMode: "single",
    activeStrategyMode: "single",
    isLoading: true
  };

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
    clearDataBtn: document.getElementById("clearDataBtn"),
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
    strategyAnalysisPanel: document.getElementById("strategyAnalysisPanel"),
    strategyTabs: Array.from(document.querySelectorAll(".analysis-tab")),
    strategySummary: document.getElementById("strategySummary"),
    strategyStats: {
      totalTrades: document.getElementById("strategyTotalTrades"),
      wins: document.getElementById("strategyWins"),
      losses: document.getElementById("strategyLosses"),
      winRate: document.getElementById("strategyWinRate"),
      longestWin: document.getElementById("strategyLongestWin"),
      longestLoss: document.getElementById("strategyLongestLoss")
    },
    strategyChartCanvas: document.getElementById("strategyChart"),
    strategyChartWrapper: document.getElementById("strategyChartWrapper"),
    strategyEmptyState: document.getElementById("strategyEmptyState"),
    strategyTableWrapper: document.getElementById("strategyTableWrapper"),
    strategyTable: document.getElementById("strategyTable"),
    strategyTableBody: document.getElementById("strategyTableBody"),
    strategyTableEmptyState: document.getElementById("strategyTableEmptyState"),
    analysisStats: {
      totalTrades: document.getElementById("analysisTotalTrades"),
      wins: document.getElementById("analysisWins"),
      losses: document.getElementById("analysisLosses"),
      winRate: document.getElementById("analysisWinRate"),
      return: document.getElementById("analysisReturn"),
      sharpe: document.getElementById("analysisSharpe"),
      maxDD: document.getElementById("analysisMaxDD"),
      profitFactor: document.getElementById("analysisProfitFactor"),
      longestWin: document.getElementById("analysisLongestWin"),
      longestLoss: document.getElementById("analysisLongestLoss")
    },
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

  app.constants = { DEFAULT_CAPITAL };
  app.state = state;
  app.dom = dom;
  app.utils = {
    loadState,
    saveState,
    saveStateWithLoading,
    ensureInit,
    generateId,
    toOneDecimal,
    formatTimestamp
  };
})(window.BacktestApp);





