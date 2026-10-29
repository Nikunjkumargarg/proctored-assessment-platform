const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // single_choice: string key; multiple_choice: string[]; short_answer: string
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
);

const attemptSchema = new mongoose.Schema(
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
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'submitted'],
      default: 'in_progress',
    },
    startedAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    submittedAt: { type: Date },
    answers: { type: [answerSchema], default: [] },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// One attempt document per assignment (prevents duplicate starts / submissions race via unique index + status checks)
attemptSchema.index({ assignment: 1 }, { unique: true });
attemptSchema.index({ candidate: 1, assessment: 1 });

module.exports = mongoose.model('Attempt', attemptSchema);
