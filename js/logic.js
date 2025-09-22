(function (app) {
  const state = app.state;
  const dom = app.dom;
  const { DEFAULT_CAPITAL } = app.constants;
  const { saveState, generateId } = app.utils;

  function getSymbolById(id) {
    return state.symbols.find((symbol) => symbol.id === id) || null;
  }

  function getSelectedSymbol() {
    if (!state.selectedSymbolId) return null;
    return getSymbolById(state.selectedSymbolId);
  }

  function upsertStateSymbol(symbol) {
    const index = state.symbols.findIndex((item) => item.id === symbol.id);
    if (index >= 0) {
      state.symbols[index] = symbol;
    } else {
      state.symbols.push(symbol);
    }
  }

  function setActiveView(viewKey) {
    state.activeView = viewKey;
    dom.viewButtons.forEach((btn) => {
      const isActive = btn.dataset.view === viewKey;
      btn.classList.toggle("active", isActive);
    });
    Object.entries(dom.views).forEach(([key, el]) => {
      el.classList.toggle("active", key === viewKey);
    });
    saveState(state);
  }

  function createSymbol(payload) {
    return {
      id: generateId("symbol"),
      name: payload.name.trim(),
      exchange: payload.exchange.trim(),
      timeframe: payload.timeframe.trim(),
      indicators: payload.indicators,
      comment: payload.comment,
      baseCapital: DEFAULT_CAPITAL,
      trades: [],
      createdAt: new Date().toISOString()
    };
  }

  function handleSymbolSubmit(event) {
    event.preventDefault();
    const name = dom.symbolNameInput.value;
    const exchange = dom.symbolExchangeInput.value;
    const timeframe = dom.symbolTimeframeInput.value;
    const indicatorsRaw = dom.symbolIndicatorsInput.value;
    const comment = dom.symbolCommentInput.value;

    if (!name || !exchange || !timeframe) {
      return false;
    }

    const indicators = indicatorsRaw
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);

    const newSymbol = createSymbol({
      name,
      exchange,
      timeframe,
      indicators,
      comment: comment.trim()
    });

    state.symbols.push(newSymbol);
    state.selectedSymbolId = newSymbol.id;
    saveState(state);
    dom.symbolForm.reset();
    return true;
  }

  function handleTradeModeChange() {
    const mode = dom.backtestModeSelect.value;
    if (mode === "single") {
      dom.singleIndicatorGroup.style.display = "block";
      dom.multiIndicatorGroup.style.display = "none";
    } else {
      dom.singleIndicatorGroup.style.display = "none";
      dom.multiIndicatorGroup.style.display = "block";
    }
  }

  function addTrade(result) {
    const symbol = getSelectedSymbol();
    if (!symbol) {
      alert("Select a symbol first.");
      return false;
    }

    const mode = dom.backtestModeSelect.value;
    const indicator = dom.primaryIndicatorInput.value.trim();
    const combo = dom.indicatorComboInput.value.trim();
    const roe = parseFloat(dom.roeInput.value);

    if (result === "win" && (!Number.isFinite(roe) || roe < 2.5)) {
      alert("ROE must be at least 2.5% to mark a win.");
      return false;
    }

    const trade = {
      id: generateId("trade"),
      result,
      mode,
      indicator: mode === "single" ? indicator : "",
      combo: mode !== "single" ? combo : "",
      notes: dom.notesInput.value.trim(),
      roe: Number.isFinite(roe) ? roe : 0,
      isBigWin: Boolean(dom.bigWinToggle.checked),
      timestamp: new Date().toISOString()
    };

    symbol.trades.push(trade);
    upsertStateSymbol(symbol);
    saveState(state);

    dom.notesInput.value = "";
    dom.bigWinToggle.checked = false;
    return true;
  }

  function deleteTrade(tradeId) {
    const symbol = getSelectedSymbol();
    if (!symbol) {
      return false;
    }

    const index = symbol.trades.findIndex((trade) => trade.id === tradeId);
    if (index === -1) {
      return false;
    }

    symbol.trades.splice(index, 1);
    upsertStateSymbol(symbol);
    saveState(state);
    return true;
  }

  function updateTrade(tradeId, changes) {
    const symbol = getSelectedSymbol();
    if (!symbol) {
      return false;
    }

    const trade = symbol.trades.find((item) => item.id === tradeId);
    if (!trade) {
      return false;
    }

    if (changes && typeof changes === 'object') {
      if (typeof changes.result === 'string') {
        trade.result = changes.result === 'win' ? 'win' : 'loss';
      }
      if (typeof changes.isBigWin === 'boolean') {
        trade.isBigWin = changes.isBigWin;
      }
    }

    upsertStateSymbol(symbol);
    saveState(state);
    return true;
  }

  function deleteSymbol(symbolId) {
    const index = state.symbols.findIndex((symbol) => symbol.id === symbolId);
    if (index === -1) {
      return false;
    }

    const confirmed = confirm(`Are you sure you want to delete the symbol "${state.symbols[index].name}"? This will also delete all its trades.`);
    if (!confirmed) {
      return false;
    }

    state.symbols.splice(index, 1);
    if (state.selectedSymbolId === symbolId) {
      state.selectedSymbolId = state.symbols.length > 0 ? state.symbols[0].id : null;
    }
    saveState(state);
    return true;
  }

  function computeTotals() {
    const totals = {
      symbols: state.symbols.length,
      trades: 0,
      wins: 0,
      losses: 0,
      bigWins: 0,
      mode: {
        single: { trades: 0, wins: 0, losses: 0, bigWins: 0 },
        multi: { trades: 0, wins: 0, losses: 0, bigWins: 0 },
        combi: { trades: 0, wins: 0, losses: 0, bigWins: 0 }
      }
    };

    state.symbols.forEach((symbol) => {
      symbol.trades.forEach((trade) => {
        totals.trades += 1;
        if (trade.result === "win") totals.wins += 1;
        if (trade.result === "loss") totals.losses += 1;
        if (trade.isBigWin) totals.bigWins += 1;

        if (totals.mode[trade.mode]) {
          totals.mode[trade.mode].trades += 1;
          if (trade.result === "win") totals.mode[trade.mode].wins += 1;
          if (trade.result === "loss") totals.mode[trade.mode].losses += 1;
          if (trade.isBigWin) totals.mode[trade.mode].bigWins += 1;
        }
      });
    });

    return totals;
  }

  function computeSymbolStats(symbol) {
    const stats = {
      symbolId: symbol.id,
      symbolName: symbol.name,
      totalTrades: symbol.trades.length,
      wins: 0,
      losses: 0,
      bigWins: 0,
      mode: {
        single: { trades: 0, wins: 0, losses: 0, bigWins: 0 },
        multi: { trades: 0, wins: 0, losses: 0, bigWins: 0 },
        combi: { trades: 0, wins: 0, losses: 0, bigWins: 0 }
      }
    };

    symbol.trades.forEach((trade) => {
      stats.mode[trade.mode].trades += 1;
      if (trade.result === "win") {
        stats.wins += 1;
        stats.mode[trade.mode].wins += 1;
      }
      if (trade.result === "loss") {
        stats.losses += 1;
        stats.mode[trade.mode].losses += 1;
      }
      if (trade.isBigWin) {
        stats.bigWins += 1;
        stats.mode[trade.mode].bigWins += 1;
      }
    });

    return stats;
  }

  function computeWinRate(wins, trades) {
    if (trades === 0) return 0;
    return (wins / trades) * 100;
  }

  function computeKellyFraction(symbol) {
    const stats = computeSymbolStats(symbol);
    const winRate = stats.totalTrades ? stats.wins / stats.totalTrades : 0;
    const kelly = Math.max(0, (2 * winRate) - 1);
    return kelly;
  }

  function computeMartingaleStake(symbol) {
    const base = symbol.baseCapital * 0.02;
    let stake = base;
    symbol.trades.forEach((trade) => {
      if (trade.result === "loss") {
        stake *= 2;
      } else {
        stake = base;
      }
    });
    return stake;
  }

  function computeAntiMartingaleStake(symbol) {
    const base = symbol.baseCapital * 0.02;
    let stake = base;
    symbol.trades.forEach((trade) => {
      if (trade.result === "win") {
        stake *= 2;
      } else {
        stake = base;
      }
    });
    return stake;
  }
  function computeTradeBreakdown(trades = []) {
    const summary = {
      total: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      longestWin: 0,
      longestLoss: 0
    };
    let currentWin = 0;
    let currentLoss = 0;

    trades.forEach((trade) => {
      if (!trade || !trade.result) {
        return;
      }
      summary.total += 1;
      if (trade.result === "win") {
        summary.wins += 1;
        currentWin += 1;
        currentLoss = 0;
        if (currentWin > summary.longestWin) {
          summary.longestWin = currentWin;
        }
      } else if (trade.result === "loss") {
        summary.losses += 1;
        currentLoss += 1;
        currentWin = 0;
        if (currentLoss > summary.longestLoss) {
          summary.longestLoss = currentLoss;
        }
      }
    });

    if (summary.total > 0) {
      summary.winRate = (summary.wins / summary.total) * 100;
    }

    return summary;
  }

  function computeStrategySimulation(trades = [], strategyKey = "fixed", options = {}) {
    const baseCapital = Number.isFinite(options.baseCapital) ? options.baseCapital : DEFAULT_CAPITAL;
    const riskFraction = Number.isFinite(options.riskFraction) ? options.riskFraction : 0.02;
    const baseStake = baseCapital * riskFraction;
    const labels = ["Start"];
    const equity = [Number.parseFloat(baseCapital.toFixed(2))];
    let capital = baseCapital;
    let martingaleLosses = 0;
    let antiWins = 0;

    trades.forEach((trade, index) => {
      if (!trade) {
        return;
      }

      let stake = baseStake;
      if (strategyKey === "martingale") {
        stake = baseStake * Math.pow(2, martingaleLosses);
      } else if (strategyKey === "anti-martingale") {
        stake = baseStake * Math.pow(2, antiWins);
      }

      stake = Math.min(stake, capital);
      const roe = Number.isFinite(trade.roe) ? trade.roe : 0;
      let pnl = 0;

      if (trade.result === "win") {
        pnl = stake * (roe / 100);
        martingaleLosses = 0;
        if (strategyKey === "anti-martingale") {
          antiWins += 1;
        } else {
          antiWins = 0;
        }
      } else {
        pnl = -stake;
        antiWins = 0;
        if (strategyKey === "martingale") {
          martingaleLosses += 1;
        } else {
          martingaleLosses = 0;
        }
      }

      capital = Math.max(0, capital + pnl);
      labels.push(`#${index + 1}`);
      equity.push(Number.parseFloat(capital.toFixed(2)));
    });

    return { labels, equity };
  }

  function clearAllData() {
    const confirmed = confirm("Are you sure you want to delete all data? This action cannot be undone.");
    if (confirmed) {
      state.symbols = [];
      state.selectedSymbolId = null;
      state.activeView = "dashboard";
      state.activeStrategy = "fixed";
      saveState({
        symbols: [],
        selectedSymbolId: null,
        activeView: "dashboard",
        activeStrategy: "fixed"
      });
      return true;
    }
    return false;
  }

  app.logic = {
    getSymbolById,
    getSelectedSymbol,
    upsertStateSymbol,
    setActiveView,
    createSymbol,
    handleSymbolSubmit,
    handleTradeModeChange,
    addTrade,
    deleteTrade,
    updateTrade,
    deleteSymbol,
    computeTotals,
    computeSymbolStats,
    computeWinRate,
    computeKellyFraction,
    computeMartingaleStake,
    computeAntiMartingaleStake,
    computeTradeBreakdown,
    computeStrategySimulation,
    clearAllData
  };
})(window.BacktestApp);
