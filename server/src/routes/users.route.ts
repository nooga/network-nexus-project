import { Router, RequestHandler } from "express";
import { Types } from "mongoose";
import User from "../models/user.model";
import Post from "../models/post.model";
import Connection from "../models/connection.model";
import Comment from "../models/comment.model";
import slugify from "slugify";

// Auth0 attaches JWT payload on req.auth
interface AuthenticatedRequest {
  auth?: { sub?: string };
}

const router = Router();

// --- Specific Routes First ---

// GET /api/users/me - get current authenticated user's profile
const getCurrentUser: RequestHandler = (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  const sub = authReq.auth?.sub;
  if (!sub) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  User.findOne({ sub })
    .then((user) => {
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json(user);
    })
    .catch((err) => next(err));
};
router.get("/me", getCurrentUser);

// GET /api/users/username/:username - get user by username
const getUserByUsername: RequestHandler = async (req, res, next) => {
  const { username } = req.params;
  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }
  try {
    // Find user by lowercase username
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
};
router.get("/username/:username", getUserByUsername);

// GET /api/users/search - search users by name or title
const searchUsers: RequestHandler = (req, res, next) => {
  const q = req.query.query as string;
  if (!q) {
    res.json([]);
    return;
  }
  const regex = new RegExp(q, "i");
  User.find({
    $or: [{ name: { $regex: regex } }, { title: { $regex: regex } }],
  })
    .limit(10)
    .select("_id sub name title avatarUrl username")
    .lean()
    .then((results) => res.json(results))
    .catch((err) => next(err));
};
router.get("/search", searchUsers);

// --- Parameterized Routes Later ---

// GET /api/users/:id - get user by id
const getUser: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: "Invalid user ID format" });
    return;
  }
  try {
    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
};
router.get("/:id", getUser);

// GET /api/users/:id/connections - list a user's connections
const getUserConnections: RequestHandler = async (req, res, next) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const skip = (page - 1) * limit;
  const { id } = req.params;

  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: "Invalid user ID format" });
    return;
  }

  const userId = new Types.ObjectId(id);

  try {
    const conns = await Connection.find({
      status: "connected",
      $or: [{ from: userId }, { to: userId }],
    })
      .skip(skip)
      .limit(limit)
      .lean();

    const otherIds = conns.map((conn) => {
      const fromId = conn.from as Types.ObjectId;
      const toId = conn.to as Types.ObjectId;
      return fromId.equals(userId) ? toId : fromId;
    });

    const users = await User.find({ _id: { $in: otherIds } }).select(
      "name title avatarUrl username"
    );

    res.json(users);
  } catch (err) {
    next(err);
  }
};
router.get("/:id/connections", getUserConnections);

// GET /api/users/:id/posts - list posts by a specific user
const getUserPosts: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const skip = (page - 1) * limit;

  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: "Invalid user ID format" });
    return;
  }

  const userId = new Types.ObjectId(id);

  try {
    const posts = await Post.find({ author: userId })
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "sub name title avatarUrl username")
      .lean();
    res.json(posts);
  } catch (err) {
    next(err);
  }
};
router.get("/:id/posts", getUserPosts);

// GET /api/users/:id/comments - list comments by a specific user with associated posts
const getUserComments: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 50;
  const skip = (page - 1) * limit;

  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: "Invalid user ID format" });
    return;
  }

  const userId = new Types.ObjectId(id);

  try {
    // Find comments by user and populate both the author and post details
    const comments = await Comment.find({ author: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("author", "sub name title avatarUrl username")
      .populate({
        path: "post",
        populate: {
          path: "author",
          select: "sub name title avatarUrl username",
        },
      })
      .lean();

    // For each comment, fetch the total comment count on its post
    const commentsWithContext = await Promise.all(
      comments.map(async (comment) => {
        const post = comment.post as {
          _id: Types.ObjectId;
          [key: string]: any;
        };
        const totalComments = await Comment.countDocuments({ post: post._id });
        return {
          ...comment,
          post: {
            ...post,
            comments: totalComments,
          },
        };
      })
    );

    res.json(commentsWithContext);
  } catch (err) {
    next(err);
  }
};
router.get("/:id/comments", getUserComments);

// --- Other Routes ---

// Helper function to generate a unique username
async function generateUniqueUsername(name: string): Promise<string> {
  const baseUsername = slugify(name, { lower: true, strict: true });
  let username = baseUsername;
  let counter = 1;
  // Check if username exists
  while (await User.exists({ username })) {
    username = `${baseUsername}-${counter}`;
    counter++;
  }
  return username;
}

// POST /api/users - create or update a user record (upsert)
const upsertUser: RequestHandler = async (req, res, next) => {
  const { sub, name, title, avatarUrl, bio, location } = req.body;
  if (!sub || !name) {
    res.status(400).json({ error: "sub and name are required" });
    return;
  }

  try {
    // Find existing user by sub
    const existingUser = await User.findOne({ sub });

    let username = existingUser?.username;
    // Generate username only if it doesn't exist (for new users or first time)
    if (!username) {
      username = await generateUniqueUsername(name);
    }

    // Prepare update data, including the username
    const updateData = {
      sub,
      name,
      username,
      title: title || undefined,
      avatarUrl: avatarUrl || undefined,
      bio: bio || undefined,
      location: location || undefined,
    };

    const user = await User.findOneAndUpdate({ sub }, updateData, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    });

    res.status(user ? 200 : 201).json(user);
  } catch (err) {
    next(err);
  }
};
router.post("/", upsertUser);

export default router;
