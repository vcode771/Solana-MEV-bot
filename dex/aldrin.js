from .base_dex import BaseDex, PoolInfo, PriceInfo
from ..config import Config
import logging
import aiohttp
import json
from solders.pubkey import Pubkey

class AldrinDex(BaseDex):
    def __init__(self, connection):
        super().__init__(connection)
        self.logger = logging.getLogger(__name__)
        self.api_endpoint = "https://api.aldrin.com/v1"  # Replace with actual Aldrin API endpoint
        
    async def init_pools(self):
        """Initialize Aldrin pools using their API"""
        try:
            async with aiohttp.ClientSession() as session:
                # Fetch active pools from Aldrin API
                async with session.get(f"{self.api_endpoint}/pools") as response:
                    if response.status == 200:
                        pools_data = await response.json()
                        
                        for pool in pools_data['pools']:
                            pool_address = pool['address']
                            self.pools[pool_address] = PoolInfo(
                                pool_address=pool_address,
                                token_a=pool['tokenA'],
                                token_b=pool['tokenB'],
                                reserve_a=float(pool['reserveA']),
                                reserve_b=float(pool['reserveB']),
                                fee_rate=float(pool['feeRate'])
                            )
                            
                        self.logger.info(f"Initialized {len(self.pools)} Aldrin pools")
                    else:
                        self.logger.error(f"Failed to fetch Aldrin pools: {response.status}")
                        
        except Exception as e:
            self.logger.error(f"Error initializing Aldrin pools: {e}")
            
    async def update_pool_state(self, pool_address: str):
        """Update pool state from Aldrin API"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.api_endpoint}/pool/{pool_address}") as response:
                    if response.status == 200:
                        pool_data = await response.json()
                        
                        if pool_address in self.pools:
                            self.pools[pool_address].reserve_a = float(pool_data['reserveA'])
                            self.pools[pool_address].reserve_b = float(pool_data['reserveB'])
                            self.pools[pool_address].fee_rate = float(pool_data['feeRate'])
                    else:
                        self.logger.error(f"Failed to update pool {pool_address}: {response.status}")
                        
        except Exception as e:
            self.logger.error(f"Error updating pool {pool_address}: {e}")
            
    async def get_price(self, input_token: str, output_token: str, amount: float) -> PriceInfo:
        """Get price information from Aldrin API"""
        try:
            async with aiohttp.ClientSession() as session:
                params = {
                    'inputToken': input_token,
                    'outputToken': output_token,
                    'amount': str(amount)
                }
                
                async with session.get(f"{self.api_endpoint}/quote", params=params) as response:
                    if response.status == 200:
                        quote_data = await response.json()
                        
                        return PriceInfo(
                            input_token=input_token,
                            output_token=output_token,
                            input_amount=amount,
                            output_amount=float(quote_data['outputAmount']),
                            price_impact=float(quote_data['priceImpact']),
                            fee=float(quote_data['fee'])
                        )
                    else:
                        self.logger.debug(f"No quote available for {input_token}/{output_token}")
                        return None
                        
        except Exception as e:
            if "No pool found" not in str(e):
                self.logger.debug(f"Error getting price: {e}")
            return None
            
    async def execute_swap(self, input_token: str, output_token: str, amount: float) -> str:
        """Execute swap using Aldrin's smart contracts"""
        try:
            # Get the pool and latest quote
            quote = await self.get_price(input_token, output_token, amount)
            if not quote:
                raise Exception("Could not get quote for swap")
                
            # Create the swap instruction
            swap_ix = await self._create_swap_instruction(
                input_token,
                output_token,
                amount,
                quote.output_amount
            )
            
            # Build and send transaction
            transaction = Transaction()
            transaction.add(swap_ix)
            
            # Sign and send transaction
            result = await self.connection.send_transaction(
                transaction,
                [self.wallet.payer],  # You'll need to implement wallet handling
                opts=self.opts
            )
            
            return result['result']
            
        except Exception as e:
            self.logger.error(f"Error executing swap: {e}")
            raise
            
    async def has_pool(self, token_a: str, token_b: str) -> bool:
        """Check if Aldrin has a pool for the given token pair"""
        try:
            async with aiohttp.ClientSession() as session:
                params = {'tokenA': token_a, 'tokenB': token_b}
                async with session.get(f"{self.api_endpoint}/pool/exists", params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data['exists']
                    return False
        except Exception as e:
            self.logger.error(f"Error checking pool existence: {e}")
            return False 