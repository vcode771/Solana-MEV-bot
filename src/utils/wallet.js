from solders.pubkey import Pubkey
from solana.rpc.async_api import AsyncClient
import logging

class WalletManager:
    def __init__(self, connection: AsyncClient, wallet_address: Pubkey):
        self.connection = connection
        self.wallet_address = wallet_address
        self.logger = logging.getLogger(__name__)
        self.token_balances = {}
        
    async def update_balances(self):
        """Update all token balances"""
        try:
            # Get SOL balance
            sol_balance = await self.connection.get_balance(self.wallet_address)
            self.token_balances["SOL"] = sol_balance / 1e9  # Convert lamports to SOL
            
            # Get SPL token balances
            token_accounts = await self.connection.get_token_accounts_by_owner(
                self.wallet_address,
                {"programId": Pubkey.from_string("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA")}
            )
            
            for account in token_accounts.value:
                mint = account.account.data.parsed['info']['mint']
                amount = float(account.account.data.parsed['info']['tokenAmount']['uiAmount'])
                self.token_balances[mint] = amount
                
        except Exception as e:
            self.logger.error(f"Error updating balances: {e}")
            
    def get_balance(self, token_address: str) -> float:
        """Get balance for specific token"""
        return self.token_balances.get(token_address, 0.0) 