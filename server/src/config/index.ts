import dotenv from "dotenv";

dotenv.config();

// List of required environment variables
const requiredEnvs = [
  "MONGODB_URI",
  "REDIS_URL",
  "AUTH0_DOMAIN",
  "AUTH0_AUDIENCE",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "PORT",
] as const;

requiredEnvs.forEach((env) => {
  if (!process.env[env]) {
    throw new Error(`Missing required environment variable: ${env}`);
  }
});

// Export typed configuration
const config = {
  MONGODB_URI: process.env.MONGODB_URI!,
  REDIS_URL: process.env.REDIS_URL!,
  AUTH0_DOMAIN: process.env.AUTH0_DOMAIN!,
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE!,
  AUTH0_CLIENT_ID: process.env.AUTH0_CLIENT_ID!,
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET!,
  PORT: parseInt(process.env.PORT as string, 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
};

export default config;
