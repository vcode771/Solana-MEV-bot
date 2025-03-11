TOKEN_NAMES = {
    "So11111111111111111111111111111111111111112": "SOL",
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
    "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": "RAY",
    # Add more token addresses and their symbols
}

def get_token_name(address: str) -> str:
    """Get human-readable token name from address"""
    return TOKEN_NAMES.get(address, address[:8] + "...") 