import mongoose from "mongoose";
import User, { IUser } from "./models/user.model";
import Post, { IPost } from "./models/post.model";
import dotenv from "dotenv";
import slugify from "slugify"; // Import slugify

dotenv.config(); // Load environment variables

// Define more professional user data with locations
const seedUsers: Partial<IUser & { email: string }>[] = [
  {
    sub: "auth0|seeduser1",
    name: "Alex Chen",
    email: "alex.chen@example.com",
    username: "alex-chen",
    title: "Software Engineer @ TechCorp",
    avatarUrl: "https://i.pravatar.cc/150?u=alex",
    location: "San Francisco, CA", // Added location
  },
  {
    sub: "auth0|seeduser2",
    name: "Jordan Lee",
    email: "jordan.lee@example.com",
    username: "jordan-lee",
    title: "Product Manager | Innovate Solutions",
    avatarUrl: "https://i.pravatar.cc/150?u=jordan",
    location: "New York, NY", // Added location
  },
  {
    sub: "auth0|seeduser3",
    name: "Sam Taylor",
    email: "sam.taylor@example.com",
    username: "sam-taylor",
    title: "UX Designer - Creative Minds Agency",
    avatarUrl: "https://i.pravatar.cc/150?u=sam",
    location: "London, UK", // Added location
  },
  {
    sub: "auth0|seeduser4",
    name: "Morgan Riley",
    email: "morgan.riley@example.com",
    username: "morgan-riley",
    title: "Data Scientist | Future AI",
    avatarUrl: "https://i.pravatar.cc/150?u=morgan",
    location: "Austin, TX", // Added location
  },
  {
    sub: "auth0|seeduser5",
    name: "Casey Garcia",
    email: "casey.garcia@example.com",
    username: "casey-garcia",
    title: "Marketing Lead at Growth Co.",
    avatarUrl: "https://i.pravatar.cc/150?u=casey",
    location: "Berlin, Germany", // Added location
  },
];

// Define more professional/work-related post data
const seedPosts: { userEmail: string; content: string }[] = [
  {
    userEmail: "alex.chen@example.com",
    content:
      "Excited to share that our latest feature just shipped! Big thanks to the team for the hard work. #softwaredevelopment #techcorp",
  },
  {
    userEmail: "jordan.lee@example.com",
    content:
      "Just finished roadmap planning for Q3. Lots of exciting things coming! How do you approach product prioritization? #productmanagement #innovation",
  },
  {
    userEmail: "sam.taylor@example.com",
    content:
      "Deep dive into user feedback today. Always insightful to see how people interact with the designs. #uxdesign #userresearch",
  },
  {
    userEmail: "morgan.riley@example.com",
    content:
      "The results from the latest A/B test on our model are fascinating! Sometimes the data really surprises you. #datascience #machinelearning",
  },
  {
    userEmail: "casey.garcia@example.com",
    content:
      "Wrapping up a successful campaign launch! Metrics are looking great. What are your favorite tools for campaign tracking? #marketing #growthhacking",
  },
  {
    userEmail: "alex.chen@example.com",
    content:
      "Spent the morning debugging a tricky issue. That feeling when you finally find the root cause... priceless! 😂 #codinglife",
  },
  {
    userEmail: "jordan.lee@example.com",
    content:
      "Attended a great webinar on agile methodologies today. Always learning! #agile #projectmanagement",
  },
];

// Helper function to generate a unique username (same as in users.route.ts, maybe centralize later)
async function generateUniqueUsernameSeed(name: string): Promise<string> {
  const baseUsername = slugify(name, { lower: true, strict: true }); // Use const
  let username = baseUsername;
  let counter = 1;
  // Check if username exists
  while (await User.exists({ username })) {
    username = `${baseUsername}-${counter}`;
    counter++;
  }
  return username;
}

export const seedDatabase = async () => {
  try {
    console.log("Upserting seed users...");

    const upsertedUsers: IUser[] = [];
    const userMap = new Map<string, mongoose.Types.ObjectId>();

    for (const userData of seedUsers) {
      const { email, name, ...userFields } = userData;
      try {
        if (typeof name !== "string" || name.trim() === "") {
          console.warn(
            `Skipping user upsert due to missing/invalid name for sub: ${userFields.sub}`
          );
          continue;
        }

        const finalUsername =
          userFields.username || (await generateUniqueUsernameSeed(name));

        // Prepare data for upsert, now including location
        const dataToUpsert = {
          ...userFields,
          name,
          username: finalUsername,
          location: userFields.location || undefined, // Include location
        };

        const upsertedUser = await User.findOneAndUpdate(
          { sub: userFields.sub },
          dataToUpsert,
          {
            upsert: true,
            new: true,
            runValidators: true,
            setDefaultsOnInsert: true,
          }
        );
        if (upsertedUser) {
          upsertedUsers.push(upsertedUser);
          if (email) {
            userMap.set(email, upsertedUser._id as mongoose.Types.ObjectId);
          }
        } else {
          console.warn(`Failed to upsert user with sub: ${userFields.sub}`);
        }
      } catch (error) {
        console.error(
          `Error upserting user with sub ${userFields.sub}:`,
          error
        );
      }
    }

    console.log(`${upsertedUsers.length} seed users upserted.`);

    // --- Post Seeding ---
    console.log("Clearing previous posts from seed users...");
    await Post.deleteMany({ author: { $in: Array.from(userMap.values()) } });

    console.log("Inserting seed posts...");
    const mappedPosts: (Partial<IPost> | null)[] = seedPosts.map((post) => {
      const authorId = userMap.get(post.userEmail);
      if (!authorId) {
        console.warn(
          `User not found for email (after upsert): ${post.userEmail}. Skipping post.`
        );
        return null;
      }
      return {
        author: authorId,
        content: post.content,
      };
    });

    const postsToCreate: Partial<IPost>[] = mappedPosts.filter(
      (post): post is Partial<IPost> => post !== null
    );

    if (postsToCreate.length > 0) {
      const createdPosts = await Post.insertMany(postsToCreate);
      console.log(`${createdPosts.length} seed posts created.`);
    } else {
      console.log(
        "No seed posts were created (potentially due to user mapping issues after upsert)."
      );
    }

    console.log("Database seeding/upserting complete.");
  } catch (error) {
    console.error("Error during database seeding/upserting:", error);
  }
};

// Connect to MongoDB and run the seeding function
// Ensure MONGODB_URI is defined in your .env file
export const connectAndSeed = async () => {
  // This function might need adjustment if the main app keeps the connection open.
  // Currently, it connects, seeds, and disconnects.
  // If called from index.ts which already connects, this separate connection is redundant.
  // The export `seedDatabase` is likely what index.ts should use directly.

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error(
      "MONGODB_URI is not defined in .env file. Cannot seed database."
    );
    process.exit(1); // Exit if the URI is not set
  }

  let connection;
  try {
    connection = await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected for seeding (stand-alone execution).");
    await seedDatabase(); // Call the main seeding logic
  } catch (err) {
    console.error("Database connection or seeding failed (stand-alone):", err);
  } finally {
    if (connection) {
      await mongoose.disconnect();
      console.log(
        "MongoDB disconnected after seeding (stand-alone execution)."
      );
    }
  }
};

// Example of how to call this from your main server file (e.g., index.ts or app.ts)
// Make sure this runs *before* your server starts listening for requests
//
// import { connectAndSeed } from './seed';
//
// async function startServer() {
//   await connectAndSeed(); // Seed the database first
//
//   // ... rest of your server setup (Express app, middleware, routes, etc.)
//
//   const PORT = process.env.PORT || 3000;
//   app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
//   });
// }
//
// startServer();

// If you want to run this script directly for testing:
// Add ` "seed": "ts-node server/src/seed.ts" ` to your package.json scripts
// Then run `npm run seed` or `yarn seed`
/*
if (require.main === module) {
  console.log("Running seed script directly...");
  connectAndSeed()
    .then(() => {
      console.log("Direct seeding process finished.");
    })
    .catch((error) => {
      console.error("Direct seeding process failed:", error);
      process.exit(1);
    });
}
*/
