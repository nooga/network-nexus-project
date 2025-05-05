import { Schema, model, Document, Types } from "mongoose";

export interface IExperience extends Document {
  user: Types.ObjectId;
  title: string;
  company: string;
  location: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
  description: string;
  employmentType: string;
  industry: string;
}

const ExperienceSchema = new Schema<IExperience>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    current: { type: Boolean, default: false },
    description: { type: String, required: true },
    employmentType: { type: String, required: true },
    industry: { type: String, required: true },
  },
  { timestamps: true }
);

// Index for faster queries
ExperienceSchema.index({ user: 1 });
ExperienceSchema.index({ company: 1 });
ExperienceSchema.index({ industry: 1 });

export const Experience = model<IExperience>("Experience", ExperienceSchema);
export default Experience;
