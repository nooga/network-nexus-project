import { Router, RequestHandler } from "express";
import { Types } from "mongoose";
import Skill from "../models/skill.model";
import User from "../models/user.model";

interface AuthenticatedRequest {
  auth?: { sub?: string };
}

interface MongoError extends Error {
  code?: number;
}

const router = Router();

// GET /api/skills/:userId - Get all skills for a user
const getUserSkills: RequestHandler = async (req, res, next) => {
  const { userId } = req.params;

  try {
    const skills = await Skill.find({ user: userId })
      .sort({ endorsements: -1 })
      .lean();
    res.json(skills);
  } catch (err) {
    next(err);
  }
};
router.get("/:userId", getUserSkills);

// POST /api/skills - Create a new skill
const createSkill: RequestHandler = async (req, res, next) => {
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

    const skill = await Skill.create({
      ...req.body,
      user: currentUser._id,
      endorsements: 0,
      endorsedBy: [],
    });
    res.status(201).json(skill);
  } catch (err) {
    // Handle duplicate skill error
    if ((err as MongoError).code === 11000) {
      res.status(400).json({ error: "Skill already exists for this user" });
      return;
    }
    next(err);
  }
};
router.post("/", createSkill);

// DELETE /api/skills/:id - Delete a skill
const deleteSkill: RequestHandler = async (req, res, next) => {
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

    const skill = await Skill.findOneAndDelete({
      _id: id,
      user: currentUser._id,
    });

    if (!skill) {
      res.status(404).json({ error: "Skill not found or unauthorized" });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
router.delete("/:id", deleteSkill);

// POST /api/skills/:id/endorse - Endorse a skill
const endorseSkill: RequestHandler = async (req, res, next) => {
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

    const skill = await Skill.findById(id);
    if (!skill) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }

    // Check if user has already endorsed this skill
    const endorserId = currentUser._id as unknown as Types.ObjectId;
    if (skill.endorsedBy.some((id) => id.equals(endorserId))) {
      res.status(400).json({ error: "Already endorsed this skill" });
      return;
    }

    // Don't allow self-endorsement
    if (skill.user.equals(endorserId)) {
      res.status(400).json({ error: "Cannot endorse your own skill" });
      return;
    }

    const updatedSkill = await Skill.findByIdAndUpdate(
      id,
      {
        $inc: { endorsements: 1 },
        $push: { endorsedBy: endorserId },
      },
      { new: true }
    );

    res.json(updatedSkill);
  } catch (err) {
    next(err);
  }
};
router.post("/:id/endorse", endorseSkill);

// DELETE /api/skills/:id/endorse - Remove skill endorsement
const removeEndorsement: RequestHandler = async (req, res, next) => {
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

    const skill = await Skill.findById(id);
    if (!skill) {
      res.status(404).json({ error: "Skill not found" });
      return;
    }

    // Check if user has endorsed this skill
    const endorserId = currentUser._id as unknown as Types.ObjectId;
    if (!skill.endorsedBy.some((id) => id.equals(endorserId))) {
      res.status(400).json({ error: "Haven't endorsed this skill" });
      return;
    }

    const updatedSkill = await Skill.findByIdAndUpdate(
      id,
      {
        $inc: { endorsements: -1 },
        $pull: { endorsedBy: endorserId },
      },
      { new: true }
    );

    res.json(updatedSkill);
  } catch (err) {
    next(err);
  }
};
router.delete("/:id/endorse", removeEndorsement);

export default router;
