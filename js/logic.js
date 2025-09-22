(function (app) {
  const state = app.state;
  const dom = app.dom;
  const { DEFAULT_CAPITAL } = app.constants;
  const { saveState, generateId, ensureInit } = app.utils;

  function getSymbolById(id) {
    return state.symbols.find((symbol) => symbol.id === id) || null;
  }

  function getSelectedSymbol() {
    if (!state.selectedSymbolId) return null;
    return getSymbolById(state.selectedSymbolId);
  }

  async function upsertStateSymbol(symbol) {
    try {
      await ensureInit();
      await app.firebaseService.saveSymbol(symbol);
      const index = state.symbols.findIndex((item) => item.id === symbol.id);
      if (index >= 0) {
        state.symbols[index] = symbol;
      } else {
        state.symbols.push(symbol);
      }
    } catch (error) {
      console.error('Error saving symbol:', error);
      throw error;
    }
  }

  async function setActiveView(viewKey) {
    state.activeView = viewKey;
    dom.viewButtons.forEach((btn) => {
      const isActive = btn.dataset.view === viewKey;
      btn.classList.toggle("active", isActive);
    });
    Object.entries(dom.views).forEach(([key, el]) => {
      el.classList.toggle("active", key === viewKey);
    });
    await saveState(state);
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

  async function handleSymbolSubmit(event) {
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

    return app.loadingManager.withLoading(async () => {
      try {
        await ensureInit();
        await app.firebaseService.saveSymbol(newSymbol);
        state.symbols.push(newSymbol);
        state.selectedSymbolId = newSymbol.id;
        await saveState(state);
        dom.symbolForm.reset();
        return true;
      } catch (error) {
        console.error('Error creating symbol:', error);
        alert('Lỗi khi tạo symbol. Vui lòng thử lại.');
        return false;
      }
    }, `Đang tạo symbol ${name}...`);
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

  async function addTrade(result) {
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

    // Auto-determine big win based on ROE (>= 5% is considered big win for RR 1:2)
    const autoBigWin = result === "win" && roe >= 5.0;
    const isBigWin = Boolean(dom.bigWinToggle.checked) || autoBigWin;

    const trade = {
      id: generateId("trade"),
      result,
      mode,
      indicator: mode === "single" ? indicator : "",
      combo: mode !== "single" ? combo : "",
      notes: dom.notesInput.value.trim(),
      roe: Number.isFinite(roe) ? roe : 0,
      isBigWin: isBigWin,
      timestamp: new Date().toISOString()
    };

    return app.loadingManager.withLoading(async () => {
      try {
        await ensureInit();
        await app.firebaseService.saveTrade(trade, symbol.id);
        symbol.trades.push(trade);
        await upsertStateSymbol(symbol);

        dom.notesInput.value = "";
        dom.bigWinToggle.checked = false;
        
        // Store trade info for animation
        app.lastAddedTrade = {
          mode: trade.mode,
          result: trade.result
        };
        
        return true;
      } catch (error) {
        console.error('Error adding trade:', error);
        alert('Lỗi khi thêm trade. Vui lòng thử lại.');
        return false;
      }
    }, `Đang thêm trade ${result}...`);
  }

  async function deleteTrade(tradeId) {
    const symbol = getSelectedSymbol();
    if (!symbol) {
      return false;
    }

    const index = symbol.trades.findIndex((trade) => trade.id === tradeId);
    if (index === -1) {
      return false;
    }

    return app.loadingManager.withLoading(async () => {
      try {
        await ensureInit();
        await app.firebaseService.deleteTrade(tradeId);
        symbol.trades.splice(index, 1);
        await upsertStateSymbol(symbol);
        return true;
      } catch (error) {
        console.error('Error deleting trade:', error);
        alert('Lỗi khi xóa trade. Vui lòng thử lại.');
        return false;
      }
    }, 'Đang xóa trade...');
  }

  async function updateTrade(tradeId, changes) {
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

    return app.loadingManager.withLoading(async () => {
      try {
        await ensureInit();
        await app.firebaseService.updateTrade(tradeId, changes);
        await upsertStateSymbol(symbol);
        return true;
      } catch (error) {
        console.error('Error updating trade:', error);
        alert('Lỗi khi cập nhật trade. Vui lòng thử lại.');
        return false;
      }
    }, 'Đang cập nhật trade...');
  }

  async function deleteSymbol(symbolId) {
    const index = state.symbols.findIndex((symbol) => symbol.id === symbolId);
    if (index === -1) {
      return false;
    }

    const symbolName = state.symbols[index].name;
    const confirmed = confirm(`Are you sure you want to delete the symbol "${symbolName}"? This will also delete all its trades.`);
    if (!confirmed) {
      return false;
    }

    return app.loadingManager.withLoading(async () => {
      try {
        await ensureInit();
        await app.firebaseService.deleteSymbol(symbolId);
        state.symbols.splice(index, 1);
        if (state.selectedSymbolId === symbolId) {
          state.selectedSymbolId = state.symbols.length > 0 ? state.symbols[0].id : null;
        }
        await saveState(state);
        return true;
      } catch (error) {
        console.error('Error deleting symbol:', error);
        alert('Lỗi khi xóa symbol. Vui lòng thử lại.');
        return false;
      }
    }, `Đang xóa symbol ${symbolName}...`);
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

  function computeBacktestMetrics(trades = [], symbol = null, strategy = "fixed") {
    if (!trades.length || !symbol) {
      return {
        return: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        profitFactor: 0
      };
    }

    const baseCapital = Number.isFinite(symbol.baseCapital) ? symbol.baseCapital : DEFAULT_CAPITAL;
    const riskPercentage = 0.04;
    
    let capital = baseCapital;
    let martingaleLosses = 0;
    let antiWins = 0;
    let baseStakeAmount = baseCapital * riskPercentage;
    
    const equityCurve = [baseCapital];
    const returns = [];
    let totalProfit = 0;
    let totalLoss = 0;
    let peak = baseCapital;
    let maxDrawdown = 0;

    trades.forEach((trade) => {
      if (!trade) return;

      let stake = 0;
      
      // Calculate stake based on strategy
      if (strategy === "fixed") {
        stake = capital * riskPercentage;
      } else if (strategy === "martingale") {
        stake = baseStakeAmount * Math.pow(2, martingaleLosses);
      } else if (strategy === "anti-martingale") {
        stake = baseStakeAmount * Math.pow(2, antiWins);
      }

      stake = Math.min(stake, capital);
      let pnl = 0;

      if (trade.result === "win") {
        if (trade.isBigWin) {
          pnl = stake * 2; // RR 1:2
        } else {
          pnl = stake * 1; // RR 1:1
        }
        totalProfit += pnl;
        
        martingaleLosses = 0;
        if (strategy === "anti-martingale") {
          antiWins += 1;
        } else {
          antiWins = 0;
        }
      } else {
        pnl = -stake;
        totalLoss += Math.abs(pnl);
        
        antiWins = 0;
        if (strategy === "martingale") {
          martingaleLosses += 1;
        } else {
          martingaleLosses = 0;
        }
      }

      capital = Math.max(0, capital + pnl);
      equityCurve.push(capital);
      
      // Calculate return for this trade
      const tradeReturn = pnl / (capital - pnl);
      returns.push(tradeReturn);
      
      // Update peak and drawdown
      if (capital > peak) {
        peak = capital;
      }
      const drawdown = (peak - capital) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
      
      // Update base stake for martingale strategies
      if (strategy === "fixed") {
        // For fixed, base stake is always recalculated from current capital
      } else {
        if (martingaleLosses === 0 && antiWins === 0) {
          baseStakeAmount = capital * riskPercentage;
        }
      }
    });

    // Calculate metrics
    const totalReturn = ((capital - baseCapital) / baseCapital) * 100;
    
    // Sharpe Ratio calculation
    let sharpeRatio = 0;
    if (returns.length > 1) {
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
      const stdDev = Math.sqrt(variance);
      
      if (stdDev > 0) {
        // Annualized Sharpe (assuming daily trades, 252 trading days per year)
        sharpeRatio = (avgReturn * Math.sqrt(252)) / stdDev;
      }
    }
    
    // Profit Factor
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : (totalProfit > 0 ? 999 : 0);

    return {
      return: totalReturn,
      sharpeRatio: sharpeRatio,
      maxDrawdown: maxDrawdown * 100, // Convert to percentage
      profitFactor: profitFactor
    };
  }

  function computeStrategySimulation(trades = [], strategyKey = "fixed", options = {}) {
    const baseCapital = Number.isFinite(options.baseCapital) ? options.baseCapital : DEFAULT_CAPITAL;
    const riskPercentage = 0.04; // 4% of current capital
    const labels = ["Start"];
    const equity = [Number.parseFloat(baseCapital.toFixed(2))];
    let capital = baseCapital;
    let martingaleLosses = 0;
    let antiWins = 0;
    let baseStakeAmount = baseCapital * riskPercentage; // Initial 4% = 400 USD

    trades.forEach((trade, index) => {
      if (!trade) {
        return;
      }

      let stake = 0;
      
      if (strategyKey === "fixed") {
        // Fixed: Always 4% of current capital
        stake = capital * riskPercentage;
      } else if (strategyKey === "martingale") {
        // Martingale: Double the base amount after each loss
        stake = baseStakeAmount * Math.pow(2, martingaleLosses);
      } else if (strategyKey === "anti-martingale") {
        // Anti-martingale: Double the base amount after each win
        stake = baseStakeAmount * Math.pow(2, antiWins);
      }

      stake = Math.min(stake, capital);
      let pnl = 0;

      if (trade.result === "win") {
        // PnL based on RR ratio
        if (trade.isBigWin) {
          pnl = stake * 2; // Big win: RR 1:2
        } else {
          pnl = stake * 1; // Normal win: RR 1:1
        }
        
        martingaleLosses = 0;
        if (strategyKey === "anti-martingale") {
          antiWins += 1;
        } else {
          antiWins = 0;
        }
      } else {
        // Loss: lose the stake
        pnl = -stake;
        antiWins = 0;
        if (strategyKey === "martingale") {
          martingaleLosses += 1;
        } else {
          martingaleLosses = 0;
        }
      }

      capital = Math.max(0, capital + pnl);
      
      // Update base stake for martingale strategies (based on new capital)
      if (strategyKey === "fixed") {
        // For fixed, base stake is always recalculated from current capital
        // No need to update baseStakeAmount as we calculate from current capital
      } else {
        // For martingale strategies, update base stake when we reset
        if (martingaleLosses === 0 && antiWins === 0) {
          baseStakeAmount = capital * riskPercentage;
        }
      }
      
      labels.push(`#${index + 1}`);
      equity.push(Number.parseFloat(capital.toFixed(2)));
    });

    return { labels, equity };
  }

  async function clearAllData() {
    const confirmed = confirm("Are you sure you want to delete all data? This action cannot be undone.");
    if (!confirmed) {
      return false;
    }

    return app.loadingManager.withLoading(async () => {
      try {
        await ensureInit();
        await app.firebaseService.clearAllData();
        state.symbols = [];
        state.selectedSymbolId = null;
        state.activeView = "dashboard";
        state.activeStrategy = "fixed";
        return true;
      } catch (error) {
        console.error('Error clearing all data:', error);
        alert('Lỗi khi xóa dữ liệu. Vui lòng thử lại.');
        return false;
      }
    }, 'Đang xóa tất cả dữ liệu...');
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
    computeBacktestMetrics,
    computeStrategySimulation,
    clearAllData
  };
})(window.BacktestApp);
