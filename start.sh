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

# Build frontend for single server deployment
if [ ! -d "admin-dashboard/dist" ]; then
    echo "🏗️  Building admin dashboard..."
    cd admin-dashboard
    npm run build
    cd ..
    echo "✅ Admin dashboard built"
    echo ""
fi

echo "🎯 Starting server..."
echo ""
echo "Server will run on: http://localhost:3000"
echo "  - Homepage: http://localhost:3000/"
echo "  - Admin Dashboard: http://localhost:3000/admin"
echo "  - API: http://localhost:3000/api"
echo "  - API Docs: http://localhost:3000/api-docs"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start backend server (which serves everything)
cd backend && npm run dev





