import 'dotenv/config';
import http from 'http';
import app from './app';
import { initSocket } from './config/socket';
import { startReminderJob } from './jobs/reminderJob';
const PORT = parseInt(process.env.PORT || '5000', 10);
const httpServer = http.createServer(app);
initSocket(httpServer);
if (process.env.NODE_ENV !== 'test') startReminderJob();
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});
process.on('SIGTERM', () => { httpServer.close(() => process.exit(0)); });
