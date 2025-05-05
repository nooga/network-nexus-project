import { Schema, model, Document, Types } from "mongoose";

export interface ISkill extends Document {
  user: Types.ObjectId;
  name: string;
  category: string;
  endorsements: number;
  endorsedBy: Types.ObjectId[];
}

const SkillSchema = new Schema<ISkill>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    endorsements: { type: Number, default: 0 },
    endorsedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

// Index for faster queries
SkillSchema.index({ user: 1 });
SkillSchema.index({ name: 1 });
SkillSchema.index({ category: 1 });

export const Skill = model<ISkill>("Skill", SkillSchema);
export default Skill;
