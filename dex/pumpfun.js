from .base_dex import BaseDex, PoolInfo, PriceInfo
from ..config import Config
import logging
import aiohttp
from solders.pubkey import Pubkey
import time
from typing import Optional

class PumpFunDex(BaseDex):
    def __init__(self, connection):
        super().__init__(connection)
        self.logger = logging.getLogger(__name__)
        self.api_endpoint = "https://api.pump.fun/v1"
        
    async def init_pools(self):
        """Initialize PumpFun pools"""
        try:
            timeout = aiohttp.ClientTimeout(total=10)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                self._init_fallback_pools()
                
                try:
                    async with session.get(f"{self.api_endpoint}/pools") as response:
                        if response.status == 200:
                            pools_data = await response.json()
                            for pool in pools_data:
                                try:
                                    pool_address = pool['address']
                                    self.pools[pool_address] = PoolInfo(
                                        pool_address=pool_address,
                                        token_a=pool['token0'],
                                        token_b=pool['token1'],
                                        reserve_a=float(pool['reserve0']),
                                        reserve_b=float(pool['reserve1']),
                                        fee_rate=0.003
                                    )
                                except (KeyError, ValueError):
                                    continue
                                    
                            self.logger.info(f"Initialized {len(self.pools)} PumpFun pools")
                except Exception as e:
                    self.logger.warning(f"Using fallback pools for PumpFun: {e}")
                    
        except Exception as e:
            self.logger.error(f"Error initializing PumpFun pools: {e}")
            
    def _init_fallback_pools(self):
        """Initialize with hardcoded pools from config"""
        for pool_name, pool_address in Config.dex.DEX_POOLS.get('PumpFun', {}).items():
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
        """Get price from PumpFun"""
        try:
            pool_address = None
            for addr, pool in self.pools.items():
                if ((pool.token_a == input_token and pool.token_b == output_token) or
                    (pool.token_b == input_token and pool.token_a == output_token)):
                    pool_address = addr
                    break
                    
            if not pool_address:
                return None
                
            pool = self.pools[pool_address]
            
            # Calculate output using constant product formula
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
            self.logger.debug(f"Error getting PumpFun price: {e}")
            return None

    async def has_pool(self, token_a: str, token_b: str) -> bool:
        """Check if PumpFun has a pool for the token pair"""
        for pool in self.pools.values():
            if ((pool.token_a == token_a and pool.token_b == token_b) or
                (pool.token_b == token_a and pool.token_a == token_b)):
                return True
        return False

    async def execute_swap(self, input_token: str, output_token: str, amount: float) -> str:
        """Execute swap on PumpFun (simulation only)"""
        try:
            quote = await self.get_price(input_token, output_token, amount)
            if not quote:
                raise Exception("Could not get quote for swap")
                
            return "SimulatedPumpFunSwap_" + str(int(time.time()))
            
        except Exception as e:
            self.logger.error(f"Error executing PumpFun swap: {e}")
            raise 