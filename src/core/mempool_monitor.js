import asyncio
from typing import Set, Dict, List
import json
from solana.rpc.websocket_api import connect
from ..config import Config

class MempoolMonitor:
    def __init__(self):
        self.ws_url = Config.network.WS_ENDPOINT
        self.monitored_addresses: Set[str] = set()
        self.pending_txs: Dict[str, dict] = {}
        self.callbacks = []
        
    async def start(self):
        async with connect(self.ws_url) as websocket:
            await websocket.transaction_subscribe()
            
            async for msg in websocket:
                try:
                    data = json.loads(msg)
                    if 'params' in data:
                        await self._process_transaction(data['params'])
                except Exception as e:
                    print(f"Error processing transaction: {e}")
                    
    async def _process_transaction(self, tx_data: dict):
        tx_hash = tx_data['result']['signature']
        
        # Process only transactions involving monitored addresses
        involved_addresses = self._extract_addresses(tx_data)
        if any(addr in self.monitored_addresses for addr in involved_addresses):
            self.pending_txs[tx_hash] = tx_data
            await self._notify_callbacks(tx_data)
            
    async def _notify_callbacks(self, tx_data: dict):
        for callback in self.callbacks:
            asyncio.create_task(callback(tx_data))
            
    def add_callback(self, callback):
        self.callbacks.append(callback)
        
    def _extract_addresses(self, tx_data: dict) -> List[str]:
        # Extract all addresses involved in the transaction
        addresses = []
        # Implementation depends on transaction data structure
        return addresses 