// src/routes/aiRoutes.ts
import { Router } from 'express';
import { getPackingTipsController } from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

// Protegemos a rota com nosso middleware de autenticação
router.post('/packing-tips', authenticateToken, getPackingTipsController);

export default router;