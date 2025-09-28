class TradingApp {
    constructor() {
        try {
            this.binanceAPI = new BinanceAPI();
            this.chartManager = new ChartManager('chart');
            this.replayEngine = new ReplayEngine(this.chartManager);
            this.backtestEngine = new BacktestEngine(this.replayEngine, this.chartManager);
            this.cacheManager = new CacheManager();
            this.currentData = [];

            this.initializeEventListeners();
            this.initializeBacktestEventListeners();
            this.updateUI();
            this.initializeBacktestSystem();
            this.initializeCacheModal();
            this.loadSymbolList();
        } catch (error) {
            console.error('Error in TradingApp constructor:', error);
            // Set a basic status message if possible
            const statusElement = document.getElementById('status');
            if (statusElement) {
                statusElement.textContent = 'Initialization error';
                statusElement.className = 'status-error';
            }
        }
    }

    // Initialize simple backtest system
    initializeBacktestSystem() {
        this.simpleBacktest = null;
        this.currentTableData = [];
        this.tableSortAscending = false;
        this.modalChart = null;
        this.initializeModal();
    }

    // Initialize modal functionality
    initializeModal() {
        const modal = document.getElementById('entryModal');
        const closeBtn = document.querySelector('.modal-close');

        // Close modal when clicking X
        closeBtn.addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (modal.style.display === 'block') {
                    this.closeModal();
                }
                const cacheModal = document.getElementById('cacheModal');
                if (cacheModal && cacheModal.style.display === 'block') {
                    this.closeCacheModal();
                }
            }
        });

        // Handle window resize for modal chart
        window.addEventListener('resize', () => {
            if (this.modalChart && modal.style.display === 'block') {
                const chartContainer = document.getElementById('modal-chart');
                this.modalChart.applyOptions({
                    width: chartContainer.clientWidth,
                    height: chartContainer.clientHeight,
                });
            }
        });
    }

    // Initialize cache modal functionality
    initializeCacheModal() {
        const modal = document.getElementById('cacheModal');
        const closeBtn = document.querySelector('.cache-modal-close');

        // Close modal when clicking X
        closeBtn.addEventListener('click', () => {
            this.closeCacheModal();
        });

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeCacheModal();
            }
        });

        // Cache control buttons
        document.getElementById('refreshCacheBtn').addEventListener('click', () => {
            this.refreshCacheTable();
        });

        document.getElementById('clearAllCacheBtn').addEventListener('click', () => {
            this.clearAllCache();
        });
    }

    // Show cache modal
    async showCacheModal() {
        const modal = document.getElementById('cacheModal');
        modal.style.display = 'block';
        await this.refreshCacheTable();
    }

    // Close cache modal
    closeCacheModal() {
        const modal = document.getElementById('cacheModal');
        modal.style.display = 'none';
    }

    // Refresh cache table
    async refreshCacheTable() {
        try {
            // Update stats
            const stats = await this.cacheManager.getCacheStats();
            document.getElementById('cache-total-symbols').textContent = stats.totalSymbols;
            document.getElementById('cache-total-candles').textContent = stats.totalCandles.toLocaleString();
            document.getElementById('cache-storage-size').textContent = stats.totalSize;

            // Update table
            const cachedData = await this.cacheManager.getAllCachedData();
            const tableBody = document.getElementById('cache-table-body');

            if (cachedData.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #666;">Chưa có cache nào</td></tr>';
                return;
            }

            const rows = cachedData.map(item => {
                const lastUpdate = new Date(item.lastUpdate).toLocaleString('vi-VN');
                return `
                    <tr>
                        <td>${item.symbol}</td>
                        <td>${item.timeframe}</td>
                        <td>${item.count.toLocaleString()}</td>
                        <td>${lastUpdate}</td>
                        <td>${item.size}</td>
                        <td>
                            <button onclick="app.deleteCacheEntry('${item.symbol}', '${item.timeframe}')" class="cache-delete-btn">Delete</button>
                        </td>
                    </tr>
                `;
            }).join('');

            tableBody.innerHTML = rows;

            console.log('Cache table refreshed');

        } catch (error) {
            console.error('Error refreshing cache table:', error);
        }
    }

    // Delete specific cache entry
    async deleteCacheEntry(symbol, timeframe) {
        if (confirm(`Xóa cache cho ${symbol} ${timeframe}?`)) {
            const success = await this.cacheManager.deleteCacheEntry(symbol, timeframe);
            if (success) {
                this.updateStatus(`Đã xóa cache ${symbol} ${timeframe}`, 'success');
                await this.refreshCacheTable();
            } else {
                this.updateStatus('Lỗi khi xóa cache', 'error');
            }
        }
    }

    // Clear all cache
    async clearAllCache() {
        if (confirm('Xóa tất cả cache? Hành động này không thể hoàn tác.')) {
            const success = await this.cacheManager.clearAllCache();
            if (success) {
                this.updateStatus('Đã xóa tất cả cache', 'success');
                await this.refreshCacheTable();
            } else {
                this.updateStatus('Lỗi khi xóa cache', 'error');
            }
        }
    }

    // Helper method to refresh cache modal if it's open
    async refreshCacheModalIfOpen() {
        const cacheModal = document.getElementById('cacheModal');
        if (cacheModal && cacheModal.style.display === 'block') {
            await this.refreshCacheTable();
        }
    }

    // Initialize backtest event listeners
    initializeBacktestEventListeners() {
        // Listen for backtest events
        this.backtestEngine.on('backtestStarted', () => {
            console.log('Backtest started');
            this.updateStatus('Backtest đã bắt đầu', 'info');
        });

        this.backtestEngine.on('backtestStopped', () => {
            console.log('Backtest stopped');
            this.updateStatus('Backtest đã dừng', 'info');
        });

        this.backtestEngine.on('backtestReset', () => {
            console.log('Backtest reset');
            this.updateStatus('Backtest đã reset', 'info');
        });

        this.backtestEngine.on('configChanged', (config) => {
            console.log('Backtest config changed:', config);
        });

        this.backtestEngine.on('error', (error) => {
            console.error('Backtest error:', error);
            this.updateStatus('Lỗi backtest: ' + error.message, 'error');
        });
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // Helper function to safely add event listener
        const safeAddEventListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            } else {
                console.warn(`Element with id '${id}' not found`);
            }
        };

        // Load data button
        safeAddEventListener('loadData', 'click', () => {
            this.loadData();
        });

        // Replay controls
        safeAddEventListener('replayBtn', 'click', () => {
            this.startReplay();
        });

        safeAddEventListener('playPauseBtn', 'click', () => {
            this.togglePlayPause();
        });

        safeAddEventListener('stepBtn', 'click', () => {
            this.step();
        });

        // Speed controls
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setSpeed(parseInt(e.target.dataset.speed));
            });
        });

        // Backtest controls
        safeAddEventListener('clearBacktestBtn', 'click', () => {
            this.clearBacktest();
        });

        // Cache controls
        safeAddEventListener('cacheManagerBtn', 'click', () => {
            this.showCacheModal();
        });

        // Table controls - these might not exist initially
        setTimeout(() => {
            safeAddEventListener('exportTableBtn', 'click', () => {
                this.exportTableToCSV();
            });

            safeAddEventListener('sortTableBtn', 'click', () => {
                this.sortTableByPnL();
            });
        }, 100);

        // Enter key on inputs
        safeAddEventListener('candleCount', 'keypress', (e) => {
            if (e.key === 'Enter') this.loadData();
        });

        // Symbol change event
        safeAddEventListener('symbol', 'change', () => {
            // Auto load data when symbol changes
            const symbolElement = document.getElementById('symbol');
            if (symbolElement && symbolElement.value) {
                this.loadData();
            }
        });
    }

    // Load data from Binance with smart caching
    async loadData() {
        const symbol = document.getElementById('symbol').value;
        const timeframe = document.getElementById('timeframe').value;
        const candleCount = parseInt(document.getElementById('candleCount').value);

        if (!symbol) {
            this.updateStatus('Select symbol', 'error');
            return;
        }

        if (candleCount < 100) {
            this.updateStatus('Tối thiểu 100 nến', 'error');
            return;
        }

        const loadBtn = document.getElementById('loadData');
        loadBtn.disabled = true;
        loadBtn.classList.add('loading');

        try {
            this.updateStatus('Kiểm tra cache...', 'loading');

            // Check existing cache
            const existingCache = await this.cacheManager.loadFromCache(symbol, timeframe);
            let data = null;
            let shouldUpdateCache = false;

            if (!existingCache) {
                // No cache exists - fetch and save
                console.log(`No cache found for ${symbol} ${timeframe}, fetching ${candleCount} candles`);
                this.updateStatus('Tải từ Binance...', 'loading');
                data = await this.binanceAPI.fetchHistoricalData(
                    symbol,
                    timeframe,
                    candleCount,
                    (current, total, message) => {
                        this.updateStatus(message, 'loading');
                    }
                );
                shouldUpdateCache = true;
                this.updateStatus('Lưu vào cache...', 'loading');
            } else {
                const cachedCount = existingCache.metadata.count;
                console.log(`Found cache for ${symbol} ${timeframe}: ${cachedCount} candles, requested: ${candleCount}`);

                if (candleCount <= cachedCount) {
                    // Requested data is less than or equal to cached data - use cache
                    console.log(`Using cache data (${candleCount} out of ${cachedCount} candles)`);
                    this.updateStatus('Tải từ cache...', 'loading');
                    const cacheResult = await this.cacheManager.loadFromCache(symbol, timeframe, candleCount);
                    data = cacheResult.candles;
                    this.updateStatus(`Cache: ${symbol} ${timeframe} - ${data.length} nến`, 'success');
                } else {
                    // Need more data - fetch only the missing amount and merge
                    const missingCount = candleCount - cachedCount;
                    console.log(`Need ${missingCount} more candles. Cache has ${cachedCount}, requested ${candleCount}`);
                    
                    this.updateStatus(`Cache có ${cachedCount} nến, tải thêm ${missingCount} nến...`, 'loading');
                    
                    // Fetch additional data
                    const additionalData = await this.binanceAPI.fetchHistoricalData(
                        symbol,
                        timeframe,
                        candleCount, // Fetch full amount to ensure we get the latest data
                        (current, total, message) => {
                            this.updateStatus(message, 'loading');
                        }
                    );
                    
                    // Only update cache if we got more data than cached
                    if (additionalData.length > cachedCount) {
                        shouldUpdateCache = true;
                        console.log(`Will update cache: ${cachedCount} → ${additionalData.length} candles`);
                        this.updateStatus('Cập nhật cache...', 'loading');
                        data = additionalData;
                    } else {
                        // Use existing cache if new data isn't better
                        console.log(`New data (${additionalData.length}) not better than cache (${cachedCount}), using cache`);
                        const cacheResult = await this.cacheManager.loadFromCache(symbol, timeframe, candleCount);
                        data = cacheResult.candles;
                        shouldUpdateCache = false;
                    }
                }
            }

            // Update cache if needed
            if (shouldUpdateCache && data) {
                await this.cacheManager.saveToCache(symbol, timeframe, data);
                console.log(`Cache updated for ${symbol} ${timeframe} with ${data.length} candles`);

                // Refresh cache modal if it's open
                await this.refreshCacheModalIfOpen();
            }

            this.currentData = data;
            this.replayEngine.loadData(data);

            // Show all data on chart initially
            this.chartManager.setCandlestickData(data);

            // Calculate and show full ATR indicators
            const botATR = new BotATRIndicator(30, 14, 2.0);
            const atrData = botATR.calculateArray(data);
            this.chartManager.setTrail1Data(atrData.ema);
            this.chartManager.setTrail2Data(atrData.trail);

            this.chartManager.fitContent();

            this.updateStatus(`${symbol} ${timeframe} - ${data.length} nến`, 'success');
            this.updateUI();

            // Auto run backtest after loading data
            setTimeout(() => {
                this.runBacktest();
            }, 500);

        } catch (error) {
            console.error('Error loading data:', error);
            this.updateStatus('Lỗi khi tải dữ liệu: ' + error.message, 'error');
        } finally {
            loadBtn.disabled = false;
            loadBtn.classList.remove('loading');
        }
    }

    // Start replay
    startReplay() {
        console.log('startReplay called');
        console.log('hasData:', this.replayEngine.hasData());
        console.log('data length:', this.replayEngine.data.length);

        if (!this.replayEngine.hasData()) {
            this.updateStatus('Tải dữ liệu trước', 'error');
            return;
        }

        this.replayEngine.startReplay();
        this.updateStatus('Replay bắt đầu', 'info');
        this.updateUI();
    }

    // Toggle play/pause
    togglePlayPause() {
        const state = this.replayEngine.getState();

        if (state.isPlaying) {
            this.replayEngine.pause();
            this.updateStatus('Đã tạm dừng', 'info');
        } else {
            if (!state.canStep) {
                this.updateStatus('Replay đã hoàn thành', 'info');
                return;
            }
            this.replayEngine.play();
            this.updateStatus('Đang phát...', 'info');
        }

        this.updateUI();
    }

    // Step forward one candle
    step() {
        if (!this.replayEngine.canStep()) {
            this.updateStatus('Replay đã hoàn thành', 'info');
            return;
        }

        this.replayEngine.step();
        this.updateUI();
    }

    // Set replay speed
    setSpeed(speed) {
        this.replayEngine.setSpeed(speed);

        // Update speed button states
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.speed) === speed);
        });

        this.updateStatus(`Tốc độ: ${speed}x`, 'info');
    }

    // Update UI based on current state
    updateUI() {
        const state = this.replayEngine.getState();

        // Update button states
        document.getElementById('replayBtn').disabled = !state.hasData;
        document.getElementById('playPauseBtn').disabled = !state.hasData || state.isComplete;
        document.getElementById('stepBtn').disabled = !state.hasData || state.isComplete;

        // Update play/pause button text
        const playPauseBtn = document.getElementById('playPauseBtn');
        playPauseBtn.textContent = state.isPlaying ? 'Pause' : 'Play';

        // Update progress if in replay mode
        if (state.currentIndex > 0) {
            this.replayEngine.updateProgress();
        } else {
            document.getElementById('progress').textContent = '';
        }
    }

    // Run backtest on current data
    runBacktest() {
        if (!this.currentData || this.currentData.length === 0) {
            this.updateStatus('Tải dữ liệu trước', 'error');
            return;
        }

        this.updateStatus('Chạy backtest...', 'loading');

        try {
            this.simpleBacktest = new SimpleBacktestSystem();
            const results = this.simpleBacktest.runBacktest(this.currentData);
            this.displayBacktestResults(results);
            this.updateStatus(`Hoàn thành - ${results.entries.length} lệnh`, 'success');
        } catch (error) {
            console.error('Backtest error:', error);
            this.updateStatus('Lỗi: ' + error.message, 'error');
        }
    }



    // Clear backtest results
    clearBacktest() {
        const resultsPanel = document.getElementById('backtest-results');
        resultsPanel.style.display = 'none';

        document.getElementById('backtest-stats').innerHTML = '';
        document.getElementById('backtest-table-body').innerHTML = '';
        document.getElementById('tableRowCount').textContent = '0';

        this.simpleBacktest = null;
        this.currentTableData = [];
        this.updateStatus('Đã xóa', 'info');
    }

    // Display backtest results in UI
    displayBacktestResults(results) {
        const resultsPanel = document.getElementById('backtest-results');
        const statsDiv = document.getElementById('backtest-stats');
        const entriesDiv = document.getElementById('backtest-entries');

        // Show panel
        resultsPanel.style.display = 'block';

        // Get fresh statistics from current backtest
        const stats = this.simpleBacktest.getStatistics();
        const allEntries = this.simpleBacktest.getAllEntries();
        const closedEntries = allEntries.filter(e => e.status === 'CLOSED');

        // Calculate updated statistics based on maxPnL
        const winsByMaxPnL = closedEntries.filter(e => e.isWinByMaxPnL).length;
        const lossByMaxPnL = closedEntries.length - winsByMaxPnL;
        const winRateByMaxPnL = closedEntries.length > 0 ? (winsByMaxPnL / closedEntries.length) * 100 : 0;
        const totalMaxPnL = closedEntries.reduce((sum, e) => sum + (e.maxPnL || 0), 0);
        const avgMaxPnL = closedEntries.length > 0 ? totalMaxPnL / closedEntries.length : 0;

        // Display updated statistics
        statsDiv.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Entries</span>
                <span class="stat-value">${closedEntries.length}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Win Rate</span>
                <span class="stat-value ${winRateByMaxPnL > 50 ? 'positive' : 'negative'}">${winRateByMaxPnL.toFixed(1)}%</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">W/L</span>
                <span class="stat-value">${winsByMaxPnL}/${lossByMaxPnL}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total PnL</span>
                <span class="stat-value ${totalMaxPnL >= 0 ? 'positive' : 'negative'}">${totalMaxPnL.toFixed(0)}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Avg PnL</span>
                <span class="stat-value ${avgMaxPnL >= 0 ? 'positive' : 'negative'}">${avgMaxPnL.toFixed(0)}</span>
            </div>
        `;

        // Display table with closed entries
        this.populateBacktestTable(closedEntries);
    }



    // Generate sample data for demo
    generateSampleData(count = 100, startPrice = 47000) {
        const candles = [];
        let currentPrice = startPrice;
        let time = Date.now() - (count * 60000); // 1 minute intervals

        for (let i = 0; i < count; i++) {
            // Generate some price movement
            const volatility = 0.02; // 2% volatility
            const change = (Math.random() - 0.5) * volatility * currentPrice;

            const open = currentPrice;
            const close = currentPrice + change;
            const high = Math.max(open, close) + Math.random() * 0.01 * currentPrice;
            const low = Math.min(open, close) - Math.random() * 0.01 * currentPrice;
            const volume = 100 + Math.random() * 100;

            candles.push({
                time: Math.floor(time / 1000), // Convert to seconds
                open: Math.round(open * 100) / 100,
                high: Math.round(high * 100) / 100,
                low: Math.round(low * 100) / 100,
                close: Math.round(close * 100) / 100,
                volume: Math.round(volume)
            });

            currentPrice = close;
            time += 60000; // Next minute
        }

        return candles;
    }

    // Populate backtest table with entries
    populateBacktestTable(entries) {
        const tableBody = document.getElementById('backtest-table-body');
        const rowCountElement = document.getElementById('tableRowCount');

        // Store current data for sorting/export
        this.currentTableData = entries;

        if (entries.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="10" class="table-empty">Chưa có lệnh nào</td></tr>';
            rowCountElement.textContent = '0';
            return;
        }

        // Generate table rows
        const rows = entries.map((entry, index) => this.generateTableRow(entry, index + 1)).join('');

        // Add summary row
        const summaryRow = this.generateSummaryRow(entries);

        tableBody.innerHTML = rows + summaryRow;
        rowCountElement.textContent = entries.length.toString();
    }

    // Generate individual table row
    generateTableRow(entry, index) {
        const maxPnL = entry.maxPnL || 0;
        const maxPnLPercent = entry.maxPnLPercent || 0;
        const duration = entry.candleData.length;
        const isWin = entry.isWinByMaxPnL || false;

        // Format dates
        const entryDate = entry.entryTime ? new Date(entry.entryTime).toLocaleString('vi-VN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }) : '-';

        const exitDate = entry.exitTime ? new Date(entry.exitTime).toLocaleString('vi-VN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }) : '-';

        // Use max price as exit price if available
        const exitPrice = entry.maxPrice || entry.exitPrice;

        return `
            <tr onclick="app.showEntryDetail(${index - 1})" data-entry-index="${index - 1}" class="${isWin ? 'win-entry' : ''}">
                <td class="table-cell-index">${index}</td>
                <td class="table-cell-side ${entry.side.toLowerCase()}">${entry.side}</td>
                <td class="table-cell-datetime">${entryDate}</td>
                <td class="table-cell-datetime">${exitDate}</td>
                <td class="table-cell-price">${entry.entryPrice?.toFixed(4) || '-'}</td>
                <td class="table-cell-price">${exitPrice?.toFixed(4) || '-'}</td>
                <td class="table-cell-amount">${entry.coinAmount?.toFixed(2) || '-'}</td>
                <td class="table-cell-pnl ${maxPnL >= 0 ? 'positive' : 'negative'}">${maxPnL.toFixed(0)}</td>
                <td class="table-cell-pnl ${maxPnLPercent >= 0 ? 'positive' : 'negative'}">${maxPnLPercent.toFixed(1)}%</td>
                <td class="table-cell-duration">${duration}</td>
            </tr>
        `;
    }

    // Generate summary row
    generateSummaryRow(entries) {
        if (entries.length === 0) return '';

        const totalMaxPnL = entries.reduce((sum, entry) => sum + (entry.maxPnL || 0), 0);
        const totalMaxPnLPercent = entries.reduce((sum, entry) => sum + (entry.maxPnLPercent || 0), 0);
        const avgDuration = entries.reduce((sum, entry) => sum + entry.candleData.length, 0) / entries.length;
        const winCount = entries.filter(entry => entry.isWinByMaxPnL).length;

        return `
            <tr class="table-summary">
                <td class="table-cell-index">Σ</td>
                <td class="table-cell-side">${winCount}W/${entries.length - winCount}L</td>
                <td class="table-cell-datetime">-</td>
                <td class="table-cell-datetime">-</td>
                <td class="table-cell-price">-</td>
                <td class="table-cell-price">-</td>
                <td class="table-cell-amount">-</td>
                <td class="table-cell-pnl ${totalMaxPnL >= 0 ? 'positive' : 'negative'}">${totalMaxPnL.toFixed(0)}</td>
                <td class="table-cell-pnl ${totalMaxPnLPercent >= 0 ? 'positive' : 'negative'}">${totalMaxPnLPercent.toFixed(1)}%</td>
                <td class="table-cell-duration">${avgDuration.toFixed(0)}</td>
            </tr>
        `;
    }

    // Sort table by PnL
    sortTableByPnL() {
        if (this.currentTableData.length === 0) {
            this.updateStatus('Không có dữ liệu để sắp xếp', 'error');
            return;
        }

        // Toggle sort direction
        this.tableSortAscending = !this.tableSortAscending;

        // Sort data
        const sortedData = [...this.currentTableData].sort((a, b) => {
            const pnlA = a.maxPnL || 0;
            const pnlB = b.maxPnL || 0;
            return this.tableSortAscending ? pnlA - pnlB : pnlB - pnlA;
        });

        // Update table
        this.populateBacktestTable(sortedData);

        const direction = this.tableSortAscending ? 'tăng dần' : 'giảm dần';
        this.updateStatus(`Đã sắp xếp theo PnL ${direction}`, 'info');

        // Update button text
        const sortBtn = document.getElementById('sortTableBtn');
        sortBtn.textContent = this.tableSortAscending ? 'Sắp xếp PnL ↓' : 'Sắp xếp PnL ↑';
    }

    // Export table to CSV
    exportTableToCSV() {
        if (this.currentTableData.length === 0) {
            this.updateStatus('Không có dữ liệu để xuất', 'error');
            return;
        }

        try {
            // Create CSV content
            const headers = [
                'STT', 'Loại', 'Thời gian vào', 'Thời gian ra', 'Giá vào', 'Giá ra',
                'Số coin', 'PnL (USDT)', 'PnL (%)', 'Thời gian (nến)', 'Trạng thái'
            ];

            const csvContent = [
                headers.join(','),
                ...this.currentTableData.map((entry, index) => {
                    const entryDate = entry.entryTime ? new Date(entry.entryTime).toLocaleString('vi-VN') : 'N/A';
                    const exitDate = entry.exitTime ? new Date(entry.exitTime).toLocaleString('vi-VN') : 'N/A';

                    return [
                        index + 1,
                        entry.side,
                        `"${entryDate}"`,
                        `"${exitDate}"`,
                        entry.entryPrice?.toFixed(4) || 'N/A',
                        entry.exitPrice?.toFixed(4) || 'N/A',
                        entry.coinAmount?.toFixed(6) || 'N/A',
                        (entry.maxPnL || 0).toFixed(2),
                        (entry.maxPnLPercent || 0).toFixed(2),
                        entry.candleData.length,
                        entry.status
                    ].join(',');
                })
            ].join('\n');

            // Create and download file
            const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            link.setAttribute('href', url);
            link.setAttribute('download', `backtest_results_${new Date().toISOString().slice(0, 10)}.csv`);
            link.style.visibility = 'hidden';

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            this.updateStatus('Đã xuất file CSV thành công', 'success');

        } catch (error) {
            console.error('Export error:', error);
            this.updateStatus('Lỗi khi xuất file: ' + error.message, 'error');
        }
    }

    // Show entry detail modal
    showEntryDetail(entryIndex) {
        if (!this.currentTableData || entryIndex >= this.currentTableData.length) {
            return;
        }

        const entry = this.currentTableData[entryIndex];
        const modal = document.getElementById('entryModal');

        // Update modal info
        this.updateModalInfo(entry);

        // Show modal
        modal.style.display = 'block';

        // Create chart after modal is visible
        setTimeout(() => {
            this.createModalChart(entry);
        }, 100);
    }

    // Update modal information
    updateModalInfo(entry) {
        const maxPnL = entry.maxPnL || 0;
        const maxPnLPercent = entry.maxPnLPercent || 0;

        document.getElementById('modal-side').textContent = entry.side;
        document.getElementById('modal-side').className = `info-value ${entry.side.toLowerCase()}`;

        document.getElementById('modal-entry-price').textContent = entry.entryPrice?.toFixed(4) || '-';

        // Show max price as exit price
        const exitPrice = entry.maxPrice || entry.exitPrice;
        document.getElementById('modal-exit-price').textContent = exitPrice?.toFixed(4) || '-';

        const pnlElement = document.getElementById('modal-pnl');
        pnlElement.textContent = `${maxPnL.toFixed(2)} USDT (${maxPnLPercent.toFixed(2)}%)`;
        pnlElement.className = `info-value ${maxPnL >= 0 ? 'positive' : 'negative'}`;

        document.getElementById('modal-duration').textContent = `${entry.candleData.length} candles`;

        // Calculate and display profit analysis
        this.updateProfitAnalysis(entry);
    }

    // Calculate maximum profit analysis
    updateProfitAnalysis(entry) {
        if (!entry.candleData || entry.candleData.length === 0 || !entry.entryPrice) {
            // Clear analysis if no data
            document.getElementById('analysis-max-price').textContent = '-';
            document.getElementById('analysis-max-pnl').textContent = '-';
            document.getElementById('analysis-max-roe').textContent = '-';
            document.getElementById('analysis-max-time').textContent = '-';
            return;
        }

        const capital = 4000; // USDT
        const entryPrice = entry.entryPrice;
        const coinAmount = capital / entryPrice;
        const side = entry.side;

        let maxPnL = -Infinity;
        let maxPrice = 0;
        let maxROE = 0;
        let maxTime = null;
        let maxCandle = null;

        // Analyze each candle to find maximum profit
        entry.candleData.forEach(candle => {
            // For each candle, check both high and low prices
            const prices = [candle.high, candle.low];

            prices.forEach(price => {
                let pnl = 0;

                if (side === 'LONG') {
                    // Long position: profit when price goes up
                    pnl = (price - entryPrice) * coinAmount;
                } else {
                    // Short position: profit when price goes down  
                    pnl = (entryPrice - price) * coinAmount;
                }

                // Check if this is the maximum profit so far
                if (pnl > maxPnL) {
                    maxPnL = pnl;
                    maxPrice = price;
                    maxROE = (pnl / capital) * 100;
                    maxTime = candle.time;
                    maxCandle = candle;
                }
            });
        });

        // Update analysis display
        const maxPriceElement = document.getElementById('analysis-max-price');
        const maxPnLElement = document.getElementById('analysis-max-pnl');
        const maxROEElement = document.getElementById('analysis-max-roe');
        const maxTimeElement = document.getElementById('analysis-max-time');

        if (maxPnL > -Infinity) {
            maxPriceElement.textContent = maxPrice.toFixed(4);

            maxPnLElement.textContent = `${maxPnL.toFixed(2)} USDT`;
            maxPnLElement.className = `analysis-value ${maxPnL >= 0 ? 'positive' : 'negative'}`;

            maxROEElement.textContent = `${maxROE.toFixed(2)}%`;
            maxROEElement.className = `analysis-value ${maxROE >= 0 ? 'positive' : 'negative'}`;

            if (maxTime) {
                const timeStr = new Date(maxTime * 1000).toLocaleString('vi-VN', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                maxTimeElement.textContent = timeStr;
            } else {
                maxTimeElement.textContent = '-';
            }

            // Add marker to chart for maximum profit point
            this.addMaxProfitMarker(maxCandle, maxPrice, maxPnL, side);

        } else {
            maxPriceElement.textContent = '-';
            maxPnLElement.textContent = '-';
            maxROEElement.textContent = '-';
            maxTimeElement.textContent = '-';
        }
    }

    // Create chart in modal
    createModalChart(entry) {
        const chartContainer = document.getElementById('modal-chart');

        // Clear existing chart
        if (this.modalChart) {
            this.modalChart.remove();
            this.modalChart = null;
        }

        // Reset modal chart variables
        this.modalMarkers = [];
        this.modalCandlestickSeries = null;

        // Clear container
        chartContainer.innerHTML = '';

        try {
            // Determine price precision based on entry price
            const entryPrice = entry.entryPrice || 1;
            let precision = 2; // default
            let minMove = 0.01; // default

            if (entryPrice < 1) {
                precision = 6;
                minMove = 0.0001;
            } else if (entryPrice < 10) {
                precision = 4;
                minMove = 0.0001;
            } else if (entryPrice < 100) {
                precision = 3;
                minMove = 0.001;
            }

            // Create new chart
            this.modalChart = LightweightCharts.createChart(chartContainer, {
                width: chartContainer.clientWidth,
                height: chartContainer.clientHeight,
                layout: {
                    background: { color: '#000' },
                    textColor: '#fff',
                    fontSize: 11,
                },
                grid: {
                    vertLines: { color: '#333' },
                    horzLines: { color: '#333' },
                },
                crosshair: {
                    mode: LightweightCharts.CrosshairMode.Normal,
                },
                rightPriceScale: {
                    borderColor: '#333',
                    scaleMargins: {
                        top: 0.1,
                        bottom: 0.1,
                    },
                    mode: LightweightCharts.PriceScaleMode.Normal,
                    autoScale: true,
                    invertScale: false,
                    alignLabels: true,
                    borderVisible: true,
                    entireTextOnly: false,
                    visible: true,
                    drawTicks: true,
                    minimumWidth: 80,
                },
                timeScale: {
                    borderColor: '#333',
                    timeVisible: true,
                    secondsVisible: false,
                    rightOffset: 5,
                    barSpacing: 8,
                    fixLeftEdge: false,
                    lockVisibleTimeRangeOnResize: true,
                    rightBarStaysOnScroll: true,
                    borderVisible: true,
                    visible: true,
                },
                localization: {
                    priceFormatter: (price) => {
                        return price.toFixed(precision);
                    },
                },
            });

            // Add candlestick series with proper precision
            const candlestickSeries = this.modalChart.addCandlestickSeries({
                upColor: '#0f0',
                downColor: '#f00',
                borderDownColor: '#f00',
                borderUpColor: '#0f0',
                wickDownColor: '#f00',
                wickUpColor: '#0f0',
                priceFormat: {
                    type: 'price',
                    precision: precision,
                    minMove: minMove,
                },
            });

            // Set candle data
            candlestickSeries.setData(entry.candleData);

            // Calculate indicators for the entry period
            this.addModalIndicators(entry);

            // Add entry/exit markers
            this.addEntryExitMarkers(candlestickSeries, entry);

            // Fit content
            this.modalChart.timeScale().fitContent();

        } catch (error) {
            console.error('Error creating modal chart:', error);
            chartContainer.innerHTML = '<div style="color: #f00; text-align: center; padding: 50px;">Error loading chart</div>';
        }
    }

    // Add indicators to modal chart
    addModalIndicators(entry) {
        if (!entry.candleData || entry.candleData.length === 0) return;

        try {
            // Calculate ATR indicators for this entry period
            const botATR = new BotATRIndicator(30, 14, 2.0);
            const atrData = botATR.calculateArray(entry.candleData);

            // Determine precision for indicators
            const entryPrice = entry.entryPrice || 1;
            let precision = 2;
            let minMove = 0.01;

            if (entryPrice < 1) {
                precision = 6;
                minMove = 0.0001;
            } else if (entryPrice < 10) {
                precision = 4;
                minMove = 0.0001;
            } else if (entryPrice < 100) {
                precision = 3;
                minMove = 0.001;
            }

            // Add Trail1 (EMA) line
            const trail1Series = this.modalChart.addLineSeries({
                color: '#00ff00',
                lineWidth: 2,
                title: 'Trail1 (EMA)',
                priceFormat: {
                    type: 'price',
                    precision: precision,
                    minMove: minMove,
                },
            });
            trail1Series.setData(atrData.ema);

            // Add Trail2 (ATR Trailing Stop) line
            const trail2Series = this.modalChart.addLineSeries({
                color: '#ff0000',
                lineWidth: 2,
                title: 'Trail2 (ATR)',
                priceFormat: {
                    type: 'price',
                    precision: precision,
                    minMove: minMove,
                },
            });
            trail2Series.setData(atrData.trail);

        } catch (error) {
            console.error('Error adding modal indicators:', error);
        }
    }

    // Add entry/exit markers
    addEntryExitMarkers(series, entry) {
        this.modalMarkers = [];

        // Entry marker
        if (entry.entryTime && entry.entryPrice) {
            this.modalMarkers.push({
                time: Math.floor(entry.entryTime / 1000),
                position: 'belowBar',
                color: entry.side === 'LONG' ? '#0f0' : '#f00',
                shape: 'arrowUp',
                text: `${entry.side} @ ${entry.entryPrice.toFixed(4)}`,
            });
        }

        // Exit marker at maximum profit point
        if (entry.maxPnLCandle && entry.maxPrice) {
            this.modalMarkers.push({
                time: entry.maxPnLCandle.time,
                position: 'aboveBar',
                color: entry.maxPnL >= 50 ? '#0f0' : '#f00',
                shape: 'arrowDown',
                text: `EXIT @ ${entry.maxPrice.toFixed(4)} (MAX: ${entry.maxPnL.toFixed(0)} USDT)`,
            });
        } else if (entry.exitTime && entry.exitPrice) {
            // Fallback to original exit if no max profit data
            this.modalMarkers.push({
                time: Math.floor(entry.exitTime / 1000),
                position: 'aboveBar',
                color: (entry.pnl || 0) >= 0 ? '#0f0' : '#f00',
                shape: 'arrowDown',
                text: `EXIT @ ${entry.exitPrice.toFixed(4)}`,
            });
        }

        // Store series reference for adding max profit marker later
        this.modalCandlestickSeries = series;

        if (this.modalMarkers.length > 0) {
            series.setMarkers(this.modalMarkers);
        }
    }

    // Add maximum profit marker to chart
    addMaxProfitMarker(candle, maxPrice, maxPnL, side) {
        if (!this.modalCandlestickSeries || !candle) return;

        // Add max profit marker to existing markers
        const maxProfitMarker = {
            time: candle.time,
            position: 'aboveBar',
            color: '#ffff00', // Yellow for max profit
            shape: 'circle',
            text: `MAX: ${maxPrice.toFixed(4)} (${maxPnL.toFixed(0)} USDT)`,
            size: 1,
        };

        // Combine all markers
        const allMarkers = [...this.modalMarkers, maxProfitMarker];
        this.modalCandlestickSeries.setMarkers(allMarkers);
    }

    // Close modal
    closeModal() {
        const modal = document.getElementById('entryModal');
        modal.style.display = 'none';

        // Clean up chart and variables
        if (this.modalChart) {
            this.modalChart.remove();
            this.modalChart = null;
        }

        this.modalMarkers = [];
        this.modalCandlestickSeries = null;
    }

    // Load symbol list from Binance Futures
    async loadSymbolList() {
        try {
            this.updateStatus('Loading symbols...', 'loading');

            // Fetch exchange info from Binance Futures API
            const response = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo');
            const data = await response.json();

            // Filter active USDT perpetual contracts
            const usdtSymbols = data.symbols
                .filter(symbol =>
                    symbol.status === 'TRADING' &&
                    symbol.contractType === 'PERPETUAL' &&
                    symbol.quoteAsset === 'USDT'
                )
                .map(symbol => symbol.symbol)
                .sort();

            // Populate symbol select
            const symbolSelect = document.getElementById('symbol');
            symbolSelect.innerHTML = '';

            // Add popular symbols first
            const popularSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT'];
            const otherSymbols = usdtSymbols.filter(s => !popularSymbols.includes(s));

            // Add popular symbols
            popularSymbols.forEach(symbol => {
                if (usdtSymbols.includes(symbol)) {
                    const option = document.createElement('option');
                    option.value = symbol;
                    option.textContent = symbol;
                    if (symbol === 'BTCUSDT') option.selected = true;
                    symbolSelect.appendChild(option);
                }
            });

            // Add separator
            if (popularSymbols.length > 0 && otherSymbols.length > 0) {
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '──────────';
                symbolSelect.appendChild(separator);
            }

            // Add other symbols
            otherSymbols.forEach(symbol => {
                const option = document.createElement('option');
                option.value = symbol;
                option.textContent = symbol;
                symbolSelect.appendChild(option);
            });

            this.updateStatus('Ready', 'success');

        } catch (error) {
            console.error('Error loading symbols:', error);
            this.updateStatus('Error loading symbols', 'error');

            // Fallback to manual input
            const symbolSelect = document.getElementById('symbol');
            symbolSelect.innerHTML = '<option value="BTCUSDT" selected>BTCUSDT</option>';
        }
    }

    // Update status message
    updateStatus(message, type = 'info') {
        const statusElement = document.getElementById('status');
        if (!statusElement) {
            console.log(`Status: ${message} (${type})`);
            return;
        }

        statusElement.textContent = message;

        // Remove existing status classes
        statusElement.classList.remove('status-error', 'status-success', 'status-loading', 'status-info');

        // Add new status class
        if (type) {
            statusElement.classList.add(`status-${type}`);
        }
    }
}

// Global app instance for onclick handlers
let app;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing TradingApp');
    console.log('BinanceAPI available:', typeof BinanceAPI);
    console.log('ChartManager available:', typeof ChartManager);
    console.log('ReplayEngine available:', typeof ReplayEngine);
    console.log('BotATRIndicator available:', typeof BotATRIndicator);
    console.log('BacktestEngine available:', typeof BacktestEngine);
    console.log('BacktestConfig available:', typeof BacktestConfig);
    console.log('LightweightCharts available:', typeof LightweightCharts);

    try {
        app = new TradingApp();
        console.log('TradingApp initialized successfully');
    } catch (error) {
        console.error('Error initializing TradingApp:', error);
    }
});