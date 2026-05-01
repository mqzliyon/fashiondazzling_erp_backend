const User = require("../models/User");
const { ROLES } = require("../config/rbac");

const DEMO_ADMIN = {
  name: "Demo Admin",
  email: "admin@gmail.com",
  password: "123456",
  role: ROLES.ADMIN,
};

async function ensureDemoAdmin() {
  const existingUser = await User.findOne({ email: DEMO_ADMIN.email });

  if (!existingUser) {
    await User.create(DEMO_ADMIN);
    // eslint-disable-next-line no-console
    console.log("[Seed] Demo admin user created.");
    return;
  }

  let hasChanges = false;

  if (existingUser.role !== ROLES.ADMIN) {
    existingUser.role = ROLES.ADMIN;
    hasChanges = true;
  }

  // Keep demo login deterministic for local testing.
  existingUser.password = DEMO_ADMIN.password;
  hasChanges = true;

  if (hasChanges) {
    await existingUser.save();
    // eslint-disable-next-line no-console
    console.log("[Seed] Demo admin user updated.");
    return;
  }

  // eslint-disable-next-line no-console
  console.log("[Seed] Demo admin already present.");
}

module.exports = { ensureDemoAdmin };
