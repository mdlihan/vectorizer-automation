import puppeteer from 'puppeteer-core'
import fs from 'fs'
import chalk from 'chalk'
import path from 'path'
import say from 'say'

let sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms))

let randomSleep = (min: number, max: number) =>
  sleep(Math.floor(Math.random() * (max - min + 1)) + min)

// ---------------- SPEAK ----------------
function speak(text: string) {
  return new Promise<void>((resolve) => {
    say.speak(text, 'Microsoft Zira Desktop', 1.0, () => {
      resolve()
    })
  })
}

// ---------------- WAIT PROCESS COMPLETE ----------------
async function waitProcess(page: any) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#App-Progress-Upload-Pane')
    return !el || (el as HTMLElement).offsetParent === null
  }, { timeout: 30000 })
}

// ---------------- TRY AGAIN HANDLER ----------------
async function handleRetry(page: any) {
  try {
    const shouldRetry = await page.evaluate(() => {
      const dialog = document.querySelector('#App-Error-Dialog') as HTMLElement
      if (!dialog) return false

      const style = window.getComputedStyle(dialog)
      return style.display === 'block'
    })

    if (shouldRetry) {
      console.log('🔁 Error dialog visible → retry clicking...')

      const btn = await page.$('#App-Error-RetryButton')

      if (btn) {
        await speak('Lihan Boss error dialog visible, retry clicking')
        await btn.click()
        await new Promise(r => setTimeout(r, 4000))
        await waitProcess(page)
        await sleep(2000)
      }
    }
  } catch (e) {
    console.log('Retry handler error ignored')
  }
}

// ---------------- MAIN ----------------
async function vectorizeImages() {
  console.log(chalk.green('Loading images...'))

  const images = fs.readdirSync('./assets')

  console.log(chalk.green('Images loaded...'))
  console.log(chalk.green('Starting vectorization...'))

  // Launching with puppeteer-core and userDataDir for session persistence
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    userDataDir: "./chrome_data", // <-- THIS SAVES YOUR LOGIN SESSION
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  })

  const downloadPath = path.resolve('./vector_images')

  for (const image of images) {
    let page: any = null

    try {
      console.log(chalk.green(`Vectorizing ${image}...`))

      page = await browser.newPage()

      const client = await page.target().createCDPSession()
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath
      })

      await page.goto('https://vectorizer.ai/', {
        waitUntil: "domcontentloaded"
      })

      // ---------------- 1. LOGIN CHECK ----------------
      // Check if we actually need to log in (if session is not saved/expired)
      const needsLogin = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('.Signon-trigger'));
        const loginBtn = btns.find(el => el.textContent?.trim() === "Log In");
        if (loginBtn) {
            (loginBtn as HTMLElement).click();
            return true;
        }
        return false;
      });

      if (needsLogin) {
        console.log("🔐 Login required. Please log in manually.");
        await speak('Lihan Boss, please log in to vectorizer.ai within 45 seconds. Then I will continue the automation.');
        await sleep(45000);
        await speak('Lihan Boss, login should be complete. Continuing automation.');
      } else {
        console.log("✅ Already logged in from previous session.");
      }

      // ---------------- 2. UPLOAD ----------------
      const input = await page.$("input[type=file]")
      if (!input) throw new Error("Upload input not found")

      await input.uploadFile(`./assets/${image}`)
      await randomSleep(8000, 12000)

      await handleRetry(page)

      // ---------------- 3. PROCESS ----------------
      await waitProcess(page)

      await handleRetry(page)

      // ---------------- 4. DOWNLOAD LINK ----------------
      let downloadLinkClicked = false

      try {
        await page.waitForSelector('#App-DownloadLink', {
          visible: true,
          timeout: 30000
        })

        await page.click('#App-DownloadLink')
        console.log('⬇️ Download link clicked')
        downloadLinkClicked = true

      } catch (e) {
        console.log('Download link not found')
        downloadLinkClicked = false
      }

      // ---------------- 5. EPS SELECT ----------------
      await page.evaluate(() => {
        const el = document.querySelector('#file_format_eps') as HTMLInputElement
        if (el && !el.checked) el.click()
      })

      await handleRetry(page)

      // ---------------- 6. SUBMIT & CAPTCHA ----------------
      await handleRetry(page)

      if (downloadLinkClicked) {
        const captchaExists = await page.$('#Options-SubmitRecaptcha');

        if (captchaExists) {
            console.log('CAPTCHA detected');
            await speak('Lihan Boss, CAPTCHA detected. Please solve it manually.');
            await page.click('#Options-SubmitRecaptcha');
            await page.waitForSelector('#Options-Submit', {
                visible: true,
                timeout: 300000 // Waits up to 5 minutes for you to solve it
            });
        }

        await page.click('#Options-Submit');
        console.log('Download started');
        await sleep(6000);
      }

      await page.close()

      console.log(chalk.green(`Done: ${image}`))
      console.log('------------------------')

    } catch (e) {
      console.log(chalk.red(`Error: ${image}`))
      console.log(e)

      try {
        if (page) await page.close()
      } catch {}
    }
  }

  await browser.close()
  console.log(chalk.green('ALL DONE'))
  speak('Lihan Boss, all images have been processed. Automation complete.')
}

vectorizeImages()