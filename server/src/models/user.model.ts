import { Schema, model, Document, Types } from "mongoose";

export interface IUser extends Document {
  sub: string;
  username: string;
  name: string;
  title: string;
  avatarUrl: string;
  bio?: string;
  location?: string;
  skills?: Types.ObjectId[];
  experience?: Types.ObjectId[];
  education?: Types.ObjectId[];
}

const UserSchema = new Schema<IUser>(
  {
    sub: { type: String, required: true, unique: true, index: true },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    name: { type: String, required: true },
    title: { type: String },
    avatarUrl: { type: String },
    bio: { type: String },
    location: { type: String },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Virtual fields for related data
UserSchema.virtual("skills", {
  ref: "Skill",
  localField: "_id",
  foreignField: "user",
});

UserSchema.virtual("experience", {
  ref: "Experience",
  localField: "_id",
  foreignField: "user",
});

UserSchema.virtual("education", {
  ref: "Education",
  localField: "_id",
  foreignField: "user",
});

export const User = model<IUser>("User", UserSchema);
export default User;
