const mongoose = require('mongoose');

const EVENT_TYPES = [
  'tab_switch',
  'window_blur',
  'fullscreen_exit',
  'copy_attempt',
  'paste_attempt',
  'right_click_attempt',
];

const proctoringEventSchema = new mongoose.Schema(
  {
    attempt: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attempt',
      required: true,
      index: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: EVENT_TYPES,
      required: true,
    },
    occurredAt: { type: Date, default: Date.now },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProctoringEvent', proctoringEventSchema);
module.exports.EVENT_TYPES = EVENT_TYPES;
