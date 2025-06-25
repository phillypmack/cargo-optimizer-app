// src/routes/aiRoutes.ts
import { Router } from 'express';
import { getPackingTipsController } from '../controllers/aiController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Protegemos a rota com nosso middleware de autenticação
router.post('/packing-tips', authenticateToken, getPackingTipsController);

export default router;