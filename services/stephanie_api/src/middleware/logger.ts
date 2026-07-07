import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const entry = {
      ts: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
      requestId: req.requestId ?? '-',
      ip: req.ip ?? req.socket.remoteAddress,
    };
    if (process.env.APP_ENV === 'production') {
      process.stdout.write(JSON.stringify(entry) + '\n');
    } else {
      console.log(`${entry.method} ${entry.path} ${entry.status} ${entry.ms}ms [${entry.requestId}]`);
    }
  });
  next();
}
