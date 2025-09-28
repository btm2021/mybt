/**
 * Entry Class - Represents a single trading entry with complete lifecycle management
 * Handles entry creation, real-time updates, and final closure with PnL calculations
 */
class Entry {
    constructor(signal, config, pnlCalculator) {
        // Validate inputs
        this.validateConstructorInputs(signal, config, pnlCalculator);
        
        // Core identification
        this.id = this.generateId();
        this.direction = signal.type; // 'LONG' or 'SHORT'
        
        // Timing information
        this.entryTime = signal.timestamp;
        this.entryCandle = signal.candleIndex;
        this.exitTime = null;
        this.exitCandle = null;
        
        // Price information
        this.entryPrice = null; // Will be set when entry is executed
        this.exitPrice = null;
        
        // Position information from config
        this.margin = config.initialCapital || 200; // USDT
        this.leverage = config.leverage || 20;
        this.positionSize = null; // Will be calculated when entry price is set
        
        // Performance tracking
        this.currentPnL = 0;
        this.currentROE = 0;
        this.maxPnL = 0;
        this.maxROE = 0;
        this.minPnL = 0;
        this.minROE = 0;
        
        // Final results (set when entry is closed)
        this.finalPnL = null;
        this.finalROE = null;
        this.isWin = null;
        
        // Status tracking
        this.status = 'PENDING'; // 'PENDING', 'ACTIVE', 'CLOSED'
        
        // Data collection
        this.candleData = [];
        this.priceHistory = [];
        
        // Configuration
        this.winThreshold = config.winThreshold || 25; // ROE percentage for win classification
        
        // Signal data
        this.signalData = {
            trail1Value: signal.trail1Value,
            trail2Value: signal.trail2Value,
            detectionTime: signal.detectionTime || signal.timestamp,
            executionTime: signal.executionTime || null
        };
        
        // Timestamps
        this.createdAt = Date.now();
        this.lastUpdateTime = null;
        
        // Reference to PnL calculator
        this.pnlCalculator = pnlCalculator;
    }
    
    /**
     * Execute the entry with the given price (after 1-candle delay)
     * @param {number} executionPrice - Price at which entry is executed
     * @param {number} executionTime - Timestamp of execution
     * @param {number} executionCandle - Candle index of execution
     */
    execute(executionPrice, executionTime, executionCandle) {
        if (this.status !== 'PENDING') {
            throw new Error(`Cannot execute entry ${this.id}: status is ${this.status}, expected PENDING`);
        }
        
        if (!executionPrice || executionPrice <= 0) {
            throw new Error('Execution price must be a positive number');
        }
        
        // Set entry price and calculate position size
        this.entryPrice = executionPrice;
        this.positionSize = this.pnlCalculator.calculatePositionSize(
            this.margin, 
            this.leverage, 
            this.entryPrice
        );
        
        // Update timing
        this.signalData.executionTime = executionTime;
        this.exitCandle = executionCandle;
        
        // Initialize PnL tracking
        this.pnlCalculator.initializeEntryTracking(this, this.entryPrice);
        
        // Update status
        this.status = 'ACTIVE';
        this.lastUpdateTime = executionTime;
        
        // Add initial price point
        this.addPricePoint(executionPrice, executionTime);
    }
    
    /**
     * Update entry with real-time price data during active period
     * @param {Object} candle - Current candle data (OHLCV)
     * @param {number} currentPrice - Current market price
     * @param {number} timestamp - Current timestamp
     */
    update(candle, currentPrice, timestamp) {
        if (this.status !== 'ACTIVE') {
            throw new Error(`Cannot update entry ${this.id}: status is ${this.status}, expected ACTIVE`);
        }
        
        if (!currentPrice || currentPrice <= 0) {
            throw new Error('Current price must be a positive number');
        }
        
        // Collect candle data
        if (candle) {
            this.addCandleData(candle);
        }
        
        // Update PnL calculations using the calculator
        this.pnlCalculator.updateEntryPnL(this, currentPrice);
        
        // Add price point to history
        this.addPricePoint(currentPrice, timestamp);
        
        // Update timestamp
        this.lastUpdateTime = timestamp;
    }
    
    /**
     * Close the entry with final PnL calculation and win/loss determination
     * @param {number} exitPrice - Price at which entry is closed
     * @param {number} exitTime - Timestamp of closure
     * @param {number} exitCandle - Candle index of closure
     * @returns {Object} Final entry statistics
     */
    close(exitPrice, exitTime, exitCandle) {
        if (this.status !== 'ACTIVE') {
            throw new Error(`Cannot close entry ${this.id}: status is ${this.status}, expected ACTIVE`);
        }
        
        if (!exitPrice || exitPrice <= 0) {
            throw new Error('Exit price must be a positive number');
        }
        
        // Set exit information
        this.exitPrice = exitPrice;
        this.exitTime = exitTime;
        this.exitCandle = exitCandle;
        
        // Calculate final PnL and ROE
        this.finalPnL = this.pnlCalculator.calculatePnL(
            this.direction,
            this.entryPrice,
            this.exitPrice,
            this.positionSize
        );
        
        this.finalROE = this.pnlCalculator.calculateROE(this.finalPnL, this.margin);
        
        // Determine win/loss based on ROE threshold
        this.isWin = this.finalROE >= this.winThreshold;
        
        // Update current values to final values
        this.currentPnL = this.finalPnL;
        this.currentROE = this.finalROE;
        
        // Update max/min if final values are extremes
        this.maxPnL = Math.max(this.maxPnL, this.finalPnL);
        this.minPnL = Math.min(this.minPnL, this.finalPnL);
        this.maxROE = Math.max(this.maxROE, this.finalROE);
        this.minROE = Math.min(this.minROE, this.finalROE);
        
        // Add final price point
        this.addPricePoint(exitPrice, exitTime);
        
        // Update status and timestamp
        this.status = 'CLOSED';
        this.lastUpdateTime = exitTime;
        
        return this.getStats();
    }
    
    /**
     * Add candle data to the entry's collection
     * @param {Object} candle - Candle data (OHLCV)
     */
    addCandleData(candle) {
        if (!candle) return;
        
        // Store essential candle information
        const candleInfo = {
            timestamp: candle.timestamp || Date.now(),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume || 0
        };
        
        this.candleData.push(candleInfo);
    }
    
    /**
     * Add price point to history for detailed tracking
     * @param {number} price - Price to record
     * @param {number} timestamp - Timestamp of the price
     */
    addPricePoint(price, timestamp) {
        if (!price || price <= 0) return;
        
        const pnl = this.entryPrice ? this.pnlCalculator.calculatePnL(
            this.direction,
            this.entryPrice,
            price,
            this.positionSize || 0
        ) : 0;
        
        const roe = this.margin ? this.pnlCalculator.calculateROE(pnl, this.margin) : 0;
        
        this.priceHistory.push({
            price,
            timestamp: timestamp || Date.now(),
            pnl,
            roe
        });
    }
    
    /**
     * Get comprehensive entry statistics
     * @returns {Object} Complete entry statistics
     */
    getStats() {
        const duration = this.exitTime ? this.exitTime - this.entryTime : 
                        (this.lastUpdateTime ? this.lastUpdateTime - this.entryTime : 0);
        
        const candleCount = this.candleData.length;
        const pricePointCount = this.priceHistory.length;
        
        return {
            // Basic info
            id: this.id,
            direction: this.direction,
            status: this.status,
            
            // Timing
            entryTime: this.entryTime,
            exitTime: this.exitTime,
            duration: duration,
            entryCandle: this.entryCandle,
            exitCandle: this.exitCandle,
            
            // Prices
            entryPrice: this.entryPrice,
            exitPrice: this.exitPrice,
            
            // Position
            margin: this.margin,
            leverage: this.leverage,
            positionSize: this.positionSize,
            
            // Performance
            finalPnL: this.finalPnL,
            finalROE: this.finalROE,
            currentPnL: this.currentPnL,
            currentROE: this.currentROE,
            
            // Extremes
            maxPnL: this.maxPnL,
            maxROE: this.maxROE,
            minPnL: this.minPnL,
            minROE: this.minROE,
            
            // Classification
            isWin: this.isWin,
            winThreshold: this.winThreshold,
            
            // Data collection
            candleCount: candleCount,
            pricePointCount: pricePointCount,
            
            // Signal data
            signalData: { ...this.signalData },
            
            // Timestamps
            createdAt: this.createdAt,
            lastUpdateTime: this.lastUpdateTime
        };
    }
    
    /**
     * Export entry data for analysis or storage
     * @param {boolean} includeFullData - Whether to include full candle and price history
     * @returns {Object} Exportable entry data
     */
    exportData(includeFullData = false) {
        const baseData = this.getStats();
        
        if (includeFullData) {
            baseData.candleData = [...this.candleData];
            baseData.priceHistory = [...this.priceHistory];
        }
        
        return baseData;
    }
    
    /**
     * Get entry duration in milliseconds
     * @returns {number} Duration in milliseconds
     */
    getDuration() {
        if (this.status === 'PENDING') return 0;
        
        const endTime = this.exitTime || this.lastUpdateTime || Date.now();
        return endTime - this.entryTime;
    }
    
    /**
     * Get entry duration in candles
     * @returns {number} Duration in number of candles
     */
    getDurationInCandles() {
        if (this.status === 'PENDING' || !this.exitCandle) return 0;
        
        return this.exitCandle - this.entryCandle;
    }
    
    /**
     * Check if entry is currently profitable
     * @returns {boolean} True if current ROE is positive
     */
    isProfitable() {
        return this.currentROE > 0;
    }
    
    /**
     * Get performance summary
     * @returns {Object} Performance metrics
     */
    getPerformanceSummary() {
        return {
            direction: this.direction,
            status: this.status,
            currentROE: this.currentROE,
            maxROE: this.maxROE,
            minROE: this.minROE,
            finalROE: this.finalROE,
            isWin: this.isWin,
            isProfitable: this.isProfitable(),
            duration: this.getDuration(),
            candleCount: this.candleData.length
        };
    }
    
    /**
     * Generate unique ID for the entry
     * @returns {string} Unique entry ID
     */
    generateId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `entry_${timestamp}_${random}`;
    }
    
    /**
     * Validate constructor inputs
     * @param {Object} signal - Signal object
     * @param {Object} config - Configuration object
     * @param {Object} pnlCalculator - PnL calculator instance
     */
    validateConstructorInputs(signal, config, pnlCalculator) {
        if (!signal || !signal.type || !['LONG', 'SHORT'].includes(signal.type)) {
            throw new Error('Invalid signal: must have type LONG or SHORT');
        }
        
        if (!signal.timestamp || typeof signal.timestamp !== 'number') {
            throw new Error('Invalid signal: must have valid timestamp');
        }
        
        if (typeof signal.candleIndex !== 'number' || signal.candleIndex < 0) {
            throw new Error('Invalid signal: must have valid candleIndex');
        }
        
        if (!config || typeof config !== 'object') {
            throw new Error('Invalid config: must be an object');
        }
        
        if (!pnlCalculator || typeof pnlCalculator.calculatePnL !== 'function') {
            throw new Error('Invalid pnlCalculator: must have calculatePnL method');
        }
    }
    
    /**
     * Validate entry state for operations
     * @param {string} expectedStatus - Expected status for the operation
     */
    validateStatus(expectedStatus) {
        if (this.status !== expectedStatus) {
            throw new Error(`Entry ${this.id} has status ${this.status}, expected ${expectedStatus}`);
        }
    }
    
    /**
     * Get a copy of the entry's candle data
     * @returns {Array} Copy of candle data array
     */
    getCandleData() {
        return [...this.candleData];
    }
    
    /**
     * Get a copy of the entry's price history
     * @returns {Array} Copy of price history array
     */
    getPriceHistory() {
        return [...this.priceHistory];
    }
    
    /**
     * Reset entry to initial state (for testing purposes)
     */
    reset() {
        this.status = 'PENDING';
        this.entryPrice = null;
        this.exitPrice = null;
        this.exitTime = null;
        this.exitCandle = null;
        this.positionSize = null;
        this.currentPnL = 0;
        this.currentROE = 0;
        this.maxPnL = 0;
        this.maxROE = 0;
        this.minPnL = 0;
        this.minROE = 0;
        this.finalPnL = null;
        this.finalROE = null;
        this.isWin = null;
        this.candleData = [];
        this.priceHistory = [];
        this.lastUpdateTime = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Entry;
}