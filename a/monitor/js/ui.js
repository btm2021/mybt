// UI functions for displaying data
class UIManager {
    constructor() {
        this.elements = {
            loading: document.getElementById('loading'),
            errorMessage: document.getElementById('error-message'),
            errorDetails: document.getElementById('error-details'),
            dataContainer: document.getElementById('data-container'),
            futuresTable: document.getElementById('futures-table'),
            statusIndicator: document.getElementById('status-indicator'),
            statusText: document.getElementById('status-text'),
            lastUpdate: document.getElementById('last-update')
        };

        this.previousData = new Map();
        this.currentData = [];
        this.sortColumn = 'quoteVolume';
        this.sortDirection = 'desc';

        this.initSortHandlers();
    }

    // Initialize sort handlers and symbol click handlers
    initSortHandlers() {
        document.addEventListener('click', (e) => {
            // Handle sort clicks
            if (e.target.classList.contains('sortable') || e.target.closest('.sortable')) {
                const th = e.target.classList.contains('sortable') ? e.target : e.target.closest('.sortable');
                const column = th.dataset.sort;
                this.handleSort(column);
            }
            // Handle symbol clicks
            else if (e.target.classList.contains('symbol-link')) {
                e.preventDefault();
                const symbol = e.target.dataset.symbol;
                this.openTradingView(symbol);
            }
        });
    }

    // Handle column sorting
    handleSort(column) {
        if (this.sortColumn === column) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortColumn = column;
            this.sortDirection = 'desc';
        }

        this.updateSortIcons();
        this.sortAndRenderData();
    }

    // Update sort icons
    updateSortIcons() {
        document.querySelectorAll('.sortable').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            const icon = th.querySelector('.sort-icon');
            if (icon) {
                icon.textContent = '↕';
            }
        });

        const activeTh = document.querySelector(`[data-sort="${this.sortColumn}"]`);
        if (activeTh) {
            activeTh.classList.add(this.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            const icon = activeTh.querySelector('.sort-icon');
            if (icon) {
                icon.textContent = this.sortDirection === 'asc' ? '↑' : '↓';
            }
        }
    }

    // Sort and render current data
    sortAndRenderData() {
        if (this.currentData.length === 0) return;

        const sortedData = [...this.currentData].sort((a, b) => {
            let aVal = a[this.sortColumn];
            let bVal = b[this.sortColumn];

            // Handle null/undefined values
            if (aVal === null || aVal === undefined) aVal = this.sortDirection === 'asc' ? Infinity : -Infinity;
            if (bVal === null || bVal === undefined) bVal = this.sortDirection === 'asc' ? Infinity : -Infinity;

            // String comparison for symbol
            if (this.sortColumn === 'symbol') {
                aVal = aVal.toString().toLowerCase();
                bVal = bVal.toString().toLowerCase();
                return this.sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }

            // Numeric comparison
            const numA = parseFloat(aVal);
            const numB = parseFloat(bVal);

            if (this.sortDirection === 'asc') {
                return numA - numB;
            } else {
                return numB - numA;
            }
        });

        this.renderTableRows(sortedData);
    }

    // Show loading state
    showLoading() {
        this.elements.loading.classList.remove('hidden');
        this.elements.errorMessage.classList.add('hidden');
        this.elements.dataContainer.classList.add('hidden');
        this.updateStatus('loading', 'Đang tải...');
    }

    // Show error state
    showError(message) {
        this.elements.loading.classList.add('hidden');
        this.elements.dataContainer.classList.add('hidden');
        this.elements.errorMessage.classList.remove('hidden');

        if (this.elements.errorDetails) {
            this.elements.errorDetails.textContent = message;
        }

        this.updateStatus('error', 'Lỗi');
    }

    // Show data
    showData() {
        this.elements.loading.classList.add('hidden');
        this.elements.errorMessage.classList.add('hidden');
        this.elements.dataContainer.classList.remove('hidden');
        this.updateStatus('online', 'Online');
    }

    // Update status indicator
    updateStatus(status, text) {
        const indicator = this.elements.statusIndicator;
        const statusText = this.elements.statusText;

        // Remove all status classes
        indicator.classList.remove('bg-green-500', 'bg-red-500', 'bg-yellow-500', 'status-online', 'status-offline');

        switch (status) {
            case 'online':
                indicator.classList.add('bg-green-500', 'status-online');
                break;
            case 'error':
                indicator.classList.add('bg-red-500', 'status-offline');
                break;
            case 'loading':
                indicator.classList.add('bg-yellow-500');
                break;
        }

        if (statusText) {
            statusText.textContent = text;
        }
    }

    // Update last update time
    updateLastUpdateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit'
        });

        if (this.elements.lastUpdate) {
            this.elements.lastUpdate.textContent = timeString;
        }
    }

    // Format number with appropriate decimal places
    formatNumber(value, type) {
        if (value === null || value === undefined || isNaN(value)) {
            return '--';
        }

        const decimals = CONFIG.DISPLAY.DECIMAL_PLACES[type] || 2;

        if (type === 'VOLUME') {
            // Format large numbers with K, M, B suffixes
            if (value >= 1e9) {
                return (value / 1e9).toFixed(1) + 'B';
            } else if (value >= 1e6) {
                return (value / 1e6).toFixed(1) + 'M';
            } else if (value >= 1e3) {
                return (value / 1e3).toFixed(1) + 'K';
            }
        }

        return value.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    // Format percentage with color
    formatPercentage(value) {
        if (value === null || value === undefined || isNaN(value)) {
            return { text: '--', class: 'text-neutral' };
        }

        const formatted = (value >= 0 ? '+' : '') + value.toFixed(2) + '%';
        const colorClass = value > 0 ? 'text-profit' : value < 0 ? 'text-loss' : 'text-neutral';

        return { text: formatted, class: colorClass };
    }

    // Format funding rate with color
    formatFundingRate(value) {
        if (value === null || value === undefined || isNaN(value)) {
            return { text: '--', class: 'text-neutral' };
        }

        const percentage = value * 100;
        const formatted = (percentage >= 0 ? '+' : '') + percentage.toFixed(4) + '%';
        const colorClass = percentage > 0 ? 'text-profit' : percentage < 0 ? 'text-loss' : 'text-neutral';

        return { text: formatted, class: colorClass };
    }

    // Create TradingView URL for symbol
    createTradingViewUrl(symbol) {
        // Convert BTCUSDT to BINANCE:BTCUSDT.P format
        const tvSymbol = `BINANCE%3A${symbol}.P`;
        return `https://vn.tradingview.com/chart/Cb78li5k/?symbol=${tvSymbol}`;
    }

    // Open TradingView in new tab
    openTradingView(symbol) {
        const url = this.createTradingViewUrl(symbol);
        window.open(url, '_blank', 'noopener,noreferrer');
        console.log(`Opening TradingView for ${symbol}:`, url);
    }

    // Create table row
    createTableRow(data) {
        const row = document.createElement('tr');
        row.className = 'fade-in';

        // Check for price changes
        const previousPrice = this.previousData.get(data.symbol);
        let priceChangeClass = '';
        if (previousPrice && previousPrice !== data.lastPrice) {
            priceChangeClass = data.lastPrice > previousPrice ? 'price-up' : 'price-down';
        }

        // Format data
        const percentage = this.formatPercentage(data.priceChangePercent);
        const fundingRate = this.formatFundingRate(data.fundingRate);

        // Format bid/ask
        const bidAsk = data.bidPrice && data.askPrice ?
            `${this.formatNumber(data.bidPrice, 'PRICE')}/${this.formatNumber(data.askPrice, 'PRICE')}` : '--';

        row.innerHTML = `
            <td class="px-2 py-1 whitespace-nowrap">
                <a href="#" class="symbol-link font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer" data-symbol="${data.symbol}">
                    ${data.symbol}
                </a>
            </td>
            <td class="px-2 py-1 whitespace-nowrap text-right number-cell ${priceChangeClass}">
                ${this.formatNumber(data.lastPrice, 'PRICE')}
            </td>
            <td class="px-2 py-1 whitespace-nowrap text-right">
                <span class="${percentage.class}">${percentage.text}</span>
            </td>
            <td class="px-2 py-1 whitespace-nowrap text-right number-cell hidden sm:table-cell">
                ${this.formatNumber(data.quoteVolume, 'VOLUME')}
            </td>
            <td class="px-2 py-1 whitespace-nowrap text-right number-cell hidden md:table-cell">
                ${this.formatNumber(data.openInterest, 'VOLUME')}
            </td>
            <td class="px-2 py-1 whitespace-nowrap text-right number-cell hidden md:table-cell">
                ${this.formatNumber(data.markPrice, 'PRICE')}
            </td>
            <td class="px-2 py-1 whitespace-nowrap text-right number-cell hidden lg:table-cell">
                <span class="${fundingRate.class}">${fundingRate.text}</span>
            </td>
            <td class="px-2 py-1 whitespace-nowrap text-right text-xs hidden lg:table-cell">
                ${bidAsk}
            </td>
        `;

        // Store current price for next comparison
        this.previousData.set(data.symbol, data.lastPrice);

        return row;
    }

    // Render table rows
    renderTableRows(data) {
        if (!this.elements.futuresTable) {
            console.error('Table element not found');
            return;
        }

        console.log(`Rendering ${data.length} rows to table`);

        // Clear existing rows
        this.elements.futuresTable.innerHTML = '';

        // Add new rows
        data.forEach((item, index) => {
            const row = this.createTableRow(item);
            this.elements.futuresTable.appendChild(row);

            // Debug log for first few rows
            if (index < 3) {
                console.log(`Row ${index}:`, item.symbol, item.lastPrice, item.priceChangePercent);
            }
        });

        console.log(`Table rendered with ${this.elements.futuresTable.children.length} rows`);
    }

    // Render table data
    renderTable(data) {
        console.log(`renderTable called with ${data.length} items`);

        if (data.length === 0) {
            console.warn('No data to render');
            return;
        }

        this.currentData = data;
        this.sortAndRenderData();

        // Update last update time
        this.updateLastUpdateTime();

        // Show data container
        this.showData();
    }

    // Show connection status
    showConnectionStatus(isConnected) {
        if (isConnected) {
            this.updateStatus('online', 'Online');
        } else {
            this.updateStatus('error', 'Offline');
        }
    }
}

// Create global instance
const uiManager = new UIManager();
// Debug function to monitor UI updates
window.debugUI = () => {
    console.log('=== UI Debug Info ===');
    console.log('Current data length:', uiManager.currentData.length);
    console.log('Table rows:', uiManager.elements.futuresTable?.children.length || 0);
    console.log('Sort column:', uiManager.sortColumn);
    console.log('Sort direction:', uiManager.sortDirection);

    if (uiManager.currentData.length > 0) {
        console.log('Sample current data:', uiManager.currentData.slice(0, 3));
    }
};

// Monitor for data changes
let lastDataUpdate = 0;
setInterval(() => {
    if (window.binanceAPI && binanceAPI.symbolsData.size > 0) {
        const currentUpdate = Array.from(binanceAPI.symbolsData.values())[0]?.lastUpdate?.getTime() || 0;
        if (currentUpdate > lastDataUpdate) {
            console.log('Data updated at:', new Date(currentUpdate));
            lastDataUpdate = currentUpdate;
        }
    }
}, 5000);