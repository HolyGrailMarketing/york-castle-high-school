import prisma from '../utils/prisma.js';

export const getInterview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const interview = await prisma.sixthFormInterview.findUnique({
      where: { applicationId: id },
    });
    res.json({ interview });
  } catch (error) {
    next(error);
  }
};

export const saveInterview = async (req, res, next) => {
  try {
    const { id } = req.params;

    const application = await prisma.sixthFormApplication.findUnique({ where: { id } });
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const {
      studentName,
      fullyMatriculated,
      awarenessMotivation,
      knowledgeOfSchool,
      appearance,
      generalSuitability,
      comments,
      decision,
    } = req.body;

    if (!studentName || !decision) {
      return res.status(400).json({ error: 'Student name and decision are required' });
    }

    const createdByName = req.user?.name || req.user?.email || 'Unknown';

    const toInt = (v) => (v != null && v !== '' ? parseInt(v) : null);

    const interview = await prisma.sixthFormInterview.upsert({
      where: { applicationId: id },
      create: {
        applicationId: id,
        studentName,
        fullyMatriculated: fullyMatriculated === true || fullyMatriculated === 'true',
        awarenessMotivation: toInt(awarenessMotivation),
        knowledgeOfSchool: toInt(knowledgeOfSchool),
        appearance: toInt(appearance),
        generalSuitability: toInt(generalSuitability),
        comments: comments || null,
        decision,
        createdByName,
      },
      update: {
        studentName,
        fullyMatriculated: fullyMatriculated === true || fullyMatriculated === 'true',
        awarenessMotivation: toInt(awarenessMotivation),
        knowledgeOfSchool: toInt(knowledgeOfSchool),
        appearance: toInt(appearance),
        generalSuitability: toInt(generalSuitability),
        comments: comments || null,
        decision,
      },
    });

    res.json({ interview });
  } catch (error) {
    next(error);
  }
};
