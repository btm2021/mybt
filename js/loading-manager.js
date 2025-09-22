window.BacktestApp = window.BacktestApp || {};

(function (app) {
  let loadingOverlay = null;
  let loadingMessage = null;
  let isShowing = false;

  function init() {
    loadingOverlay = document.getElementById('loadingOverlay');
    loadingMessage = document.getElementById('loadingMessage');
  }

  function show(message = 'Đang xử lý...') {
    if (!loadingOverlay) init();
    
    if (loadingMessage) {
      loadingMessage.textContent = message;
    }
    
    if (loadingOverlay && !isShowing) {
      loadingOverlay.style.display = 'flex';
      loadingOverlay.classList.add('show');
      loadingOverlay.classList.remove('hide');
      isShowing = true;
    }
  }

  function hide() {
    if (!loadingOverlay) return;
    
    if (isShowing) {
      loadingOverlay.classList.add('hide');
      loadingOverlay.classList.remove('show');
      
      setTimeout(() => {
        if (loadingOverlay) {
          loadingOverlay.style.display = 'none';
        }
        isShowing = false;
      }, 200);
    }
  }

  function updateMessage(message) {
    if (loadingMessage) {
      loadingMessage.textContent = message;
    }
  }

  // Wrapper function for async operations with loading
  async function withLoading(asyncFn, message = 'Đang xử lý...') {
    try {
      show(message);
      const result = await asyncFn();
      return result;
    } finally {
      hide();
    }
  }

  app.loadingManager = {
    show,
    hide,
    updateMessage,
    withLoading
  };
})(window.BacktestApp);