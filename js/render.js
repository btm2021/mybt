(function (app) {
  const state = app.state;
  const dom = app.dom;
  const logic = app.logic;
  const { toOneDecimal } = app.utils;
  const { DEFAULT_CAPITAL } = app.constants;
  let strategyChart = null;
  function escapeAttribute(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  }


  function renderSummaryCards() {
    const totals = logic.computeTotals();
    const winRate = logic.computeWinRate(totals.wins, totals.trades);

    const cards = [
      { title: "Total symbols", value: totals.symbols },
      { title: "Total trades", value: totals.trades },
      { title: "Win trades", value: totals.wins },
      { title: "Loss trades", value: totals.losses },
      { title: "Win rate", value: `${toOneDecimal(winRate)}%` },
      { title: "Big wins", value: totals.bigWins }
    ];

    dom.summaryCardsEl.innerHTML = cards
      .map((card) => `
        <article class="card">
          <h3>${card.title}</h3>
          <strong>${card.value}</strong>
          ${card.title === "Win rate" ? "<small>Minimum ROE for Win: 2.5%</small>" : ""}
        </article>
      `)
      .join("");
  }

  function renderModeStats() {
    const totals = logic.computeTotals();
    const labels = {
      single: "Single",
      multi: "Multi",
      combi: "Combi"
    };

    const rows = Object.entries(totals.mode)
      .map(([modeKey, data]) => {
        const winRate = logic.computeWinRate(data.wins, data.trades);
        return `
          <tr>
            <td>${labels[modeKey]}</td>
            <td>${data.trades}</td>
            <td>${data.wins}</td>
            <td>${data.losses}</td>
            <td>${toOneDecimal(winRate)}%</td>
            <td>${data.bigWins}</td>
          </tr>
        `;
      })
      .join("");

    dom.modeStatsTableBody.innerHTML = rows;
  }

  function renderSymbolStats() {
    if (!state.symbols.length) {
      dom.symbolStatsEl.innerHTML = '<div class="empty-state">No symbols yet.</div>';
      return;
    }

    const rows = state.symbols
      .map((symbol) => {
        const stats = logic.computeSymbolStats(symbol);
        const winRate = logic.computeWinRate(stats.wins, stats.totalTrades);
        return `
          <tr>
            <td>${symbol.name}</td>
            <td>${stats.totalTrades}</td>
            <td>${stats.wins}</td>
            <td>${stats.losses}</td>
            <td>${toOneDecimal(winRate)}%</td>
            <td>${stats.bigWins}</td>
          </tr>
        `;
      })
      .join("");

    dom.symbolStatsEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Trades</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Win %</th>
            <th>Big Wins</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderCapitalStrategies() {
    if (!state.symbols.length) {
      dom.capitalStrategiesEl.innerHTML = '<div class="empty-state">Add a symbol to see suggestions.</div>';
      return;
    }

    dom.capitalStrategiesEl.innerHTML = state.symbols
      .map((symbol) => {
        const stats = logic.computeSymbolStats(symbol);
        const winRate = logic.computeWinRate(stats.wins, stats.totalTrades);
        const kellyFraction = logic.computeKellyFraction(symbol);
        const kellyStake = symbol.baseCapital * (kellyFraction / 20);
        const twoPercent = symbol.baseCapital * 0.02;
        const martingaleStake = logic.computeMartingaleStake(symbol);
        const antiMartingaleStake = logic.computeAntiMartingaleStake(symbol);

        return `
          <article class="card">
            <h3>${symbol.name} - ${symbol.exchange}</h3>
            <small>Win rate: ${toOneDecimal(winRate)}%</small>
            <p>Kelly fraction (approx): ${toOneDecimal(kellyFraction * 100)}%</p>
            <p>Stake from Kelly/20: ${kellyStake.toFixed(2)} USDT</p>
            <p>Fixed 2% stake: ${twoPercent.toFixed(2)} USDT</p>
            <p>Martingale next stake: ${martingaleStake.toFixed(2)} USDT</p>
            <p>Anti-martingale next stake: ${antiMartingaleStake.toFixed(2)} USDT</p>
          </article>
        `;
      })
      .join("");
  }

  function renderSymbolList() {
    if (!state.symbols.length) {
      dom.symbolListEl.innerHTML = '<div class="empty-state">Create a symbol to begin.</div>';
      return;
    }

    dom.symbolListEl.innerHTML = state.symbols
      .map((symbol) => {
        const isActive = state.selectedSymbolId === symbol.id;
        const stats = logic.computeSymbolStats(symbol);
        return `
          <div class="symbol-item ${isActive ? 'active' : ''}" data-id="${symbol.id}">
            <div class="symbol-item-main">
              <strong>${symbol.name}</strong>
              <div class="symbol-meta">${symbol.exchange} - ${symbol.timeframe}</div>
            </div>
            <div class="symbol-item-stats">${stats.wins}/${stats.totalTrades}</div>
            <button type="button" class="symbol-delete-btn" data-symbol-id="${symbol.id}" title="Delete Symbol">&times;</button>
          </div>
        `;
      })
      .join("");
  }

  function renderActiveSymbolInfo() {
    const symbol = logic.getSelectedSymbol();
    if (!symbol) {
      dom.activeSymbolInfo.innerHTML = '<div class="empty-state">Select a symbol to start logging trades.</div>';
      dom.tradeForm.classList.add("disabled");
      dom.tradeForm.querySelectorAll("input, textarea, select, button").forEach((el) => {
        el.disabled = true;
      });
      return;
    }

    dom.tradeForm.classList.remove("disabled");
    dom.tradeForm.querySelectorAll("input, textarea, select, button").forEach((el) => {
      el.disabled = false;
    });

    const stats = logic.computeSymbolStats(symbol);
    const winRate = logic.computeWinRate(stats.wins, stats.totalTrades);

    dom.activeSymbolInfo.innerHTML = `
      <div class="active-symbol">
        <h3>${symbol.name}</h3>
        <div class="symbol-meta">${symbol.exchange} - ${symbol.timeframe}</div>
        <div class="note">Default capital: ${symbol.baseCapital.toFixed(2)} USDT</div>
        <div class="note">Current win rate: ${toOneDecimal(winRate)}%</div>
        ${symbol.indicators.length ? `
          <div><strong>Indicators:</strong>
            <div class="tag-list">${symbol.indicators.map((indicator) => `<span class="tag">${indicator}</span>`).join("")}</div>
          </div>` : ""}
        ${symbol.comment ? `<div class="note">${symbol.comment}</div>` : ""}
      </div>
    `;
  }

  function renderTradeHistory() {
    const symbol = logic.getSelectedSymbol();
    if (!symbol) {
      dom.tradeHistoryEl.innerHTML = '<div class="empty-state">No trades yet.</div>';
      return;
    }

    const groups = [
      { key: 'single', label: 'Single' },
      { key: 'multi', label: 'Multi' },
      { key: 'combi', label: 'Combi' }
    ];

    const currentMode = state.activeAnalysisMode || "single";

    const columns = groups.map((group) => {
      const trades = symbol.trades
        .filter((trade) => trade.mode === group.key)
        .slice()
        .reverse();

      const badges = trades
        .map((trade, index) => {
          const number = index + 1;
          const resultIcon = trade.result === 'win' ? '✔' : '✗';
          const classes = ['trade-badge', trade.result === 'win' ? 'win' : 'loss'];
          if (trade.isBigWin) {
            classes.push('big');
          }
          const tooltipParts = [`#${number}`, group.label];
          if (trade.notes) {
            tooltipParts.push(trade.notes);
          }
          const tooltip = escapeAttribute(tooltipParts.join(' - '));
          return `<button type="button" class="${classes.join(' ')}" data-id="${trade.id}" data-mode="${group.key}" title="${tooltip}">${resultIcon}</button>`;
        })
        .join('');

      const body = badges || '<span class="trade-empty">No trades</span>';
      const isActive = group.key === currentMode;

      return `
        <section class="trade-column ${isActive ? 'active' : ''}" data-mode="${group.key}">
          <header>
            <span class="column-title">${group.label}</span>
            <span class="column-count">${trades.length}</span>
          </header>
          <div class="trade-badges">
            ${body}
          </div>
        </section>
      `;
    }).join('');

    dom.tradeHistoryEl.innerHTML = `<div class="trade-columns">${columns}</div>`;
  }

  function addTradeBlinkAnimation(mode, result) {
    // Find the newest trade badge in the specified mode column
    const column = document.querySelector(`.trade-column[data-mode="${mode}"]`);
    if (!column) return;

    const badges = column.querySelectorAll('.trade-badge');
    if (badges.length === 0) return;

    // Get the first badge (newest trade since they're reversed)
    const newestBadge = badges[0];
    
    // Add blink animation
    const animationClass = result === 'win' ? 'blink-win' : 'blink-loss';
    newestBadge.classList.add(animationClass);
    
    // Remove animation class after animation completes
    setTimeout(() => {
      newestBadge.classList.remove(animationClass);
    }, 1500);
  }

  function renderStrategyAnalysis() {
    if (!dom.strategyAnalysisPanel) {
      return;
    }

    const statsEls = dom.strategyStats || {};
    const strategy = state.activeStrategy || "fixed";

    if (Array.isArray(dom.strategyTabs)) {
      dom.strategyTabs.forEach((tab) => {
        const isActive = tab.dataset.strategy === strategy;
        tab.classList.toggle("active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    }

    const applyStats = (summary) => {
      const data = summary || {
        total: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        longestWin: 0,
        longestLoss: 0
      };
      if (statsEls.totalTrades) statsEls.totalTrades.textContent = data.total.toString();
      if (statsEls.wins) statsEls.wins.textContent = data.wins.toString();
      if (statsEls.losses) statsEls.losses.textContent = data.losses.toString();
      if (statsEls.winRate) statsEls.winRate.textContent = `${toOneDecimal(data.winRate)}%`;
      if (statsEls.longestWin) statsEls.longestWin.textContent = data.longestWin.toString();
      if (statsEls.longestLoss) statsEls.longestLoss.textContent = data.longestLoss.toString();
    };

    const resetChart = (message) => {
      if (strategyChart) {
        strategyChart.destroy();
        strategyChart = null;
      }
      if (dom.strategyChartWrapper) {
        dom.strategyChartWrapper.classList.remove("has-data");
      }
      if (dom.strategyEmptyState) {
        dom.strategyEmptyState.textContent = message;
      }
      // Hide strategy table
      const tableWrapper = document.getElementById('strategyTableWrapper');
      const emptyState = document.getElementById('strategyTableEmptyState');
      if (tableWrapper) tableWrapper.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
    };

    const symbol = logic.getSelectedSymbol();
    if (!symbol) {
      applyStats(null);
      resetChart("Chon symbol de bat dau.");
      return;
    }

    const allTrades = Array.isArray(symbol.trades) ? symbol.trades : [];
    const currentMode = state.activeStrategyMode || "single";
    const trades = allTrades.filter(trade => trade.mode === currentMode);
    
    if (!trades.length) {
      applyStats(null);
      resetChart(`Them giao dich ${currentMode} de xem mo phong von.`);
      return;
    }

    const summary = logic.computeTradeBreakdown(trades);
    applyStats(summary);

    const simulation = logic.computeStrategySimulation(trades, strategy, {
      baseCapital: Number.isFinite(symbol.baseCapital) ? symbol.baseCapital : DEFAULT_CAPITAL
    });

    const chartLib = window.Chart;
    if (!chartLib || !dom.strategyChartCanvas) {
      resetChart("Chart khong kha dung.");
      return;
    }

    if (!strategyChart) {
      strategyChart = new chartLib(dom.strategyChartCanvas, {
        type: "line",
        data: {
          labels: simulation.labels,
          datasets: [
            {
              label: "Von",
              data: simulation.equity,
              borderColor: "#111",
              backgroundColor: "rgba(0, 0, 0, 0.08)",
              borderWidth: 2,
              tension: 0.18,
              pointRadius: 2,
              pointHoverRadius: 3,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => `Von: ${context.formattedValue}`
              }
            }
          },
          scales: {
            x: {
              ticks: {
                color: "#333",
                font: { size: 10 }
              },
              grid: {
                color: "rgba(0, 0, 0, 0.08)"
              }
            },
            y: {
              ticks: {
                color: "#333",
                font: { size: 10 }
              },
              grid: {
                color: "rgba(0, 0, 0, 0.08)"
              }
            }
          }
        }
      });
    } else {
      strategyChart.data.labels = simulation.labels;
      strategyChart.data.datasets[0].data = simulation.equity;
      strategyChart.update();
    }

    if (dom.strategyChartWrapper) {
      dom.strategyChartWrapper.classList.add("has-data");
    }
    if (dom.strategyEmptyState) {
      dom.strategyEmptyState.textContent = "";
    }

    // Render strategy table
    renderStrategyTable(symbol, trades, strategy);
  }

  function renderStrategyTable(symbol, trades, strategy) {
    const tableWrapper = document.getElementById('strategyTableWrapper');
    const tableBody = document.getElementById('strategyTableBody');
    const emptyState = document.getElementById('strategyTableEmptyState');
    const tableSummary = document.getElementById('strategyTableSummary');

    if (!tableWrapper || !tableBody || !emptyState) return;

    if (!trades.length) {
      tableWrapper.style.display = 'none';
      emptyState.style.display = 'block';
      if (tableSummary) tableSummary.style.display = 'none';
      return;
    }

    tableWrapper.style.display = 'block';
    emptyState.style.display = 'none';
    if (tableSummary) tableSummary.style.display = 'block';

    // Calculate detailed simulation with trade-by-trade breakdown
    const baseCapital = Number.isFinite(symbol.baseCapital) ? symbol.baseCapital : DEFAULT_CAPITAL;
    const riskPercentage = 0.04; // 4% of current capital
    
    let capital = baseCapital;
    let martingaleLosses = 0;
    let antiWins = 0;
    let baseStakeAmount = baseCapital * riskPercentage; // Initial 4% = 400 USD
    const tradeDetails = [];
    let totalStake = 0;
    let totalPnL = 0;

    trades.forEach((trade, index) => {
      let stake = 0;
      
      // Calculate stake based on strategy
      if (strategy === "fixed") {
        // Fixed: Always 4% of current capital
        stake = capital * riskPercentage;
      } else if (strategy === "martingale") {
        // Martingale: Double the base amount after each loss
        stake = baseStakeAmount * Math.pow(2, martingaleLosses);
      } else if (strategy === "anti-martingale") {
        // Anti-martingale: Double the base amount after each win
        stake = baseStakeAmount * Math.pow(2, antiWins);
      }

      stake = Math.min(stake, capital);
      totalStake += stake;
      
      let pnl = 0;
      let rrRatio = "N/A";

      if (trade.result === "win") {
        // Calculate RR ratio and PnL based on it
        if (trade.isBigWin) {
          rrRatio = "1:2"; // Big win
          pnl = stake * 2; // Big win: RR 1:2
        } else {
          rrRatio = "1:1"; // Normal win
          pnl = stake * 1; // Normal win: RR 1:1
        }
        
        martingaleLosses = 0;
        if (strategy === "anti-martingale") {
          antiWins += 1;
        } else {
          antiWins = 0;
        }
      } else {
        // Loss: lose the stake
        pnl = -stake;
        rrRatio = "1:0"; // Loss
        antiWins = 0;
        if (strategy === "martingale") {
          martingaleLosses += 1;
        } else {
          martingaleLosses = 0;
        }
      }

      capital = Math.max(0, capital + pnl);
      totalPnL += pnl;
      
      // Update base stake for martingale strategies (based on new capital)
      if (strategy === "fixed") {
        // For fixed, base stake is always recalculated from current capital
        // No need to update baseStakeAmount as we calculate from current capital
      } else {
        // For martingale strategies, update base stake when we reset
        if (martingaleLosses === 0 && antiWins === 0) {
          baseStakeAmount = capital * riskPercentage;
        }
      }

      tradeDetails.push({
        index: index + 1,
        result: trade.result,
        isBigWin: trade.isBigWin,
        stake: stake,
        pnl: pnl,
        rrRatio: rrRatio,
        capitalAfter: capital
      });
    });

    // Render table rows
    const rows = tradeDetails.map(detail => {
      const resultClass = detail.result === 'win' ? 'result-win' : 'result-loss';
      const pnlClass = detail.pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
      const resultText = detail.result === 'win' ? 'Win' : 'Loss';
      const bigWinIndicator = detail.isBigWin ? '<span class="big-win-indicator">BIG</span>' : '';
      
      return `
        <tr>
          <td>${detail.index}</td>
          <td class="${resultClass}">${resultText}${bigWinIndicator}</td>
          <td>${detail.stake.toFixed(1)}</td>
          <td class="${pnlClass}">${detail.pnl >= 0 ? '+' : ''}${detail.pnl.toFixed(1)}</td>
          <td class="rr-ratio">${detail.rrRatio}</td>
          <td>${detail.capitalAfter.toFixed(1)}</td>
        </tr>
      `;
    }).join('');

    tableBody.innerHTML = rows;

    // Update summary
    if (tableSummary) {
      const summaryTotalTrades = document.getElementById('summaryTotalTrades');
      const summaryTotalStake = document.getElementById('summaryTotalStake');
      const summaryTotalPnL = document.getElementById('summaryTotalPnL');
      const summaryFinalCapital = document.getElementById('summaryFinalCapital');

      if (summaryTotalTrades) summaryTotalTrades.textContent = trades.length;
      if (summaryTotalStake) summaryTotalStake.textContent = `${totalStake.toFixed(1)} USDT`;
      
      if (summaryTotalPnL) {
        summaryTotalPnL.textContent = `${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(1)} USDT`;
        summaryTotalPnL.className = `summary-value ${totalPnL >= 0 ? 'positive' : 'negative'}`;
      }
      
      if (summaryFinalCapital) {
        summaryFinalCapital.textContent = `${capital.toFixed(1)} USDT`;
        summaryFinalCapital.className = `summary-value ${capital >= baseCapital ? 'positive' : 'negative'}`;
      }
    }
  }

  function renderEverything() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    if (state.isLoading) {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'flex';
      }
      return;
    } else {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
    }
    
    renderSummaryCards();
    renderModeStats();
    renderSymbolStats();
    renderCapitalStrategies();
    renderSymbolList();
    renderActiveSymbolInfo();
    renderTradeHistory();
    renderStrategyAnalysis();
    renderTradeAnalysis();
  }

  function renderTradeAnalysis() {
    const statsEls = dom.analysisStats || {};
    const symbol = logic.getSelectedSymbol();

    const applyStats = (summary, metrics) => {
      const data = summary || {
        total: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        longestWin: 0,
        longestLoss: 0
      };
      
      const metricsData = metrics || {
        return: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        profitFactor: 0
      };

      if (statsEls.totalTrades) statsEls.totalTrades.textContent = data.total.toString();
      if (statsEls.wins) statsEls.wins.textContent = data.wins.toString();
      if (statsEls.losses) statsEls.losses.textContent = data.losses.toString();
      if (statsEls.winRate) statsEls.winRate.textContent = `${toOneDecimal(data.winRate)}%`;
      if (statsEls.longestWin) statsEls.longestWin.textContent = data.longestWin.toString();
      if (statsEls.longestLoss) statsEls.longestLoss.textContent = data.longestLoss.toString();
      
      // New backtest metrics
      if (statsEls.return) {
        statsEls.return.textContent = `${metricsData.return >= 0 ? '+' : ''}${toOneDecimal(metricsData.return)}%`;
        statsEls.return.className = metricsData.return >= 0 ? 'positive' : 'negative';
      }
      if (statsEls.sharpe) {
        statsEls.sharpe.textContent = metricsData.sharpeRatio.toFixed(2);
        statsEls.sharpe.className = metricsData.sharpeRatio >= 1 ? 'positive' : (metricsData.sharpeRatio >= 0 ? '' : 'negative');
      }
      if (statsEls.maxDD) {
        statsEls.maxDD.textContent = `-${toOneDecimal(metricsData.maxDrawdown)}%`;
        statsEls.maxDD.className = 'negative';
      }
      if (statsEls.profitFactor) {
        statsEls.profitFactor.textContent = metricsData.profitFactor.toFixed(2);
        statsEls.profitFactor.className = metricsData.profitFactor >= 1 ? 'positive' : 'negative';
      }
    };

    if (!symbol) {
      applyStats(null, null);
      return;
    }

    const allTrades = Array.isArray(symbol.trades) ? symbol.trades : [];
    const currentMode = state.activeAnalysisMode || "single";
    const trades = allTrades.filter(trade => trade.mode === currentMode);
    
    if (!trades.length) {
      applyStats(null, null);
      return;
    }

    const summary = logic.computeTradeBreakdown(trades);
    const metrics = logic.computeBacktestMetrics(trades, symbol, state.activeStrategy || "fixed");
    applyStats(summary, metrics);
  }

  app.render = {
    renderSummaryCards,
    renderModeStats,
    renderSymbolStats,
    renderCapitalStrategies,
    renderSymbolList,
    renderActiveSymbolInfo,
    renderTradeHistory,
    renderStrategyAnalysis,
    renderEverything,
    renderTradeAnalysis,
    addTradeBlinkAnimation
  };
})(window.BacktestApp);