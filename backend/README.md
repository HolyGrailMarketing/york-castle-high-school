# York Castle High School - Backend API

Node.js/Express backend API for York Castle High School management system.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment Variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and configure:
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - Secret key for JWT tokens (use a strong random string)
   - `PORT` - Server port (default: 3000)
   - `CORS_ORIGIN` - Frontend URL (default: http://localhost:5173)
   - `SMTP_*` - Email configuration (optional, for notifications)

3. **Set Up Database**
   ```bash
   # Generate Prisma client
   npm run prisma:generate

   # Run database migrations
   npm run prisma:migrate

   # Seed database with initial data (optional)
   npm run prisma:seed
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:3000`
   API documentation at `http://localhost:3000/api-docs`

## Default Admin Account

After running the seed script:
- **Email**: `admin@yorkcastle.edu.jm`
- **Password**: `admin123`

**⚠️ Change the default password in production!**

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Applications
- `GET /api/applications` - List applications (admin/staff)
- `POST /api/applications` - Submit application
- `GET /api/applications/:id` - Get application
- `PUT /api/applications/:id/status` - Update status
- `DELETE /api/applications/:id` - Delete application

### Sixth Form Applications
- `GET /api/sixth-form` - List applications (admin/staff)
- `POST /api/sixth-form` - Submit application
- `GET /api/sixth-form/:id` - Get application
- `PUT /api/sixth-form/:id/status` - Update status

### Users
- `GET /api/users` - List users (admin/staff)
- `GET /api/users/:id` - Get user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `PUT /api/users/:id/role` - Update user role (admin)

### Courses
- `GET /api/courses` - List courses
- `GET /api/courses/:id` - Get course
- `POST /api/courses` - Create course (admin/staff)
- `PUT /api/courses/:id` - Update course
- `DELETE /api/courses/:id` - Delete course
- `POST /api/courses/:id/enroll` - Enroll student
- `GET /api/courses/:id/enrollments` - Get enrollments

### Blog Posts
- `GET /api/blog` - List blog posts
- `GET /api/blog/:id` - Get blog post
- `POST /api/blog` - Create post (admin/staff)
- `PUT /api/blog/:id` - Update post
- `DELETE /api/blog/:id` - Delete post
- `PUT /api/blog/:id/publish` - Publish/unpublish

### Events
- `GET /api/events` - List events
- `GET /api/events/:id` - Get event
- `POST /api/events` - Create event (admin/staff)
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Documents
- `GET /api/documents` - List documents
- `GET /api/documents/:id` - Get document
- `POST /api/documents` - Upload document (admin/staff)
- `PUT /api/documents/:id` - Update document
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/:id/download` - Download document

### Requests
- `GET /api/requests` - List requests
- `GET /api/requests/:id` - Get request
- `POST /api/requests` - Create request
- `PUT /api/requests/:id/status` - Update status (admin/staff)
- `DELETE /api/requests/:id` - Delete request

### Analytics
- `GET /api/analytics/dashboard` - Dashboard statistics (admin/staff)
- `GET /api/analytics/applications` - Application analytics
- `GET /api/analytics/users` - User analytics
- `POST /api/analytics/track` - Track event

## Database Management

### View Database
```bash
npm run prisma:studio
```

### Create Migration
```bash
npm run prisma:migrate
```

### Reset Database (⚠️ Deletes all data)
```bash
npx prisma migrate reset
```

## Project Structure

```
backend/
├── src/
│   ├── controllers/    # Route handlers
│   ├── routes/        # API route definitions
│   ├── middleware/    # Auth, validation, error handling
│   ├── services/      # Business logic (email, etc.)
│   ├── utils/         # Helper functions
│   └── server.js      # Express app entry point
├── prisma/
│   ├── schema.prisma  # Database schema
│   └── seed.js        # Database seed script
└── uploads/           # File uploads directory
```

## Environment Variables

See `.env.example` for all available environment variables.

## Production Deployment

1. Set `NODE_ENV=production`
2. Use a strong `JWT_SECRET`
3. Configure production database
4. Set up proper CORS origins
5. Configure email service
6. Use a process manager (PM2, etc.)
7. Set up reverse proxy (nginx)
8. Enable HTTPS

## Security Notes

- All passwords are hashed using bcrypt
- JWT tokens expire after 7 days (configurable)
- File uploads are validated by type and size
- SQL injection prevented by Prisma ORM
- CORS is configured for specific origins
- Input validation on all endpoints





