class TradingApp {
    constructor() {
        this.binanceAPI = new BinanceAPI();
        this.chartManager = new ChartManager('chart');
        this.replayEngine = new ReplayEngine(this.chartManager);
        this.backtestEngine = new BacktestEngine(this.replayEngine, this.chartManager);
        this.currentData = [];
        
        this.initializeEventListeners();
        this.initializeBacktestEventListeners();
        this.updateUI();
        this.initializeBacktestSystem();
    }
    
    // Initialize simple backtest system
    initializeBacktestSystem() {
        this.simpleBacktest = null;
        this.currentTableData = [];
        this.tableSortAscending = false;
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
        // Load data button
        document.getElementById('loadData').addEventListener('click', () => {
            this.loadData();
        });

        // Replay controls
        document.getElementById('replayBtn').addEventListener('click', () => {
            this.startReplay();
        });

        document.getElementById('playPauseBtn').addEventListener('click', () => {
            this.togglePlayPause();
        });

        document.getElementById('stepBtn').addEventListener('click', () => {
            this.step();
        });

        // Speed controls
        document.querySelectorAll('.speed-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setSpeed(parseInt(e.target.dataset.speed));
            });
        });

        // Backtest controls
        document.getElementById('backtestBtn').addEventListener('click', () => {
            this.runBacktest();
        });

        document.getElementById('clearBacktestBtn').addEventListener('click', () => {
            this.clearBacktest();
        });

        // Table controls
        document.getElementById('exportTableBtn').addEventListener('click', () => {
            this.exportTableToCSV();
        });

        document.getElementById('sortTableBtn').addEventListener('click', () => {
            this.sortTableByPnL();
        });

        // Enter key on inputs
        document.getElementById('symbol').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.loadData();
        });

        document.getElementById('candleCount').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.loadData();
        });
    }

    // Load data from Binance
    async loadData() {
        const symbol = document.getElementById('symbol').value.trim();
        const timeframe = document.getElementById('timeframe').value;
        const candleCount = parseInt(document.getElementById('candleCount').value);

        if (!symbol) {
            this.updateStatus('Nhập symbol', 'error');
            return;
        }

        if (candleCount < 100 || candleCount > 10000) {
            this.updateStatus('100-10000 nến', 'error');
            return;
        }

        const loadBtn = document.getElementById('loadData');
        loadBtn.disabled = true;
        loadBtn.classList.add('loading');
        
        try {
            this.updateStatus('Đang tải...', 'loading');
            
            const data = await this.binanceAPI.fetchHistoricalData(
                symbol,
                timeframe,
                candleCount,
                (current, total, message) => {
                    this.updateStatus(message, 'loading');
                }
            );

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
        
        // Get statistics
        const stats = this.simpleBacktest.getStatistics();
        
        // Display statistics
        statsDiv.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Entries</span>
                <span class="stat-value">${stats.totalEntries}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Win Rate</span>
                <span class="stat-value ${stats.winRate > 50 ? 'positive' : 'negative'}">${stats.winRate.toFixed(1)}%</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">W/L</span>
                <span class="stat-value">${stats.winCount}/${stats.lossCount}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Total PnL</span>
                <span class="stat-value ${stats.totalPnL >= 0 ? 'positive' : 'negative'}">${stats.totalPnL?.toFixed(2) || 0}</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Avg PnL</span>
                <span class="stat-value ${stats.averagePnL >= 0 ? 'positive' : 'negative'}">${stats.averagePnL?.toFixed(2) || 0}</span>
            </div>
        `;
        
        // Display table
        const allEntries = this.simpleBacktest.getAllEntries();
        const closedEntries = allEntries.filter(e => e.status === 'CLOSED');
        
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
        const pnl = entry.pnl || 0;
        const pnlPercent = entry.pnlPercent || 0;
        const duration = entry.candleData.length;
        
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
        
        return `
            <tr>
                <td class="table-cell-index">${index}</td>
                <td class="table-cell-side ${entry.side.toLowerCase()}">${entry.side}</td>
                <td class="table-cell-datetime">${entryDate}</td>
                <td class="table-cell-datetime">${exitDate}</td>
                <td class="table-cell-price">${entry.entryPrice?.toFixed(4) || '-'}</td>
                <td class="table-cell-price">${entry.exitPrice?.toFixed(4) || '-'}</td>
                <td class="table-cell-amount">${entry.coinAmount?.toFixed(2) || '-'}</td>
                <td class="table-cell-pnl ${pnl >= 0 ? 'positive' : 'negative'}">${pnl.toFixed(0)}</td>
                <td class="table-cell-pnl ${pnlPercent >= 0 ? 'positive' : 'negative'}">${pnlPercent.toFixed(1)}%</td>
                <td class="table-cell-duration">${duration}</td>
            </tr>
        `;
    }
    
    // Generate summary row
    generateSummaryRow(entries) {
        if (entries.length === 0) return '';
        
        const totalPnL = entries.reduce((sum, entry) => sum + (entry.pnl || 0), 0);
        const totalPnLPercent = entries.reduce((sum, entry) => sum + (entry.pnlPercent || 0), 0);
        const avgDuration = entries.reduce((sum, entry) => sum + entry.candleData.length, 0) / entries.length;
        const winCount = entries.filter(entry => (entry.pnl || 0) > 0).length;
        
        return `
            <tr class="table-summary">
                <td class="table-cell-index">Σ</td>
                <td class="table-cell-side">${winCount}W/${entries.length - winCount}L</td>
                <td class="table-cell-datetime">-</td>
                <td class="table-cell-datetime">-</td>
                <td class="table-cell-price">-</td>
                <td class="table-cell-price">-</td>
                <td class="table-cell-amount">-</td>
                <td class="table-cell-pnl ${totalPnL >= 0 ? 'positive' : 'negative'}">${totalPnL.toFixed(0)}</td>
                <td class="table-cell-pnl ${totalPnLPercent >= 0 ? 'positive' : 'negative'}">${totalPnLPercent.toFixed(1)}%</td>
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
            const pnlA = a.pnl || 0;
            const pnlB = b.pnl || 0;
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
                        (entry.pnl || 0).toFixed(2),
                        (entry.pnlPercent || 0).toFixed(2),
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

    // Update status message
    updateStatus(message, type = 'info') {
        const statusElement = document.getElementById('status');
        statusElement.textContent = message;
        
        // Remove existing status classes
        statusElement.classList.remove('status-error', 'status-success', 'status-loading', 'status-info');
        
        // Add new status class
        if (type) {
            statusElement.classList.add(`status-${type}`);
        }
    }
}

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
        new TradingApp();
        console.log('TradingApp initialized successfully');
    } catch (error) {
        console.error('Error initializing TradingApp:', error);
    }
});