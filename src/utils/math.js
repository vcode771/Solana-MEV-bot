import numpy as np
from typing import List, Dict
from ..config import Config

def calculate_arbitrage_profit(
    price1: float,
    price2: float,
    fees: float,
    slippage: float = 0.005
) -> float:
    """Calculate potential arbitrage profit considering fees and slippage"""
    # Apply slippage to prices
    price1_with_slippage = price1 * (1 - slippage)
    price2_with_slippage = price2 * (1 + slippage)
    
    # Calculate gross profit
    gross_profit = (price2_with_slippage / price1_with_slippage - 1) * 100
    
    # Subtract fees
    net_profit = gross_profit - fees * 100
    
    return net_profit

def optimize_trade_size(
    reserves_a: float,
    reserves_b: float,
    price_impact_factor: float,
    max_trade_size: float
) -> float:
    """Optimize trade size for maximum profit"""
    def objective(x):
        impact = price_impact_factor * (x / reserves_a)
        return -(x * (1 - impact))
    
    # Use numerical optimization
    result = np.minimum(
        max_trade_size,
        reserves_a * 0.1  # Don't use more than 10% of reserves
    )
    
    return float(result)

def calculate_multi_hop_arbitrage(
    prices: List[Dict],
    balances: List[float],
    gas_prices: List[float]
) -> Dict:
    """Calculate optimal multi-hop arbitrage path"""
    n = len(prices)
    dp = [[float('-inf')] * n for _ in range(n)]
    path = [[None] * n for _ in range(n)]
    
    # Initialize direct trades
    for i in range(n):
        for j in range(n):
            if i != j and prices[i][j] > 0:
                profit = calculate_arbitrage_profit(
                    1.0,
                    prices[i][j],
                    gas_prices[i] + gas_prices[j]
                )
                if profit > dp[i][j]:
                    dp[i][j] = profit
                    path[i][j] = [i, j]
    
    # Find best multi-hop path
    for k in range(n):
        for i in range(n):
            for j in range(n):
                if dp[i][k] > float('-inf') and dp[k][j] > float('-inf'):
                    combined_profit = min(dp[i][k], dp[k][j])
                    if combined_profit > dp[i][j]:
                        dp[i][j] = combined_profit
                        path[i][j] = path[i][k] + path[k][j][1:]
    
    # Find best overall arbitrage
    best_profit = float('-inf')
    best_path = None
    
    for i in range(n):
        for j in range(n):
            if dp[i][j] > best_profit:
                best_profit = dp[i][j]
                best_path = path[i][j]
    
    return {
        "profit": best_profit,
        "path": best_path,
        "confidence": calculate_confidence_score(best_profit, gas_prices)
    }

def calculate_confidence_score(profit: float, gas_prices: List[float]) -> float:
    """Calculate confidence score for arbitrage opportunity"""
    base_confidence = min(profit / Config.network.MIN_PROFIT_THRESHOLD, 1.0)
    gas_volatility = np.std(gas_prices) / np.mean(gas_prices)
    
    return base_confidence * (1 - gas_volatility) 

def calculate_optimal_amount(rate1: float, rate2: float, max_amount: float,
                           fee1: float, fee2: float) -> float:
    """Calculate optimal trade size for maximum profit"""
    try:
        # Calculate theoretical optimal amount
        price_diff = (rate2 / rate1) - 1
        if price_diff <= 0:
            return 0
            
        # Consider fees
        total_fee = fee1 + fee2
        net_price_diff = price_diff - total_fee
        
        if net_price_diff <= 0:
            return 0
            
        # Calculate optimal amount considering slippage
        optimal = max_amount * (net_price_diff / 2)  # Use half of max for safety
        
        # Ensure within bounds
        return min(optimal, max_amount)
        
    except Exception:
        return 0 