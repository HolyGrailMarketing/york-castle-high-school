#!/bin/bash

# York Castle High School - Start Script
# This script helps start the application

echo "🚀 Starting York Castle High School Application..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Check if dependencies are installed
if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend
    npm install
    cd ..
    echo ""
fi

if [ ! -d "admin-dashboard/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd admin-dashboard
    npm install
    cd ..
    echo ""
fi

# Check if .env exists
if [ ! -f "backend/.env" ]; then
    echo "⚙️  Creating .env file from template..."
    cp backend/.env.example backend/.env
    echo "⚠️  Please edit backend/.env and configure your database connection!"
    echo ""
fi

# Check if database is set up
if [ ! -d "backend/prisma/migrations" ]; then
    echo "🗄️  Setting up database..."
    cd backend
    npm run prisma:generate
    npm run prisma:migrate
    npm run prisma:seed
    cd ..
    echo ""
fi

echo "🎯 Starting servers..."
echo ""
echo "Backend will run on: http://localhost:3000"
echo "Admin Dashboard will run on: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Start both servers
cd backend && npm run dev &
BACKEND_PID=$!

cd ../admin-dashboard && npm run dev &
FRONTEND_PID=$!

# Wait for user interrupt
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM

wait





