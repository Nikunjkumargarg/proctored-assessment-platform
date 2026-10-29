const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    text: { type: String, required: true },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    type: {
      type: String,
      enum: ['single_choice', 'multiple_choice', 'short_answer'],
      required: true,
    },
    options: { type: [optionSchema], default: [] },
    // For single_choice: one key. For multiple_choice: array of keys. Short answer: unused for scoring.
    correctAnswers: { type: [String], default: [] },
    points: { type: Number, default: 1, min: 0 },
  },
  { timestamps: true }
);

const assessmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    durationMinutes: { type: Number, required: true, min: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    questions: { type: [questionSchema], default: [] },
    isPublished: { type: Boolean, default: false },
    proctoringRules: {
      captureTabSwitch: { type: Boolean, default: true },
      captureWindowBlur: { type: Boolean, default: true },
      captureFullscreenExit: { type: Boolean, default: true },
      captureCopy: { type: Boolean, default: true },
      capturePaste: { type: Boolean, default: true },
      captureRightClick: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Assessment', assessmentSchema);
