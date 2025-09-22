(function (app) {
  const state = app.state;
  const dom = app.dom;
  const logic = app.logic;
  const render = app.render;
  const { saveState } = app.utils;

  const modeLabels = {
    single: 'Single',
    multi: 'Multi',
    combi: 'Combi'
  };

  let editingTradeId = null;

  function closeTradeEditor() {
    if (!dom.tradeEditor) return;
    dom.tradeEditor.classList.remove('is-open');
    dom.tradeEditor.setAttribute('aria-hidden', 'true');
    dom.tradeEditor.dataset.tradeId = '';
    editingTradeId = null;
  }

  function openTradeEditor(tradeId) {
    if (!dom.tradeEditor) return;

    const symbol = logic.getSelectedSymbol();
    if (!symbol) {
      closeTradeEditor();
      return;
    }

    const trade = symbol.trades.find((item) => item.id === tradeId);
    if (!trade) {
      closeTradeEditor();
      return;
    }

    const tradesInMode = symbol.trades.filter((item) => item.mode === trade.mode);
    const position = tradesInMode.findIndex((item) => item.id === tradeId) + 1;
    const modeLabel = modeLabels[trade.mode] || trade.mode;

    editingTradeId = tradeId;
    dom.tradeEditor.dataset.tradeId = tradeId;
    if (dom.tradeEditorBigWin) {
      dom.tradeEditorBigWin.checked = !!trade.isBigWin;
    }
    if (dom.tradeEditorMeta) {
      dom.tradeEditorMeta.textContent = `#${position} - ${modeLabel}${trade.notes ? ` - ${trade.notes}` : ''}`;
    }
    dom.tradeEditor.classList.add('is-open');
    dom.tradeEditor.setAttribute('aria-hidden', 'false');
  }

  if (dom.clearDataBtn) {
    dom.clearDataBtn.addEventListener('click', () => {
      const cleared = logic.clearAllData();
      if (cleared) {
        render.renderEverything();
      }
    });
  }

  dom.viewButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      logic.setActiveView(btn.dataset.view);
      closeTradeEditor();
    });
  });

  dom.symbolListEl.addEventListener('click', (event) => {
    const deleteBtn = event.target.closest('.symbol-delete-btn');
    if (deleteBtn) {
      const symbolId = deleteBtn.dataset.symbolId;
      if (logic.deleteSymbol(symbolId)) {
        render.renderEverything();
      }
      return;
    }

    const item = event.target.closest('.symbol-item');
    if (!item) return;
    state.selectedSymbolId = item.dataset.id;
    saveState(state);
    render.renderEverything();
    closeTradeEditor();
  });

  dom.symbolForm.addEventListener('submit', (event) => {
    const created = logic.handleSymbolSubmit(event);
    if (created) {
      render.renderEverything();
      closeTradeEditor();
    }
  });

  dom.backtestModeSelect.addEventListener('change', () => {
    logic.handleTradeModeChange();
  });

  dom.resultButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const added = logic.addTrade(button.dataset.result);
      if (added) {
        render.renderEverything();
      }
    });
  });

  if (Array.isArray(dom.strategyTabs)) {
    dom.strategyTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const strategy = tab.dataset.strategy;
        if (!strategy) {
          return;
        }
        state.activeStrategy = strategy;
        saveState(state);
        render.renderStrategyAnalysis();
      });
    });
  }

  dom.tradeHistoryEl.addEventListener('click', (event) => {
    const badge = event.target.closest('.trade-badge');
    if (!badge) return;
    openTradeEditor(badge.dataset.id);
  });

  if (dom.tradeEditor) {
    dom.tradeEditor.setAttribute('aria-hidden', 'true');
    dom.tradeEditor.addEventListener('click', (event) => {
      if (event.target === dom.tradeEditor) {
        closeTradeEditor();
        return;
      }

      const action = event.target.dataset && event.target.dataset.editorAction;
      if (!action) {
        return;
      }

      if (action === 'close') {
        closeTradeEditor();
        return;
      }

      if (!editingTradeId) {
        closeTradeEditor();
        return;
      }

      if (action === 'set-win' || action === 'set-loss') {
        const updated = logic.updateTrade(editingTradeId, {
          result: action === 'set-win' ? 'win' : 'loss'
        });
        if (updated) {
          render.renderEverything();
          openTradeEditor(editingTradeId);
        }
        return;
      }

      if (action === 'delete') {
        const deleted = logic.deleteTrade(editingTradeId);
        if (deleted) {
          render.renderEverything();
          closeTradeEditor();
        }
      }
    });
  }

  if (dom.tradeEditorBigWin) {
    dom.tradeEditorBigWin.addEventListener('change', () => {
      if (!editingTradeId) {
        closeTradeEditor();
        return;
      }

      const updated = logic.updateTrade(editingTradeId, {
        isBigWin: dom.tradeEditorBigWin.checked
      });

      if (updated) {
        render.renderEverything();
        openTradeEditor(editingTradeId);
      }
    });
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dom.tradeEditor && dom.tradeEditor.classList.contains('is-open')) {
      closeTradeEditor();
    }
  });

  if (state.activeView) {
    logic.setActiveView(state.activeView);
  } else {
    logic.setActiveView('dashboard');
  }

  render.renderEverything();
  logic.handleTradeModeChange();
})(window.BacktestApp);