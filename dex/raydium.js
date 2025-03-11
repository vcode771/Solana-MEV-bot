from .base_dex import BaseDex, PoolInfo, PriceInfo
from ..config import Config
import logging
import aiohttp
from solders.pubkey import Pubkey
import time
from typing import Optional

class RaydiumDex(BaseDex):
    def __init__(self, connection):
        super().__init__(connection)
        self.logger = logging.getLogger(__name__)
        self.api_endpoint = "https://api.raydium.io/v2"
        
    async def init_pools(self):
        """Initialize Raydium pools by fetching from API"""
        try:
            # Initialize with fallback pools first
            self._init_fallback_pools()
            
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                try:
                    async with session.get(f"{self.api_endpoint}/main/pairs") as response:
                        if response.status == 200:
                            pools_data = await response.json()
                            
                            for pool in pools_data:
                                try:
                                    pool_address = pool.get('id') or pool.get('ammId')
                                    if pool_address and 'baseMint' in pool and 'quoteMint' in pool:
                                        self.pools[pool_address] = PoolInfo(
                                            pool_address=pool_address,
                                            token_a=pool['baseMint'],
                                            token_b=pool['quoteMint'],
                                            reserve_a=float(pool.get('baseReserve', 1_000_000)),
                                            reserve_b=float(pool.get('quoteReserve', 1_000_000)),
                                            fee_rate=0.0025
                                        )
                                except (KeyError, ValueError) as e:
                                    continue
                                    
                            self.logger.info(f"Initialized {len(self.pools)} Raydium pools")
                except Exception as e:
                    self.logger.warning(f"Using fallback pools for Raydium: {e}")
                    
        except Exception as e:
            self.logger.error(f"Error initializing Raydium pools: {e}")
            
    def _init_fallback_pools(self):
        """Initialize with hardcoded pools from config"""
        for pool_name, pool_address in Config.dex.DEX_POOLS['Raydium'].items():
            tokens = pool_name.split('/')
            if len(tokens) == 2:
                self.pools[pool_address] = PoolInfo(
                    pool_address=pool_address,
                    token_a=Config.token.TOKENS[tokens[0]],
                    token_b=Config.token.TOKENS[tokens[1]],
                    reserve_a=1_000_000,
                    reserve_b=1_000_000,
                    fee_rate=0.0025
                )
                
    async def get_price(self, input_token: str, output_token: str, amount: float) -> Optional[PriceInfo]:
        """Get price from Raydium pool"""
        try:
            # Find matching pool
            pool_address = None
            for addr, pool in self.pools.items():
                if ((pool.token_a == input_token and pool.token_b == output_token) or
                    (pool.token_b == input_token and pool.token_a == output_token)):
                    pool_address = addr
                    break
                    
            if not pool_address:
                return None
                
            pool = self.pools[pool_address]
            
            # Get latest pool state
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.api_endpoint}/pool/{pool_address}") as response:
                    if response.status == 200:
                        pool_data = await response.json()
                        
                        # Update reserves
                        pool.reserve_a = float(pool_data['tokenAAmount'])
                        pool.reserve_b = float(pool_data['tokenBAmount'])
                        
                        # Calculate output amount using constant product formula
                        if pool.token_a == input_token:
                            input_reserve = pool.reserve_a
                            output_reserve = pool.reserve_b
                        else:
                            input_reserve = pool.reserve_b
                            output_reserve = pool.reserve_a
                            
                        amount_with_fee = amount * (1 - pool.fee_rate)
                        output_amount = (output_reserve * amount_with_fee) / (input_reserve + amount_with_fee)
                        price_impact = (amount / input_reserve) * 100
                        
                        return PriceInfo(
                            input_token=input_token,
                            output_token=output_token,
                            input_amount=amount,
                            output_amount=output_amount,
                            price_impact=price_impact,
                            fee=amount * pool.fee_rate
                        )
                        
        except Exception as e:
            self.logger.debug(f"Error getting Raydium price: {e}")
            return None
            
    async def has_pool(self, token_a: str, token_b: str) -> bool:
        """Check if Raydium has a pool for the token pair"""
        for pool in self.pools.values():
            if ((pool.token_a == token_a and pool.token_b == token_b) or
                (pool.token_b == token_a and pool.token_a == token_b)):
                return True
        return False

    async def execute_swap(self, input_token: str, output_token: str, amount: float) -> str:
        """Execute swap on Raydium (simulation only)"""
        try:
            quote = await self.get_price(input_token, output_token, amount)
            if not quote:
                raise Exception("Could not get quote for swap")
                
            return "SimulatedRaydiumSwap_" + str(int(time.time()))
            
        except Exception as e:
            self.logger.error(f"Error executing Raydium swap: {e}")
            raise 