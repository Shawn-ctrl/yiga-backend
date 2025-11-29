const Application = require('../models/Application');
const createApplication = async (req, res) => {
  try {
    const applicationData = req.body;
    const existingApplication = await Application.findOne({ email: applicationData.email });
    if (existingApplication) return res.status(400).json({ message: 'An application with this email already exists' });
    const application = new Application(applicationData);
    await application.save();
    res.status(201).json({ message: 'Application submitted successfully', application });
  } catch (error) {
    console.error('Create application error:', error);
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Invalid application data', errors: error.errors });
    res.status(500).json({ message: 'Server error' });
  }
};
const getApplications = async (req, res) => {
  try {
    const { status, page = 1, limit = 10, search } = req.query;
    let query = {};
    if (status && status !== 'all') query.status = status;
    if (search) query.$or = [{ fullName: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }, { institution: { $regex: search, $options: 'i' } }];
    const applications = await Application.find(query).sort({ createdAt: -1 }).limit(limit * 1).skip((page - 1) * limit);
    const total = await Application.countDocuments(query);
    res.json({ applications, totalPages: Math.ceil(total / limit), currentPage: page, total });
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
const getApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: 'Application not found' });
    res.json(application);
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
const updateApplication = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const application = await Application.findByIdAndUpdate(req.params.id, { status, notes }, { new: true, runValidators: true });
    if (!application) return res.status(404).json({ message: 'Application not found' });
    res.json(application);
  } catch (error) {
    console.error('Update application error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
const getStats = async (req, res) => {
  try {
    const total = await Application.countDocuments();
    const pending = await Application.countDocuments({ status: 'pending' });
    const approved = await Application.countDocuments({ status: 'approved' });
    const rejected = await Application.countDocuments({ status: 'rejected' });
    const byInterest = await Application.aggregate([{ $group: { _id: '$interestArea', count: { $sum: 1 } } }]);
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recent = await Application.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
    res.json({ total, pending, approved, rejected, byInterest, recent });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
module.exports = { createApplication, getApplications, getApplication, updateApplication, getStats };
