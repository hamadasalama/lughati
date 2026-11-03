import { Router } from 'express';
import * as c from '../controllers/auth';
import { requireAuth } from '../middleware/auth';

const r = Router();
r.post('/login', c.login);
r.post('/logout', c.logout);
r.get('/me', requireAuth, c.me);
r.post('/change-password', requireAuth, c.changePassword);
export default r;
