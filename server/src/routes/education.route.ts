import { Router, RequestHandler } from "express";
import { Types } from "mongoose";
import Education from "../models/education.model";
import User from "../models/user.model";

interface AuthenticatedRequest {
  auth?: { sub?: string };
}

const router = Router();

// GET /api/education/:userId - Get all education entries for a user
const getUserEducation: RequestHandler = async (req, res, next) => {
  const { userId } = req.params;
  console.log(`Fetching education for user ID: ${userId}`);

  try {
    // Convert string ID to ObjectId
    const userObjectId = new Types.ObjectId(userId);
    console.log(`Converted to ObjectId: ${userObjectId.toString()}`);

    // Log the exact query we'll execute
    console.log(`Query: { user: ${userObjectId.toString()} }`);

    // First try a raw find to see all education documents
    const allEducation = await Education.find().lean();
    console.log(
      "All education documents in DB:",
      JSON.stringify(allEducation, null, 2)
    );

    // Now execute our specific query
    const education = await Education.find({ user: userObjectId })
      .sort({ current: -1, endDate: -1, startDate: -1 })
      .lean();

    console.log(`Found ${education.length} education entries for user`);
    if (education.length > 0) {
      console.log("Found education:", JSON.stringify(education, null, 2));
    }

    res.json(education);
  } catch (err) {
    console.error(`Error fetching education for user ID: ${userId}`, err);
    next(err);
  }
};
router.get("/:userId", getUserEducation);

// POST /api/education - Create a new education entry
const createEducation: RequestHandler = async (req, res, next) => {
  const authReq = req as AuthenticatedRequest;
  const userSub = authReq.auth?.sub;
  if (!userSub) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const currentUser = await User.findOne({ sub: userSub });
    if (!currentUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const education = await Education.create({
      ...req.body,
      user: currentUser._id,
    });
    res.status(201).json(education);
  } catch (err) {
    next(err);
  }
};
router.post("/", createEducation);

// PUT /api/education/:id - Update an education entry
const updateEducation: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const userSub = authReq.auth?.sub;
  if (!userSub) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const currentUser = await User.findOne({ sub: userSub });
    if (!currentUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const education = await Education.findOneAndUpdate(
      { _id: id, user: currentUser._id },
      req.body,
      { new: true }
    );

    if (!education) {
      res
        .status(404)
        .json({ error: "Education entry not found or unauthorized" });
      return;
    }

    res.json(education);
  } catch (err) {
    next(err);
  }
};
router.put("/:id", updateEducation);

// DELETE /api/education/:id - Delete an education entry
const deleteEducation: RequestHandler = async (req, res, next) => {
  const { id } = req.params;
  const authReq = req as AuthenticatedRequest;
  const userSub = authReq.auth?.sub;
  if (!userSub) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const currentUser = await User.findOne({ sub: userSub });
    if (!currentUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const education = await Education.findOneAndDelete({
      _id: id,
      user: currentUser._id,
    });

    if (!education) {
      res
        .status(404)
        .json({ error: "Education entry not found or unauthorized" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
router.delete("/:id", deleteEducation);

export default router;
