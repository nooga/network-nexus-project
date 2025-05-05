import os
import time
import random
import asyncio
import logging
from dotenv import load_dotenv
from typing import Dict, List, Optional, Any

from db import db
from bot import Bot
from accounts import get_or_create_bot_accounts
from llm import llm_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("network-nexus-simulator")

# Load environment variables
load_dotenv()

# Configuration
NUM_BOTS = int(os.getenv("NUM_BOTS", "5"))
TICK_INTERVAL = int(os.getenv("TICK_INTERVAL", "30"))  # seconds between ticks
MODEL_NAME = os.getenv("MODEL_NAME", "default")

# Main simulation function
async def run_simulation():
    """Run the continuous social network simulation"""
    logger.info("Starting Network Nexus Simulator")
    
    # Ensure LLM model is available
    logger.info(f"Ensuring LLM model {MODEL_NAME} is available...")
    await llm_client.ensure_model_available()
    
    # Get or create bot accounts
    bot_ids = await get_or_create_bot_accounts(NUM_BOTS)
    
    if not bot_ids:
        logger.error("Failed to create any bot accounts. Exiting.")
        return
    
    logger.info(f"Using {len(bot_ids)} bot accounts for simulation")
    
    # Create bot instances
    bots = [Bot(bot_id) for bot_id in bot_ids]
    
    # Run the simulation continuously
    tick = 0
    while True:
        tick += 1
        logger.info(f"Starting tick {tick}")
        
        # Choose a random bot to perform an action
        bot = random.choice(bots)
        logger.info(f"Selected bot: {bot.name}")
        
        # Perform a random action
        success = await bot.perform_random_action()
        
        if success:
            logger.info(f"Bot {bot.name} successfully performed an action")
        else:
            logger.warning(f"Bot {bot.name} failed to perform an action")
        
        # Wait for the next tick
        logger.info(f"Waiting {TICK_INTERVAL} seconds until next tick")
        await asyncio.sleep(TICK_INTERVAL)

if __name__ == "__main__":
    try:
        asyncio.run(run_simulation())
    except KeyboardInterrupt:
        logger.info("Simulation stopped by user")
    except Exception as e:
        logger.error(f"Simulation stopped due to error: {e}")
    finally:
        logger.info("Simulation ended")
