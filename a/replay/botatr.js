class BotATRIndicator {
    constructor(emaLength = 30, atrLength = 14, atrMultiplier = 2.0) {
        this.emaLength = emaLength;
        this.atrLength = atrLength;
        this.atrMultiplier = atrMultiplier;
        this.reset();
    }

    // Reset all calculations
    reset() {
        this.emaMultiplier = 2 / (this.emaLength + 1);
        this.atrMultiplier_calc = 2 / (this.atrLength + 1);
        this.ema = null;
        this.atr = null;
        this.trail2 = null;
        this.isInitialized = false;
        this.prevClose = null;
    }

    // Calculate True Range
    calculateTrueRange(high, low, close, prevClose) {
        if (prevClose === null) {
            return high - low;
        }
        
        const tr1 = high - low;
        const tr2 = Math.abs(high - prevClose);
        const tr3 = Math.abs(low - prevClose);
        
        return Math.max(tr1, tr2, tr3);
    }

    // Calculate EMA
    calculateEMA(price, prevEMA, multiplier) {
        if (prevEMA === null) {
            return price;
        }
        return (price * multiplier) + (prevEMA * (1 - multiplier));
    }

    // Calculate ATR
    calculateATR(trueRange) {
        if (this.atr === null) {
            this.atr = trueRange;
        } else {
            this.atr = this.calculateEMA(trueRange, this.atr, this.atrMultiplier_calc);
        }
        return this.atr;
    }

    // Calculate Trail2 (ATR Dynamic Trailing Stop)
    calculateTrail2(trail1, prevTrail2, atrValue) {
        const sl2 = atrValue * this.atrMultiplier;
        
        // nz function equivalent
        const nzPrevTrail2 = prevTrail2 !== null ? prevTrail2 : 0;
        
        let trail2;
        
        if (trail1 > nzPrevTrail2) {
            // Trail1 > Trail2[1]
            if (this.prevTrail1 !== null && this.prevTrail1 > nzPrevTrail2) {
                // Trail1 > Trail2[1] and Trail1[1] > Trail2[1]
                trail2 = Math.max(nzPrevTrail2, trail1 - sl2);
            } else {
                // Trail1 > Trail2[1] but Trail1[1] <= Trail2[1]
                trail2 = trail1 - sl2;
            }
        } else {
            // Trail1 <= Trail2[1]
            if (this.prevTrail1 !== null && this.prevTrail1 < nzPrevTrail2) {
                // Trail1 < Trail2[1] and Trail1[1] < Trail2[1]
                trail2 = Math.min(nzPrevTrail2, trail1 + sl2);
            } else {
                // Default case
                trail2 = trail1 + sl2;
            }
        }
        
        return trail2;
    }

    // Calculate single point
    calculate(candle) {
        const { high, low, close, time } = candle;
        
        // Calculate True Range
        const trueRange = this.calculateTrueRange(high, low, close, this.prevClose);
        
        // Calculate ATR
        const atrValue = this.calculateATR(trueRange);
        
        // Calculate EMA (Trail1)
        this.ema = this.calculateEMA(close, this.ema, this.emaMultiplier);
        const trail1 = this.ema;
        
        // Calculate Trail2
        const trail2 = this.calculateTrail2(trail1, this.trail2, atrValue);
        
        // Store previous values for next calculation
        this.prevClose = close;
        this.prevTrail1 = trail1;
        this.trail2 = trail2;
        
        return {
            time: time,
            trail1: trail1,
            trail2: trail2,
            atr: atrValue
        };
    }

    // Calculate for array of candles
    calculateArray(candles) {
        this.reset();
        const results = {
            ema: [],
            trail: []
        };
        
        for (let i = 0; i < candles.length; i++) {
            const result = this.calculate(candles[i]);
            
            results.ema.push({
                time: result.time,
                value: result.trail1
            });
            
            results.trail.push({
                time: result.time,
                value: result.trail2
            });
        }
        
        return results;
    }

    // Calculate incrementally (for replay mode)
    calculateIncremental(candle) {
        const result = this.calculate(candle);
        
        return {
            ema: {
                time: result.time,
                value: result.trail1
            },
            trail: {
                time: result.time,
                value: result.trail2
            }
        };
    }

    // Get current values
    getCurrentValues() {
        return {
            ema: this.ema,
            trail2: this.trail2,
            atr: this.atr
        };
    }

    // Check if indicator is ready
    isReady() {
        return this.ema !== null && this.trail2 !== null;
    }

    // Update parameters
    updateParameters(emaLength, atrLength, atrMultiplier) {
        this.emaLength = emaLength;
        this.atrLength = atrLength;
        this.atrMultiplier = atrMultiplier;
        this.reset();
    }
}
/**
 * 
Simple Backtest System for BotATR Strategy
 * Implements the specific requirements:
 * 1. Entry after 1 candle when trail_1 crosses trail_2
 * 2. Long when trail1 > trail2, Short when trail2 > trail1
 * 3. Each entry uses 4000 USDT capital (converted to coin amount)
 * 4. Entry closes when side changes
 * 5. Each entry contains OHLCV data during its period
 * 6. Each entry is independent, no cumulative calculations
 */
class SimpleBacktestSystem {
    constructor() {
        this.botATR = new BotATRIndicator();
        this.entries = [];
        this.currentEntry = null;
        this.previousSide = null; // 'LONG', 'SHORT', or null
        this.capital = 4000; // USDT per entry
        this.candleIndex = 0;
    }

    /**
     * Process a single candle and manage entries
     * @param {Object} candle - OHLCV candle data
     * @returns {Object} Processing result with entry updates
     */
    processCandle(candle) {
        const result = this.botATR.calculate(candle);
        const { trail1, trail2 } = result;
        
        // Determine current side based on trail comparison
        let currentSide = null;
        if (trail1 > trail2) {
            currentSide = 'LONG';
        } else if (trail2 > trail1) {
            currentSide = 'SHORT';
        }

        const processingResult = {
            candleIndex: this.candleIndex,
            candle: candle,
            trail1: trail1,
            trail2: trail2,
            currentSide: currentSide,
            previousSide: this.previousSide,
            sideChanged: false,
            entryCreated: null,
            entryClosed: null,
            activeEntry: this.currentEntry
        };

        // Check if side changed (trail1 crosses trail2)
        if (currentSide && currentSide !== this.previousSide) {
            processingResult.sideChanged = true;

            // Close current entry if exists
            if (this.currentEntry) {
                this.closeEntry(candle);
                processingResult.entryClosed = this.currentEntry;
            }

            // Create new entry (will be executed at close of NEXT candle - 1 candle delay)
            const newEntry = this.createEntry(currentSide, candle, trail1, trail2);
            processingResult.entryCreated = newEntry;
        }

        // Update active entry with current candle data
        if (this.currentEntry && this.currentEntry.status === 'ACTIVE') {
            this.updateEntry(candle);
        }

        // Execute pending entry if exists (1-candle delay)
        if (this.currentEntry && this.currentEntry.status === 'PENDING') {
            this.executeEntry(candle);
        }

        this.previousSide = currentSide;
        this.candleIndex++;

        return processingResult;
    }

    /**
     * Create a new entry
     * @param {string} side - 'LONG' or 'SHORT'
     * @param {Object} candle - Current candle data
     * @param {number} trail1 - Trail1 value
     * @param {number} trail2 - Trail2 value
     * @returns {Object} New entry object
     */
    createEntry(side, candle, trail1, trail2) {
        const entry = {
            id: `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            side: side,
            status: 'PENDING', // Will be executed next candle
            capital: this.capital,
            
            // Signal data
            signalCandle: this.candleIndex,
            signalTime: candle.time,
            signalTrail1: trail1,
            signalTrail2: trail2,
            
            // Entry execution data (filled when executed)
            entryCandle: null,
            entryTime: null,
            entryPrice: null,
            coinAmount: null,
            
            // Exit data (filled when closed)
            exitCandle: null,
            exitTime: null,
            exitPrice: null,
            
            // Performance data
            pnl: null,
            pnlPercent: null,
            
            // OHLCV data during entry period
            candleData: [],
            
            // Timestamps
            createdAt: Date.now()
        };

        this.currentEntry = entry;
        return entry;
    }

    /**
     * Execute pending entry (1-candle delay)
     * @param {Object} candle - Execution candle
     */
    executeEntry(candle) {
        if (!this.currentEntry || this.currentEntry.status !== 'PENDING') {
            return;
        }

        const entry = this.currentEntry;
        
        // Entry at close price of the second candle after signal
        entry.entryCandle = this.candleIndex;
        entry.entryTime = candle.time;
        entry.entryPrice = candle.close; // Entry at close of second candle after signal
        entry.coinAmount = this.capital / entry.entryPrice; // Convert USDT to coin amount
        entry.status = 'ACTIVE';

        // Add first candle to data
        this.addCandleToEntry(entry, candle);
    }

    /**
     * Update active entry with current candle
     * @param {Object} candle - Current candle data
     */
    updateEntry(candle) {
        if (!this.currentEntry || this.currentEntry.status !== 'ACTIVE') {
            return;
        }

        // Add candle data to entry
        this.addCandleToEntry(this.currentEntry, candle);
    }

    /**
     * Close current entry
     * @param {Object} candle - Exit candle
     */
    closeEntry(candle) {
        if (!this.currentEntry || this.currentEntry.status !== 'ACTIVE') {
            return;
        }

        const entry = this.currentEntry;
        
        // Set exit data
        entry.exitCandle = this.candleIndex;
        entry.exitTime = candle.time;
        entry.exitPrice = candle.close; // Exit at current close
        entry.status = 'CLOSED';

        // Calculate PnL
        this.calculateEntryPnL(entry);

        // Add final candle
        this.addCandleToEntry(entry, candle);

        // Add to completed entries
        this.entries.push(entry);
        this.currentEntry = null;
    }

    /**
     * Add candle data to entry
     * @param {Object} entry - Entry object
     * @param {Object} candle - Candle data
     */
    addCandleToEntry(entry, candle) {
        const candleData = {
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume || 0,
            candleIndex: this.candleIndex
        };

        entry.candleData.push(candleData);
    }

    /**
     * Calculate PnL for completed entry
     * @param {Object} entry - Entry object
     */
    calculateEntryPnL(entry) {
        if (!entry.entryPrice || !entry.exitPrice || !entry.coinAmount) {
            entry.pnl = 0;
            entry.pnlPercent = 0;
            entry.maxPnL = 0;
            entry.maxPnLPercent = 0;
            entry.isWinByMaxPnL = false;
            return;
        }

        // Calculate actual PnL (exit PnL)
        let pnl;
        if (entry.side === 'LONG') {
            // Long: profit when price goes up
            pnl = (entry.exitPrice - entry.entryPrice) * entry.coinAmount;
        } else {
            // Short: profit when price goes down
            pnl = (entry.entryPrice - entry.exitPrice) * entry.coinAmount;
        }

        entry.pnl = pnl;
        entry.pnlPercent = (pnl / this.capital) * 100;

        // Calculate maximum possible PnL during the entry period
        this.calculateMaxPnL(entry);
    }

    /**
     * Calculate maximum PnL during entry period
     * @param {Object} entry - Entry object
     */
    calculateMaxPnL(entry) {
        if (!entry.candleData || entry.candleData.length === 0 || !entry.entryPrice) {
            entry.maxPnL = entry.pnl || 0;
            entry.maxPnLPercent = entry.pnlPercent || 0;
            entry.isWinByMaxPnL = false;
            return;
        }

        const entryPrice = entry.entryPrice;
        const coinAmount = entry.coinAmount;
        const side = entry.side;
        
        let maxPnL = -Infinity;
        let maxPrice = 0;
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
                    maxCandle = candle;
                }
            });
        });
        
        // Store maximum PnL data
        entry.maxPnL = maxPnL > -Infinity ? maxPnL : (entry.pnl || 0);
        entry.maxPnLPercent = (entry.maxPnL / this.capital) * 100;
        entry.maxPrice = maxPrice;
        entry.maxPnLCandle = maxCandle;
        
        // Determine if this is a win based on max PnL >= 50 USDT
        entry.isWinByMaxPnL = entry.maxPnL >= 50;
    }

    /**
     * Run backtest on array of candles
     * @param {Array} candles - Array of OHLCV candles
     * @returns {Object} Backtest results
     */
    runBacktest(candles) {
        // Reset state
        this.reset();

        const results = {
            totalCandles: candles.length,
            processedCandles: 0,
            entries: [],
            processingLog: []
        };

        // Process each candle
        for (let i = 0; i < candles.length; i++) {
            const candle = candles[i];
            const processingResult = this.processCandle(candle);
            
            results.processedCandles++;
            results.processingLog.push(processingResult);

            // Log significant events
            if (processingResult.sideChanged) {
                console.log(`Candle ${i}: Side changed from ${processingResult.previousSide} to ${processingResult.currentSide}`);
                
                if (processingResult.entryClosed) {
                    console.log(`  - Closed entry: ${processingResult.entryClosed.side} PnL: ${processingResult.entryClosed.pnl?.toFixed(2)} USDT (${processingResult.entryClosed.pnlPercent?.toFixed(2)}%)`);
                }
                
                if (processingResult.entryCreated) {
                    console.log(`  - Created new ${processingResult.entryCreated.side} entry (pending execution)`);
                }
            }
        }

        // Close any remaining active entry
        if (this.currentEntry && this.currentEntry.status === 'ACTIVE') {
            const lastCandle = candles[candles.length - 1];
            this.closeEntry(lastCandle);
        }

        // Collect all entries
        results.entries = [...this.entries];
        if (this.currentEntry) {
            results.entries.push(this.currentEntry);
        }

        return results;
    }

    /**
     * Get backtest statistics
     * @returns {Object} Statistics summary
     */
    getStatistics() {
        const closedEntries = this.entries.filter(entry => entry.status === 'CLOSED');
        
        if (closedEntries.length === 0) {
            return {
                totalEntries: 0,
                closedEntries: 0,
                winCount: 0,
                lossCount: 0,
                winRate: 0,
                totalPnL: 0,
                averagePnL: 0,
                bestEntry: null,
                worstEntry: null
            };
        }

        const winCount = closedEntries.filter(entry => entry.pnl > 0).length;
        const lossCount = closedEntries.length - winCount;
        const totalPnL = closedEntries.reduce((sum, entry) => sum + entry.pnl, 0);
        const averagePnL = totalPnL / closedEntries.length;

        const bestEntry = closedEntries.reduce((best, entry) => 
            entry.pnl > best.pnl ? entry : best
        );
        
        const worstEntry = closedEntries.reduce((worst, entry) => 
            entry.pnl < worst.pnl ? entry : worst
        );

        return {
            totalEntries: this.entries.length + (this.currentEntry ? 1 : 0),
            closedEntries: closedEntries.length,
            winCount: winCount,
            lossCount: lossCount,
            winRate: (winCount / closedEntries.length) * 100,
            totalPnL: totalPnL,
            averagePnL: averagePnL,
            bestEntry: bestEntry,
            worstEntry: worstEntry
        };
    }

    /**
     * Get all entries (for analysis)
     * @returns {Array} All entries
     */
    getAllEntries() {
        const allEntries = [...this.entries];
        if (this.currentEntry) {
            allEntries.push(this.currentEntry);
        }
        return allEntries;
    }

    /**
     * Reset backtest state
     */
    reset() {
        this.botATR.reset();
        this.entries = [];
        this.currentEntry = null;
        this.previousSide = null;
        this.candleIndex = 0;
    }

    /**
     * Export entry data for analysis
     * @param {string} entryId - Entry ID to export
     * @returns {Object} Entry data with full candle history
     */
    exportEntry(entryId) {
        const entry = this.getAllEntries().find(e => e.id === entryId);
        if (!entry) {
            return null;
        }

        return {
            ...entry,
            candleCount: entry.candleData.length,
            duration: entry.exitTime ? entry.exitTime - entry.entryTime : null,
            durationCandles: entry.exitCandle ? entry.exitCandle - entry.entryCandle : null
        };
    }
}