const express = require("express");
const app = express();
const fs = require("fs");
const bodyParser = require("body-parser");
const { json } = require("express");
const { log } = require("console");
const puppeteer = require('puppeteer');

const port = 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));


app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public");
});

app.post("/form", (req, res) => {
  const user = req.body.user;
  const pass = req.body.pass;
  const desc = req.body.detail;
  const policy = req.body.policies;
  const workdays = req.body.workdays;

  const inputList = [];
  let subject = [];
  let start_d;
  let start_t;
  let end_d;
  let end_t;

  let outputJson = [];

  try {

    for (let i = 0; i < workdays.length; i++) {
      let date = workdays[i].slice(0, 10);
      let dn = workdays[i].slice(10);
      let day = new Date(date);
      let y = day.getFullYear();
      let m = ("00" + (day.getMonth() + 1)).slice(-2);
      let d = ("00" + day.getDate()).slice(-2);


      // 申請する件名のフォーマット（名前はログイン後のHTMLから取得しフォーマットを更新する）
      subject.push(`MO_${y}${m}${d}_hoge__${dn}`);


      if (dn == "昼") {
        start_d = `${y}/${m}/${d}`;
        start_t = "09:30";
        end_d = `${y}/${m}/${d}`;
        end_t = "17:59";
      } else if (dn == "夜-明") {
        let t = new Date(date);
        t.setDate(t.getDate() + 1);
        let yy = t.getFullYear();
        let mm = ("00" + (t.getMonth() + 1)).slice(-2);
        let dd = ("00" + t.getDate()).slice(-2);
        start_d = `${y}/${m}/${d}`;
        start_t = "17:30";
        end_d = `${yy}/${mm}/${dd}`;
        end_t = "09:59";
      }
      // 各項目の入力値をリストにして配列としてまとめる
      inputList.push([subject[i], desc, policy, start_d, start_t, end_d, end_t]);
    }
  } catch (error) {
    console.log("エラー発生：" + error);
  }


  // 1回の申請でのポリシーの上限が5個なので
  // 5個以上であれば同じ日付の申請を2回以上に分ける
  const oneTimeInputLimit = 5;

  let firstInputPolicies = [];
  let secondInputPolicies = [];
  let splitPolicyArray = [];

  // ポリシーが5個以上であれば申請回数を増やす
  let inputPolicyCount = 1;

  if (policy.length > oneTimeInputLimit) {
    firstInputPolicies = policy.slice(0, 5);
    secondInputPolicies = policy.slice(5);
    splitPolicyArray.push(firstInputPolicies);
    splitPolicyArray.push(secondInputPolicies);
    inputPolicyCount++;
  } else {
    splitPolicyArray.push(policy);
  }


  (async () => {
    const browser = await puppeteer.launch({
      executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      ignoreHTTPSErrors: true,
      headless: false,
      defaultViewport: null
    });
    const page = await browser.newPage();

    const proxyServer = 'http://sample.proxylocal:3456'; // 実際のプロキシサーバではありません
    await page.authenticate({ username: 'hoge', password: 'hoge' }); // 実際のプロキシ認証情報ではありません

    try {
      await page.goto('http://sample/login', { proxyServer, timeout: 60000 }); // 申請を行うwebページ（ダミー）
      await page.waitForSelector('input[name="username"]', { timeout: 5000 });
      await page.type('input[name="username"]', user);
      await page.waitForSelector('input[name="pwd"]', { timeout: 5000 });
      await page.type('input[name="pwd"]', pass);
      await page.click('input[type="submit"]');
      await page.waitForSelector('.font_20 > b:nth-child(1)', { timeout: 5000 });
      await Promise.all([
        page.waitForNavigation(),
        page.click('.toggledisplaydiv > a:nth-child(1)')
      ])

      for (let i = 0; i < inputList.length; i++) {
        for (let j = 0; j < inputPolicyCount; j++) {

          // 新規作成画面が出力しきるまで待つ
          await Promise.all([
            page.waitForNavigation(),
            page.click('input[name="add"]')
          ])

          // HTMLから申請者の名前を取得し正規表現で苗字と名前の間の空白を取り除く
          const name = await page.evaluate(() => {
            const text = document.querySelector("span.header:nth-child(3)");
            return text.textContent.replace(/\s/g, "").replace("Name:", "");
          });

          // 申請する件名のフォーマットに申請者の名前を追加する
          if(!inputList[i][0].match(name)) {
            inputList[i][0] = inputList[i][0].slice(0, 16) + name + inputList[i][0].slice(16);
          }
          await page.type('input[name="title"]', inputList[i][0], { timeout: 5000 }); // 日付、名前、勤務時間帯の動的入力
          await page.type('textarea[name="description"]', desc, { timeout: 5000 }); // 内容
          await page.click('input[name="select_policy"]'); // 選択ボタン
          for (let k = 0; k < splitPolicyArray[j].length; k++) {
            await page.$eval('#_policy_idname_id', e => e.value = '');
            await page.type('#_policy_idname_id', splitPolicyArray[j][k]); // ポリシーの入力
            await page.click('input[id="policy_search_button"]');
            await page.click('td.border_bot:nth-child(8) > div:nth-child(1) > input:nth-child(1)');
          }
          await Promise.all([
            page.click('input[id="_okButton_id"]')
          ])

          // 日付の自動入力はなぜか必ず１回は失敗するのでリトライさせる
          let retryCount = 0;
          const maxRetries = 4;
          while (retryCount < maxRetries) {
            try {
              await page.$eval('#d_startDatetimeScreen_id', e => e.value = '');
              await page.$eval('#t_startDatetimeScreen_id', e => e.value = '');
              await page.$eval('#d_endDatetimeScreen_id', e => e.value = '');
              await page.$eval('#t_endDatetimeScreen_id', e => e.value = '');
              await page.type('input[id="t_startDatetimeScreen_id"]', inputList[i][4], { timeout: 3000 }); // 開始時間
              await page.type('input[id="d_endDatetimeScreen_id"]', inputList[i][5], { timeout: 3000 }); // 終了日
              await page.type('input[id="t_endDatetimeScreen_id"]', inputList[i][6], { timeout: 3000 }); // 終了時間
              await page.type('input[id="d_startDatetimeScreen_id"]', inputList[i][3], { timeout: 3000 }); // 開始日
              await Promise.all([
                page.waitForNavigation({ timeout: 10000 }),
                page.click('input[name="set"]')
              ])

              break;

            } catch (error) {
              console.log(`エラー：${error}`);
              retryCount++;
              console.log(`${retryCount}回目失敗`);
            }
          }

          await Promise.all([
            page.waitForNavigation(),
            page.click('input[name="confirmCreate"]')// 申請ボタン
          ])
        }
        outputJson.push({ "件名": inputList[i][0] });
      }

      res.send(JSON.stringify(outputJson));

    } catch (error) {
      console.error(`エラー発生: ${error}`);
    }
    // finally {
    //  console.log('ブラウザを閉じます');
    //  await browser.close();
    //}
  })();
});

app.listen(port, () => {
  console.log(`listening at http://localhost:${port}`);
});
