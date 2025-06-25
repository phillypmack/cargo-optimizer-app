// src/routes/aiRoutes.ts
import { Router } from 'express';
import { getPackingTipsController } from '../controllers/aiController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = Router();

// Rota protegida para obter dicas de empacotamento
// CORREÇÃO: Passando o middleware e o controlador como argumentos separados
router.post('/packing-tips', authenticateToken, getPackingTipsController);

export default router;