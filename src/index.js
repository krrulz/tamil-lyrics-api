require('dotenv').config();
const app     = require('./app');
const PORT    = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🎵  Tamil Lyrics API running on http://localhost:${PORT}`);
  console.log(`     Environment : ${process.env.NODE_ENV || 'development'}`);
});
