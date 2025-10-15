-- Drop the foreign key constraint from LoanRequest to User for the old 'assignedToUserId' field.
ALTER TABLE "LoanRequest" DROP CONSTRAINT "LoanRequest_assignedToUserId_fkey";

-- Drop the old 'assignedToUserId' column from the LoanRequest table.
ALTER TABLE "LoanRequest" DROP COLUMN "assignedToUserId";

-- Create the many-to-many join table '_AssignedUsers' for LoanRequest and User.
CREATE TABLE "_AssignedUsers" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- Create a unique index on the join table to prevent duplicate assignments.
CREATE UNIQUE INDEX "_AssignedUsers_AB_unique" ON "_AssignedUsers"("A", "B");

-- Create an index on the "B" column for efficient lookups.
CREATE INDEX "_AssignedUsers_B_index" ON "_AssignedUsers"("B");

-- Add a foreign key constraint from the join table to the LoanRequest table.
ALTER TABLE "_AssignedUsers" ADD CONSTRAINT "_AssignedUsers_A_fkey" FOREIGN KEY ("A") REFERENCES "LoanRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add a foreign key constraint from the join table to the User table.
ALTER TABLE "_AssignedUsers" ADD CONSTRAINT "_AssignedUsers_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
