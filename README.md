# York Castle High School - Full Web Application

A comprehensive web application for York Castle High School with an admin dashboard, built with Node.js/Express backend and React frontend.

## Project Structure

```
york-castle-high-school/
├── backend/              # Node.js/Express API
│   ├── src/
│   │   ├── controllers/ # Route handlers
│   │   ├── routes/      # API routes
│   │   ├── middleware/  # Auth, validation
│   │   ├── services/    # Business logic
│   │   └── utils/       # Helpers
│   └── prisma/          # Database schema
├── admin-dashboard/     # React admin SPA
│   └── src/
│       ├── pages/      # Dashboard pages
│       ├── components/ # React components
│       └── services/   # API clients
└── [static files]      # Existing HTML pages
```

## Quick Start

See [SETUP.md](SETUP.md) for detailed setup instructions.

### Quick Setup (from project root)

1. **Install all dependencies:**
   ```bash
   npm run setup
   ```

2. **Set up backend environment:**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Set up database:**
   
   **Option A: Local PostgreSQL**
   ```bash
   cd backend
   npm run prisma:generate
   npm run prisma:migrate
   npm run prisma:seed
   ```
   
   **Option B: Supabase (Cloud Database)**
   
   **With Supabase CLI (Recommended)**:
   ```bash
   # Install Supabase CLI: brew install supabase/tap/supabase
   cd backend
   supabase login
   supabase link --project-ref your-project-ref
   npx prisma migrate deploy
   npm run prisma:seed
   ```
   
   **Manual Setup**:
   ```bash
   # See SUPABASE_MIGRATION.md for detailed instructions
   cd backend
   # Update .env with Supabase connection string
   npm run prisma:generate
   npx prisma migrate deploy
   npm run prisma:seed
   ```
   
   **📖 Guides**:
   - [Supabase CLI Guide](./SUPABASE_CLI_GUIDE.md) - Complete CLI setup
   - [Supabase Migration Guide](./SUPABASE_MIGRATION.md) - Detailed migration steps

4. **Start both servers:**
   ```bash
   # From project root
   npm run dev
   ```

   Or start separately:
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend
   cd admin-dashboard && npm run dev
   ```

### Default Admin Credentials

After seeding the database:
- Email: `admin@yorkcastle.edu.jm`
- Password: `admin123`

## Features

### Backend API
- JWT-based authentication
- User management with role-based access control
- Application management (General & Sixth Form)
- Content management (Blog posts, Events)
- Course and enrollment management
- Document management with file uploads
- Request management system
- Analytics and reporting

### Admin Dashboard
- Dashboard overview with statistics
- Application review and management
- User management
- Content management (Blog, Events)
- Course management
- Document library
- Request management
- Analytics and reports

### Static Pages Integration
- Application forms connected to API
- Sixth form application connected to API
- Preserves existing Webflow styling

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Applications
- `GET /api/applications` - List applications (admin/staff)
- `POST /api/applications` - Submit application
- `GET /api/applications/:id` - Get application
- `PUT /api/applications/:id/status` - Update status

### Users
- `GET /api/users` - List users (admin/staff)
- `GET /api/users/:id` - Get user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Courses
- `GET /api/courses` - List courses
- `POST /api/courses` - Create course
- `POST /api/courses/:id/enroll` - Enroll student

### Documents
- `GET /api/documents` - List documents
- `POST /api/documents` - Upload document
- `GET /api/documents/:id/download` - Download document

See full API documentation at `/api-docs` when server is running.

## Technologies Used

- **Backend**: Node.js, Express.js, Prisma ORM, PostgreSQL
- **Frontend**: React, TypeScript, Vite
- **Authentication**: JWT
- **File Upload**: Multer
- **Email**: Resend

## Development

### Running in Development

**Option 1: Run both servers together (from project root)**
```bash
npm run dev
```

**Option 2: Run separately**
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd admin-dashboard && npm run dev
```

### Database Management

**Run migrations:**
```bash
npm run db:migrate
# or
cd backend && npm run prisma:migrate
```

**Seed database:**
```bash
npm run db:seed
# or
cd backend && npm run prisma:seed
```

**View database (Prisma Studio):**
```bash
npm run db:studio
# or
cd backend && npm run prisma:studio
```

### Useful Commands

- `npm run setup` - Install all dependencies
- `npm run dev` - Start both backend and frontend
- `npm run build` - Build admin dashboard for production
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with initial data

## Production Deployment

1. Set `NODE_ENV=production` in environment variables
2. Build admin dashboard: `cd admin-dashboard && npm run build`
3. Serve admin dashboard build files statically
4. Configure production database
5. Set up proper CORS origins
6. Configure email service for notifications

## License

Copyright © York Castle High School 2025

