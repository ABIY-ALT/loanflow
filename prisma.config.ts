import type { Prisma } from '@prisma/client';
import dotenv from 'dotenv';

// Explicitly load environment variables from .env file
dotenv.config();

const config: Prisma.Subset<Prisma.PrismaClientOptions, Prisma.PrismaClientOptions> = {
  // Prisma's seeder config is very minimal in a config file
  // and doesn't need to specify the command directly. It will
  // automatically look for the default seed file (prisma/seed.ts)
  // and tsx will handle the TypeScript execution.
};

export default config;
