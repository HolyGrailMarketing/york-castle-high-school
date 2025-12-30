# Setup Guide - York Castle High School Web Application

Complete setup instructions for getting the application running.

## Prerequisites

- **Node.js** (v18 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** or **yarn**

## Step 1: Database Setup

1. **Install PostgreSQL** (if not already installed)
   - macOS: `brew install postgresql`
   - Ubuntu: `sudo apt-get install postgresql`
   - Windows: Download from [postgresql.org](https://www.postgresql.org/download/)

2. **Create Database**
   ```bash
   # Connect to PostgreSQL
   psql -U postgres

   # Create database
   CREATE DATABASE yorkcastle;

   # Exit psql
   \q
   ```

## Step 2: Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` file:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/yorkcastle
   JWT_SECRET=your-very-secure-secret-key-here
   PORT=3000
   NODE_ENV=development
   CORS_ORIGIN=http://localhost:5173
   ```

4. **Set up database schema**
   ```bash
   # Generate Prisma client
   npm run prisma:generate

   # Run migrations
   npm run prisma:migrate

   # Seed database (creates admin user)
   npm run prisma:seed
   ```

5. **Start backend server**
   ```bash
   npm run dev
   ```

   Backend should be running at `http://localhost:3000`
   API docs at `http://localhost:3000/api-docs`

## Step 3: Admin Dashboard Setup

1. **Open a new terminal and navigate to admin dashboard**
   ```bash
   cd admin-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

   Dashboard should be running at `http://localhost:5173`

## Step 4: Verify Installation

1. **Access Admin Dashboard**
   - Go to `http://localhost:5173`
   - Login with:
     - Email: `admin@yorkcastle.edu.jm`
     - Password: `admin123`

2. **Test API**
   - Visit `http://localhost:3000/api-docs` for API documentation
   - Test health endpoint: `http://localhost:3000/health`

3. **Test Form Submission**
   - Visit `http://localhost:3000/application-form.html` (if serving static files)
   - Submit a test application

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready`
- Check database credentials in `.env`
- Ensure database exists: `psql -U postgres -l`

### Port Already in Use

- Backend: Change `PORT` in `.env`
- Frontend: Change port in `vite.config.ts`

### CORS Errors

- Ensure `CORS_ORIGIN` in backend `.env` matches frontend URL
- Check browser console for specific error messages

### Prisma Issues

- Run `npm run prisma:generate` after schema changes
- Reset database if needed: `npx prisma migrate reset`

## Next Steps

1. **Change Default Admin Password**
   - Login to dashboard
   - Go to Users section
   - Update admin password

2. **Configure Email Service** (optional)
   - Add SMTP credentials to `.env`
   - Test email notifications

3. **Customize Content**
   - Add courses
   - Create blog posts
   - Add events

4. **Production Deployment**
   - See `backend/README.md` and `admin-dashboard/README.md`
   - Set up proper environment variables
   - Configure production database
   - Set up reverse proxy (nginx)
   - Enable HTTPS

## Support

For issues or questions, refer to:
- Backend documentation: `backend/README.md`
- Dashboard documentation: `admin-dashboard/README.md`
- Main README: `README.md`





