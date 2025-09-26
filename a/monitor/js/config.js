// Configuration for Crypto Futures Screener
const CONFIG = {
    // Binance API endpoints
    API: {
        BASE_URL: 'https://fapi.binance.com',
        WS_BASE_URL: 'wss://fstream.binance.com/ws',
        ENDPOINTS: {
            EXCHANGE_INFO: '/fapi/v1/exchangeInfo'
        }
    },

    // WebSocket streams
    WEBSOCKET: {
        RECONNECT_INTERVAL: 5000, // 5 seconds
        MAX_RECONNECT_ATTEMPTS: 10,
        PING_INTERVAL: 30000, // 30 seconds
        STREAMS: {
            ALL_TICKER: '!ticker@arr',
            ALL_BOOK_TICKER: '!bookTicker', 
            ALL_LIQUIDATION: '!forceOrder@arr',
            ALL_MARK_PRICE: '!markPrice@arr@1s'
        }
    },

    // Display settings
    DISPLAY: {
        MAX_SYMBOLS: 200, // Hiển thị nhiều symbol hơn
        DECIMAL_PLACES: {
            PRICE: 4,
            PERCENTAGE: 2,
            VOLUME: 0,
            FUNDING_RATE: 4
        }
    },

    // Filters cho exchangeInfo
    FILTERS: {
        STATUS: 'TRADING', // Chỉ lấy symbol đang trading
        CONTRACT_TYPE: 'PERPETUAL', // Chỉ lấy perpetual contracts
        QUOTE_ASSET: 'USDT', // Chỉ lấy cặp USDT
        MIN_VOLUME: 100000, // Minimum 24h volume in USDT
        EXCLUDE_SYMBOLS: ['USDCUSDT', 'BUSDUSDT', 'TUSDUSDT', 'FDUSDUSDT'] // Stablecoins
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}