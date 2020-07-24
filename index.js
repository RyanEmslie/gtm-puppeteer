const puppeteer = require("puppeteer");
const ObjectsToCsv = require("objects-to-csv");

let accountsArr = "";
let adminsArr = [];

// Helper function used to create objec to be pushed into adminsArr
const containerPermissionObj = async (account, container, public, admins) => {
  account = {
    "account_id": account,
    "container_id": container,
    "public_id": public,
    "admins": admins,
  };
  adminsArr.push(account);
};

// Generates List of all account and container ids
const getAccountContainerIds = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: "~/Library/Application Support/Google/Chrome",
  });
  const page = await browser.newPage();

  await page.goto("https://tagmanager.google.com/?authuser=0#/home", {
    waitUntil: "networkidle0",
  });

  await page.waitForSelector(".gtm-account-list", { visible: true });

  var accountCard = await page.evaluate(() => {
    let rowsArr = [];
    let rows = Array.from(document.querySelectorAll("a.wd-container-name"));
    rows.forEach((row) => {
      let accounts = row.href.split("accounts/")[1].split("/cont")[0];
      let containers = row.href.split("accounts/")[1].split("ers/")[1];
      rowsArr.push([accounts, containers]);
    });
    return rowsArr;
  });
  accountsArr = accountCard;
  browser.close();
};

// Cycles through all containers and collects Feathr emails with admin permissions
const containerPermissions = async (accountsArr) => {
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: "~/Library/Application Support/Google/Chrome",
  });
  const page = await browser.newPage();
  //!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  for (let i = 0; i < accountsArr.length; i++) {
    const url = `https://tagmanager.google.com/?authuser=0#/admin/?accountId=${accountsArr[i][0]}&containerId=${accountsArr[i][1]}&containerDraftId=2`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    // Wait for Account / User Managment icon to appear
    await page.waitForSelector("i.gtm-user-management-icon", { visible: true });
    await page.$eval("i.gtm-user-management-icon", (elem) => elem.click());

    await page.waitForSelector("#cdk-describedby-message-container", { visible: true });
    await page.waitFor(500);

    // Open Account - User Settings
    const result = await page.evaluate(() => {
      var index = document.querySelectorAll("mat-table").length - 1;
      return document.querySelectorAll("mat-table")[index].innerText;
    });
    let account_id = await page.evaluate(
      () => window.location.href.split("accountId=")[1].split("&")[0]
    );
    let container_id = await page.evaluate(
      () => window.location.href.split("containerId=")[1].split("&")[0]
    );
    let public_id = await page.evaluate(
      () => document.querySelector(".admin-column_gtm-id").innerText
    );
    let rowsTest = await page.evaluate(() => {
      let adminEmail = [];
      let rows = Array.from(document.querySelectorAll("mat-table > mat-row"));
      rows.forEach((item) => {
        if (
          item.querySelector(".mat-column-permissions").innerText == "Administrator" &&
          item.querySelector(".mat-column-emailAddress").innerText.includes("feathr")
        ) {
          adminEmail.push(item.querySelector(".mat-column-emailAddress").innerText);
        }
      });
      return adminEmail;
    });
    if (rowsTest.length > 0) {
      await containerPermissionObj(account_id, container_id, public_id, rowsTest);
    }
    if (i < accountsArr.length - 1) {
      await page.click('button[aria-label="Close this slider window"]');
    }
  }
  browser.close();
};

// Creates CSV file from adminsArr
async function createCSV() {
  const csv = new ObjectsToCsv(adminsArr);
  await csv.toDisk("./gtm_admim_accounts.csv");
  console.log(await csv.toString());
}

async function engage() {
  await getAccountContainerIds();
  await containerPermissions(accountsArr);
  await createCSV();
}

engage();
