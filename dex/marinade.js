from .base_dex import BaseDex, PoolInfo, PriceInfo
from ..config import Config
import logging

class MarinadeDex(BaseDex):
    def __init__(self, connection):
        super().__init__(connection)
        self.logger = logging.getLogger(__name__)
        
    async def init_pools(self):
        """Initialize Marinade pools"""
        try:
            # Initialize with Marinade's main pools
            self.pools = {
                "MarinadeFinancePool111111111111111111111111": PoolInfo(
                    pool_address="MarinadeFinancePool111111111111111111111111",
                    token_a=Config.token.TOKENS["SOL"],
                    token_b=Config.token.TOKENS["mSOL"],
                    reserve_a=5000000,  # 5M SOL
                    reserve_b=5000000,  # 5M mSOL
                    fee_rate=0.003
                ),
            }
            
            # Update pool states
            for pool_address in self.pools.keys():
                await self.update_pool_state(pool_address)
                
        except Exception as e:
            self.logger.error(f"Error initializing Marinade pools: {e}")
            
    async def get_price(self, input_token: str, output_token: str, amount: float) -> PriceInfo:
        """Get price information for a swap on Marinade"""
        try:
            # First check if we have this pool
            pool_address = None
            for addr, pool in self.pools.items():
                if ((pool.token_a == input_token and pool.token_b == output_token) or
                    (pool.token_b == input_token and pool.token_a == output_token)):
                    pool_address = addr
                    break
            
            if not pool_address:
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
            self.logger.debug(f"Error calculating price: {e}")
            return None
            
    async def execute_swap(self, input_token: str, output_token: str, amount: float) -> str:
        """Execute a swap on Marinade"""
        # Implement Marinade-specific swap logic
        pass
        
    async def has_pool(self, token_a: str, token_b: str) -> bool:
        """Check if Marinade has a pool for the given token pair"""
        for pool in self.pools.values():
            if ((pool.token_a == token_a and pool.token_b == token_b) or
                (pool.token_b == token_a and pool.token_a == token_b)):
                return True
        return False 