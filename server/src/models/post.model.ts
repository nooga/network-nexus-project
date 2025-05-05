import {
  Schema,
  model,
  Document,
  Types,
  SchemaDefinitionProperty,
} from "mongoose";

export interface IPost extends Document {
  author: Types.ObjectId;
  content: string;
  imageUrl?: string;
  timestamp: Date;
  likes: number;
  comments: number;
}

const PostSchema = new Schema<IPost>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    imageUrl: { type: String },
    timestamp: {
      type: Date,
      default: Date.now,
      // Store timestamps in UTC format
      get: function (this: IPost) {
        // Return the internal _timestamp property to avoid recursion
        return this.get("_timestamp");
      },
      set: function (value: string | Date) {
        // Convert to Date if string, otherwise use as is
        return value ? new Date(value) : null;
      },
    } as SchemaDefinitionProperty<Date>,
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

export const Post = model<IPost>("Post", PostSchema);
export default Post;
