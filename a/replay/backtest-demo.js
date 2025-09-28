/**
 * Demo script for Simple Backtest System
 * Shows how to use the backtest system with sample data
 */

// Sample candle data for testing
const sampleCandles = [
    { time: 1640995200000, open: 47000, high: 47500, low: 46800, close: 47200, volume: 100 },
    { time: 1640995260000, open: 47200, high: 47800, low: 47000, close: 47600, volume: 120 },
    { time: 1640995320000, open: 47600, high: 48000, low: 47400, close: 47900, volume: 110 },
    { time: 1640995380000, open: 47900, high: 48200, low: 47700, close: 48100, volume: 130 },
    { time: 1640995440000, open: 48100, high: 48300, low: 47900, close: 48000, volume: 105 },
    { time: 1640995500000, open: 48000, high: 48100, low: 47600, close: 47700, volume: 95 },
    { time: 1640995560000, open: 47700, high: 47900, low: 47300, close: 47400, volume: 115 },
    { time: 1640995620000, open: 47400, high: 47600, low: 47000, close: 47100, volume: 125 },
    { time: 1640995680000, open: 47100, high: 47300, low: 46800, close: 46900, volume: 140 },
    { time: 1640995740000, open: 46900, high: 47200, low: 46600, close: 46800, volume: 135 },
    { time: 1640995800000, open: 46800, high: 47000, low: 46500, close: 46700, volume: 150 },
    { time: 1640995860000, open: 46700, high: 46900, low: 46400, close: 46500, volume: 160 },
    { time: 1640995920000, open: 46500, high: 46800, low: 46200, close: 46600, volume: 145 },
    { time: 1640995980000, open: 46600, high: 47000, low: 46400, close: 46800, volume: 130 },
    { time: 1640996040000, open: 46800, high: 47200, low: 46600, close: 47000, volume: 120 },
    { time: 1640996100000, open: 47000, high: 47400, low: 46800, close: 47300, volume: 110 },
    { time: 1640996160000, open: 47300, high: 47700, low: 47100, close: 47500, volume: 100 },
    { time: 1640996220000, open: 47500, high: 47900, low: 47300, close: 47800, volume: 95 },
    { time: 1640996280000, open: 47800, high: 48200, low: 47600, close: 48000, volume: 105 },
    { time: 1640996340000, open: 48000, high: 48400, low: 47800, close: 48200, volume: 115 }
];

/**
 * Run backtest demo
 */
function runBacktestDemo() {
    console.log('=== Simple Backtest System Demo ===\n');
    
    // Create backtest system
    const backtest = new SimpleBacktestSystem();
    
    console.log('Running backtest on', sampleCandles.length, 'candles...\n');
    
    // Run backtest
    const results = backtest.runBacktest(sampleCandles);
    
    console.log('\n=== Backtest Results ===');
    console.log('Total candles processed:', results.processedCandles);
    console.log('Total entries created:', results.entries.length);
    
    // Show statistics
    const stats = backtest.getStatistics();
    console.log('\n=== Statistics ===');
    console.log('Total entries:', stats.totalEntries);
    console.log('Closed entries:', stats.closedEntries);
    console.log('Win count:', stats.winCount);
    console.log('Loss count:', stats.lossCount);
    console.log('Win rate:', stats.winRate.toFixed(2) + '%');
    console.log('Total PnL:', stats.totalPnL?.toFixed(2) || 0, 'USDT');
    console.log('Average PnL:', stats.averagePnL?.toFixed(2) || 0, 'USDT');
    
    if (stats.bestEntry) {
        console.log('Best entry PnL:', stats.bestEntry.pnl.toFixed(2), 'USDT');
    }
    
    if (stats.worstEntry) {
        console.log('Worst entry PnL:', stats.worstEntry.pnl.toFixed(2), 'USDT');
    }
    
    // Show detailed entry information
    console.log('\n=== Entry Details ===');
    const allEntries = backtest.getAllEntries();
    
    allEntries.forEach((entry, index) => {
        console.log(`\nEntry ${index + 1}:`);
        console.log('  ID:', entry.id);
        console.log('  Side:', entry.side);
        console.log('  Status:', entry.status);
        console.log('  Capital:', entry.capital, 'USDT');
        
        if (entry.entryPrice) {
            console.log('  Entry Price:', entry.entryPrice);
            console.log('  Coin Amount:', entry.coinAmount?.toFixed(6));
        }
        
        if (entry.exitPrice) {
            console.log('  Exit Price:', entry.exitPrice);
            console.log('  PnL:', entry.pnl?.toFixed(2), 'USDT');
            console.log('  PnL %:', entry.pnlPercent?.toFixed(2) + '%');
        }
        
        console.log('  Candles in entry:', entry.candleData.length);
        
        if (entry.candleData.length > 0) {
            console.log('  Duration:', entry.candleData.length, 'candles');
            const firstCandle = entry.candleData[0];
            const lastCandle = entry.candleData[entry.candleData.length - 1];
            console.log('  Price range:', firstCandle.low, '-', lastCandle.high);
        }
    });
    
    return results;
}

/**
 * Generate more realistic sample data for testing
 */
function generateSampleData(count = 100, startPrice = 47000) {
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
            time: time,
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

/**
 * Run extended backtest with generated data
 */
function runExtendedBacktest() {
    console.log('\n\n=== Extended Backtest with Generated Data ===\n');
    
    // Generate more data
    const extendedCandles = generateSampleData(200, 47000);
    
    // Create backtest system
    const backtest = new SimpleBacktestSystem();
    
    console.log('Running extended backtest on', extendedCandles.length, 'candles...\n');
    
    // Run backtest
    const results = backtest.runBacktest(extendedCandles);
    
    // Show summary statistics
    const stats = backtest.getStatistics();
    console.log('=== Extended Backtest Results ===');
    console.log('Total entries:', stats.totalEntries);
    console.log('Closed entries:', stats.closedEntries);
    console.log('Win rate:', stats.winRate.toFixed(2) + '%');
    console.log('Total PnL:', stats.totalPnL?.toFixed(2) || 0, 'USDT');
    console.log('Average PnL per entry:', stats.averagePnL?.toFixed(2) || 0, 'USDT');
    
    // Show entry summary
    const allEntries = backtest.getAllEntries();
    const closedEntries = allEntries.filter(e => e.status === 'CLOSED');
    
    if (closedEntries.length > 0) {
        console.log('\n=== Entry Summary ===');
        closedEntries.forEach((entry, index) => {
            const duration = entry.candleData.length;
            const pnl = entry.pnl || 0;
            const pnlPercent = entry.pnlPercent || 0;
            
            console.log(`${index + 1}. ${entry.side} - ${duration} candles - ${pnl.toFixed(2)} USDT (${pnlPercent.toFixed(2)}%)`);
        });
    }
    
    return results;
}

// Export functions for use in HTML
if (typeof window !== 'undefined') {
    window.runBacktestDemo = runBacktestDemo;
    window.runExtendedBacktest = runExtendedBacktest;
    window.generateSampleData = generateSampleData;
    window.SimpleBacktestSystem = SimpleBacktestSystem;
}