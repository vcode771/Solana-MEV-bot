import asyncio
from typing import List, Dict, Optional
from ..dex.base_dex import BaseDex, PriceInfo
from ..utils.math import calculate_arbitrage_profit
from ..config import Config
from .transaction_simulator import TransactionSimulator
import logging
import time
import itertools

class ArbitrageFinder:
    def __init__(self, dex_instances: Dict[str, BaseDex]):
        self.dex_instances = dex_instances
        self.simulator = TransactionSimulator(next(iter(dex_instances.values())).connection)
        self.logger = logging.getLogger(__name__)
        self.total_profit = 0.0
        self.total_opportunities = 0
        self.total_trades = 0
        self.total_gas = 0.0
        self.seen_opportunities = set()  # Track seen opportunities
        self.checked_pairs = set()  # Track already checked pairs
        
    def _get_valid_pairs(self) -> List[tuple]:
        """Get all valid trading pairs across DEXes"""
        valid_pairs = set()
        
        # Collect all pools from all DEXes
        for dex_name, dex in self.dex_instances.items():
            for pool_addr, pool in dex.pools.items():
                # Skip empty pools
                if pool.reserve_a <= 0 or pool.reserve_b <= 0:
                    continue
                    
                # Add both directions of the pair
                valid_pairs.add((pool.token_a, pool.token_b))
                valid_pairs.add((pool.token_b, pool.token_a))
        
        pairs_list = list(valid_pairs)
        self.logger.info(f"Found {len(pairs_list)} valid pairs across {len(self.dex_instances)} DEXes")
        return pairs_list
        
    async def find_opportunities(self) -> List[Dict]:
        """Find arbitrage opportunities across all pairs"""
        opportunities = []
        start_time = time.time()
        
        try:
            valid_pairs = self._get_valid_pairs()
            
            # Create tasks for all pair combinations
            tasks = []
            for token_a, token_b in valid_pairs:
                dex_pairs = list(itertools.combinations(self.dex_instances.items(), 2))
                for (dex1_name, dex1), (dex2_name, dex2) in dex_pairs:
                    task = asyncio.create_task(self._check_opportunity(
                        dex1_name, dex2_name,
                        dex1, dex2,
                        token_a, token_b
                    ))
                    tasks.append(task)
            
            # Wait for all tasks to complete
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Filter valid opportunities
            opportunities = [r for r in results if isinstance(r, dict)]
            
            # Sort by profit
            opportunities.sort(key=lambda x: x['profit_percentage'], reverse=True)
            
            scan_time = time.time() - start_time
            self.last_scan_time = scan_time
            
            if opportunities:
                self.logger.info(f"Found {len(opportunities)} opportunities in {scan_time:.2f}s")
                for opp in opportunities[:5]:  # Show top 5
                    self.logger.info(
                        f"Opportunity: {opp['dex1']} -> {opp['dex2']} "
                        f"{opp['token_a']}/{opp['token_b']} "
                        f"Profit: {opp['profit_percentage']:.2f}%"
                    )
            
            return opportunities[:Config.trading.MAX_CONCURRENT_OPPORTUNITIES]
            
        except Exception as e:
            self.logger.error(f"Error finding opportunities: {e}")
            return []
            
    async def _check_opportunity(self, dex1_name: str, dex2_name: str,
                               dex1: BaseDex, dex2: BaseDex,
                               token_a: str, token_b: str) -> Optional[Dict]:
        """Check for arbitrage opportunity between two DEXes"""
        try:
            # Use 1.0 as standard input amount for comparison
            amount = 1.0
            
            # Get prices from both DEXes
            price1 = await dex1.get_price(token_a, token_b, amount)
            if not price1:
                return None
                
            price2 = await dex2.get_price(token_b, token_a, price1.output_amount)
            if not price2:
                return None
                
            # Calculate potential profit
            profit = calculate_arbitrage_profit(
                price1.output_amount,
                price2.output_amount,
                price1.fee + price2.fee
            )
            
            if profit > Config.network.MIN_PROFIT_THRESHOLD:
                return {
                    "dex1": dex1_name,
                    "dex2": dex2_name,
                    "token_a": token_a,
                    "token_b": token_b,
                    "amount1": amount,
                    "amount2": price1.output_amount,
                    "profit_percentage": profit,
                    "price1": price1,
                    "price2": price2,
                    "timestamp": time.time()
                }
                
        except Exception as e:
            self.logger.debug(f"Error checking opportunity: {e}")
            
        return None
        
    def _filter_best_opportunities(self, opportunities: List[Dict]) -> List[Dict]:
        """Filter and return only the best opportunities"""
        filtered = []
        seen_pairs = set()
        
        for opp in opportunities:
            # Create unique key for this trading pair
            pair_key = tuple(sorted([opp['token_a'], opp['token_b']]))
            
            if pair_key not in seen_pairs:
                seen_pairs.add(pair_key)
                
                # Validate opportunity
                if self._is_valid_opportunity(opp):
                    filtered.append(opp)
                    
                    # Only keep top N opportunities
                    if len(filtered) >= Config.trading.MAX_CONCURRENT_OPPORTUNITIES:
                        break
                        
        return filtered
        
    def get_stats(self) -> Dict:
        """Get current performance statistics"""
        return {
            "total_opportunities": self.total_opportunities,
            "total_trades": self.total_trades,
            "total_profit": self.total_profit,
            "total_gas": self.total_gas,
            "best_profit": getattr(self, 'best_profit', 0),
            "avg_profit": self.total_profit / max(self.total_opportunities, 1),
            "last_scan_time": getattr(self, 'last_scan_time', None)
        }
        
    def _get_opportunity_key(self, opp: Dict) -> str:
        """Generate a unique key for an opportunity"""
        return f"{opp['dex1']}-{opp['dex2']}-{opp['token_a']}-{opp['token_b']}-{opp['profit_percentage']:.2f}"
        
    def _is_valid_opportunity(self, opp: Dict) -> bool:
        """Validate if an opportunity is realistic and unique"""
        try:
            # Generate opportunity key
            opp_key = self._get_opportunity_key(opp)
            
            # Check if we've seen this opportunity before
            if opp_key in self.seen_opportunities:
                return False
                
            # Add to seen opportunities
            self.seen_opportunities.add(opp_key)
            
            # Check for minimum profit threshold
            if opp['profit_percentage'] < Config.network.MIN_PROFIT_THRESHOLD:
                return False
                
            # Check for unrealistic profits (e.g., more than 5%)
            if opp['profit_percentage'] > 5.0:  # Reduced from previous value
                self.logger.debug(f"Unrealistic profit: {opp['profit_percentage']:.2f}%")
                return False
                
            # Check for unrealistic output amounts
            if opp['amount2'] / opp['amount1'] > 1.1:  # Max 10% difference
                self.logger.debug(f"Unrealistic output amount: {opp['amount2'] / opp['amount1']:.2f}x")
                return False
                
            # Check price impact
            if opp['price1'].price_impact > Config.network.SLIPPAGE_TOLERANCE or \
               opp['price2'].price_impact > Config.network.SLIPPAGE_TOLERANCE:
                return False
                
            return True
            
        except Exception as e:
            self.logger.debug(f"Error validating opportunity: {e}")
            return False 