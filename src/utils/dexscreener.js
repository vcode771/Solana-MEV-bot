import aiohttp
import logging
from typing import Dict, Optional
from ..config import Config

class DexScreenerAPI:
    BASE_URL = "https://api.dexscreener.com/latest"
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.session = None
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
            
    async def get_pair_info(self, pair_address: str) -> Optional[Dict]:
        """Get detailed pair information from DEXScreener"""
        try:
            async with self.session.get(f"{self.BASE_URL}/dex/pairs/solana/{pair_address}") as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('pair', {})
                else:
                    self.logger.error(f"DEXScreener API error: {response.status}")
                    return None
        except Exception as e:
            self.logger.error(f"Error fetching pair info: {e}")
            return None
            
    async def get_token_pairs(self, token_address: str) -> list:
        """Get all pairs for a specific token"""
        try:
            async with self.session.get(f"{self.BASE_URL}/dex/tokens/{token_address}") as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('pairs', [])
                else:
                    self.logger.error(f"DEXScreener API error: {response.status}")
                    return []
        except Exception as e:
            self.logger.error(f"Error fetching token pairs: {e}")
            return [] 