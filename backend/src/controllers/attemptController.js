const Assessment = require('../models/Assessment');
const Assignment = require('../models/Assignment');
const Attempt = require('../models/Attempt');
const ProctoringEvent = require('../models/ProctoringEvent');
const asyncHandler = require('../utils/asyncHandler');
const { scoreAttempt, stripCorrectAnswers } = require('../utils/scoring');

function remainingSeconds(endsAt) {
  return Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
}

async function getOwnedAttempt(attemptId, user) {
  const attempt = await Attempt.findById(attemptId);
  if (!attempt) {
    const err = new Error('Attempt not found');
    err.status = 404;
    throw err;
  }
  if (user.role === 'candidate' && String(attempt.candidate) !== String(user._id)) {
    const err = new Error('You cannot access another candidate’s attempt');
    err.status = 403;
    throw err;
  }
  return attempt;
}

const listMyAssignments = asyncHandler(async (req, res) => {
  const assignments = await Assignment.find({ candidate: req.user._id })
    .populate('assessment', 'title description durationMinutes isPublished questions')
    .sort({ createdAt: -1 });

  const attempts = await Attempt.find({ candidate: req.user._id }).select(
    'assignment status score maxScore startedAt endsAt submittedAt'
  );
  const attemptByAssignment = new Map(
    attempts.map((a) => [String(a.assignment), a])
  );

  const items = assignments
    .filter((a) => a.assessment && a.assessment.isPublished)
    .map((a) => {
      const attempt = attemptByAssignment.get(String(a._id));
      return {
        assignmentId: a._id,
        assessment: {
          id: a.assessment._id,
          title: a.assessment.title,
          description: a.assessment.description,
          durationMinutes: a.assessment.durationMinutes,
          questionCount: a.assessment.questions.length,
        },
        attempt: attempt
          ? {
              id: attempt._id,
              status: attempt.status,
              score: attempt.status === 'submitted' ? attempt.score : undefined,
              maxScore: attempt.status === 'submitted' ? attempt.maxScore : undefined,
              startedAt: attempt.startedAt,
              endsAt: attempt.endsAt,
              submittedAt: attempt.submittedAt,
              remainingSeconds:
                attempt.status === 'in_progress' ? remainingSeconds(attempt.endsAt) : 0,
            }
          : null,
      };
    });

  res.json({ assignments: items });
});

const startAttempt = asyncHandler(async (req, res) => {
  const { assignmentId } = req.body;
  if (!assignmentId) {
    return res.status(400).json({ message: 'assignmentId is required' });
  }

  const assignment = await Assignment.findById(assignmentId).populate('assessment');
  if (!assignment) {
    return res.status(404).json({ message: 'Assignment not found' });
  }
  if (String(assignment.candidate) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Not your assignment' });
  }
  if (!assignment.assessment || !assignment.assessment.isPublished) {
    return res.status(400).json({ message: 'Assessment is not available' });
  }

  const existing = await Attempt.findOne({ assignment: assignment._id });
  if (existing) {
    if (existing.status === 'submitted') {
      return res.status(409).json({ message: 'Assessment already submitted' });
    }
    // Resume path if they hit start again
    const assessmentSafe = stripCorrectAnswers(assignment.assessment);
    return res.json({
      attempt: serializeAttempt(existing, true),
      assessment: assessmentSafe,
      remainingSeconds: remainingSeconds(existing.endsAt),
      resumed: true,
    });
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + assignment.assessment.durationMinutes * 60 * 1000);

  let attempt;
  try {
    attempt = await Attempt.create({
      assessment: assignment.assessment._id,
      candidate: req.user._id,
      assignment: assignment._id,
      status: 'in_progress',
      startedAt,
      endsAt,
      answers: [],
    });
  } catch (err) {
    if (err.code === 11000) {
      const raced = await Attempt.findOne({ assignment: assignment._id });
      if (raced?.status === 'submitted') {
        return res.status(409).json({ message: 'Assessment already submitted' });
      }
      const assessmentSafe = stripCorrectAnswers(assignment.assessment);
      return res.json({
        attempt: serializeAttempt(raced, true),
        assessment: assessmentSafe,
        remainingSeconds: remainingSeconds(raced.endsAt),
        resumed: true,
      });
    }
    throw err;
  }

  res.status(201).json({
    attempt: serializeAttempt(attempt, true),
    assessment: stripCorrectAnswers(assignment.assessment),
    remainingSeconds: remainingSeconds(attempt.endsAt),
    resumed: false,
  });
});

const getAttempt = asyncHandler(async (req, res) => {
  const attempt = await getOwnedAttempt(req.params.id, req.user);
  const assessment = await Assessment.findById(attempt.assessment);
  if (!assessment) {
    return res.status(404).json({ message: 'Assessment not found' });
  }

  const forCandidate = req.user.role === 'candidate';
  const payload = {
    attempt: serializeAttempt(attempt, forCandidate),
    assessment: forCandidate ? stripCorrectAnswers(assessment) : assessment,
    remainingSeconds:
      attempt.status === 'in_progress' ? remainingSeconds(attempt.endsAt) : 0,
  };

  if (!forCandidate) {
    const events = await ProctoringEvent.find({ attempt: attempt._id }).sort({
      occurredAt: 1,
    });
    payload.proctoringEvents = events.map((e) => ({
      id: e._id,
      type: e.type,
      occurredAt: e.occurredAt,
      meta: e.meta,
    }));
  }

  res.json(payload);
});

const saveAnswers = asyncHandler(async (req, res) => {
  const attempt = await getOwnedAttempt(req.params.id, req.user);

  if (req.user.role !== 'candidate') {
    return res.status(403).json({ message: 'Only candidates can save answers' });
  }
  if (attempt.status === 'submitted') {
    return res.status(409).json({ message: 'Assessment already submitted' });
  }
  if (remainingSeconds(attempt.endsAt) <= 0) {
    return res.status(400).json({ message: 'Time has expired' });
  }

  const { answers } = req.body;
  if (!Array.isArray(answers)) {
    return res.status(400).json({ message: 'answers must be an array' });
  }

  const assessment = await Assessment.findById(attempt.assessment);
  const validIds = new Set(assessment.questions.map((q) => String(q._id)));

  const merged = new Map(
    attempt.answers.map((a) => [String(a.questionId), a.value])
  );
  for (const item of answers) {
    if (!item || !validIds.has(String(item.questionId))) continue;
    merged.set(String(item.questionId), item.value);
  }

  attempt.answers = [...merged.entries()].map(([questionId, value]) => ({
    questionId,
    value,
  }));
  await attempt.save();

  res.json({
    attempt: serializeAttempt(attempt, true),
    remainingSeconds: remainingSeconds(attempt.endsAt),
    savedAt: new Date().toISOString(),
  });
});

const getTimer = asyncHandler(async (req, res) => {
  const attempt = await getOwnedAttempt(req.params.id, req.user);
  res.json({
    status: attempt.status,
    endsAt: attempt.endsAt,
    remainingSeconds:
      attempt.status === 'in_progress' ? remainingSeconds(attempt.endsAt) : 0,
    serverTime: new Date().toISOString(),
  });
});

const submitAttempt = asyncHandler(async (req, res) => {
  const attempt = await getOwnedAttempt(req.params.id, req.user);

  if (req.user.role !== 'candidate') {
    return res.status(403).json({ message: 'Only candidates can submit' });
  }
  if (attempt.status === 'submitted') {
    return res.status(409).json({ message: 'Assessment already submitted' });
  }

  // Optional final answer merge before submit
  if (Array.isArray(req.body?.answers)) {
    const assessmentForMerge = await Assessment.findById(attempt.assessment);
    const validIds = new Set(assessmentForMerge.questions.map((q) => String(q._id)));
    const merged = new Map(attempt.answers.map((a) => [String(a.questionId), a.value]));
    for (const item of req.body.answers) {
      if (!item || !validIds.has(String(item.questionId))) continue;
      merged.set(String(item.questionId), item.value);
    }
    attempt.answers = [...merged.entries()].map(([questionId, value]) => ({
      questionId,
      value,
    }));
  }

  const assessment = await Assessment.findById(attempt.assessment);
  const { score, maxScore } = scoreAttempt(assessment, attempt.answers);

  // Atomic guard against duplicate submit
  const updated = await Attempt.findOneAndUpdate(
    { _id: attempt._id, status: 'in_progress' },
    {
      $set: {
        status: 'submitted',
        submittedAt: new Date(),
        answers: attempt.answers,
        score,
        maxScore,
      },
    },
    { new: true }
  );

  if (!updated) {
    return res.status(409).json({ message: 'Assessment already submitted' });
  }

  res.json({
    attempt: serializeAttempt(updated, true),
    score: updated.score,
    maxScore: updated.maxScore,
  });
});

const recordProctoringEvent = asyncHandler(async (req, res) => {
  const attempt = await getOwnedAttempt(req.params.id, req.user);

  if (req.user.role !== 'candidate') {
    return res.status(403).json({ message: 'Only candidates can report events' });
  }
  if (String(attempt.candidate) !== String(req.user._id)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (attempt.status !== 'in_progress') {
    return res.status(400).json({ message: 'Attempt is not in progress' });
  }

  const { type, meta, occurredAt } = req.body;
  if (!ProctoringEvent.EVENT_TYPES.includes(type)) {
    return res.status(400).json({ message: 'Invalid event type' });
  }

  const assessment = await Assessment.findById(attempt.assessment);
  const rules = assessment.proctoringRules || {};
  const ruleMap = {
    tab_switch: rules.captureTabSwitch,
    window_blur: rules.captureWindowBlur,
    fullscreen_exit: rules.captureFullscreenExit,
    copy_attempt: rules.captureCopy,
    paste_attempt: rules.capturePaste,
    right_click_attempt: rules.captureRightClick,
  };
  if (ruleMap[type] === false) {
    return res.status(200).json({ ignored: true });
  }

  const event = await ProctoringEvent.create({
    attempt: attempt._id,
    candidate: req.user._id,
    type,
    occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
    meta: meta || {},
  });

  res.status(201).json({
    event: {
      id: event._id,
      type: event.type,
      occurredAt: event.occurredAt,
    },
  });
});

function serializeAttempt(attempt, forCandidate) {
  const base = {
    id: attempt._id,
    assessmentId: attempt.assessment,
    candidateId: attempt.candidate,
    assignmentId: attempt.assignment,
    status: attempt.status,
    startedAt: attempt.startedAt,
    endsAt: attempt.endsAt,
    submittedAt: attempt.submittedAt,
    answers: attempt.answers,
  };
  if (!forCandidate || attempt.status === 'submitted') {
    base.score = attempt.score;
    base.maxScore = attempt.maxScore;
  }
  return base;
}

module.exports = {
  listMyAssignments,
  startAttempt,
  getAttempt,
  saveAnswers,
  getTimer,
  submitAttempt,
  recordProctoringEvent,
};
