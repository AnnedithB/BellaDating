
# Admin Service

This service is responsible for handling all the admin related functionalities.

## Features

- Authentication
- User Management
- Moderation
- Analytics
- Settings

## API Documentation

The API documentation is available at `/api-docs`.

## Getting Started

1. Clone the repository.
2. Install the dependencies using `npm install`.
3. Create a `.env` file by copying the `.env.example` file and update the values to match your environment (database URL, JWT secret, seed admin credentials, etc.).
4. Push the Prisma schema to your database with `npx prisma db push`.
5. Seed the database with a default admin account using `npm run prisma:seed`.
6. (Optional) Open Prisma Studio to inspect the data with `npm run prisma:studio`.
7. Build the TypeScript output with `npm run build` or start the development server with `npm run dev`.
8. Run the service using `npm start` (after building) or `npm run dev`.

## Environment Variables

- `DATABASE_URL`: The URL of the database.
- `JWT_SECRET`: The secret key for JWT.
- `FRONTEND_URL`: The URL of the frontend.
- `PORT`: The port on which the service will run.
- `ADMIN_SEED_*`: Values used by the Prisma seed script to create the initial admin user.
