module.exports = {
  host: 'smtp.gmail.com',
  port: 587,
  user: 'itsoveragainagain@gmail.com',        // your Gmail address
  pass: process.env.EMAIL_PASS,  // set in .env file
  from: '"RentInvoicesToGo" <itsoveragainagain@gmail.com>',
};
