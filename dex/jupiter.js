from .base_dex import BaseDex, PoolInfo, PriceInfo
from ..config import Config
import logging
import aiohttp
from solders.pubkey import Pubkey
import time
from typing import Optional

class JupiterDex(BaseDex):
    def __init__(self, connection):
        super().__init__(connection)
        self.logger = logging.getLogger(__name__)
        self.api_endpoint = "https://quote-api.jup.ag/v6"
        
    async def init_pools(self):
        """Initialize Jupiter pools by fetching from API"""
        try:
            timeout = aiohttp.ClientTimeout(total=10)  # 10 seconds timeout
            async with aiohttp.ClientSession(timeout=timeout) as session:
                # Initialize with fallback pools first
                self._init_fallback_pools()
                
                try:
                    # Try to get real pool data
                    async with session.get(f"{self.api_endpoint}/indexed-route-map") as response:
                        if response.status == 200:
                            route_map = await response.json()
                            
                            # Process each market in the route map
                            for input_mint, output_markets in route_map.items():
                                for output_mint in output_markets:
                                    pool_address = f"jupiter_{input_mint}_{output_mint}"
                                    self.pools[pool_address] = PoolInfo(
                                        pool_address=pool_address,
                                        token_a=input_mint,
                                        token_b=output_mint,
                                        reserve_a=1_000_000,
                                        reserve_b=1_000_000,
                                        fee_rate=0.003
                                    )
                            
                            self.logger.info(f"Initialized {len(self.pools)} Jupiter pools")
                except Exception as e:
                    self.logger.warning(f"Using fallback pools for Jupiter: {e}")
                    
        except Exception as e:
            self.logger.error(f"Error initializing Jupiter pools: {e}")
            
    def _init_fallback_pools(self):
        """Initialize with hardcoded pools from config"""
        for pool_name, pool_address in Config.dex.DEX_POOLS['Jupiter'].items():
            tokens = pool_name.split('/')
            if len(tokens) == 2:
                self.pools[pool_address] = PoolInfo(
                    pool_address=pool_address,
                    token_a=Config.token.TOKENS[tokens[0]],
                    token_b=Config.token.TOKENS[tokens[1]],
                    reserve_a=1_000_000,
                    reserve_b=1_000_000,
                    fee_rate=0.003
                )
            
    async def get_price(self, input_token: str, output_token: str, amount: float) -> Optional[PriceInfo]:
        """Get price quote from Jupiter API"""
        try:
            async with aiohttp.ClientSession() as session:
                params = {
                    "inputMint": input_token,
                    "outputMint": output_token,
                    "amount": int(amount * 1e9),  # Convert to lamports
                    "slippageBps": int(Config.network.SLIPPAGE_TOLERANCE * 100)
                }
                
                async with session.get(f"{self.api_endpoint}/quote", params=params) as response:
                    if response.status == 200:
                        quote_data = await response.json()
                        
                        return PriceInfo(
                            input_token=input_token,
                            output_token=output_token,
                            input_amount=amount,
                            output_amount=float(quote_data['outAmount']) / 1e9,
                            price_impact=float(quote_data.get('priceImpactPct', 0)),
                            fee=float(quote_data.get('fee', 0)) / 1e9
                        )
                    elif response.status == 404:
                        # No route found - this is normal
                        return None
                    else:
                        self.logger.debug(f"Jupiter quote failed: {response.status}")
                        return None
                        
        except Exception as e:
            # Only log real errors
            if "No route found" not in str(e):
                self.logger.debug(f"Error getting Jupiter price: {e}")
            return None
            
    async def has_pool(self, token_a: str, token_b: str) -> bool:
        """Check if Jupiter has a route between tokens"""
        try:
            price = await self.get_price(token_a, token_b, 1.0)
            return price is not None
        except:
            return False

    async def execute_swap(self, input_token: str, output_token: str, amount: float) -> str:
        """Execute swap on Jupiter (simulation only)"""
        try:
            quote = await self.get_price(input_token, output_token, amount)
            if not quote:
                raise Exception("Could not get quote for swap")
                
            # Return simulated transaction signature
            return "SimulatedJupiterSwap_" + str(int(time.time()))
            
        except Exception as e:
            self.logger.error(f"Error executing Jupiter swap: {e}")
            raise 