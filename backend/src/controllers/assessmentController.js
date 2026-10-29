const Assessment = require('../models/Assessment');
const Assignment = require('../models/Assignment');
const Attempt = require('../models/Attempt');
const asyncHandler = require('../utils/asyncHandler');

const listAssessments = asyncHandler(async (req, res) => {
  const assessments = await Assessment.find()
    .sort({ createdAt: -1 })
    .select('-questions.correctAnswers');

  res.json({
    assessments: assessments.map((a) => ({
      id: a._id,
      title: a.title,
      description: a.description,
      durationMinutes: a.durationMinutes,
      questionCount: a.questions.length,
      isPublished: a.isPublished,
      createdAt: a.createdAt,
    })),
  });
});

const getAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment) {
    return res.status(404).json({ message: 'Assessment not found' });
  }

  res.json({ assessment });
});

const createAssessment = asyncHandler(async (req, res) => {
  const { title, description, durationMinutes, proctoringRules, isPublished } = req.body;
  if (!title || !durationMinutes) {
    return res.status(400).json({ message: 'Title and durationMinutes are required' });
  }

  const assessment = await Assessment.create({
    title,
    description: description || '',
    durationMinutes,
    createdBy: req.user._id,
    isPublished: Boolean(isPublished),
    proctoringRules: proctoringRules || undefined,
  });

  res.status(201).json({ assessment });
});

const updateAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment) {
    return res.status(404).json({ message: 'Assessment not found' });
  }

  const { title, description, durationMinutes, proctoringRules, isPublished } = req.body;
  if (title !== undefined) assessment.title = title;
  if (description !== undefined) assessment.description = description;
  if (durationMinutes !== undefined) {
    const mins = Number(durationMinutes);
    if (!Number.isFinite(mins) || mins < 1) {
      return res.status(400).json({ message: 'durationMinutes must be a number >= 1' });
    }
    assessment.durationMinutes = mins;
  }
  if (proctoringRules !== undefined && typeof proctoringRules === 'object') {
    const current =
      assessment.proctoringRules && typeof assessment.proctoringRules.toObject === 'function'
        ? assessment.proctoringRules.toObject()
        : { ...(assessment.proctoringRules || {}) };
    const next = { ...current };
    for (const key of [
      'captureTabSwitch',
      'captureWindowBlur',
      'captureFullscreenExit',
      'captureCopy',
      'capturePaste',
      'captureRightClick',
    ]) {
      if (proctoringRules[key] !== undefined) {
        next[key] = Boolean(proctoringRules[key]);
      }
    }
    assessment.proctoringRules = next;
    assessment.markModified('proctoringRules');
  }
  if (isPublished !== undefined) assessment.isPublished = Boolean(isPublished);

  await assessment.save();
  res.json({ assessment });
});


const addQuestion = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment) {
    return res.status(404).json({ message: 'Assessment not found' });
  }

  const { text, type, options, correctAnswers, points } = req.body;
  if (!text || !type) {
    return res.status(400).json({ message: 'Question text and type are required' });
  }
  if (!['single_choice', 'multiple_choice', 'short_answer'].includes(type)) {
    return res.status(400).json({ message: 'Invalid question type' });
  }
  if (type !== 'short_answer' && (!options || options.length < 2)) {
    return res.status(400).json({ message: 'Choice questions need at least 2 options' });
  }
  if (type !== 'short_answer' && (!correctAnswers || correctAnswers.length === 0)) {
    return res.status(400).json({ message: 'Correct answers are required for objective questions' });
  }

  assessment.questions.push({
    text,
    type,
    options: options || [],
    correctAnswers: correctAnswers || [],
    points: points ?? 1,
  });
  await assessment.save();

  res.status(201).json({ assessment });
});

const updateQuestion = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment) {
    return res.status(404).json({ message: 'Assessment not found' });
  }

  const question = assessment.questions.id(req.params.questionId);
  if (!question) {
    return res.status(404).json({ message: 'Question not found' });
  }

  const { text, type, options, correctAnswers, points } = req.body;
  if (text !== undefined) question.text = text;
  if (type !== undefined) question.type = type;
  if (options !== undefined) question.options = options;
  if (correctAnswers !== undefined) question.correctAnswers = correctAnswers;
  if (points !== undefined) question.points = points;

  await assessment.save();
  res.json({ assessment });
});

const deleteQuestion = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment) {
    return res.status(404).json({ message: 'Assessment not found' });
  }

  const question = assessment.questions.id(req.params.questionId);
  if (!question) {
    return res.status(404).json({ message: 'Question not found' });
  }

  question.deleteOne();
  await assessment.save();
  res.json({ assessment });
});

const assignAssessment = asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id);
  if (!assessment) {
    return res.status(404).json({ message: 'Assessment not found' });
  }

  const { candidateIds } = req.body;
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    return res.status(400).json({ message: 'candidateIds array is required' });
  }

  const results = [];
  for (const candidateId of candidateIds) {
    try {
      const assignment = await Assignment.findOneAndUpdate(
        { assessment: assessment._id, candidate: candidateId },
        {
          $setOnInsert: {
            assessment: assessment._id,
            candidate: candidateId,
            assignedBy: req.user._id,
          },
        },
        { upsert: true, new: true }
      );
      results.push({ candidateId, assignmentId: assignment._id, status: 'assigned' });
    } catch (err) {
      results.push({ candidateId, status: 'error', message: err.message });
    }
  }

  res.status(201).json({ results });
});

const listAssignments = asyncHandler(async (req, res) => {
  const assignments = await Assignment.find({ assessment: req.params.id })
    .populate('candidate', 'name email')
    .sort({ createdAt: -1 });

  res.json({
    assignments: assignments.map((a) => ({
      id: a._id,
      candidate: a.candidate
        ? { id: a.candidate._id, name: a.candidate.name, email: a.candidate.email }
        : null,
      assignedAt: a.createdAt,
    })),
  });
});

const listSubmissions = asyncHandler(async (req, res) => {
  const attempts = await Attempt.find({ assessment: req.params.id })
    .populate('candidate', 'name email')
    .sort({ submittedAt: -1, createdAt: -1 });

  res.json({
    submissions: attempts.map((a) => ({
      id: a._id,
      candidate: a.candidate
        ? { id: a.candidate._id, name: a.candidate.name, email: a.candidate.email }
        : null,
      status: a.status,
      score: a.score,
      maxScore: a.maxScore,
      startedAt: a.startedAt,
      endsAt: a.endsAt,
      submittedAt: a.submittedAt,
    })),
  });
});

module.exports = {
  listAssessments,
  getAssessment,
  createAssessment,
  updateAssessment,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  assignAssessment,
  listAssignments,
  listSubmissions,
};
