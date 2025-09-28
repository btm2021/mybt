/**
 * PnLCalculator - Handles profit/loss calculations for futures trading with leverage
 * Supports both LONG and SHORT positions with proper futures trading formulas
 */
class PnLCalculator {
    constructor() {
        // Default configuration values
        this.DEFAULT_MARGIN = 200; // USDT
        this.DEFAULT_LEVERAGE = 20;
    }

    /**
     * Calculate position size based on margin and leverage
     * @param {number} margin - Margin amount in USDT (default: 200)
     * @param {number} leverage - Leverage multiplier (default: 20)
     * @param {number} entryPrice - Entry price for the position
     * @returns {number} Position size in base currency
     */
    calculatePositionSize(margin = this.DEFAULT_MARGIN, leverage = this.DEFAULT_LEVERAGE, entryPrice) {
        if (!entryPrice || entryPrice <= 0) {
            throw new Error('Entry price must be a positive number');
        }
        if (!margin || margin <= 0) {
            throw new Error('Margin must be a positive number');
        }
        if (!leverage || leverage <= 0) {
            throw new Error('Leverage must be a positive number');
        }

        // Position size = (margin * leverage) / entry price
        return (margin * leverage) / entryPrice;
    }

    /**
     * Calculate PnL for a position using futures trading formulas
     * @param {string} direction - 'LONG' or 'SHORT'
     * @param {number} entryPrice - Entry price of the position
     * @param {number} currentPrice - Current market price
     * @param {number} positionSize - Size of the position
     * @returns {number} PnL in USDT
     */
    calculatePnL(direction, entryPrice, currentPrice, positionSize) {
        if (!direction || !['LONG', 'SHORT'].includes(direction)) {
            throw new Error('Direction must be either LONG or SHORT');
        }
        if (!entryPrice || entryPrice <= 0) {
            throw new Error('Entry price must be a positive number');
        }
        if (!currentPrice || currentPrice <= 0) {
            throw new Error('Current price must be a positive number');
        }
        if (!positionSize || positionSize <= 0) {
            throw new Error('Position size must be a positive number');
        }

        let pnl;
        
        if (direction === 'LONG') {
            // For LONG: PnL = (currentPrice - entryPrice) * positionSize
            pnl = (currentPrice - entryPrice) * positionSize;
        } else {
            // For SHORT: PnL = (entryPrice - currentPrice) * positionSize
            pnl = (entryPrice - currentPrice) * positionSize;
        }

        return pnl;
    }

    /**
     * Calculate ROE (Return on Equity) as percentage
     * @param {number} pnl - Profit/Loss in USDT
     * @param {number} margin - Margin used for the position
     * @returns {number} ROE as percentage
     */
    calculateROE(pnl, margin) {
        if (typeof pnl !== 'number') {
            throw new Error('PnL must be a number');
        }
        if (!margin || margin <= 0) {
            throw new Error('Margin must be a positive number');
        }

        // ROE = (PnL / margin) * 100%
        return (pnl / margin) * 100;
    }

    /**
     * Calculate unrealized PnL for an active position
     * @param {Object} entry - Entry object with position details
     * @param {number} currentPrice - Current market price
     * @returns {number} Unrealized PnL in USDT
     */
    calculateUnrealizedPnL(entry, currentPrice) {
        if (!entry || !entry.direction || !entry.entryPrice || !entry.positionSize) {
            throw new Error('Invalid entry object - missing required properties');
        }

        return this.calculatePnL(
            entry.direction,
            entry.entryPrice,
            currentPrice,
            entry.positionSize
        );
    }

    /**
     * Calculate unrealized ROE for an active position
     * @param {Object} entry - Entry object with position details
     * @param {number} currentPrice - Current market price
     * @returns {number} Unrealized ROE as percentage
     */
    calculateUnrealizedROE(entry, currentPrice) {
        if (!entry || !entry.margin) {
            throw new Error('Invalid entry object - missing margin property');
        }

        const unrealizedPnL = this.calculateUnrealizedPnL(entry, currentPrice);
        return this.calculateROE(unrealizedPnL, entry.margin);
    }

    /**
     * Update entry with real-time PnL tracking and max/min calculations
     * @param {Object} entry - Entry object to update
     * @param {number} currentPrice - Current market price
     * @returns {Object} Updated entry with current PnL/ROE and max/min values
     */
    updateEntryPnL(entry, currentPrice) {
        this.validateEntry(entry);
        
        if (!currentPrice || currentPrice <= 0) {
            throw new Error('Current price must be a positive number');
        }

        // Calculate current unrealized PnL and ROE
        const currentPnL = this.calculateUnrealizedPnL(entry, currentPrice);
        const currentROE = this.calculateUnrealizedROE(entry, currentPrice);

        // Initialize tracking properties if they don't exist
        if (typeof entry.maxPnL === 'undefined') {
            entry.maxPnL = currentPnL;
            entry.minPnL = currentPnL;
            entry.maxROE = currentROE;
            entry.minROE = currentROE;
        }

        // Update current values
        entry.currentPnL = currentPnL;
        entry.currentROE = currentROE;

        // Update max/min tracking
        entry.maxPnL = Math.max(entry.maxPnL, currentPnL);
        entry.minPnL = Math.min(entry.minPnL, currentPnL);
        entry.maxROE = Math.max(entry.maxROE, currentROE);
        entry.minROE = Math.min(entry.minROE, currentROE);

        // Add timestamp for tracking
        entry.lastUpdateTime = Date.now();

        return entry;
    }

    /**
     * Calculate performance metrics for an entry
     * @param {Object} entry - Entry object with tracking data
     * @returns {Object} Performance metrics
     */
    calculatePerformanceMetrics(entry) {
        if (!entry.maxPnL || !entry.minPnL || !entry.maxROE || !entry.minROE) {
            throw new Error('Entry must have max/min tracking data');
        }

        return {
            // PnL metrics
            currentPnL: entry.currentPnL || 0,
            maxPnL: entry.maxPnL,
            minPnL: entry.minPnL,
            pnlRange: entry.maxPnL - entry.minPnL,
            
            // ROE metrics
            currentROE: entry.currentROE || 0,
            maxROE: entry.maxROE,
            minROE: entry.minROE,
            roeRange: entry.maxROE - entry.minROE,
            
            // Drawdown calculations
            drawdownFromMax: entry.maxPnL - (entry.currentPnL || 0),
            drawdownFromMaxPercent: entry.maxPnL !== 0 ? 
                ((entry.maxPnL - (entry.currentPnL || 0)) / Math.abs(entry.maxPnL)) * 100 : 0,
            
            // Performance ratios
            profitFactor: entry.minPnL < 0 ? Math.abs(entry.maxPnL / entry.minPnL) : null,
            
            // Risk metrics
            maxDrawdown: Math.abs(entry.minPnL),
            maxDrawdownPercent: Math.abs(entry.minROE),
            
            // Volatility (range as percentage of entry price)
            volatility: entry.entryPrice ? (entry.pnlRange / entry.positionSize / entry.entryPrice) * 100 : 0
        };
    }

    /**
     * Initialize entry tracking properties
     * @param {Object} entry - Entry object to initialize
     * @param {number} initialPrice - Initial price for tracking
     * @returns {Object} Entry with initialized tracking properties
     */
    initializeEntryTracking(entry, initialPrice = null) {
        this.validateEntry(entry);
        
        const price = initialPrice || entry.entryPrice;
        const initialPnL = this.calculateUnrealizedPnL(entry, price);
        const initialROE = this.calculateUnrealizedROE(entry, price);

        // Initialize all tracking properties
        entry.currentPnL = initialPnL;
        entry.currentROE = initialROE;
        entry.maxPnL = initialPnL;
        entry.minPnL = initialPnL;
        entry.maxROE = initialROE;
        entry.minROE = initialROE;
        entry.lastUpdateTime = Date.now();
        entry.priceHistory = [{ price, timestamp: Date.now(), pnl: initialPnL, roe: initialROE }];

        return entry;
    }

    /**
     * Add price point to entry history for detailed tracking
     * @param {Object} entry - Entry object
     * @param {number} price - Price to add
     * @param {number} timestamp - Optional timestamp (defaults to now)
     * @returns {Object} Updated entry
     */
    addPricePoint(entry, price, timestamp = null) {
        if (!entry.priceHistory) {
            entry.priceHistory = [];
        }

        const pnl = this.calculateUnrealizedPnL(entry, price);
        const roe = this.calculateUnrealizedROE(entry, price);

        entry.priceHistory.push({
            price,
            timestamp: timestamp || Date.now(),
            pnl,
            roe
        });

        // Update entry with this price point
        this.updateEntryPnL(entry, price);

        return entry;
    }

    /**
     * Calculate time-weighted performance metrics
     * @param {Object} entry - Entry with price history
     * @returns {Object} Time-weighted metrics
     */
    calculateTimeWeightedMetrics(entry) {
        if (!entry.priceHistory || entry.priceHistory.length < 2) {
            return null;
        }

        const history = entry.priceHistory;
        let totalTime = 0;
        let weightedPnL = 0;
        let weightedROE = 0;

        for (let i = 1; i < history.length; i++) {
            const timeDiff = history[i].timestamp - history[i-1].timestamp;
            const avgPnL = (history[i].pnl + history[i-1].pnl) / 2;
            const avgROE = (history[i].roe + history[i-1].roe) / 2;

            totalTime += timeDiff;
            weightedPnL += avgPnL * timeDiff;
            weightedROE += avgROE * timeDiff;
        }

        return {
            timeWeightedPnL: totalTime > 0 ? weightedPnL / totalTime : 0,
            timeWeightedROE: totalTime > 0 ? weightedROE / totalTime : 0,
            totalDuration: totalTime,
            dataPoints: history.length
        };
    }

    /**
     * Validate entry object has required properties for calculations
     * @param {Object} entry - Entry object to validate
     * @returns {boolean} True if valid, throws error if invalid
     */
    validateEntry(entry) {
        const requiredProps = ['direction', 'entryPrice', 'positionSize', 'margin'];
        
        for (const prop of requiredProps) {
            if (!entry.hasOwnProperty(prop)) {
                throw new Error(`Entry missing required property: ${prop}`);
            }
        }

        if (!['LONG', 'SHORT'].includes(entry.direction)) {
            throw new Error('Entry direction must be LONG or SHORT');
        }

        if (entry.entryPrice <= 0 || entry.positionSize <= 0 || entry.margin <= 0) {
            throw new Error('Entry price, position size, and margin must be positive numbers');
        }

        return true;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PnLCalculator;
}