const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  // Fail fast if MongoDB connection string is not provided
  // eslint-disable-next-line no-console
  console.warn(
    "[Database] MONGO_URI is not set. Please configure it in your .env file."
  );
}

// Connection options tuned for production workloads
const mongoOptions = {
  autoIndex: false, // turn on selectively per-model for performance
  maxPoolSize: 20,
  minPoolSize: 5,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
};

let connectionAttempt = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 5000;

// Establish connection with retry logic for transient failures
async function connectDB() {
  if (!MONGO_URI) {
    throw new Error("MONGO_URI is required to connect to MongoDB");
  }

  try {
    connectionAttempt += 1;
    // eslint-disable-next-line no-console
    console.log(
      `[Database] Connecting to MongoDB (attempt ${connectionAttempt}/${MAX_RETRIES})...`
    );

    await mongoose.connect(MONGO_URI, mongoOptions);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Database] Initial connection error:", error.message);

    if (connectionAttempt < MAX_RETRIES) {
      // eslint-disable-next-line no-console
      console.log(
        `[Database] Retrying connection in ${RETRY_DELAY_MS / 1000}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
      return connectDB();
    }

    // eslint-disable-next-line no-console
    console.error(
      "[Database] Maximum retry attempts reached. Failing startup."
    );
    throw error;
  }
}

// Explicitly close the database connection
async function disconnectDB() {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      // eslint-disable-next-line no-console
      console.log("[Database] MongoDB connection closed.");
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[Database] Error during disconnect:", error);
  }
}

// Mongo connection event listeners for observability
mongoose.connection.on("connected", () => {
  // eslint-disable-next-line no-console
  console.log("[Database] MongoDB connected.");
});

mongoose.connection.on("reconnected", () => {
  // eslint-disable-next-line no-console
  console.log("[Database] MongoDB reconnected.");
});

mongoose.connection.on("disconnected", () => {
  // eslint-disable-next-line no-console
  console.log("[Database] MongoDB disconnected.");
});

mongoose.connection.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("[Database] MongoDB connection error:", err);
});

process.on("SIGINT", async () => {
  await disconnectDB();
  process.exit(0);
});

module.exports = {
  connectDB,
  disconnectDB,
};

