import logging
import time
from dataclasses import dataclass
from typing import Dict, List
import asyncio
from prometheus_client import Counter, Gauge, start_http_server

@dataclass
class MetricsConfig:
    METRICS_PORT: int = 8000
    LOG_FILE: str = "mev_bot.log"

class MonitoringSystem:
    def __init__(self):
        # Setup logging
        self.setup_logging()
        
        # Prometheus metrics
        self.opportunities_found = Counter(
            'mev_opportunities_found_total',
            'Total number of arbitrage opportunities found'
        )
        self.opportunities_executed = Counter(
            'mev_opportunities_executed_total',
            'Total number of executed arbitrage trades'
        )
        self.profit_gauge = Gauge(
            'mev_current_profit',
            'Current profit in base currency'
        )
        self.gas_costs = Counter(
            'mev_gas_costs_total',
            'Total gas costs in base currency'
        )
        
        # Start metrics server
        start_http_server(MetricsConfig.METRICS_PORT)
        
    def setup_logging(self):
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(MetricsConfig.LOG_FILE),
                logging.StreamHandler()
            ]
        )
        
    async def monitor_performance(self, arbitrage_finder):
        """
        Continuously monitor bot performance
        """
        while True:
            try:
                # Update metrics
                self.profit_gauge.set(arbitrage_finder.total_profit)
                
                # Log performance statistics
                logging.info(
                    f"Performance Stats:\n"
                    f"Total Opportunities Found: {self.opportunities_found._value.get()}\n"
                    f"Total Trades Executed: {self.opportunities_executed._value.get()}\n"
                    f"Total Profit: {arbitrage_finder.total_profit}\n"
                    f"Total Gas Spent: {self.gas_costs._value.get()}"
                )
                
                await asyncio.sleep(60)  # Update every minute
                
            except Exception as e:
                logging.error(f"Error in performance monitoring: {str(e)}")
                await asyncio.sleep(5) 