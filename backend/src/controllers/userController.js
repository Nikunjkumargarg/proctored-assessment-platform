const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');

const listCandidates = asyncHandler(async (req, res) => {
  const candidates = await User.find({ role: 'candidate' })
    .select('name email role createdAt')
    .sort({ name: 1 });

  res.json({
    candidates: candidates.map((c) => ({
      id: c._id,
      name: c.name,
      email: c.email,
      role: c.role,
    })),
  });
});

module.exports = { listCandidates };
