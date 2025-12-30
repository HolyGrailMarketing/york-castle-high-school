# Quick Start Guide

Get the application running in 5 minutes!

## Prerequisites Check

- ✅ Node.js installed (`node --version`)
- ✅ PostgreSQL installed and running (`pg_isready`)
- ✅ Database created (`psql -U postgres -c "CREATE DATABASE yorkcastle;"`)

## Step-by-Step Setup

### 1. Install Dependencies (2 minutes)

```bash
# From project root
npm run setup
```

This installs dependencies for both backend and frontend.

### 2. Configure Backend (1 minute)

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/yorkcastle
JWT_SECRET=change-this-to-a-random-secret-key
```

### 3. Set Up Database (1 minute)

```bash
cd backend
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 4. Start Application (1 minute)

**Option A: Run both together**
```bash
# From project root
npm run dev
```

**Option B: Run separately**
```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd admin-dashboard && npm run dev
```

### 5. Access Application

- **Admin Dashboard**: http://localhost:5173
- **API**: http://localhost:3000
- **API Docs**: http://localhost:3000/api-docs

### 6. Login

- **Email**: `admin@yorkcastle.edu.jm`
- **Password**: `admin123`

## That's It! 🎉

You should now have:
- ✅ Backend API running
- ✅ Admin dashboard accessible
- ✅ Database seeded with sample data
- ✅ Default admin account ready

## Next Steps

1. **Change admin password** (Users → Admin → Edit)
2. **Add courses** (Courses → New Course)
3. **Test form submission** (Visit application-form.html)
4. **Explore features** (Check all dashboard sections)

## Troubleshooting

**Database connection error?**
- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `.env`
- Ensure database exists

**Port already in use?**
- Backend: Change `PORT` in `backend/.env`
- Frontend: Edit `admin-dashboard/vite.config.ts`

**CORS errors?**
- Ensure `CORS_ORIGIN` in `backend/.env` matches frontend URL (http://localhost:5173)

For more details, see [SETUP.md](SETUP.md)





