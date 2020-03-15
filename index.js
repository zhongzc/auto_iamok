/**
 * 华工人自动 IamOK 系统, 让你不再因为记性不好而烦恼
 */

const des = require('./des.js');
const utils = require('./utils.js');
const axios = require('axios');
const chalk = require('chalk');
const querystring = require('querystring');
const readlineSync = require('readline-sync');

const SSO_URL = 'https://sso.scut.edu.cn/cas/login?service=https%3A%2F%2Fiamok.scut.edu.cn%2Fcas%2Flogin';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36';

console.log(chalk.blue('-----------------\n'))
console.log(chalk.blue('今天你 IamOK 了吗\n'))
console.log(chalk.blue('-----------------\n'))

const username = readlineSync.question(`${chalk.cyan('学号: ')}`);
const password = readlineSync.question(`${chalk.cyan('密码: ')}`, { hideEchoBack: true });
const raw_interval = readlineSync.question(`${chalk.cyan('上报周期 (单位: 分钟): ')}`);
const interval = parseFloat(raw_interval) * 1000 * 60;

const log = utils.initLog();
main();
setInterval(main, interval);

function main() {
    encodeSSO(username, password)
        .then(loginSSO)
        .then(fetchToken)
        .then(loginIamOK)
        .then(getData)
        .then(postData)
        .then(() => { log.info('下次上报时间:', utils.timeconv(new Date((new Date()).getTime() + interval))) })
        .catch((e) => {
            log.error('失败:', e);
        });
}

function encodeSSO(username, password) {
    log.info('构造密钥中 ...');
    return axios.get(SSO_URL, {
        headers: {
            'User-Agent': USER_AGENT,
        }
    }).then(({ headers: { 'set-cookie': cookies }, data }) => {
        // 获取 session token
        const token = cookies.map((s) => s.split(';')[0]).sort().join('; ');

        // 按照教务系统加密规则进行加密
        const lt_reg = /<input type="hidden" id="lt" name="lt" value="([^"]+)/;
        const ex_reg = /<input type="hidden" name="execution" value="([^"]+)/;

        const lt = lt_reg.exec(data)[1];
        const execution = ex_reg.exec(data)[1];
        const rsa = des(username + password + lt, '1', '2', '3');

        log.info('构造密钥成功!');
        return { token, lt, execution, rsa };
    });
}

function loginSSO({ token, lt, execution, rsa }) {
    log.info('登录 SSO 中 ...');

    return axios.post(SSO_URL, querystring.stringify({
        rsa,
        ul: username.length,
        pl: password.length,
        lt,
        execution,
        _eventId: 'submit'
    }), {
        ...utils.mustRedir,
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Origin': 'https://sso.scut.edu.cn',
            'Cookie': token,
            'User-Agent': USER_AGENT,
            'Referer': SSO_URL,
        }
    }).then(({ headers: { location } }) => {
        log.info("登录 SSO 成功!");

        return { location };
    })
}

function fetchToken({ location }) {
    // 从此重定向地址处取登录 token
    return axios.get(location, {
        ...utils.mustRedir,
        headers: {
            'Referer': SSO_URL,
            'User-Agent': USER_AGENT,
        }
    }).then(({ headers: { 'set-cookie': cookies } }) => {
        // 新登录 token
        const token = cookies.map((s) => s.split(';')[0]).sort().join('; ');
        return { token };
    });
}

function loginIamOK({ token }) {
    log.info('登录 IamOK 中 ...');

    return axios.get('https://iamok.scut.edu.cn/cas/login', {
        ...utils.mustRedir,
        headers: {
            'Cookie': token,
            'Referer': SSO_URL,
            'User-Agent': USER_AGENT,
        }
    }).then(({ headers: { 'set-cookie': cookie }, config: { headers: { Cookie } } }) => {
        log.info('登录 IamOK 成功!');

        // IamOK 同样有 token，需要继续补充
        Cookie += '; ' + cookie[0].split(';')[0];
        return { token: Cookie };
    });
}

function getData({ token }) {
    log.info('获取数据中 ...');

    return axios.get('https://iamok.scut.edu.cn/mobile/recordPerDay/getRecordPerDay', {
        headers: {
            'Cookie': token,
            'Referer': 'https://iamok.scut.edu.cn/iamok/web/mobile/index.html',
            'User-Agent': USER_AGENT,
        }
    }).then(({ data: { data }, config: { headers } }) => {
        if (data == null) {
            throw ReferenceError('data 为空，疑似 IamOK 系统出状况');
        }

        log.info('上次上报记录:', utils.timeconv(data.updateTime));

        // IamOK 系统的 Bug，这里模仿它的行为
        //
        // Bug 是这样的：
        //   系统首先将所有时间相关的变量都初始化为当前日期，然后根据填写状况再去修正。
        //   对于温州，系统判断温州选项是不是'否'，如果是'否'，则将日期修改为null。
        //   然而现在温州选项去掉了，所以恒为null，导致这个变量没有被修正。
        data.visitingRelativesOrTravelToWenzhouDate = new Date(new Date().toLocaleDateString()).getTime();

        return { data, headers };
    });
}

function postData({ data, headers }) {
    log.info('上报中 ...');

    return axios.post('https://iamok.scut.edu.cn/mobile/recordPerDay/submitRecordPerDay', data, {
        headers
    }).then(({ data }) => {
        if (data.msg === '成功') {
            log.info('上报成功!');
        } else {
            log.warn('上报失败!');
        }
    });
}
