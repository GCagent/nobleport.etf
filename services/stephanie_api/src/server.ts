import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import intakeRouter from './routes/intake';
import proposalsRouter from './routes/proposals';
import webhooksRouter from './routes/webhooks';
import { createSessionRouter } from './routes/session';
import { createPaymentRouter } from './routes/payment';
import { createGateRouter } from './gates/launch';
import { requestLogger } from './middleware/logger';
import { requestIdMiddleware } from './middleware/requestId';
import { killSwitchMiddleware } from './middleware/killSwitch';
import { AuditChain } from './audit/chain';
import { PaymentGateway } from './payments/gateway';
import { attachWebSocket } from './voice/websocket';

const app = express();
const PORT = parseInt(process.env.API_PORT ?? '8000', 10);
const HOST = process.env.API_HOST ?? '0.0.0.0';

const audit = new AuditChain();
const paymentGateway = new PaymentGateway(audit);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(requestIdMiddleware);
app.use(requestLogger);
app.use(killSwitchMiddleware);

// Health/ready/gates (no auth required)
app.use(createGateRouter(audit));

// Session & message (conversation API)
app.use(createSessionRouter(audit));

// Payment gateway
app.use(createPaymentRouter(paymentGateway));

// Business routes
app.use(intakeRouter);
app.use(proposalsRouter);
app.use(webhooksRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const server = createServer(app);
attachWebSocket(server, audit);

server.listen(PORT, HOST, () => {
  console.log(`Stephanie API listening on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.APP_ENV ?? 'development'}`);
  console.log(`WebSocket: ws://${HOST}:${PORT}/ws/voice`);
  console.log(`Payment methods: ${paymentGateway.getEnabledMethods().join(', ') || 'none (configure API keys)'}`);
});

process.on('SIGTERM', async () => {
  console.log('[Shutdown] SIGTERM received, flushing audit chain...');
  await audit.shutdown();
  server.close();
  process.exit(0);
});

export default app;
