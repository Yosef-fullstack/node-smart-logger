// Mock для winston-cloudwatch
module.exports = function CloudWatchTransport(options) {
  this.name = 'CloudWatch';
  this.level = options.level || 'info';
  this.options = options;

  this.log = jest.fn();
};
