# Testing Checklist - York Castle High School Application

## Pre-Deployment Testing

### 1. Environment Setup
- [ ] Copy `.env.example` to `.env` with test values
- [ ] Ensure all required environment variables are set
- [ ] Run environment validation: `npm run db:test`

### 2. Database Setup
- [ ] Run database migrations: `npm run db:migrate`
- [ ] Seed database: `npm run db:seed`
- [ ] Verify database connection and data integrity

### 3. Build Testing
- [ ] Build admin dashboard: `npm run build:production`
- [ ] Verify admin dashboard build exists: `ls admin-dashboard/dist/`
- [ ] Build completes without errors

### 4. Server Startup
- [ ] Start server: `npm run start:production`
- [ ] Server starts without errors
- [ ] Health check endpoint works: `curl http://localhost:3000/health`
- [ ] API documentation accessible: `http://localhost:3000/api-docs`

## API Endpoint Testing

### Authentication Endpoints
- [ ] `POST /api/auth/register` - User registration with validation
- [ ] `POST /api/auth/login` - User login
- [ ] `GET /api/auth/me` - Get current user (authenticated)
- [ ] `POST /api/auth/logout` - User logout

### Applications Endpoints
- [ ] `GET /api/applications` - List applications (admin/staff)
- [ ] `POST /api/applications` - Submit application (public)
- [ ] `GET /api/applications/:id` - Get application details
- [ ] `PUT /api/applications/:id/status` - Update application status

### Sixth Form Endpoints
- [ ] `GET /api/sixth-form` - List sixth form applications
- [ ] `POST /api/sixth-form` - Submit sixth form application
- [ ] `GET /api/sixth-form/:id` - Get sixth form application
- [ ] `PUT /api/sixth-form/:id/status` - Update sixth form status

### Content Endpoints
- [ ] `GET /api/blog` - List blog posts
- [ ] `GET /api/blog/:id` - Get blog post
- [ ] `POST /api/blog` - Create blog post (admin/staff)
- [ ] `GET /api/events` - List events
- [ ] `GET /api/events/:id` - Get event
- [ ] `POST /api/events` - Create event (admin/staff)

### User Management
- [ ] `GET /api/users` - List users (admin/staff)
- [ ] `POST /api/users` - Create user (admin)
- [ ] `PUT /api/users/:id` - Update user
- [ ] `DELETE /api/users/:id` - Delete user

### Courses & Enrollment
- [ ] `GET /api/courses` - List courses
- [ ] `POST /api/courses` - Create course (admin/staff)
- [ ] `POST /api/courses/:id/enroll` - Enroll in course

## Security Testing

### Rate Limiting
- [ ] Authentication endpoints: 3 requests per 15 minutes in production
- [ ] Public submission endpoints: 3 requests per hour in production
- [ ] Admin endpoints: 30 requests per 15 minutes in production
- [ ] Verify rate limit headers are present

### Input Validation
- [ ] SQL injection attempts are blocked
- [ ] XSS attempts are sanitized
- [ ] File upload validation (type, size, name)
- [ ] Email format validation
- [ ] Password strength requirements

### Authentication & Authorization
- [ ] Protected routes require authentication
- [ ] Role-based access control works
- [ ] JWT tokens are validated
- [ ] Session management works properly

## Performance Testing

### Caching
- [ ] Response caching headers are set correctly
- [ ] Cache invalidation works when data changes
- [ ] Static content has appropriate cache headers

### Database Queries
- [ ] Queries use proper SELECT clauses
- [ ] No N+1 query issues
- [ ] Pagination works correctly
- [ ] Search functionality performs well

### Response Times
- [ ] API responses under 200ms
- [ ] Database queries under 100ms
- [ ] Page loads under 2 seconds

## File Upload Testing

### Upload Functionality
- [ ] File upload to `/api/documents` works
- [ ] File validation (MIME type, size, filename)
- [ ] Files are stored correctly
- [ ] Download functionality works

### Security
- [ ] Path traversal attacks prevented
- [ ] Malicious file types rejected
- [ ] File size limits enforced

## Frontend Integration

### Admin Dashboard
- [ ] Dashboard loads at `/admin`
- [ ] Authentication works
- [ ] All admin features work
- [ ] Responsive design

### Static Pages
- [ ] Homepage loads at `/`
- [ ] Application forms work
- [ ] API integration functions
- [ ] Form validation works

## Vercel Deployment Testing

### Deployment
- [ ] Vercel deployment succeeds
- [ ] Build process completes
- [ ] Environment variables are set correctly
- [ ] Database connection works in production

### Runtime Testing
- [ ] Cold start time under 5 seconds
- [ ] All API endpoints work
- [ ] File uploads work in serverless
- [ ] Caching works correctly
- [ ] Rate limiting functions

### Monitoring
- [ ] Logs are accessible
- [ ] Error tracking works
- [ ] Performance monitoring active
- [ ] Health checks pass

## Load Testing

### Basic Load Test
- [ ] 10 concurrent users
- [ ] Response times remain acceptable
- [ ] No memory leaks
- [ ] Database connections stable

### Stress Testing
- [ ] Rate limiting activates correctly
- [ ] Error handling works under load
- [ ] Recovery from failures

## Security Audit

### Final Security Check
- [ ] No sensitive data in logs
- [ ] HTTPS enabled
- [ ] CORS properly configured
- [ ] Security headers present
- [ ] Input validation comprehensive
- [ ] Authentication secure

## Post-Deployment Verification

### Production Environment
- [ ] All features work in production
- [ ] Performance meets requirements
- [ ] Security measures active
- [ ] Monitoring and logging functional
- [ ] Backup procedures in place

### User Acceptance
- [ ] Admin users can manage content
- [ ] Public users can submit applications
- [ ] Email notifications work
- [ ] File downloads work
- [ ] Search functionality works

## Rollback Plan

### If Issues Found
- [ ] Database backup available
- [ ] Previous deployment accessible
- [ ] Rollback procedure documented
- [ ] Emergency contact information

## Success Criteria

✅ All API endpoints return correct responses
✅ Authentication and authorization work
✅ File uploads and downloads function
✅ Performance requirements met
✅ Security measures active
✅ Vercel deployment successful
✅ Monitoring and logging functional
✅ No critical errors in logs
✅ User acceptance criteria met

## Testing Commands

```bash
# Health check
curl http://localhost:3000/health

# Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yorkcastle.edu.jm","password":"admin123"}'

# Test rate limiting
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test"}'
done

# Test API endpoints
curl http://localhost:3000/api/courses
curl http://localhost:3000/api/blog
curl http://localhost:3000/api/events

# Test file upload
curl -X POST http://localhost:3000/api/documents \
  -F "file=@test.pdf" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Common Issues & Solutions

### Database Connection Issues
- Check DATABASE_URL format
- Verify Supabase project is active
- Check IP restrictions

### Vercel Deployment Issues
- Verify vercel.json configuration
- Check build logs
- Ensure environment variables are set

### Performance Issues
- Check database query optimization
- Verify caching is working
- Monitor memory usage

### Security Issues
- Review rate limiting configuration
- Check input validation
- Verify authentication flow