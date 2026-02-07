import * as authService from '../services/authService.js';

export async function login(req, res) {
  try {
    const {username, password} = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    const result = await authService.login(username, password);

    return res.json({
      success: true,
      data: {
        id: result.user.id,
        username: result.user.username,
        displayName: result.user.displayName,
        role: result.user.role,
        token: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message
    });
  }
}

export async function logout(req, res) {
  try {
    await authService.logout(req.userId);
    return res.json({success: true, message: 'Logged out successfully'});
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({success: false, error: error.message});
  }
}

export async function refreshToken(req, res) {
  try {
    const {refreshToken: token} = req.body;

    if (!token) {
      return res.status(400).json({success: false, error: 'Refresh token is required'});
    }

    const result = await authService.handleRefreshToken(token);

    return res.json({
      success: true,
      data: {
        username: result.user.username,
        token: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken
      }
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      error: error.message
    });
  }
}
