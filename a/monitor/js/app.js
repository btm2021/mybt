// Main application logic
class CryptoScreenerApp {
    constructor() {
        this.retryTimeout = null;
        this.isInitializing = false;
        this.retryCount = 0;
        this.maxRetries = 5;
        this.wsInitialized = false; // Track if WebSocket has been initialized
    }

    // Initialize the application
    async init() {
        console.log('Initializing Crypto Futures Screener with WebSocket...');
        
        if (this.isInitializing) {
            console.log('Already initializing, skipping...');
            return;
        }

        this.isInitializing = true;
        
        // Show loading state
        uiManager.showLoading();
        
        try {
            // Initialize WebSocket connection
            await this.initWebSocket();
            
            // Add event listeners
            this.addEventListeners();
            
            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.handleError(error);
        } finally {
            this.isInitializing = false;
        }
    }

    // Initialize WebSocket
    async initWebSocket() {
        try {
            await binanceAPI.initWebSocket();
            this.wsInitialized = true;
            this.retryCount = 0;
            
            // Show initial data after a longer delay to let WebSocket populate
            setTimeout(() => {
                const data = binanceAPI.getCurrentData();
                if (data.length > 0) {
                    uiManager.renderTable(data);
                    console.log(`Displaying ${data.length} symbols`);
                } else {
                    console.log('No data received yet, waiting for WebSocket updates...');
                    // Try again after another delay
                    setTimeout(() => {
                        const retryData = binanceAPI.getCurrentData();
                        if (retryData.length > 0) {
                            uiManager.renderTable(retryData);
                            console.log(`Displaying ${retryData.length} symbols (retry)`);
                        } else {
                            console.warn('Still no data after retry');
                        }
                    }, 3000);
                }
            }, 5000);
            
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            throw error;
        }
    }

    // Retry initialization
    async retryInit() {
        if (this.wsInitialized) {
            console.log('WebSocket already initialized, skipping retry...');
            return;
        }

        try {
            console.log('Retrying WebSocket initialization...');
            await this.initWebSocket();
        } catch (error) {
            console.error('Failed to retry initialization:', error);
            this.handleError(error);
        }
    }

    // Handle errors with retry logic
    handleError(error) {
        this.retryCount++;
        
        let errorMessage = 'Không thể kết nối đến Binance WebSocket';
        
        if (error.message.includes('HTTP')) {
            errorMessage = `Lỗi API: ${error.message}`;
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Lỗi mạng: Kiểm tra kết nối internet';
        } else if (error.message.includes('WebSocket')) {
            errorMessage = 'Lỗi WebSocket: Không thể kết nối real-time';
        }
        
        // Show error
        uiManager.showError(`${errorMessage} (Thử lại ${this.retryCount}/${this.maxRetries})`);
        uiManager.showConnectionStatus(false);
        
        // Retry if not exceeded max retries
        if (this.retryCount < this.maxRetries) {
            console.log(`Retrying in ${CONFIG.WEBSOCKET.RECONNECT_INTERVAL / 1000} seconds... (${this.retryCount}/${this.maxRetries})`);
            
            this.retryTimeout = setTimeout(() => {
                this.retryInit();
            }, CONFIG.WEBSOCKET.RECONNECT_INTERVAL);
        } else {
            console.error('Max retries exceeded');
            uiManager.showError('Đã thử kết nối tối đa. Vui lòng tải lại trang.');
        }
    }

    // Stop retry timeout
    stopRetry() {
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
    }

    // Add event listeners
    addEventListeners() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('Page hidden - WebSocket will continue running');
            } else {
                console.log('Page visible');
                // Check WebSocket connection status
                if (!binanceAPI.isWebSocketConnected()) {
                    console.log('WebSocket disconnected, attempting to reconnect...');
                    this.retryInit();
                }
            }
        });

        // Handle online/offline events
        window.addEventListener('online', () => {
            console.log('Connection restored');
            // Retry WebSocket if not connected
            if (!this.wsInitialized || !binanceAPI.isWebSocketConnected()) {
                this.retryCount = 0;
                this.retryInit();
            }
        });

        window.addEventListener('offline', () => {
            console.log('Connection lost');
            uiManager.showError('Mất kết nối internet');
            uiManager.showConnectionStatus(false);
        });

        // Handle errors
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
        });
    }

    // Manual refresh
    async refresh() {
        console.log('Manual refresh triggered');
        this.retryCount = 0; // Reset retry count for manual refresh
        
        // Close existing WebSocket and reinitialize
        binanceAPI.closeWebSocket();
        this.wsInitialized = false;
        
        await this.retryInit();
    }

    // Cleanup
    destroy() {
        this.stopRetry();
        binanceAPI.closeWebSocket();
        binanceAPI.clearCache();
        console.log('Application destroyed');
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create global app instance
    window.cryptoApp = new CryptoScreenerApp();
    
    // Initialize the app
    window.cryptoApp.init().catch(error => {
        console.error('Failed to initialize app:', error);
        uiManager.showError('Không thể khởi tạo ứng dụng');
    });
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.cryptoApp) {
        window.cryptoApp.destroy();
    }
});

// Expose refresh function globally for debugging
window.refreshData = () => {
    if (window.cryptoApp) {
        window.cryptoApp.refresh();
    }
};