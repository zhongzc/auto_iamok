const prefix = require('loglevel-plugin-prefix');
const chalk = require('chalk');
const log = require('loglevel');

function timeConverter(timestamp) {
    const a = new Date(timestamp);
    const months = ['1 月', '2 月', '3 月', '4 月', '5 月', '6 月', '7 月', '8 月', '9 月', '10 月', '11 月', '12 月'];
    const year = a.getFullYear();
    const month = months[a.getMonth()];
    const date = a.getDate();
    const hour = a.getHours();
    const min = a.getMinutes();
    const sec = a.getSeconds();
    const time = year + ' 年 ' + month + ' ' + date + ' 日 ' + hour + ':' + min + ':' + sec;
    return time;
}

const mustRedir = {
    maxRedirects: 0,
    validateStatus: function (status) {
        return status == 302;
    },
}

function initLog() {
    const colors = {
        TRACE: chalk.magenta,
        DEBUG: chalk.cyan,
        INFO: chalk.blue,
        WARN: chalk.yellow,
        ERROR: chalk.red,
    };

    prefix.reg(log);
    prefix.apply(log, {
        format(level, _name, timestamp) {
          return `${chalk.gray(`[${timestamp}]`)} ${colors[level.toUpperCase()](level)}`;
        },
      });
    log.enableAll();

    return log;
}

module.exports = { timeconv: timeConverter, mustRedir, initLog };