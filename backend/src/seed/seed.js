require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const config = require('../config');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const Assignment = require('../models/Assignment');
const Attempt = require('../models/Attempt');
const ProctoringEvent = require('../models/ProctoringEvent');

async function seed() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected. Clearing collections...');

  await Promise.all([
    User.deleteMany({}),
    Assessment.deleteMany({}),
    Assignment.deleteMany({}),
    Attempt.deleteMany({}),
    ProctoringEvent.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@example.com',
    passwordHash,
    role: 'admin',
  });

  const [c1, c2] = await User.create([
    {
      name: 'Alice Candidate',
      email: 'alice@example.com',
      passwordHash,
      role: 'candidate',
    },
    {
      name: 'Bob Candidate',
      email: 'bob@example.com',
      passwordHash,
      role: 'candidate',
    },
  ]);

  const assessment = await Assessment.create({
    title: 'JavaScript Fundamentals',
    description: 'Short assessment covering JS basics. Duration includes proctoring checks.',
    durationMinutes: 30,
    createdBy: admin._id,
    isPublished: true,
    proctoringRules: {
      captureTabSwitch: true,
      captureWindowBlur: true,
      captureFullscreenExit: true,
      captureCopy: true,
      capturePaste: true,
      captureRightClick: true,
    },
    questions: [
      {
        text: 'Which keyword declares a block-scoped variable in JavaScript?',
        type: 'single_choice',
        options: [
          { key: 'A', text: 'var' },
          { key: 'B', text: 'let' },
          { key: 'C', text: 'function' },
          { key: 'D', text: 'define' },
        ],
        correctAnswers: ['B'],
        points: 2,
      },
      {
        text: 'Which of the following are falsy values in JavaScript?',
        type: 'multiple_choice',
        options: [
          { key: 'A', text: '0' },
          { key: 'B', text: '"" (empty string)' },
          { key: 'C', text: '{} (empty object)' },
          { key: 'D', text: 'null' },
        ],
        correctAnswers: ['A', 'B', 'D'],
        points: 3,
      },
      {
        text: 'What does JSON stand for?',
        type: 'short_answer',
        options: [],
        correctAnswers: [],
        points: 1,
      },
    ],
  });

  await Assignment.create([
    { assessment: assessment._id, candidate: c1._id, assignedBy: admin._id },
    { assessment: assessment._id, candidate: c2._id, assignedBy: admin._id },
  ]);

  console.log('Seed complete.\n');
  console.log('Sample credentials (password for all: Password123!)');
  console.log('  Admin:     admin@example.com');
  console.log('  Candidate: alice@example.com');
  console.log('  Candidate: bob@example.com');
  console.log(`  Assessment: ${assessment.title} (${assessment._id})`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
