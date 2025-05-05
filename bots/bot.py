import random
import logging
import json
import os
from typing import List, Dict, Optional, Any
from bson import ObjectId
from datetime import datetime, timedelta, timezone
import time
from dotenv import load_dotenv

from db import users, posts, comments, connections
from llm import llm_client

# Load environment variables
load_dotenv()

# Configuration
TICK_INTERVAL = int(os.getenv("TICK_INTERVAL", "30"))  # seconds between ticks

# Configure logging
logger = logging.getLogger("network-nexus-simulator")

# Function to get current time in UTC
def get_current_time():
    """Get the current time in UTC"""
    return datetime.now(timezone.utc)

# Store the simulator start time
simulator_start_time = time.time()

class Bot:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.user = users.find_one({"_id": ObjectId(user_id)})
        self.name = self.user.get("name", "Unknown")
        self.recent_posts = []
        self.load_recent_posts()
        
        # Cooldown tracking
        self.last_post_time = 0
        self.last_comment_time = 0
        self.post_cooldown = random.randint(5, 15)  # Random cooldown between 5-15 ticks
        self.comment_cooldown = random.randint(3, 10)  # Random cooldown between 3-10 ticks
    
    def load_recent_posts(self, limit: int = 3):
        """Load the bot's recent posts"""
        self.recent_posts = list(posts.find({"author": ObjectId(self.user_id)}).sort("timestamp", -1).limit(limit))
    
    async def send_connection_request(self) -> bool:
        """Send a connection request to a random user"""
        # Get a random user that the bot is not already connected to
        existing_connections = list(connections.find({
            "$or": [
                {"from": ObjectId(self.user_id)},
                {"to": ObjectId(self.user_id)}
            ]
        }))
        
        connected_user_ids = [conn["to"] for conn in existing_connections if conn["from"] == ObjectId(self.user_id)]
        connected_user_ids.extend([conn["from"] for conn in existing_connections if conn["to"] == ObjectId(self.user_id)])
        
        # Add the bot's own ID to exclude it
        bot_id = ObjectId(self.user_id)
        connected_user_ids.append(bot_id)
        
        logger.info(f"{self.name} (ID: {self.user_id}) - Current connections: {[str(id) for id in connected_user_ids]}")
        
        # Find a random user that is not in the connected list
        potential_connections = list(users.find({
            "_id": {"$nin": connected_user_ids}
        }))
        
        if not potential_connections:
            logger.info(f"{self.name} has no more users to connect with")
            return False
        
        target_user = random.choice(potential_connections)
        target_id = str(target_user["_id"])
        
        logger.info(f"{self.name} (ID: {self.user_id}) - Selected target: {target_user.get('name', 'Unknown')} (ID: {target_id})")
        
        # Create a connection request
        current_time = get_current_time()
        connection = {
            "from": bot_id,
            "to": target_user["_id"],
            "status": "pending",
            "createdAt": current_time,
            "updatedAt": current_time
        }
        
        try:
            connections.insert_one(connection)
            logger.info(f"{self.name} sent a connection request to {target_user.get('name', 'Unknown')}")
            return True
        except Exception as e:
            logger.error(f"Failed to send connection request: {e}")
            return False
    
    async def accept_connection_request(self) -> bool:
        """Accept a pending connection request"""
        # Get pending connection requests for this bot
        pending_requests = list(connections.find({
            "to": ObjectId(self.user_id),
            "status": "pending"
        }))
        
        if not pending_requests:
            logger.info(f"{self.name} has no pending connection requests")
            return False
        
        # Accept a random request
        request = random.choice(pending_requests)
        from_user = users.find_one({"_id": request["from"]})
        from_user_name = from_user.get("name", "Unknown") if from_user else "Unknown"
        
        try:
            # Update the connection status
            connections.update_one(
                {"_id": request["_id"]},
                {"$set": {"status": "accepted", "updatedAt": get_current_time()}}
            )
            
            logger.info(f"{self.name} accepted a connection request from {from_user_name}")
            return True
        except Exception as e:
            logger.error(f"Failed to accept connection request: {e}")
            return False
    
    async def create_post(self) -> Optional[str]:
        """Create a new post"""
        # Check cooldown
        current_tick = int(time.time() / TICK_INTERVAL)
        if current_tick - self.last_post_time < self.post_cooldown:
            logger.info(f"{self.name} is still on post cooldown ({self.post_cooldown - (current_tick - self.last_post_time)} ticks remaining)")
            return None
            
        # Generate post content using LLM
        context = ""
        if self.recent_posts:
            context = "Here are my recent posts for context:\n"
            for post in self.recent_posts:
                context += f"- {post.get('content', '')}\n"
            context += "\nNow, write a new post that is different from these but maintains a similar style and interests."
        
        # Include the bot's bio and title in the context
        bot_bio = self.user.get("bio", "")
        bot_title = self.user.get("title", "")
        
        prompt = f"""You are {self.name}, {bot_title}.
Your bio: {bot_bio}

{context}
Write a short, engaging social media post about a topic related to your professional background.
It can be something you learned today or something that happened at work.
You can also write about the project you are working on or something you are passionate about.
Avoid using hashtags or @ mentions.
Keep your response concise and professional yet casual but you may use humour and emojis when applicable.

Return ONLY a valid JSON object with this exact format:
{{"content": "your post text here"}}"""
        
        content_json = await llm_client.generate(prompt, max_tokens=100)
        
        # Clean up and extract the text content from the JSON response
        content = self._extract_content_from_json(content_json)
        
        # Create the post
        current_time = get_current_time()
        post = {
            "author": ObjectId(self.user_id),
            "content": content,
            "timestamp": current_time,
            "likes": 0,
            "comments": 0,
            "createdAt": current_time,
            "updatedAt": current_time
        }
        
        try:
            result = posts.insert_one(post)
            logger.info(f"{self.name} created a post: {content[:30]}...")
            
            # Update recent posts
            self.load_recent_posts()
            
            # Update cooldown
            self.last_post_time = current_tick
            self.post_cooldown = random.randint(5, 15)  # Reset cooldown
            
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to create post: {e}")
            return None
            
    def _extract_content_from_json(self, json_str: str) -> str:
        """Extract content from JSON response with robust error handling"""
        # First try to parse as JSON
        try:
            content_data = json.loads(json_str)
            # Check if the content is in the expected format
            if isinstance(content_data, dict) and "content" in content_data:
                if isinstance(content_data["content"], dict) and "text" in content_data["content"]:
                    return content_data["content"]["text"]
                else:
                    return content_data["content"]
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}, Response: {json_str}")
        
        # If JSON parsing failed, try to extract content using regex
        import re
        
        # Try to extract content between quotes after "content":
        content_match = re.search(r'"content"\s*:\s*"([^"]*)"', json_str)
        if content_match and len(content_match.group(1)) > 5:  # Only use if content is meaningful
            return content_match.group(1)
        
        # Try to extract content between quotes at the beginning
        content_match = re.search(r'^"([^"]*)"', json_str)
        if content_match and len(content_match.group(1)) > 5:  # Only use if content is meaningful
            return content_match.group(1)
        
        # If all else fails, clean up the response and use it as is
        # Remove any JSON-like structure
        cleaned = re.sub(r'^\s*{\s*"content"\s*:\s*"', '', json_str)
        cleaned = re.sub(r'"\s*}\s*$', '', cleaned)
        cleaned = re.sub(r'\\"', '"', cleaned)
        
        # If the cleaned string is too short or empty, generate a fallback message
        if len(cleaned.strip()) < 10 or cleaned.strip() in ["Couldn", "I couldn", "I can't"]:
            # Generate a more specific fallback based on the bot's profile
            bot_title = self.user.get("title", "their field")
            bot_name = self.user.get("name", "Unknown")
            
            fallbacks = [
                f"{bot_name} shared an update about their work in {bot_title}.",
                f"{bot_name} is working on an interesting project in {bot_title}.",
                f"{bot_name} learned something new about {bot_title} today.",
                f"{bot_name} is excited about recent developments in {bot_title}."
            ]
            
            return random.choice(fallbacks)
        
        return cleaned
    
    async def comment_on_post(self) -> Optional[str]:
        """Comment on a random post, with preference for fresher posts"""
        # Check cooldown
        current_tick = int(time.time() / TICK_INTERVAL)
        if current_tick - self.last_comment_time < self.comment_cooldown:
            logger.info(f"{self.name} is still on comment cooldown ({self.comment_cooldown - (current_tick - self.last_comment_time)} ticks remaining)")
            return None
            
        # Get posts sorted by timestamp (newest first), excluding the bot's own posts
        all_posts = list(posts.find({"author": {"$ne": ObjectId(self.user_id)}}).sort("timestamp", -1))
        
        if not all_posts:
            logger.info(f"{self.name} found no posts to comment on")
            return None
        
        # Implement weighted selection to favor newer posts
        # Posts are already sorted by timestamp (newest first)
        # We'll use a weighted random selection where newer posts have higher weights
        
        # Calculate weights based on post age
        current_time = get_current_time()
        weights = []
        for post in all_posts:
            # Calculate age in hours
            post_time = post.get("timestamp", current_time)
            
            # Ensure post_time is timezone-aware
            if post_time.tzinfo is None:
                # If post_time is naive, make it timezone-aware by assuming UTC
                post_time = post_time.replace(tzinfo=timezone.utc)
                
            age_hours = (current_time - post_time).total_seconds() / 3600
            
            # Weight formula: 1 / (1 + age_hours)
            # This gives higher weights to newer posts
            # We add 1 to avoid division by zero and to ensure all posts have a chance
            weight = 1 / (1 + age_hours)
            weights.append(weight)
        
        # Normalize weights to sum to 1
        total_weight = sum(weights)
        if total_weight > 0:
            normalized_weights = [w / total_weight for w in weights]
        else:
            # Fallback to uniform weights if all weights are zero
            normalized_weights = [1.0 / len(weights)] * len(weights)
        
        # Select a post using weighted random choice
        post = random.choices(all_posts, weights=normalized_weights, k=1)[0]
        
        # Get existing comments on this post
        post_comments = list(comments.find({"post": post["_id"]}).sort("createdAt", 1))
        
        # Skip if this is the bot's own post
        if post.get("author") == ObjectId(self.user_id):
            logger.info(f"{self.name} skipped commenting on their own post")
            return None
        
        # Skip if the bot was the last commenter
        if post_comments and post_comments[-1].get("author") == ObjectId(self.user_id):
            logger.info(f"{self.name} skipped commenting as they were the last commenter")
            return None
        
        # Get the post author's info for context
        post_author = users.find_one({"_id": post.get("author")})
        post_author_name = post_author.get("name", "Unknown") if post_author else "Unknown"
        post_author_title = post_author.get("title", "") if post_author else ""
        post_author_bio = post_author.get("bio", "") if post_author else ""
        
        # Include the bot's bio in the context
        bot_bio = self.user.get("bio", "")
        bot_title = self.user.get("title", "")
        
        # Generate comment content using LLM
        context = f"""Original post by {post_author_name} ({post_author_title}): {post.get('content', '')}

Post author's background:
Title: {post_author_title}
Bio: {post_author_bio}

Your profile: {self.name} - {bot_title}
Your bio: {bot_bio}

"""
        if post_comments:
            context += "Existing comments:\n"
            for comment in post_comments:
                comment_author = users.find_one({"_id": comment["author"]})
                author_name = comment_author.get("name", "Unknown") if comment_author else "Unknown"
                context += f"- {author_name}: {comment.get('content', '')}\n"
        
        prompt = f"""You are {self.name}, {bot_title}. {context}
Write a relevant, professional comment on this post. Focus on the topic and avoid using hashtags or @ mentions.

IMPORTANT GUIDELINES:
- You can engage with the post author's background or expertise if relevant, but do it naturally
- You can find common ground between your field and theirs
- DO NOT reintroduce yourself or your credentials (e.g. avoid phrases like "As a [profession], I think...")
- You can agree, disagree, ask questions, or share related experiences
- You can use humour and emojis where applicable
- Keep your response concise and natural - readers see your comment in the context of the post
- Don't reiterate the post content or previous comments

Return ONLY a valid JSON object with this exact format:
{{"content": "your comment text here"}}"""
        
        content_json = await llm_client.generate(prompt, max_tokens=50)
        
        # Clean up and extract the text content from the JSON response
        content = self._extract_content_from_json(content_json)
        
        # Create the comment
        current_time = get_current_time()
        comment = {
            "post": post["_id"],
            "author": ObjectId(self.user_id),
            "content": content,
            "createdAt": current_time,
            "updatedAt": current_time
        }
        
        try:
            result = comments.insert_one(comment)
            
            # Update post comment count
            posts.update_one(
                {"_id": post["_id"]},
                {"$inc": {"comments": 1}}
            )
            
            logger.info(f"{self.name} commented on a post: {content[:20]}...")
            
            # Update cooldown
            self.last_comment_time = current_tick
            self.comment_cooldown = random.randint(3, 10)  # Reset cooldown
            
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Failed to comment on post: {e}")
            return None
    
    async def like_post(self) -> bool:
        """Like a random post"""
        # Get a random post (excluding the bot's own posts)
        all_posts = list(posts.find({"author": {"$ne": ObjectId(self.user_id)}}))
        
        if not all_posts:
            logger.info(f"{self.name} found no posts to like")
            return False
        
        post = random.choice(all_posts)
        
        try:
            # Increment likes count
            posts.update_one(
                {"_id": post["_id"]},
                {"$inc": {"likes": 1}}
            )
            
            logger.info(f"{self.name} liked a post")
            return True
        except Exception as e:
            logger.error(f"Failed to like post: {e}")
            return False
    
    async def perform_random_action(self) -> bool:
        """Perform a random action"""
        # Define all possible actions
        actions = [
            self.send_connection_request,
            self.accept_connection_request,
            self.like_post
        ]
        
        # First try to comment on a post
        comment_result = await self.comment_on_post()
        
        # If commenting failed, create a post instead
        if comment_result is None:
            logger.info(f"{self.name} couldn't find a suitable post to comment on, creating a new post instead")
            post_result = await self.create_post()
            if post_result:
                return True
        
        # If we couldn't comment or post, try a random action from the remaining options
        if comment_result is None:
            # Choose a random action
            action = random.choice(actions)
            try:
                result = await action()
                return bool(result)
            except Exception as e:
                logger.error(f"Error performing action: {e}")
                return False
        
        return True 