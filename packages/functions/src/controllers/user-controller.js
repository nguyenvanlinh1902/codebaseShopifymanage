import bcrypt from 'bcryptjs';
import {AdminUserRepository} from '../repositories/adminUserRepository.js';

const adminUserRepo = new AdminUserRepository();

// Strip sensitive fields before returning user data
function sanitizeUser(user) {
  // eslint-disable-next-line no-unused-vars
  const {password: _pw, ...safe} = user;
  return safe;
}

/** GET /api/users — list all users (admin only) */
export async function listUsers(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Admin access required'});
    }
    const users = await adminUserRepo.getAll();
    return res.json({success: true, data: users.map(sanitizeUser)});
  } catch (error) {
    console.error('listUsers error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** GET /api/users/me — get current user profile */
export async function getMe(req, res) {
  try {
    const user = await adminUserRepo.getById(req.userId);
    if (!user) {
      return res.status(404).json({success: false, error: 'User not found'});
    }
    return res.json({success: true, data: sanitizeUser(user)});
  } catch (error) {
    console.error('getMe error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** POST /api/users — create user (admin only) */
export async function createUser(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Admin access required'});
    }

    const {username, password, displayName, role, assignedStores, allowedFeatures} = req.body;

    if (!username || !password || !displayName || !role) {
      return res
        .status(400)
        .json({success: false, error: 'username, password, displayName, role are required'});
    }

    if (!['admin', 'manager', 'staff'].includes(role)) {
      return res
        .status(400)
        .json({success: false, error: 'Invalid role. Must be admin, manager, or staff'});
    }

    // Check duplicate username
    const existing = await adminUserRepo.getByUsername(username);
    if (existing) {
      return res.status(409).json({success: false, error: 'Username already exists'});
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await adminUserRepo.create({
      username,
      password: hashedPassword,
      displayName,
      role,
      assignedStores: assignedStores || [],
      allowedFeatures: allowedFeatures || [],
      status: 'active'
    });

    return res.status(201).json({success: true, data: sanitizeUser(user)});
  } catch (error) {
    console.error('createUser error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** PUT /api/users/:id — update user (admin only) */
export async function updateUser(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Admin access required'});
    }

    const {id} = req.params;
    const {displayName, role, assignedStores, allowedFeatures, status, password} = req.body;

    if (status === 'inactive' && id === req.userId) {
      return res.status(400).json({success: false, error: 'Cannot deactivate your own account'});
    }

    const user = await adminUserRepo.getById(id);
    if (!user) {
      return res.status(404).json({success: false, error: 'User not found'});
    }

    const updates = {};
    if (displayName) updates.displayName = displayName;
    if (role && ['admin', 'manager', 'staff'].includes(role)) updates.role = role;
    if (assignedStores !== undefined) updates.assignedStores = assignedStores;
    if (allowedFeatures !== undefined) updates.allowedFeatures = allowedFeatures;
    if (status && ['active', 'inactive'].includes(status)) updates.status = status;
    if (password) updates.password = await bcrypt.hash(password, 10);

    await adminUserRepo.update(id, updates);
    return res.json({success: true, message: 'User updated'});
  } catch (error) {
    console.error('updateUser error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** PUT /api/users/me/preferences — update own preferences (timezone, etc.) */
export async function updateMyPreferences(req, res) {
  try {
    const {timezone} = req.body;
    const updates = {};
    if (timezone !== undefined) updates.timezone = timezone;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({success: false, error: 'No valid fields to update'});
    }

    await adminUserRepo.update(req.userId, updates);
    const user = await adminUserRepo.getById(req.userId);
    return res.json({success: true, data: sanitizeUser(user)});
  } catch (error) {
    console.error('updateMyPreferences error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

/** DELETE /api/users/:id — deactivate user (admin only, cannot deactivate self) */
export async function deactivateUser(req, res) {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({success: false, error: 'Admin access required'});
    }

    const {id} = req.params;

    if (id === req.userId) {
      return res.status(400).json({success: false, error: 'Cannot deactivate your own account'});
    }

    const user = await adminUserRepo.getById(id);
    if (!user) {
      return res.status(404).json({success: false, error: 'User not found'});
    }

    await adminUserRepo.deactivate(id);
    return res.json({success: true, message: 'User deactivated'});
  } catch (error) {
    console.error('deactivateUser error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}
