const DEFAULT_USER_ID = 'demo-user';

export function injectUserId(req, res, next) {
  req.userId = req.query?.userId || req.body?.userId || DEFAULT_USER_ID;
  next();
}
