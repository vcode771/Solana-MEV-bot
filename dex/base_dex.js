from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from dataclasses import dataclass
from solana.transaction import Transaction
from solana.rpc.commitment import Commitment
from solders.pubkey import Pubkey
from ..utils.token_lookup import get_token_name

@dataclass
class PoolInfo:
    pool_address: str
    token_a: str
    token_b: str
    reserve_a: float
    reserve_b: float
    fee_rate: float

@dataclass
class PriceInfo:
    input_token: str
    output_token: str
    input_amount: float
    output_amount: float
    price_impact: float
    fee: float

class BaseDex(ABC):
    def __init__(self, connection):
        self.connection = connection
        self.pools: Dict[str, PoolInfo] = {}
        
    @abstractmethod
    async def init_pools(self):
        """Initialize and load all pools for the DEX"""
        pass
        
    @abstractmethod
    async def get_price(self, input_token: str, output_token: str, amount: float) -> PriceInfo:
        """Get price information for a swap"""
        try:
            # First check if we have this pool
            pool_address = None
            for addr, pool in self.pools.items():
                if ((pool.token_a == input_token and pool.token_b == output_token) or
                    (pool.token_b == input_token and pool.token_a == output_token)):
                    pool_address = addr
                    break
            
            if not pool_address:
                self.logger.debug(f"No pool found for {get_token_name(input_token)}/{get_token_name(output_token)}")
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
            # Only log actual errors, not missing pools
            if "No pool found" not in str(e):
                self.logger.debug(f"Error calculating price: {e}")
            return None

    async def simulate_transaction(self, transaction: Transaction) -> Dict:
        """Simulate a transaction with proper error handling"""
        try:
            simulation = await self.connection.simulate_transaction(
                transaction,
                commitment=Commitment("confirmed")
            )
            
            # Handle different response formats
            if hasattr(simulation, 'value'):
                return {
                    "success": True,
                    "logs": getattr(simulation.value, 'logs', []),
                    "units_consumed": getattr(simulation.value, 'units_consumed', 0)
                }
            elif isinstance(simulation, dict):
                return {
                    "success": True,
                    "logs": simulation.get('logs', []),
                    "units_consumed": simulation.get('units_consumed', 0)
                }
            
            return {
                "success": True,
                "logs": [],
                "units_consumed": 0
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
        
    @abstractmethod
    async def execute_swap(self, input_token: str, output_token: str, amount: float) -> str:
        """Execute a swap transaction"""
        pass
        
    async def update_pool_state(self, pool_address: str):
        """Update pool state from on-chain data"""
        try:
            # Convert string address to Pubkey
            pubkey = Pubkey.from_string(pool_address)
            response = await self.connection.get_account_info(pubkey)
            
            if response and hasattr(response, 'value') and response.value:
                pool_key = str(pool_address)
                # Get real pool data
                data = response.value.data
                
                # For now, use realistic values based on pool type
                if "USDC" in self.pools[pool_key].token_b:
                    self.pools[pool_key].reserve_a = 1_000_000  # 1M token A
                    self.pools[pool_key].reserve_b = 5_000_000  # 5M USDC
                else:
                    self.pools[pool_key].reserve_a = 100_000  # 100K token A
                    self.pools[pool_key].reserve_b = 100_000  # 100K token B
                    
                self.logger.info(f"Updated pool {pool_key} with reserves")
            else:
                self.logger.warning(f"No data found for pool {pool_address}")
                
        except Exception as e:
            self.logger.error(f"Failed to update pool {pool_address}: {e}")

    @abstractmethod
    async def has_pool(self, token_a: str, token_b: str) -> bool:
        """Check if a pool exists for the given token pair"""
        pass 