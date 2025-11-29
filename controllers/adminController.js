const User = require('../models/User');
const getAdmins = async (req, res) => {
  try {
    const admins = await User.find({ isActive: true }).select('-password').sort({ role: -1, createdAt: -1 });
    res.json(admins);
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
const createAdmin = async (req, res) => {
  try {
    const { username, password, name, role } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ message: 'Username already exists' });
    const newAdmin = new User({ username, password, name, role: role || 'admin' });
    await newAdmin.save();
    const adminData = await User.findById(newAdmin._id).select('-password');
    res.status(201).json(adminData);
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
const updateAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, isActive, password } = req.body;
    if (id === req.user.id) return res.status(400).json({ message: 'Cannot modify your own account' });
    const updateData = { name, role, isActive };
    if (password) updateData.password = password;
    const updatedAdmin = await User.findByIdAndUpdate(id, updateData, { new: true }).select('-password');
    if (!updatedAdmin) return res.status(404).json({ message: 'Admin not found' });
    res.json(updatedAdmin);
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
const deleteAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ message: 'Cannot delete your own account' });
    const adminToDelete = await User.findById(id);
    if (adminToDelete.role === 'superadmin') {
      const superAdminCount = await User.countDocuments({ role: 'superadmin', isActive: true });
      if (superAdminCount <= 1) return res.status(400).json({ message: 'Cannot delete the last super admin' });
    }
    await User.findByIdAndUpdate(id, { isActive: false });
    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    console.error('Delete admin error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
module.exports = { getAdmins, createAdmin, updateAdmin, deleteAdmin };
