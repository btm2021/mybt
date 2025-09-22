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
    dom.clearDataBtn.addEventListener('click', async () => {
      const cleared = await logic.clearAllData();
      if (cleared) {
        render.renderEverything();
      }
    });
  }

  dom.viewButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      await logic.setActiveView(btn.dataset.view);
      closeTradeEditor();
    });
  });

  dom.symbolListEl.addEventListener('click', async (event) => {
    const deleteBtn = event.target.closest('.symbol-delete-btn');
    if (deleteBtn) {
      const symbolId = deleteBtn.dataset.symbolId;
      const deleted = await logic.deleteSymbol(symbolId);
      if (deleted) {
        render.renderEverything();
      }
      return;
    }

    const item = event.target.closest('.symbol-item');
    if (!item) return;
    state.selectedSymbolId = item.dataset.id;
    await saveState(state);
    render.renderEverything();
    closeTradeEditor();
  });

  dom.symbolForm.addEventListener('submit', async (event) => {
    const created = await logic.handleSymbolSubmit(event);
    if (created) {
      render.renderEverything();
      closeTradeEditor();
    }
  });

  dom.backtestModeSelect.addEventListener('change', () => {
    logic.handleTradeModeChange();
  });

  dom.resultButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      const added = await logic.addTrade(button.dataset.result);
      if (added) {
        render.renderEverything();
        
        // Trigger blink animation for the new trade
        if (app.lastAddedTrade) {
          setTimeout(() => {
            render.addTradeBlinkAnimation(app.lastAddedTrade.mode, app.lastAddedTrade.result);
            app.lastAddedTrade = null; // Clear after use
          }, 100); // Small delay to ensure DOM is updated
        }
      }
    });
  });

  if (Array.isArray(dom.strategyTabs)) {
    dom.strategyTabs.forEach((tab) => {
      tab.addEventListener('click', async () => {
        const strategy = tab.dataset.strategy;
        if (!strategy) {
          return;
        }
        state.activeStrategy = strategy;
        await saveState(state);
        render.renderStrategyAnalysis();
      });
    });
  }

  // Handle trade column clicks to switch modes
  dom.tradeHistoryEl.addEventListener('click', (event) => {
    const badge = event.target.closest('.trade-badge');
    if (badge) {
      openTradeEditor(badge.dataset.id);
      return;
    }

    const column = event.target.closest('.trade-column');
    if (column) {
      const mode = column.dataset.mode;
      if (mode) {
        // Update both analysis and strategy modes
        state.activeAnalysisMode = mode;
        state.activeStrategyMode = mode;
        
        // Update column active states
        const allColumns = document.querySelectorAll('.trade-column');
        allColumns.forEach(col => {
          col.classList.toggle('active', col.dataset.mode === mode);
        });
        
        // Update mode indicators
        const analysisCurrentMode = document.getElementById('analysisCurrentMode');
        const strategyCurrentMode = document.getElementById('strategyCurrentMode');
        const modeLabels = { single: 'Single', multi: 'Multi', combi: 'Combi' };
        
        if (analysisCurrentMode) analysisCurrentMode.textContent = modeLabels[mode] || mode;
        if (strategyCurrentMode) strategyCurrentMode.textContent = modeLabels[mode] || mode;
        
        // Re-render both panels
        render.renderTradeAnalysis();
        render.renderStrategyAnalysis();
      }
    }
  });



  if (dom.tradeEditor) {
    dom.tradeEditor.setAttribute('aria-hidden', 'true');
    dom.tradeEditor.addEventListener('click', async (event) => {
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
        const updated = await logic.updateTrade(editingTradeId, {
          result: action === 'set-win' ? 'win' : 'loss'
        });
        if (updated) {
          render.renderEverything();
          openTradeEditor(editingTradeId);
        }
        return;
      }

      if (action === 'delete') {
        const deleted = await logic.deleteTrade(editingTradeId);
        if (deleted) {
          render.renderEverything();
          closeTradeEditor();
        }
      }
    });
  }

  if (dom.tradeEditorBigWin) {
    dom.tradeEditorBigWin.addEventListener('change', async () => {
      if (!editingTradeId) {
        closeTradeEditor();
        return;
      }

      const updated = await logic.updateTrade(editingTradeId, {
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

  // Initialize app
  async function initializeApp() {
    try {
      // Load state with loading overlay
      const loadedState = await app.utils.loadState();
      Object.assign(state, loadedState);
      state.isLoading = false;
      
      if (state.activeView) {
        await logic.setActiveView(state.activeView);
      } else {
        await logic.setActiveView('dashboard');
      }

      render.renderEverything();
      logic.handleTradeModeChange();
      
      // Initialize mode indicators
      const analysisCurrentMode = document.getElementById('analysisCurrentMode');
      const strategyCurrentMode = document.getElementById('strategyCurrentMode');
      const modeLabels = { single: 'Single', multi: 'Multi', combi: 'Combi' };
      const currentMode = state.activeAnalysisMode || "single";
      
      if (analysisCurrentMode) analysisCurrentMode.textContent = modeLabels[currentMode] || currentMode;
      if (strategyCurrentMode) strategyCurrentMode.textContent = modeLabels[currentMode] || currentMode;
    } catch (error) {
      console.error('Error initializing app:', error);
      state.isLoading = false;
      render.renderEverything();
      
      // Hide loading overlay on error
      if (app.loadingManager) {
        app.loadingManager.hide();
      }
    }
  }

  // Start the app when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }
})(window.BacktestApp);