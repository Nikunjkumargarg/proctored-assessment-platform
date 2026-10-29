const express = require('express');
const { listCandidates } = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requireRole('admin'));
router.get('/candidates', listCandidates);

module.exports = router;
