// API functions for fetching Binance Futures data
class BinanceAPI {
    constructor() {
        this.baseUrl = CONFIG.API.BASE_URL;
        this.wsUrl = CONFIG.API.WS_BASE_URL;
        this.cache = new Map();
        this.lastUpdate = null;
        this.symbols = []; // Danh sách symbols từ exchangeInfo
        this.symbolsData = new Map(); // Dữ liệu real-time cho từng symbol

        // WebSocket connections - multiple streams
        this.wsConnections = new Map(); // Multiple WebSocket connections
        this.reconnectAttempts = 0;
        this.isConnected = false;
        this.pingInterval = null;
        this.updateThrottle = null; // Throttle UI updates
    }

    // Generic fetch function with error handling
    async fetchData(endpoint, params = {}) {
        try {
            const url = new URL(this.baseUrl + endpoint);
            Object.keys(params).forEach(key => {
                if (params[key] !== undefined) {
                    url.searchParams.append(key, params[key]);
                }
            });

            const response = await fetch(url.toString());

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`API Error for ${endpoint}:`, error);
            throw error;
        }
    }

    // Get exchange info and filter symbols
    async getExchangeInfo() {
        try {
            const data = await this.fetchData(CONFIG.API.ENDPOINTS.EXCHANGE_INFO);

            // Filter symbols theo yêu cầu
            const filteredSymbols = data.symbols
                .filter(symbol => {
                    // Chỉ lấy symbol đang trading
                    if (symbol.status !== CONFIG.FILTERS.STATUS) return false;

                    // Chỉ lấy perpetual contracts
                    if (symbol.contractType !== CONFIG.FILTERS.CONTRACT_TYPE) return false;

                    // Chỉ lấy cặp USDT
                    if (symbol.quoteAsset !== CONFIG.FILTERS.QUOTE_ASSET) return false;

                    // Loại bỏ stablecoins
                    if (CONFIG.FILTERS.EXCLUDE_SYMBOLS.includes(symbol.symbol)) return false;

                    return true;
                })
                .map(symbol => ({
                    symbol: symbol.symbol,
                    baseAsset: symbol.baseAsset,
                    quoteAsset: symbol.quoteAsset,
                    pricePrecision: symbol.pricePrecision,
                    quantityPrecision: symbol.quantityPrecision
                }))
                .sort((a, b) => a.symbol.localeCompare(b.symbol));

            this.symbols = filteredSymbols;
            this.cache.set('exchangeInfo', filteredSymbols);

            console.log(`Loaded ${filteredSymbols.length} trading symbols from exchangeInfo`);
            return filteredSymbols;
        } catch (error) {
            console.error('Error fetching exchange info:', error);
            throw error;
        }
    }

    // Initialize WebSocket connection
    async initWebSocket() {
        try {
            // Nếu chưa có symbols, lấy từ exchangeInfo trước
            if (this.symbols.length === 0) {
                await this.getExchangeInfo();
            }

            // Initialize symbols data với default values
            this.symbols.forEach(symbolInfo => {
                this.symbolsData.set(symbolInfo.symbol, {
                    symbol: symbolInfo.symbol,
                    // From !ticker@arr
                    lastPrice: 0,
                    priceChangePercent: 0,
                    quoteVolume: 0,
                    openPrice: 0,
                    highPrice: 0,
                    lowPrice: 0,
                    // From !bookTicker
                    bidPrice: 0,
                    askPrice: 0,
                    bidQty: 0,
                    askQty: 0,
                    // From !markPrice@arr@1s
                    markPrice: 0,
                    indexPrice: 0,
                    fundingRate: 0,
                    nextFundingTime: null,
                    // From !forceOrder@arr
                    liquidationOrders: [],
                    lastUpdate: new Date()
                });
            });

            this.connectWebSocket();
        } catch (error) {
            console.error('Error initializing WebSocket:', error);
            throw error;
        }
    }

    // Connect to multiple WebSocket streams
    connectWebSocket() {
        try {
            const streams = [
                CONFIG.WEBSOCKET.STREAMS.ALL_TICKER,
                CONFIG.WEBSOCKET.STREAMS.ALL_BOOK_TICKER,
                CONFIG.WEBSOCKET.STREAMS.ALL_MARK_PRICE,
                CONFIG.WEBSOCKET.STREAMS.ALL_LIQUIDATION
            ];

            streams.forEach(stream => {
                this.connectSingleStream(stream);
            });

        } catch (error) {
            console.error('Error connecting WebSocket:', error);
            this.handleReconnect();
        }
    }

    // Connect to single WebSocket stream
    connectSingleStream(streamName) {
        const wsUrl = `${this.wsUrl}/${streamName}`;
        console.log(`Connecting to WebSocket stream: ${streamName}`, wsUrl);

        const ws = new WebSocket(wsUrl);
        this.wsConnections.set(streamName, ws);

        ws.onopen = () => {
            console.log(`WebSocket stream ${streamName} connected successfully`);

            // Check if all streams are connected
            const connectedStreams = Array.from(this.wsConnections.values())
                .filter(ws => ws.readyState === WebSocket.OPEN).length;

            if (connectedStreams === this.wsConnections.size) {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.startPing();

                if (window.uiManager) {
                    uiManager.showConnectionStatus(true);
                }

                console.log(`All ${this.wsConnections.size} WebSocket streams connected`);
            }
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data, streamName);
            } catch (error) {
                console.error(`Error parsing WebSocket message for ${streamName}:`, error, event.data);
            }
        };

        ws.onclose = (event) => {
            console.log(`WebSocket stream ${streamName} disconnected:`, event.code, event.reason);
            this.wsConnections.delete(streamName);

            // Check if any streams are still connected
            const connectedStreams = Array.from(this.wsConnections.values())
                .filter(ws => ws.readyState === WebSocket.OPEN).length;

            if (connectedStreams === 0) {
                this.isConnected = false;
                this.stopPing();

                if (window.uiManager) {
                    uiManager.showConnectionStatus(false);
                }

                this.handleReconnect();
            }
        };

        ws.onerror = (error) => {
            console.error(`WebSocket stream ${streamName} error:`, error);
        };
    }

    // Handle WebSocket messages
    handleWebSocketMessage(data, streamName) {
        // All Market Tickers Stream (!ticker@arr)
        if (streamName === CONFIG.WEBSOCKET.STREAMS.ALL_TICKER) {
            if (Array.isArray(data)) {
                console.log(`Processing ${data.length} ticker updates`);
                data.forEach(ticker => {
                    this.updateTickerData(ticker);
                });
                this.triggerUIUpdate();
            }
        }
        // All Book Tickers Stream (!bookTicker)
        else if (streamName === CONFIG.WEBSOCKET.STREAMS.ALL_BOOK_TICKER) {
            this.updateBookTickerData(data);
        }
        // All Mark Price Stream (!markPrice@arr@1s)
        else if (streamName === CONFIG.WEBSOCKET.STREAMS.ALL_MARK_PRICE) {
            if (Array.isArray(data)) {
                console.log(`Processing ${data.length} mark price updates`);
                data.forEach(markPrice => {
                    this.updateMarkPriceData(markPrice);
                });
            }
        }
        // All Liquidation Orders Stream (!forceOrder@arr)
        else if (streamName === CONFIG.WEBSOCKET.STREAMS.ALL_LIQUIDATION) {
            if (data.e === 'forceOrder') {
                this.updateLiquidationData(data);
            }
        }
    }

    // Update ticker data from !ticker@arr
    updateTickerData(ticker) {
        const symbol = ticker.s; // symbol

        if (this.symbolsData.has(symbol)) {
            const existing = this.symbolsData.get(symbol);
            const updatedData = {
                ...existing,
                lastPrice: parseFloat(ticker.c), // close price
                priceChangePercent: parseFloat(ticker.P), // price change percent
                quoteVolume: parseFloat(ticker.q), // quote volume
                openPrice: parseFloat(ticker.o), // open price
                highPrice: parseFloat(ticker.h), // high price
                lowPrice: parseFloat(ticker.l), // low price
                lastUpdate: new Date()
            };

            this.symbolsData.set(symbol, updatedData);
            
            // Debug log for first few symbols
            if (['BTCUSDT', 'ETHUSDT', 'BNBUSDT'].includes(symbol)) {
                console.log(`Updated ${symbol}:`, {
                    price: updatedData.lastPrice,
                    change: updatedData.priceChangePercent,
                    volume: updatedData.quoteVolume
                });
            }
        }
    }

    // Update book ticker data from !bookTicker
    updateBookTickerData(bookTicker) {
        const symbol = bookTicker.s; // symbol
        if (this.symbolsData.has(symbol)) {
            const existing = this.symbolsData.get(symbol);
            this.symbolsData.set(symbol, {
                ...existing,
                bidPrice: parseFloat(bookTicker.b), // best bid price
                askPrice: parseFloat(bookTicker.a), // best ask price
                bidQty: parseFloat(bookTicker.B), // best bid qty
                askQty: parseFloat(bookTicker.A), // best ask qty
                lastUpdate: new Date()
            });
            
            // Trigger UI update for book ticker changes too
            this.triggerUIUpdate();
        }
    }

    // Update mark price data from !markPrice@arr@1s
    updateMarkPriceData(markPrice) {
        const symbol = markPrice.s; // symbol
        if (this.symbolsData.has(symbol)) {
            const existing = this.symbolsData.get(symbol);
            this.symbolsData.set(symbol, {
                ...existing,
                markPrice: parseFloat(markPrice.p), // mark price
                indexPrice: parseFloat(markPrice.i), // index price
                fundingRate: parseFloat(markPrice.r), // funding rate
                nextFundingTime: new Date(markPrice.T), // next funding time
                lastUpdate: new Date()
            });
            
            // Trigger UI update for mark price changes
            this.triggerUIUpdate();
        }
    }

    // Update liquidation data from !forceOrder@arr
    updateLiquidationData(liquidation) {
        const symbol = liquidation.o.s; // symbol from order object
        if (this.symbolsData.has(symbol)) {
            const existing = this.symbolsData.get(symbol);

            // Keep only last 5 liquidation orders
            const liquidationOrders = [...(existing.liquidationOrders || [])];
            liquidationOrders.unshift({
                side: liquidation.o.S, // SELL/BUY
                orderType: liquidation.o.o, // LIMIT/MARKET
                quantity: parseFloat(liquidation.o.q), // quantity
                price: parseFloat(liquidation.o.p), // price
                averagePrice: parseFloat(liquidation.o.ap), // average price
                status: liquidation.o.X, // order status
                time: new Date(liquidation.o.T)
            });

            // Keep only last 5
            if (liquidationOrders.length > 5) {
                liquidationOrders.splice(5);
            }

            this.symbolsData.set(symbol, {
                ...existing,
                liquidationOrders,
                lastUpdate: new Date()
            });
        }
    }

    // Trigger UI update - throttled to avoid too many updates
    triggerUIUpdate() {
        if (!this.updateThrottle) {
            this.updateThrottle = setTimeout(() => {
                this.performUIUpdate();
                this.updateThrottle = null;
            }, 100); // Throttle updates to every 100ms
        }
    }

    // Perform actual UI update
    performUIUpdate() {
        if (window.uiManager && this.symbolsData.size > 0) {
            // Convert Map to Array và filter theo volume
            const dataArray = Array.from(this.symbolsData.values())
                .filter(item => {
                    // Filter theo volume và chỉ lấy symbols có dữ liệu thực
                    return item.quoteVolume > 0 && item.lastPrice > 0;
                })
                .sort((a, b) => b.quoteVolume - a.quoteVolume)
                .slice(0, CONFIG.DISPLAY.MAX_SYMBOLS);

            console.log(`Updating UI with ${dataArray.length} symbols`);
            if (dataArray.length > 0) {
                uiManager.renderTable(dataArray);
            }
        }
    }

    // Start ping to keep connection alive
    startPing() {
        this.pingInterval = setInterval(() => {
            this.wsConnections.forEach((ws, streamName) => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    try {
                        ws.send(JSON.stringify({ id: Date.now(), method: 'ping' }));
                    } catch (error) {
                        console.warn(`Failed to send ping to ${streamName}:`, error);
                    }
                }
            });
        }, CONFIG.WEBSOCKET.PING_INTERVAL);
    }

    // Stop ping
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    // Handle reconnection
    handleReconnect() {
        if (this.reconnectAttempts < CONFIG.WEBSOCKET.MAX_RECONNECT_ATTEMPTS) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${CONFIG.WEBSOCKET.MAX_RECONNECT_ATTEMPTS})`);

            setTimeout(() => {
                this.connectWebSocket();
            }, CONFIG.WEBSOCKET.RECONNECT_INTERVAL);
        } else {
            console.error('Max reconnection attempts reached');
            if (window.uiManager) {
                uiManager.showError('Mất kết nối WebSocket. Vui lòng tải lại trang.');
            }
        }
    }

    // Get current data
    getCurrentData() {
        console.log(`getCurrentData: symbolsData size = ${this.symbolsData.size}`);

        if (this.symbolsData.size === 0) {
            return [];
        }

        const allData = Array.from(this.symbolsData.values());
        console.log(`Total symbols: ${allData.length}`);

        const filteredData = allData.filter(item => {
            const hasVolume = item.quoteVolume > 0;
            const hasPrice = item.lastPrice > 0;
            return hasVolume && hasPrice;
        });

        console.log(`Filtered symbols with data: ${filteredData.length}`);

        const sortedData = filteredData
            .sort((a, b) => b.quoteVolume - a.quoteVolume)
            .slice(0, CONFIG.DISPLAY.MAX_SYMBOLS);

        console.log(`Final symbols to display: ${sortedData.length}`);

        return sortedData;
    }

    // Get symbols list
    getSymbols() {
        return this.symbols;
    }

    // Get cached data
    getCachedData(key) {
        return this.cache.get(key);
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }

    // Close WebSocket connections
    closeWebSocket() {
        this.stopPing();
        this.wsConnections.forEach((ws, streamName) => {
            if (ws) {
                console.log(`Closing WebSocket stream: ${streamName}`);
                ws.close();
            }
        });
        this.wsConnections.clear();
        this.isConnected = false;
    }

    // Check connection status
    isWebSocketConnected() {
        const connectedStreams = Array.from(this.wsConnections.values())
            .filter(ws => ws.readyState === WebSocket.OPEN).length;
        return this.isConnected && connectedStreams > 0;
    }
}

// Create global instance
const binanceAPI = new BinanceAPI();

window.debugBinanceAPI = () => {
    console.log('=== Binance API Debug Info ===');
    console.log('WebSocket connected:', binanceAPI.isWebSocketConnected());
    console.log('Symbols loaded:', binanceAPI.symbols.length);
    console.log('Symbols data size:', binanceAPI.symbolsData.size);
    console.log('Current data length:', binanceAPI.getCurrentData().length);

    if (binanceAPI.symbolsData.size > 0) {
        const sample = Array.from(binanceAPI.symbolsData.values()).slice(0, 3);
        console.log('Sample data:', sample);
    }
};

// Auto debug every 10 seconds
setInterval(() => {
    if (window.location.search.includes('debug')) {
        window.debugBinanceAPI();
    }
}, 10000);