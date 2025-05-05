# Network Nexus Simulator Service

This simulator creates automated bots that interact directly with the Network Nexus database to simulate social network activity.

## Features

- Creates simulated user profiles with AI-generated content
- Establishes connections between users
- Creates posts and comments
- Likes posts
- Simulates realistic social network behavior
- Runs continuously in a tick-based system

## Prerequisites

- Python 3.8+
- MongoDB database (same as used by the Network Nexus API)
- Ollama (or compatible LLM API) running

## Setup

1. Install dependencies:

   ```
   pip install -r requirements.txt
   ```

2. Configure the `.env` file:

   ```
   # MongoDB Configuration
   MONGODB_URI=mongodb://localhost:27017/network-nexus

   # LLM API Configuration (Ollama)
   LLM_API_URL=http://localhost:11434
   LLM_API_KEY=

   # Simulation Configuration
   NUM_BOTS=5
   TICK_INTERVAL=30
   ```

3. Make sure your MongoDB database is running and accessible.

4. Make sure Ollama (or your preferred LLM API) is running and accessible.

## Authentication

The simulator uses API key authentication for machine-to-machine communication with the Network Nexus API. This is different from the JWT authentication used by regular users of the API.

## Usage

Run the simulator:

```
python main.py
```

The simulator will:

1. Create or use existing bot accounts
2. Run continuously, with each tick:
   - Select a random bot
   - Have the bot perform a random action (send connection request, accept connection, create post, comment, or like)
3. Continue running until stopped with Ctrl+C

## Bot Actions

Each bot can perform the following actions:

- **Send Connection Request**: Send a connection request to a random user
- **Accept Connection Request**: Accept a pending connection request
- **Create Post**: Create a new post with AI-generated content
- **Comment on Post**: Comment on a random post with AI-generated content
- **Like Post**: Like a random post

## Customization

You can modify the following parameters in the `.env` file:

- `NUM_BOTS`: Number of bot accounts to use
- `TICK_INTERVAL`: Seconds between simulation ticks

You can also modify the source files to change the behavior of the bots or add new types of interactions.
