const authConfig = {
  jwtSecret: process.env.JWT_SECRET,
  accessTokenExpiry: '2d',
  refreshTokenExpiry: '7d'
};

export default authConfig;
