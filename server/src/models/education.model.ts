import { Schema, model, Document, Types } from "mongoose";

export interface IEducation extends Document {
  user: Types.ObjectId;
  school: string;
  degree: string;
  fieldOfStudy: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
  grade?: string;
  activities?: string;
  description?: string;
}

const EducationSchema = new Schema<IEducation>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    school: { type: String, required: true },
    degree: { type: String, required: true },
    fieldOfStudy: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    current: { type: Boolean, default: false },
    grade: { type: String },
    activities: { type: String },
    description: { type: String },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
EducationSchema.index({ user: 1 });
EducationSchema.index({ school: 1 });
EducationSchema.index({ fieldOfStudy: 1 });

export const Education = model<IEducation>("Education", EducationSchema);
export default Education;
