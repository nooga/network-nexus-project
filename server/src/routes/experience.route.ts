import { Router, RequestHandler } from "express";
import { Types } from "mongoose";
import Experience from "../models/experience.model";
import User from "../models/user.model";

interface AuthenticatedRequest {
  auth?: { sub?: string };
}

const router = Router();

// GET /api/experience/:userId - Get all experiences for a user
const getUserExperience: RequestHandler = async (req, res, next) => {
  const { userId } = req.params;

  try {
    const experiences = await Experience.find({ user: userId })
      .sort({ current: -1, endDate: -1, startDate: -1 })
      .lean();
    res.json(experiences);
  } catch (err) {
    next(err);
  }
};
router.get("/:userId", getUserExperience);

// POST /api/experience - Create a new experience
const createExperience: RequestHandler = async (req, res, next) => {
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

    const experience = await Experience.create({
      ...req.body,
      user: currentUser._id,
    });
    res.status(201).json(experience);
  } catch (err) {
    next(err);
  }
};
router.post("/", createExperience);

// PUT /api/experience/:id - Update an experience
const updateExperience: RequestHandler = async (req, res, next) => {
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

    const experience = await Experience.findOneAndUpdate(
      { _id: id, user: currentUser._id },
      req.body,
      { new: true }
    );

    if (!experience) {
      res.status(404).json({ error: "Experience not found or unauthorized" });
      return;
    }

    res.json(experience);
  } catch (err) {
    next(err);
  }
};
router.put("/:id", updateExperience);

// DELETE /api/experience/:id - Delete an experience
const deleteExperience: RequestHandler = async (req, res, next) => {
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

    const experience = await Experience.findOneAndDelete({
      _id: id,
      user: currentUser._id,
    });

    if (!experience) {
      res.status(404).json({ error: "Experience not found or unauthorized" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
router.delete("/:id", deleteExperience);

export default router;
