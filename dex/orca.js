from .base_dex import BaseDex, PoolInfo, PriceInfo
from ..config import Config
import logging
import aiohttp
from solders.pubkey import Pubkey
import time

class OrcaDex(BaseDex):
    def __init__(self, connection):
        super().__init__(connection)
        self.logger = logging.getLogger(__name__)
        self.api_endpoint = "https://api.orca.so"  # Orca API endpoint
        
    async def init_pools(self):
        """Initialize Orca pools"""
        try:
            # Initialize with some common Orca pools
            self.pools = {
                "DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe": PoolInfo(
                    pool_address="DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe",
                    token_a=Config.token.TOKENS["SOL"],
                    token_b=Config.token.TOKENS["USDC"],
                    reserve_a=1000000,
                    reserve_b=1000000,
                    fee_rate=0.003
                ),
                "GwzBgrXb4PG59zjce24SF2b9JXbLEjJJTBkmytuEZj1b": PoolInfo(
                    pool_address="GwzBgrXb4PG59zjce24SF2b9JXbLEjJJTBkmytuEZj1b",
                    token_a=Config.token.TOKENS["SOL"],
                    token_b=Config.token.TOKENS["RAY"],
                    reserve_a=500000,
                    reserve_b=500000,
                    fee_rate=0.003
                ),
            }
            
            # Update pool states
            for pool_address in self.pools.keys():
                await self.update_pool_state(pool_address)
                
        except Exception as e:
            self.logger.error(f"Error initializing Orca pools: {e}")
            
    async def get_price(self, input_token: str, output_token: str, amount: float) -> PriceInfo:
        """Get price information from Orca API"""
        try:
            # First check if we have this pool
            pool_address = None
            for addr, pool in self.pools.items():
                if ((pool.token_a == input_token and pool.token_b == output_token) or
                    (pool.token_b == input_token and pool.token_a == output_token)):
                    pool_address = addr
                    break
            
            if not pool_address:
                # Instead of error, return None silently for missing pools
                # This is normal as not all token pairs have pools
                return None
                
            pool = self.pools[str(pool_address)]
            
            # Skip only if pool is completely empty
            if pool.reserve_a <= 0 or pool.reserve_b <= 0:
                return None
            
            # Calculate expected output using constant product formula
            input_amount_with_fee = amount * (1 - pool.fee_rate)
            
            # Determine which reserve is input/output based on token direction
            if pool.token_a == input_token:
                input_reserve = pool.reserve_a
                output_reserve = pool.reserve_b
            else:
                input_reserve = pool.reserve_b
                output_reserve = pool.reserve_a
            
            output_amount = (output_reserve * input_amount_with_fee) / (input_reserve + input_amount_with_fee)
            
            # Calculate price impact
            price_impact = (amount / input_reserve) * 100
            
            return PriceInfo(
                input_token=input_token,
                output_token=output_token,
                input_amount=amount,
                output_amount=output_amount,
                price_impact=price_impact,
                fee=pool.fee_rate * amount
            )
                        
        except Exception as e:
            # Only log real errors, not missing pools
            if "No pool found" not in str(e):
                self.logger.error(f"Error getting Orca price: {e}")
            return None
            
    async def execute_swap(self, input_token: str, output_token: str, amount: float) -> str:
        """Execute a swap on Orca (simulation only for now)"""
        try:
            # For now, just simulate the swap
            quote = await self.get_price(input_token, output_token, amount)
            if not quote:
                raise Exception("Could not get quote for swap")
                
            # Return simulated transaction signature
            return "SimulatedOrcaSwap_" + str(int(time.time()))
            
        except Exception as e:
            self.logger.error(f"Error executing Orca swap: {e}")
            raise
            
    async def has_pool(self, token_a: str, token_b: str) -> bool:
        """Check if Orca has a pool for the given token pair"""
        for pool in self.pools.values():
            if ((pool.token_a == token_a and pool.token_b == token_b) or
                (pool.token_b == token_a and pool.token_a == token_b)):
                return True
        return False 