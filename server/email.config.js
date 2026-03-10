module.exports = {
  host: 'smtp.gmail.com',
  port: 587,
  user: '',        // your Gmail address
  pass: process.env.EMAIL_PASS,  // set in .env file
  from: '',        // display "from" address (can be same as user)
};
