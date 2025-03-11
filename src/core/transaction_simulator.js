import logging
from typing import Dict, Optional
from solana.rpc.commitment import Commitment
from solana.transaction import Transaction
from ..config import Config

class TransactionSimulator:
    def __init__(self, connection):
        self.connection = connection
        self.logger = logging.getLogger(__name__)

    async def simulate_transaction(self, transaction: Transaction) -> Dict:
        """
        Simulate a transaction before execution to verify its success and estimate costs
        """
        try:
            result = await self.connection.simulate_transaction(
                transaction,
                commitment=Commitment("confirmed"),
                sig_verify=False,
                preflight_commitment=Commitment("confirmed")
            )

            if result.get("value", {}).get("err"):
                self.logger.error(f"Transaction simulation failed: {result['value']['err']}")
                return {
                    "success": False,
                    "error": result["value"]["err"],
                    "logs": result.get("value", {}).get("logs", [])
                }

            return {
                "success": True,
                "logs": result.get("value", {}).get("logs", []),
                "units_consumed": result.get("value", {}).get("unitsConsumed", 0),
                "accounts": result.get("value", {}).get("accounts", [])
            }

        except Exception as e:
            self.logger.error(f"Simulation error: {str(e)}")
            return {"success": False, "error": str(e)}

    def estimate_gas_cost(self, simulation_result: Dict) -> Optional[int]:
        """
        Estimate gas cost based on simulation results
        """
        if not simulation_result["success"]:
            return None

        units_consumed = simulation_result.get("units_consumed", 0)
        # Add buffer for safety
        return int(units_consumed * 1.1) 