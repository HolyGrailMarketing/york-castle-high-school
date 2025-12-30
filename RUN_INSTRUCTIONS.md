# How to Run the Application

## Quick Start (Recommended)

Run the start script:
```bash
./start.sh
```

This will:
1. Check for Node.js
2. Install dependencies if needed
3. Set up database if needed
4. Start both backend and frontend servers

## Manual Start

### Step 1: Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd admin-dashboard
npm install
```

### Step 2: Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set your database connection:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/yorkcastle
JWT_SECRET=your-strong-secret-key-here
```

### Step 3: Set Up Database

```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed database (creates admin user)
npm run prisma:seed
```

### Step 4: Start Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd admin-dashboard
npm run dev
```

## Access the Application

- **Admin Dashboard**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Documentation**: http://localhost:3000/api-docs

## Default Login

- **Email**: `admin@yorkcastle.edu.jm`
- **Password**: `admin123`

## Troubleshooting

### npm install fails with permission errors

Try:
```bash
sudo npm install
```

Or use a node version manager (nvm):
```bash
nvm install 18
nvm use 18
npm install
```

### Database connection error

1. Ensure PostgreSQL is running:
   ```bash
   pg_isready
   ```

2. Create the database:
   ```bash
   psql -U postgres
   CREATE DATABASE yorkcastle;
   \q
   ```

3. Update `DATABASE_URL` in `backend/.env`

### Port already in use

- Backend: Change `PORT` in `backend/.env`
- Frontend: Edit `admin-dashboard/vite.config.ts`

### CORS errors

Ensure `CORS_ORIGIN` in `backend/.env` matches frontend URL (http://localhost:5173)





