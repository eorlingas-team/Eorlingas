// backend/src/server.js
require("dotenv").config();
process.env.TZ = 'UTC';
const app = require("./app");

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
