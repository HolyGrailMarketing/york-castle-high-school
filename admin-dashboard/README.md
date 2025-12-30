# York Castle High School - Admin Dashboard

React TypeScript admin dashboard for managing York Castle High School operations.

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

   The dashboard will be available at `http://localhost:5173`

3. **Build for Production**
   ```bash
   npm run build
   ```

   The built files will be in the `dist/` directory.

## Configuration

The dashboard connects to the backend API. By default, it expects the API at `http://localhost:3000`.

To change the API URL, create a `.env` file:
```
VITE_API_URL=http://your-api-url/api
```

## Features

- **Dashboard Overview** - Statistics and recent activity
- **Application Management** - Review and manage student applications
- **User Management** - Manage users and roles
- **Content Management** - Blog posts and events
- **Course Management** - Courses and enrollments
- **Document Library** - Upload and manage documents
- **Request Management** - Handle various requests
- **Analytics** - Reports and statistics

## Project Structure

```
admin-dashboard/
├── src/
│   ├── components/    # Reusable React components
│   ├── pages/         # Dashboard pages
│   ├── contexts/      # React contexts (Auth)
│   ├── services/      # API client
│   ├── types/         # TypeScript types
│   └── App.tsx        # Main app component
└── public/            # Static assets
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Authentication

The dashboard uses JWT tokens stored in localStorage. Tokens are automatically included in API requests.

## Production Deployment

1. Build the application: `npm run build`
2. Serve the `dist/` directory using a web server (nginx, Apache, etc.)
3. Configure the API URL in environment variables
4. Ensure CORS is properly configured on the backend

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)





