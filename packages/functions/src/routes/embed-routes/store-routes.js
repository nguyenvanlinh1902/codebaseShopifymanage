import {Router} from 'express';

const router = new Router();

// Get current store info
router.get('/', (req, res) => {
  if (!req.store) {
    return res.status(404).json({success: false, error: 'Store not found'});
  }
  return res.json({
    success: true,
    data: {
      id: req.store.id,
      name: req.store.name,
      shopDomain: req.store.shopDomain,
      email: req.store.email,
      status: req.store.status
    }
  });
});

export default router;
