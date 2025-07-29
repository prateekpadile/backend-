import dotenv from "dotenv";
import express from "express";
import connectDB from "./db/index.js";
import userRouter from "./routes/user.routes.js"; // 👈 import routes

const app = express();

dotenv.config({
  path: './.env'
});


connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`✅ Server running on port ${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.error("❌ Failed to connect to the database:", error);
  });
