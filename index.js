// Some of these imports are scuffed due to ES6 such as __dirname and __filename
import faker from "faker";
import FormData from "form-data";
import axios from "axios";
import inbox from "inbox";
import { simpleParser } from "mailparser";
import cheerio from "cheerio";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import * as Captcha from "2captcha";

const main = async () => {
  await listenInbox();
  await getCode();
};

const pathExists = async (pathToCheck) => {
  try {
    await fs.access(pathToCheck);
    return true;
  } catch (e) {
    return false;
  }
};

const verifyUrl = async (link) => {
  let r = await axios.get(link);
  return r;
};

const getCode = async () => {
  let form = new FormData();
  console.log("Presolving captcha...");
  let solver = new Captcha.Solver(""); // 2Captcha API Key
  let solvedCap = await solver.recaptcha(
    "6LfdBa8cAAAAABBZkENfB9ktOMFAogDYYpREYgXs", // Site key
    "https://www.jacklinks.com/shop/cod-support" // Page URL
  );
  let capToken = solvedCap.data.toString();
  console.log("Captcha solved! Sending code request...");
  form.append("form_key", "1URzRUjaSOEUgUMy"); // Static form key
  form.append("submitForm_1", "1");
  form.append("form_id", "1");
  form.append("field[1]", ""); // Use faker to generate random name
  form.append("field[2]", ""); // Use faker to generate random name
  form.append("field[3]", ``); // Use generated name + catchall
  form.append("field[4]", ""); // Use faker to generate random phone number
  form.append("field[5]", "Walmart"); // Leave as walmart, but any big box store works
  form.append("field[6]", "017082012050"); // UPC of Jack Links 2.85oz bag - Static besides last 4 digits
  form.append("field[7]", "1573925"); // Code tied to UPC - Static per code
  form.append("g-recaptcha-response", capToken); // For some reason, this is required twice on their end. Not sure why.
  form.append("g-recaptcha-response", capToken);
  form.append(
    "submitted_from",
    '{"url":"https://www.jacklinks.com/shop/cod-support","title":"Call of Duty Support"}'
  );
  form.append("referrer_page", "");
  let req = await axios({
    method: "POST",
    url: "https://www.jacklinks.com/shop/webforms/form/submit/ajax/1",
    headers: {
      authority: "www.jacklinks.com",
      accept: "application/json, text/javascript, */*; q=0.01",
      "accept-language": "en-US,en;q=0.9",
      "content-type":
        "multipart/form-data; boundary=---011000010111000001101001",
      origin: "https://www.jacklinks.com",
      referer: "https://www.jacklinks.com/shop/cod-support",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36",
      "x-requested-with": "XMLHttpRequest",
    },
    data: form,
  });
  if (req.status === 200) {
    console.log("Code request sent!");
  } else {
    console.log("Failed to request code :(");
    console.log(req.data);
  }

  await getCode();
};

const listenInbox = async () => {
  const client = inbox.createConnection(false, "imap.gmail.com", {
    secureConnection: true,
    auth: {
      user: "", // IMAP login
      pass: "", // IMAP password
    },
  });

  client.connect();

  client.on("connect", () => {
    client.openMailbox("INBOX", async (error, info) => {
      client.on("new", async (message) => {
        if (message.from.name === "Jacklinks.com") {
          const messageStream = client.createMessageStream(message.UID);
          const parsed = await simpleParser(messageStream);
          const html = parsed.html;

          if (parsed.subject === "Information Verified") {
            console.log("Verifying URL...");
            const vUrl = html
              .match(/<a[^>]*href=["']([^"']*)["']/g)[6]
              .trim()
              .replace(/<a href=/g, "")
              .replace(/"/g, "")
              .replaceAll("'", "")
              .replaceAll(",", "");
            await verifyUrl(vUrl);
          } else if (parsed.subject === "Your Call of Duty Code") {
            const $ = cheerio.load(html);
            const code = $("strong").text();

            if (code) {
              let contents = null;
              const generatedPath = "./generated";
              const codeExportsPath = "./generated/code_exports.txt";

              if (!(await pathExists(generatedPath))) {
                console.log("Creating export directory...");
                await fs.mkdir(path.join(__dirname, generatedPath));
                console.log("Successfully created export directory!");
              }

              if (await pathExists(codeExportsPath)) {
                contents = await fs.readFile(
                  path.join(__dirname, codeExportsPath),
                  "utf8"
                );

                if (contents) {
                  await fs.writeFile(
                    path.join(__dirname, codeExportsPath),
                    `${contents}\n${code}`
                  );
                }
              } else {
                await fs.writeFile(
                  path.join(__dirname, codeExportsPath),
                  `${code}`
                );
              }

              console.log(`Successfully generated and saved code: ${code}`);
            }
          } else if (parsed.subject === "Code Request Not Valid") {
            console.log("Email burnt, exiting...");
            process.exit();
          }
        }
      });
    });
  });
};

main();
