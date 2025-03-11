# Solana-MEV-Bot
Solana mev bot
at the moment this is one of the few working bots, and most likely this is not a MEV bot but a regular arbitrage bot, simple open source code, presented as an example but at the same time it works and brings some profit, be careful, presented for informational purposes only

![Solana-MEV-Bot-2 97](https://github.com/user-attachments/assets/3735c5f9-15c0-46b6-830f-83794fff2e04)



# Solana MEV Bot Installation and Launch Guide
- System requirements:
- Node.js 16+
- npm 8+
- Git

# Installation steps:
- Clone repository
- git clone [url rep]
- cd solana-mev-bot
- Install dependencies
- npm install
- Configuration settings
- Open config.yaml file
- Specify your Solana private key in the KEYS.PRIVATE_KEY section
- Select a strategy in config.yaml:

# Launching the bot:
- Via CLI interface (recommended)
- npm start
- Directly (without CLI)
- npm run bot

# Important notes:
- Minimum balance for operation: 0.5 SOL
- Recommended RPC: https://api.mainnet-beta.solana.com (https://api.mainnet-beta.solana.com/)
- The bot automatically restarts every 30 minutes
- All transactions are simulated before execution

# Security:
- Never share your private key
- Use a separate wallet for the bot
- Check your balance and statistics regularly

# Supported DEX:
- Raydium
- Orca
- Meteora
- Jupiter

# Supported tokens:
- SOL
- USDC
- RAY
- ORCA
- MNGO
- SRM
