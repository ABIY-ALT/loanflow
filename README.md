# LoanFlow: Loan Management System

This is a Next.js-based Loan Management System built with React, ShadCN UI, Tailwind CSS, and Prisma.

## Getting Started

To access the system during development and testing, use the following default Administrator credentials:

- **Phone Number:** `0000000000`
- **Password:** `password123`

## Features

- **Dashboard**: Real-time KPIs and quick access.
- **Loan Pipeline**: Kanban-style tracking across 32 workflow stages.
- **My Assigned Cases**: Personalized task queue for staff.
- **My Submitted Cases**: Visibility for inputters/creators.
- **Incoming Cases**: Dedicated queue for Department Heads with real-time badges.
- **Case History**: Full chronological audit trail for every loan.
- **Public Tracker**: Read-only status lookup for loan applicants.
- **Role-Based Access**: Granular permissions for Secretaries, CRMs, Officers, Directors, and Chiefs.

## Developer Notes

- **Tech Stack**: Next.js (App Router), TypeScript, Prisma (SQLite), Tailwind CSS.
- **Authentication**: Custom JWT-based session management with phone number login.
- **Database**: Run `npm run db:setup` to apply migrations and seed initial data (including sectors and standard workflows).
