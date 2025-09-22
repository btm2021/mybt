(function (app) {
  const state = app.state;
  const dom = app.dom;
  const logic = app.logic;
  const { toOneDecimal } = app.utils;
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

    dom.globalWinRateNote.textContent = totals.trades
      ? `Current win rate: ${toOneDecimal(winRate)}%. Minimum ROE counted as win: 2.5%.`
      : "No trades recorded yet.";
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
            <div>
              <strong>${symbol.name}</strong>
              <div class="symbol-meta">${symbol.exchange} - ${symbol.timeframe}</div>
            </div>
            <div class="symbol-meta">${stats.wins}/${stats.totalTrades}</div>
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

    const columns = groups.map((group) => {
      const trades = symbol.trades
        .filter((trade) => trade.mode === group.key)
        .slice()
        .reverse();

      const badges = trades
        .map((trade, index) => {
          const number = index + 1;
          const resultIcon = trade.result === 'win' ? '✔' : '✖';
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

      return `
        <section class="trade-column" data-mode="${group.key}">
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
  function renderEverything() {
    renderSummaryCards();
    renderModeStats();
    renderSymbolStats();
    renderCapitalStrategies();
    renderSymbolList();
    renderActiveSymbolInfo();
    renderTradeHistory();
  }

  app.render = {
    renderSummaryCards,
    renderModeStats,
    renderSymbolStats,
    renderCapitalStrategies,
    renderSymbolList,
    renderActiveSymbolInfo,
    renderTradeHistory,
    renderEverything
  };
})(window.BacktestApp);



