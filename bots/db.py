import os
import logging
from pymongo import MongoClient
from dotenv import load_dotenv

# Configure logging
logger = logging.getLogger("network-nexus-simulator")

# Load environment variables
load_dotenv()

# MongoDB connection
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/network-nexus")

def get_db():
    """Get MongoDB database connection"""
    try:
        client = MongoClient(MONGODB_URI)
        db = client.get_default_database()
        logger.info(f"Connected to MongoDB: {db.name}")
        return db
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise

# Initialize database connection
db = get_db()

# Collections
users = db.users
posts = db.posts
comments = db.comments
connections = db.connections
experiences = db.experiences
skills = db.skills
education = db.educations 