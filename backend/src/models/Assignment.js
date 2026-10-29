const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

assignmentSchema.index({ assessment: 1, candidate: 1 }, { unique: true });

module.exports = mongoose.model('Assignment', assignmentSchema);
