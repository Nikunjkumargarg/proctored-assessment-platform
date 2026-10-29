const express = require('express');
const ctrl = require('../controllers/attemptController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/mine', requireRole('candidate'), ctrl.listMyAssignments);
router.post('/start', requireRole('candidate'), ctrl.startAttempt);
router.get('/:id', ctrl.getAttempt);
router.put('/:id/answers', requireRole('candidate'), ctrl.saveAnswers);
router.get('/:id/timer', ctrl.getTimer);
router.post('/:id/submit', requireRole('candidate'), ctrl.submitAttempt);
router.post('/:id/proctoring-events', requireRole('candidate'), ctrl.recordProctoringEvent);

module.exports = router;
