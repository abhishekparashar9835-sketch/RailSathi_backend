const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const registerUser = async (data) => {
  const { fullName, email, mobile, password, role } = data;

  const existingUser = await User.findOne({
    $or: [{ email }, { mobile }],
  });

  if (existingUser) {
    throw new Error("User already exists");
  }

  const user = await User.create({
    fullName,
    email,
    mobile,
    password,
    role,
  });

  const token = generateToken(user);

  // Remove password before sending response
  const userResponse = user.toObject();
  delete userResponse.password;

  return {
    user: userResponse,
    token,
  };
};

const loginUser = async ({ mobile, password }) => {
  const user = await User.findOne({ mobile }).select("+password");

  if (!user) {
    throw new Error("Invalid mobile or password");
  }

  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    throw new Error("Invalid mobile or password");
  }

  const token = generateToken(user);

  // Remove password before sending response
  const userResponse = user.toObject();
  delete userResponse.password;

  return {
    user: userResponse,
    token,
  };
};

module.exports = {
  registerUser,
  loginUser,
};