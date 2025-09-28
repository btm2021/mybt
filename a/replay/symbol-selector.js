class SymbolSelector {
    constructor(binanceAPI) {
        this.binanceAPI = binanceAPI;
        this.tickerData = [];
        this.filteredData = [];
        this.currentSort = { field: 'quoteVolume', direction: 'desc' };
        this.selectedSymbol = 'BTCUSDT';
        this.favorites = this.loadFavorites();
        this.realtimePrices = new Map();
        this.wsConnection = null;
        
        this.initializeModal();
        this.loadSymbols();
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        // Symbol selector button
        document.getElementById('symbolSelector').addEventListener('click', () => {
            this.showModal();
        });

        // Symbol modal close
        document.querySelector('.symbol-modal-close').addEventListener('click', () => {
            this.hideModal();
        });

        // Click outside modal to close
        document.getElementById('symbolModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideModal();
            }
        });

        // Search functionality
        document.getElementById('symbolSearch').addEventListener('input', (e) => {
            this.filterSymbols(e.target.value);
        });

        // Table header sorting
        document.querySelectorAll('#symbol-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.dataset.sort;
                this.sortSymbols(field);
            });
        });
    }

    initializeModal() {
        // Modal initialization logic if needed
        console.log('SymbolSelector modal initialized');
    }

    async loadSymbols() {
        try {
            this.showLoadingOverlay('Loading symbols...');
            
            const tickerData = await this.binanceAPI.fetch24hrTicker();
            this.tickerData = this.binanceAPI.format24hrTicker(tickerData);
            this.filteredData = [...this.tickerData];
            
            this.sortSymbols('quoteVolume');
            this.hideLoadingOverlay();
            
        } catch (error) {
            console.error('Error loading symbols:', error);
            this.showError('Failed to load symbols');
            this.hideLoadingOverlay();
        }
    }


    showModal() {
        const modal = document.getElementById('symbolModal');
        modal.style.display = 'block';
        
        // Focus search input
        setTimeout(() => {
            document.getElementById('symbolSearch').focus();
        }, 100);
        
        // Refresh data if it's old (more than 5 minutes)
        const lastUpdate = this.tickerData.length > 0 ? Date.now() : 0;
        if (Date.now() - lastUpdate > 5 * 60 * 1000) {
            this.loadSymbolData();
        } else {
            this.renderTable();
        }
    }

    hideModal() {
        const modal = document.getElementById('symbolModal');
        modal.style.display = 'none';
        
        // Clear search
        document.getElementById('symbolSearch').value = '';
        this.filteredData = [...this.tickerData];
    }

    filterSymbols(searchTerm) {
        const term = searchTerm.toLowerCase().trim();
        
        if (term === '') {
            this.filteredData = [...this.tickerData];
        } else {
            this.filteredData = this.tickerData.filter(ticker => 
                ticker.symbol.toLowerCase().includes(term)
            );
        }
        
        this.renderTable();
    }

    sortSymbols(field) {
        // Toggle direction if same field
        if (this.currentSort.field === field) {
            this.currentSort.direction = this.currentSort.direction === 'desc' ? 'asc' : 'desc';
        } else {
            this.currentSort.field = field;
            this.currentSort.direction = field === 'symbol' ? 'asc' : 'desc';
        }

        // Sort data
        this.filteredData.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];
            
            if (field === 'symbol') {
                aVal = aVal.toString().toLowerCase();
                bVal = bVal.toString().toLowerCase();
            }
            
            if (this.currentSort.direction === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });

        this.updateSortIndicators();
        this.renderTable();
    }

    updateSortIndicators() {
        // Reset all indicators
        document.querySelectorAll('.sort-indicator').forEach(indicator => {
            indicator.className = 'sort-indicator';
        });

        // Set active indicator
        const activeHeader = document.querySelector(`[data-sort="${this.currentSort.field}"] .sort-indicator`);
        if (activeHeader) {
            activeHeader.className = `sort-indicator ${this.currentSort.direction}`;
        }
    }

    renderTable() {
        const tbody = document.getElementById('symbol-table-body');
        
        if (this.filteredData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading-row">No symbols found</td></tr>';
            return;
        }

        // Sort favorites first
        const sortedData = [...this.filteredData].sort((a, b) => {
            const aFav = this.isFavorite(a.symbol);
            const bFav = this.isFavorite(b.symbol);
            if (aFav && !bFav) return -1;
            if (!aFav && bFav) return 1;
            return 0;
        });

        const rows = sortedData.map(ticker => {
            const changeClass = ticker.priceChangePercent >= 0 ? 'positive' : 'negative';
            const volumeUSDT = ticker.quoteVolume.toLocaleString(undefined, { maximumFractionDigits: 0 });
            const isFav = this.isFavorite(ticker.symbol);
            const starClass = isFav ? 'favorite-star active' : 'favorite-star';
            
            return `
                <tr>
                    <td><span class="${starClass}" onclick="event.stopPropagation(); symbolSelector.toggleFavorite('${ticker.symbol}')">★</span></td>
                    <td onclick="symbolSelector.selectSymbol('${ticker.symbol}')"><span class="symbol-name">${ticker.symbol}</span></td>
                    <td onclick="symbolSelector.selectSymbol('${ticker.symbol}')">${this.formatPrice(ticker.lastPrice)}</td>
                    <td onclick="symbolSelector.selectSymbol('${ticker.symbol}')">${volumeUSDT}</td>
                    <td onclick="symbolSelector.selectSymbol('${ticker.symbol}')"><span class="price-change ${changeClass}">${ticker.priceChangePercent.toFixed(2)}%</span></td>
                </tr>
            `;
        }).join('');
        
        tbody.innerHTML = rows;
    }

    formatPrice(price) {
        if (price >= 1) {
            return price.toFixed(4);
        } else if (price >= 0.001) {
            return price.toFixed(6);
        } else {
            return price.toFixed(8);
        }
    }

    selectSymbol(symbol) {
        this.selectedSymbol = symbol;
        
        // Update UI
        document.getElementById('selectedSymbol').textContent = symbol;
        
        // Hide modal
        this.hideModal();
        
        // Trigger symbol change event
        const event = new CustomEvent('symbolSelected', { detail: { symbol } });
        document.dispatchEvent(event);
    }

    getSelectedSymbol() {
        return this.selectedSymbol;
    }

    showLoadingOverlay(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.querySelector('.loading-text');
        
        text.textContent = message;
        overlay.style.display = 'flex';
    }

    hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = 'none';
    }

    showError(message) {
        // Update status in the main app
        const statusElement = document.getElementById('status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = 'status-error';
        }
    }

    showLoadingProgress(current, total, message) {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.querySelector('.loading-text');
        const progress = document.querySelector('.loading-progress');
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        text.textContent = message;
        
        if (total > 0) {
            const percentage = (current / total) * 100;
            progressFill.style.width = percentage + '%';
            progressText.textContent = `${current}/${total} (${Math.round(percentage)}%)`;
            progress.style.display = 'block';
        } else {
            progress.style.display = 'none';
        }
        
        overlay.style.display = 'flex';
    }

    // Load favorites from localStorage
    loadFavorites() {
        try {
            const saved = localStorage.getItem('symbol_favorites');
            return saved ? new Set(JSON.parse(saved)) : new Set();
        } catch (error) {
            console.error('Error loading favorites:', error);
            return new Set();
        }
    }

    // Save favorites to localStorage
    saveFavorites() {
        try {
            localStorage.setItem('symbol_favorites', JSON.stringify([...this.favorites]));
        } catch (error) {
            console.error('Error saving favorites:', error);
        }
    }

    // Toggle favorite status
    toggleFavorite(symbol) {
        if (this.favorites.has(symbol)) {
            this.favorites.delete(symbol);
        } else {
            this.favorites.add(symbol);
        }
        this.saveFavorites();
        this.renderTable(); // Re-render to update display
    }

    // Check if symbol is favorite
    isFavorite(symbol) {
        return this.favorites.has(symbol);
    }

    // Initialize realtime price updates
    initializeRealtimePrices() {
        if (this.wsConnection) {
            this.wsConnection.close();
        }

        // Connect to Binance WebSocket for mark price stream
        const wsUrl = 'wss://fstream.binance.com/ws/!markPrice@arr';
        this.wsConnection = new WebSocket(wsUrl);

        this.wsConnection.onopen = () => {
            console.log('Connected to Binance WebSocket for realtime prices');
        };

        this.wsConnection.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (Array.isArray(data)) {
                    // Update realtime prices map
                    data.forEach(item => {
                        if (item.s && item.p) { // symbol and price
                            this.realtimePrices.set(item.s, parseFloat(item.p));
                        }
                    });
                    
                    // Update visible table if modal is open
                    this.updateTablePrices();
                }
            } catch (error) {
                console.error('Error parsing WebSocket data:', error);
            }
        };

        this.wsConnection.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        this.wsConnection.onclose = () => {
            console.log('WebSocket connection closed, attempting to reconnect in 5s...');
            setTimeout(() => {
                if (document.getElementById('symbolModal').style.display === 'block') {
                    this.initializeRealtimePrices();
                }
            }, 5000);
        };
    }

    // Update table prices with realtime data
    updateTablePrices() {
        const modal = document.getElementById('symbolModal');
        if (modal.style.display !== 'block') return;

        const rows = document.querySelectorAll('#symbol-table-body tr');
        rows.forEach(row => {
            const symbolCell = row.querySelector('.symbol-name');
            if (symbolCell) {
                const symbol = symbolCell.textContent;
                const realtimePrice = this.realtimePrices.get(symbol);
                
                if (realtimePrice) {
                    // Update price in the row (3rd column for price)
                    const priceCell = row.cells[2]; // 0=star, 1=symbol, 2=price
                    if (priceCell) {
                        const oldPrice = parseFloat(priceCell.textContent.replace(/,/g, ''));
                        priceCell.textContent = this.formatPrice(realtimePrice);
                        
                        // Add flash effect for price changes
                        if (oldPrice && oldPrice !== realtimePrice) {
                            const flashClass = realtimePrice > oldPrice ? 'price-flash-up' : 'price-flash-down';
                            priceCell.classList.add(flashClass);
                            setTimeout(() => priceCell.classList.remove(flashClass), 500);
                        }
                    }
                }
            }
        });
    }

    // Override showModal to start realtime prices
    showModal() {
        const modal = document.getElementById('symbolModal');
        modal.style.display = 'block';
        this.initializeRealtimePrices();
    }

    // Override hideModal to cleanup websocket
    hideModal() {
        const modal = document.getElementById('symbolModal');
        modal.style.display = 'none';
        if (this.wsConnection) {
            this.wsConnection.close();
            this.wsConnection = null;
        }
    }
}
