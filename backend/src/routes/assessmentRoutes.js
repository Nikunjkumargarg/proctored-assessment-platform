const express = require('express');
const ctrl = require('../controllers/assessmentController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('admin'));

router.get('/', ctrl.listAssessments);
router.post('/', ctrl.createAssessment);
router.get('/:id', ctrl.getAssessment);
router.patch('/:id', ctrl.updateAssessment);
router.post('/:id/questions', ctrl.addQuestion);
router.patch('/:id/questions/:questionId', ctrl.updateQuestion);
router.delete('/:id/questions/:questionId', ctrl.deleteQuestion);
router.post('/:id/assign', ctrl.assignAssessment);
router.get('/:id/assignments', ctrl.listAssignments);
router.get('/:id/submissions', ctrl.listSubmissions);

module.exports = router;
