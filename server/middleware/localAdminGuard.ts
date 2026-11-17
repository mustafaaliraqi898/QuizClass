import type { NextFunction, Request, Response } from 'express';

const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  return LOOPBACK_IPS.has(address);
}

function isTrustedCloudPreviewRequest(req: Request): boolean {
  // In Cloud Run / AI Studio preview, traffic arrives through the managed HTTPS ingress proxy
  const appUrl = process.env.APP_URL;
  const isCloudRun = Boolean(process.env.K_SERVICE || (appUrl && appUrl.startsWith('https://')));
  if (!isCloudRun) {
    return false;
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const hostHeader = req.headers.host;
  if (forwardedProto !== 'https' || !hostHeader) {
    return false;
  }

  if (appUrl) {
    try {
      const expectedHost = new URL(appUrl).host;
      if (hostHeader === expectedHost) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return hostHeader.endsWith('.run.app');
}

/**
 * يحمي عمليات إدارة بنك الأسئلة من أي وصول مباشر عبر أجهزة الشبكة المحلية،
 * ويسمح فقط بالاتصال المحلي (Loopback) من جهاز المعلم أو بيئة المعاينة السحابية المعتمدة.
 */
export function localAdminGuard(req: Request, res: Response, next: NextFunction): void {
  if (process.env.QUIZCLASS_ALLOW_REMOTE_ADMIN === 'true') {
    next();
    return;
  }

  const remoteAddress = req.socket.remoteAddress;
  if (isLoopbackAddress(remoteAddress) || isTrustedCloudPreviewRequest(req)) {
    next();
    return;
  }

  res.status(403).json({
    error: 'غير مصرح بتنفيذ عمليات الإدارة من أجهزة الشبكة الأخرى.',
  });
}
