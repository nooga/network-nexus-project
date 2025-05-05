import random
import logging
import asyncio
import json
from typing import List, Dict, Optional
from bson import ObjectId
from datetime import datetime, timedelta

from db import users, experiences, skills, education
from llm import llm_client

# Configure logging
logger = logging.getLogger("network-nexus-simulator")

def get_existing_bot_names() -> List[str]:
    """Get names of all existing bot accounts"""
    existing_bots = users.find({"sub": {"$regex": "^sim-"}}, {"name": 1})
    return [bot["name"] for bot in existing_bots]

async def create_bot_account() -> Optional[str]:
    """Create a new bot account with basic profile information"""
    # Get existing bot names
    existing_names = get_existing_bot_names()
    existing_names_str = "\n".join(f"- {name}" for name in existing_names) if existing_names else "No bots created yet"

    # Define the prompt with JSON example and more specific instructions for diverse names
    prompt = f"""Generate a realistic social media profile in JSON format with a creative and diverse name. 
    
IMPORTANT NAME INSTRUCTIONS:
- Use a wide variety of names from different cultures and backgrounds
- Include names from various regions: Asian, European, African, Latin American, Middle Eastern, Slavic, etc.
- Use both traditional and modern names
- Include some compound names or names with prefixes/suffixes, but only if there is not too many of them already
- Avoid using the same names repeatedly (like Lee or Patel)
- Names can be unisex or gender-specific

Previously generated bot names (DO NOT reuse these, also try to generate wwildly different name from these):
{existing_names_str}

Follow this exact structure:
{{
    "name": "Alex Smith",
    "title": "Software Engineer & AI Enthusiast",
    "bio": "Building the future with code. Passionate about AI, robotics, and sustainable tech."
}}

Here are some example names to inspire diversity (DO NOT use these exact names):
- Amara Okafor
- Chen Wei
- Priya Sharma, PhD
- Alejandro Rodriguez
- Fatima Hassan
- Sven Johansson
- Mei-Ling Chang, PhD
- Raj Patel
- Isabella Santos
- Kwame Mensah
- Ivan Petrov
- Olga Kovalenko
- Mikhail Sokolov
- Elena Popova, PhD
- Dmitry Volkov

Make it different from ALL the examples above but keep the same JSON structure. The bio should be one or two sentences."""

    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Generate profile JSON
            profile_text = await llm_client.generate(prompt)
            
            # Try to parse the JSON
            profile_data = json.loads(profile_text)
            
            # Validate required fields
            if not all(key in profile_data for key in ["name", "title", "bio"]):
                raise ValueError("Missing required fields in profile data")
            
            # Check if the name already exists
            existing_bot = users.find_one({"name": profile_data["name"], "sub": {"$regex": "^sim-"}})
            if existing_bot:
                logger.warning(f"Bot name '{profile_data['name']}' already exists, retrying with a different name")
                continue
            
            # Create user in the database
            user = {
                "sub": f"sim-{random.randint(10000, 99999)}",
                "username": profile_data["name"].lower().replace(" ", "") + str(random.randint(100, 999)),
                "name": profile_data["name"],
                "title": profile_data["title"],
                "avatarUrl": f"https://i.pravatar.cc/150?u={random.randint(1, 1000)}",
                "bio": profile_data["bio"],
                "createdAt": datetime.now(),
                "updatedAt": datetime.now()
            }
            
            result = users.insert_one(user)
            user_id = result.inserted_id
            logger.info(f"Created bot account: {profile_data['name']} (ID: {user_id})")
            
            # Return the user ID immediately without waiting for profile details
            return str(user_id)
            
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse LLM response as JSON (attempt {attempt + 1}/{max_retries})")
        except ValueError as e:
            logger.warning(f"Invalid profile data: {e} (attempt {attempt + 1}/{max_retries})")
        except Exception as e:
            logger.error(f"Failed to create bot account: {e}")
            return None
        
        if attempt < max_retries - 1:
            await asyncio.sleep(1)  # Wait before retry
    
    logger.error("Failed to create bot account after all retries")
    return None

async def create_bot_experience(user_id: ObjectId) -> None:
    """Create experience entries for a bot"""
    # Get user info for context
    user = users.find_one({"_id": user_id})
    if not user:
        logger.error(f"User not found: {user_id}")
        return
    
    name = user.get("name", "Unknown")
    title = user.get("title", "")
    bio = user.get("bio", "")
    
    # Generate exactly 1 experience entry
    num_experiences = 1
    
    prompt = f"""Generate exactly 1 realistic work experience entry for a professional named {name} with the title "{title}" and bio: "{bio}".

Return a JSON array with 1 experience object. The experience should have:
- title: Job title
- company: Company name
- location: City, Country
- startDate: Start date in ISO format (YYYY-MM-DD)
- endDate: End date in ISO format (YYYY-MM-DD) or null if current
- current: Boolean indicating if this is their current job
- description: Brief job description (2-3 sentences)
- employmentType: Full-time, Part-time, Contract, etc.
- industry: Industry sector

IMPORTANT DIVERSITY INSTRUCTIONS:
- Use a wide variety of company names from different industries and regions
- DO NOT use the example companies (Tech Innovations Inc., Digital Solutions Ltd)
- Include companies from various regions: North America, Europe, Asia, Africa, Latin America, etc.
- Use both large corporations and smaller companies
- Include some startups, non-profits, and government organizations
- Make sure the company name is realistic and diverse

Required format:
[
  {{
    "title": "Senior Software Engineer",
    "company": "Tech Innovations Inc.",
    "location": "San Francisco, USA",
    "startDate": "2020-01-15",
    "endDate": null,
    "current": true,
    "description": "Leading development of cloud-based applications. Mentoring junior developers and implementing CI/CD pipelines.",
    "employmentType": "Full-time",
    "industry": "Technology"
  }}
]

Make sure the experience is realistic, diverse, and aligns with the person's professional background. The experience should be relevant to their current job title.

IMPORTANT: Return ONLY valid JSON. Do not include any explanatory text before or after the JSON array."""
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Generate experience data
            experience_text = await llm_client.generate(prompt)
            
            # Clean up the response to ensure it's valid JSON
            experience_text = experience_text.strip()
            if experience_text.startswith("```json"):
                experience_text = experience_text[7:]
            if experience_text.endswith("```"):
                experience_text = experience_text[:-3]
            experience_text = experience_text.strip()
            
            # Try to parse the JSON
            experience_data = json.loads(experience_text)
            
            # Validate that we have the expected number of experiences
            if not isinstance(experience_data, list) or len(experience_data) < 1:
                raise ValueError(f"Expected at least 1 experience, got {len(experience_data) if isinstance(experience_data, list) else 'non-list'}")
            
            # Insert each experience
            for exp in experience_data:
                # Convert string dates to datetime objects
                start_date = datetime.fromisoformat(exp["startDate"])
                end_date = datetime.fromisoformat(exp["endDate"]) if exp["endDate"] else None
                
                experience = {
                    "user": user_id,
                    "title": exp["title"],
                    "company": exp["company"],
                    "location": exp["location"],
                    "startDate": start_date,
                    "endDate": end_date,
                    "current": exp["current"],
                    "description": exp["description"],
                    "employmentType": exp["employmentType"],
                    "industry": exp["industry"],
                    "createdAt": datetime.now(),
                    "updatedAt": datetime.now()
                }
                
                experiences.insert_one(experience)
            
            logger.info(f"Created {len(experience_data)} experience entries for {name}")
            return
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse experience JSON (attempt {attempt + 1}/{max_retries}): {e}")
            logger.debug(f"Raw response: {experience_text}")
        except ValueError as e:
            logger.warning(f"Invalid experience data (attempt {attempt + 1}/{max_retries}): {e}")
        except Exception as e:
            logger.error(f"Failed to create experience for {name}: {e}")
        
        if attempt < max_retries - 1:
            await asyncio.sleep(1)  # Wait before retry
    
    # If all retries failed, create a fallback experience
    try:
        logger.warning(f"Creating fallback experience for {name} after all retries failed")
        
        # Create a fallback experience based on the user's title
        current_time = datetime.now()
        start_date = current_time - timedelta(days=random.randint(365, 1825))  # 1-5 years ago
        
        experience = {
            "user": user_id,
            "title": title,
            "company": f"{name.split()[0]}'s Company",
            "location": "Various Locations",
            "startDate": start_date,
            "endDate": None,
            "current": True,
            "description": f"Professional experience in {title.lower()}.",
            "employmentType": "Full-time",
            "industry": "Professional Services",
            "createdAt": datetime.now(),
            "updatedAt": datetime.now()
        }
        
        experiences.insert_one(experience)
        logger.info(f"Created fallback experience for {name}")
    except Exception as e:
        logger.error(f"Failed to create fallback experience for {name}: {e}")

async def create_bot_skills(user_id: ObjectId, title: str) -> None:
    """Create skills entries for a bot"""
    # Get user info for context
    user = users.find_one({"_id": user_id})
    if not user:
        logger.error(f"User not found: {user_id}")
        return
    
    name = user.get("name", "Unknown")
    bio = user.get("bio", "")
    
    # Generate 3-5 skills
    num_skills = random.randint(3, 5)
    
    prompt = f"""Generate {num_skills} realistic professional skills for a person with the title "{title}" and bio: "{bio}".

Return a JSON array with {num_skills} skill objects. Each skill should have:
- name: Skill name
- category: Category (e.g., "Programming Languages", "Soft Skills", "Tools", "Frameworks", "Methodologies", etc.)

Required format:
[
  {{
    "name": "Python",
    "category": "Programming Languages"
  }},
  {{
    "name": "Project Management",
    "category": "Soft Skills"
  }},
  {{
    "name": "Docker",
    "category": "Tools"
  }},
  {{
    "name": "React",
    "category": "Frameworks"
  }},
  {{
    "name": "Agile",
    "category": "Methodologies"
  }}
]

Make sure the skills are realistic, diverse, and align with the person's professional background. Include a mix of technical and soft skills.

IMPORTANT: Return ONLY valid JSON. Do not include any explanatory text before or after the JSON array."""
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Generate skills data
            skills_text = await llm_client.generate(prompt)
            
            # Clean up the response to ensure it's valid JSON
            skills_text = skills_text.strip()
            if skills_text.startswith("```json"):
                skills_text = skills_text[7:]
            if skills_text.endswith("```"):
                skills_text = skills_text[:-3]
            skills_text = skills_text.strip()
            
            # Try to parse the JSON
            skills_data = json.loads(skills_text)
            
            # Validate that we have the expected number of skills
            if not isinstance(skills_data, list) or len(skills_data) < 3:
                raise ValueError(f"Expected at least 3 skills, got {len(skills_data) if isinstance(skills_data, list) else 'non-list'}")
            
            # Insert each skill
            for skill in skills_data:
                skill_entry = {
                    "user": user_id,
                    "name": skill["name"],
                    "category": skill["category"],
                    "endorsements": random.randint(0, 20),  # Random number of endorsements
                    "endorsedBy": [],  # Empty array for endorsedBy
                    "createdAt": datetime.now(),
                    "updatedAt": datetime.now()
                }
                
                skills.insert_one(skill_entry)
            
            logger.info(f"Created {len(skills_data)} skills for {name}")
            return
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse skills JSON (attempt {attempt + 1}/{max_retries}): {e}")
            logger.debug(f"Raw response: {skills_text}")
        except ValueError as e:
            logger.warning(f"Invalid skills data (attempt {attempt + 1}/{max_retries}): {e}")
        except Exception as e:
            logger.error(f"Failed to create skills for {name}: {e}")
        
        if attempt < max_retries - 1:
            await asyncio.sleep(1)  # Wait before retry
    
    # If all retries failed, create fallback skills
    try:
        logger.warning(f"Creating fallback skills for {name} after all retries failed")
        
        # Create fallback skills based on the user's title
        fallback_skills = [
            {"name": "Communication", "category": "Soft Skills"},
            {"name": "Problem Solving", "category": "Soft Skills"},
            {"name": "Teamwork", "category": "Soft Skills"},
            {"name": "Time Management", "category": "Soft Skills"},
            {"name": "Leadership", "category": "Soft Skills"}
        ]
        
        # Select 3-5 random skills
        selected_skills = random.sample(fallback_skills, min(5, max(3, len(fallback_skills))))
        
        for skill in selected_skills:
            skill_entry = {
                "user": user_id,
                "name": skill["name"],
                "category": skill["category"],
                "endorsements": random.randint(0, 20),
                "endorsedBy": [],
                "createdAt": datetime.now(),
                "updatedAt": datetime.now()
            }
            
            skills.insert_one(skill_entry)
        
        logger.info(f"Created {len(selected_skills)} fallback skills for {name}")
    except Exception as e:
        logger.error(f"Failed to create fallback skills for {name}: {e}")

async def create_bot_education(user_id: ObjectId, title: str) -> None:
    """Create education entries for a bot"""
    # Get user info for context
    user = users.find_one({"_id": user_id})
    if not user:
        logger.error(f"User not found: {user_id}")
        return
    
    name = user.get("name", "Unknown")
    bio = user.get("bio", "")
    
    # Generate exactly 1 education entry
    num_education = 1
    
    prompt = f"""Generate exactly 1 realistic education entry for a person with the title "{title}" and bio: "{bio}".

Return a JSON array with 1 education object. The education should have:
- school: University or institution name
- degree: Degree type (e.g., Bachelor of Science, Master of Arts, PhD)
- fieldOfStudy: Field of study
- startDate: Start date in ISO format (YYYY-MM-DD)
- endDate: End date in ISO format (YYYY-MM-DD) or null if current
- current: Boolean indicating if they are currently studying
- grade: Optional grade or GPA
- activities: Optional extracurricular activities
- description: Optional additional information

IMPORTANT DIVERSITY INSTRUCTIONS:
- Use a wide variety of universities from different countries and regions
- DO NOT use the example universities (Stanford University, University of California, Berkeley)
- Include universities from various regions: North America, Europe, Asia, Africa, Latin America, etc.
- Use both prestigious universities and lesser-known institutions
- Include some international universities, technical colleges, and specialized institutions
- Make sure the university name is realistic and diverse

Required format:
[
  {{
    "school": "Stanford University",
    "degree": "Master of Science",
    "fieldOfStudy": "Computer Science",
    "startDate": "2016-09-01",
    "endDate": "2018-06-15",
    "current": false,
    "grade": "3.8/4.0",
    "activities": "AI Research Group, Hackathon Organizer",
    "description": "Specialized in Machine Learning and Natural Language Processing"
  }}
]

Make sure the education is realistic, diverse, and aligns with the person's professional background. The education should be relevant to their current job title.

IMPORTANT: Return ONLY valid JSON. Do not include any explanatory text before or after the JSON array."""
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Generate education data
            education_text = await llm_client.generate(prompt)
            
            # Clean up the response to ensure it's valid JSON
            education_text = education_text.strip()
            if education_text.startswith("```json"):
                education_text = education_text[7:]
            if education_text.endswith("```"):
                education_text = education_text[:-3]
            education_text = education_text.strip()
            
            # Try to parse the JSON
            education_data = json.loads(education_text)
            
            # Validate that we have the expected number of education entries
            if not isinstance(education_data, list) or len(education_data) < 1:
                raise ValueError(f"Expected at least 1 education entry, got {len(education_data) if isinstance(education_data, list) else 'non-list'}")
            
            # Insert each education entry
            for edu in education_data:
                # Convert string dates to datetime objects
                start_date = datetime.fromisoformat(edu["startDate"])
                end_date = datetime.fromisoformat(edu["endDate"]) if edu["endDate"] else None
                
                education_entry = {
                    "user": user_id,
                    "school": edu["school"],
                    "degree": edu["degree"],
                    "fieldOfStudy": edu["fieldOfStudy"],
                    "startDate": start_date,
                    "endDate": end_date,
                    "current": edu["current"],
                    "grade": edu.get("grade"),
                    "activities": edu.get("activities"),
                    "description": edu.get("description"),
                    "createdAt": datetime.now(),
                    "updatedAt": datetime.now()
                }
                
                education.insert_one(education_entry)
            
            logger.info(f"Created {len(education_data)} education entries for {name}")
            return
            
        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse education JSON (attempt {attempt + 1}/{max_retries}): {e}")
            logger.debug(f"Raw response: {education_text}")
        except ValueError as e:
            logger.warning(f"Invalid education data (attempt {attempt + 1}/{max_retries}): {e}")
        except Exception as e:
            logger.error(f"Failed to create education for {name}: {e}")
        
        if attempt < max_retries - 1:
            await asyncio.sleep(1)  # Wait before retry
    
    # If all retries failed, create a fallback education entry
    try:
        logger.warning(f"Creating fallback education for {name} after all retries failed")
        
        # Create a fallback education entry
        current_time = datetime.now()
        start_date = current_time - timedelta(days=random.randint(1460, 2920))  # 4-8 years ago
        end_date = start_date + timedelta(days=1460)  # 4 years later
        
        education_entry = {
            "user": user_id,
            "school": "University of Professional Studies",
            "degree": "Bachelor of Science",
            "fieldOfStudy": "Computer Science",
            "startDate": start_date,
            "endDate": end_date,
            "current": False,
            "grade": "3.5/4.0",
            "activities": "Student Organization",
            "description": "General studies in computer science and related fields",
            "createdAt": datetime.now(),
            "updatedAt": datetime.now()
        }
        
        education.insert_one(education_entry)
        logger.info(f"Created fallback education for {name}")
    except Exception as e:
        logger.error(f"Failed to create fallback education for {name}: {e}")

async def add_bot_profile_details(user_id: str, title: str) -> None:
    """Add profile details (experience, skills, education) to a bot account asynchronously"""
    user_id_obj = ObjectId(user_id)
    
    # Create tasks for each profile detail type
    tasks = [
        create_bot_experience(user_id_obj),
        create_bot_skills(user_id_obj, title),
        create_bot_education(user_id_obj, title)
    ]
    
    # Run all tasks concurrently
    await asyncio.gather(*tasks)
    
    logger.info(f"Completed adding profile details for bot {user_id}")
    return f"Profile details added for bot {user_id}"

async def get_or_create_bot_accounts(count: int = 5) -> List[str]:
    """Get existing bot accounts or create new ones if needed"""
    # Find existing bot accounts
    bot_accounts = list(users.find({"sub": {"$regex": "^sim-"}}))
    
    # If we have enough bot accounts, return their IDs
    if len(bot_accounts) >= count:
        logger.info(f"Found {len(bot_accounts)} existing bot accounts")
        bot_ids = [str(account["_id"]) for account in bot_accounts[:count]]
    else:
        # Otherwise, create new bot accounts
        bot_ids = [str(account["_id"]) for account in bot_accounts]
        
        # Create additional bot accounts
        for i in range(count - len(bot_accounts)):
            logger.info(f"Creating bot account {i + 1}/{count - len(bot_accounts)}")
            bot_id = await create_bot_account()
            if bot_id:
                bot_ids.append(bot_id)
            else:
                logger.error(f"Failed to create bot account {i + 1}")
    
    # Print names of all bot accounts
    logger.info("=== Bot Accounts ===")
    for bot_id in bot_ids:
        try:
            bot_account = users.find_one({"_id": ObjectId(bot_id)})
            if bot_account:
                logger.info(f"Bot: {bot_account['name']} (ID: {bot_id})")
            else:
                logger.error(f"Could not find bot account with ID: {bot_id}")
        except Exception as e:
            logger.error(f"Error retrieving bot account {bot_id}: {e}")
    logger.info("==================")
    
    # Add profile details asynchronously for all bots
    profile_detail_tasks = []
    for bot_id in bot_ids:
        try:
            bot_account = users.find_one({"_id": ObjectId(bot_id)})
            if bot_account:
                title = bot_account.get("title", "")
                # Create a task for adding profile details
                task = asyncio.create_task(add_bot_profile_details(bot_id, title))
                profile_detail_tasks.append(task)
        except Exception as e:
            logger.error(f"Error creating profile detail task for bot {bot_id}: {e}")
    
    # Start all profile detail tasks in the background
    if profile_detail_tasks:
        logger.info(f"Starting {len(profile_detail_tasks)} profile detail tasks in the background")
        # Don't await the tasks, let them run in the background
        for task in profile_detail_tasks:
            task.add_done_callback(lambda t: logger.info(f"Profile detail task completed: {t.result() if not t.exception() else t.exception()}"))
    
    return bot_ids 