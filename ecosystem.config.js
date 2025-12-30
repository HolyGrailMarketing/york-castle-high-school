/**
 * PM2 Ecosystem Configuration
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop ecosystem.config.js
 *   pm2 restart ecosystem.config.js
 *   pm2 delete ecosystem.config.js
 * 
 * Monitor:
 *   pm2 monit
 *   pm2 logs
 */

export default {
  apps: [
    {
      name: 'york-castle-api',
      script: './backend/src/server.js',
      instances: process.env.NODE_ENV === 'production' ? 2 : 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      // Logging
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Restart policy
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      
      // Watch (development only)
      watch: process.env.NODE_ENV === 'development',
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log',
        '.git',
        'uploads',
      ],
      
      // Advanced
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,
      
      // Source map support
      source_map_support: true,
    },
  ],
};





