import { Router } from 'express';
import * as derivController from '../controllers/deriv.controller.js';

const router = Router();

router.post('/connect', derivController.connect);
router.get('/account', derivController.getAccount);
router.get('/symbols', derivController.getSymbols);
router.get('/tick/:symbol', derivController.getTick);
router.get('/positions', derivController.getPositions);
router.get('/contract/:contractId', derivController.getContractStatus);
router.post('/test-buy', derivController.testBuy);
router.post('/close-trade', derivController.closeTrade);

export default router;
