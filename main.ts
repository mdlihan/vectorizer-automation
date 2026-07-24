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
let waitcomplete = false; 
async function waitProcess(page: any) {
  await page.waitForFunction(() => {
    const el = document.querySelector('#App-Progress-Upload-Pane')
    return !el || (el as HTMLElement).offsetParent === null;
    waitcomplete = true;
  }, { timeout: 20000 })
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

  const assetsDir = './assets';
  const failedDir = './failed_assets';
  const downloadPath = path.resolve('./vector_images')

  // Failed ফোল্ডার না থাকলে তৈরি করে নিবে
  if (!fs.existsSync(failedDir)) {
    fs.mkdirSync(failedDir, { recursive: true });
  }

  // গ্লোবাল কাউন্টার
  let successCount = 0;
  let failCount = 0;

  // Launching browser
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    userDataDir: "./chrome_data", 
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  })

  // ---------------- PROCESS BATCH FUNCTION ----------------
  async function processBatch(fileList: string[], sourceFolder: string, isRetryPhase: boolean) {
    const totalLocalImages = fileList.length;
    let localIndex = 0;

    for (const image of fileList) {
      localIndex++;
      let page: any = null

      try {
        const phaseText = isRetryPhase ? 'RETRY ' : '';
        console.log(chalk.green(`\n[${phaseText}${localIndex}/${totalLocalImages}] Vectorizing ${image}...`))

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

        await input.uploadFile(`${sourceFolder}/${image}`) 
        await randomSleep(8000, 12000)

        await handleRetry(page)

        // ---------------- 3. PROCESS ----------------
        await waitProcess(page)
        await handleRetry(page)

        // ---------------- 4. DOWNLOAD LINK ----------------
        let downloadLinkClicked = false
        await handleRetry(page)
        await handleRetry(page)

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

        // ---------------- 6. SUBMIT & CAPTCHA ----------------
        if (downloadLinkClicked) {
          const captchaExists = await page.$('#Options-SubmitRecaptcha');

          if (captchaExists) {
              console.log('CAPTCHA detected');
              await speak('Lihan Boss, CAPTCHA detected. Please solve it manually.');
              await page.click('#Options-SubmitRecaptcha');
              await page.waitForSelector('#Options-Submit', {
                  visible: true,
                  timeout: 300000 
              });
          }

          await page.click('#Options-Submit');
          console.log('Download started');
          await sleep(6000);
        }

        await page.close()

        // ---------------- SUCCESS HANDLING ----------------
        successCount++;
        
        // রিট্রাই-এ সফল হলে ফেইল কাউন্ট কমাবে
        if (isRetryPhase) {
          failCount--; 
        }

        // ✅ সফল হওয়া ছবিটি তার ফোল্ডার (assets বা failed_assets) থেকে ডিলিট করে দিবে
        try {
          fs.unlinkSync(path.join(sourceFolder, image));
          console.log(chalk.gray(`🗑️ Deleted successfully processed file: ${image}`));
        } catch(e) {
          console.log(chalk.red(`⚠️ Could not delete file: ${image}`));
        }

        console.log(chalk.green(`Done: ${image} | Total Success: ${successCount}, Total Failed: ${failCount}`))
        console.log('------------------------')
        await speak(`Image ${localIndex} successful`);// ✅ সফল হলে বলবে

      } catch (e) {
        // ---------------- ERROR HANDLING ----------------
        if (!isRetryPhase) {
          failCount++; // প্রথমবার ফেইল হলে কাউন্ট বাড়বে
        }
        
        console.log(chalk.red(`Error: ${image} | Total Success: ${successCount}, Total Failed: ${failCount}`))
        console.log(e)

        // প্রথমবার ফেইল হলে ফাইল failed_assets এ মুভ করবে
        if (!isRetryPhase) {
          try {
            const oldPath = path.join(sourceFolder, image);
            const newPath = path.join(failedDir, image);
            if (fs.existsSync(oldPath)) {
              fs.renameSync(oldPath, newPath);
              console.log(chalk.magenta(`📂 Moved failed image to ${failedDir}/${image}`));
            }
          } catch (moveErr) {
            console.log(chalk.red(`⚠️ Could not move failed file: ${image}`));
          }
        } else {
          console.log(chalk.red(`⚠️ Retry failed again for: ${image}`));
        }

        await speak(`Image ${localIndex} failed`); // ❌ ফেইল হলে বলবে

        try {
          if (page) await page.close()
        } catch {}
      }
    }
  }

  // ========================================================
  // 1. FIRST PASS (Main Assets)
  // ========================================================
  const images = fs.readdirSync(assetsDir)
  const initialTotal = images.length;
  console.log(chalk.green('Images loaded...'))
  console.log(chalk.blue(`Total images to process: ${initialTotal}`))
  console.log(chalk.green('Starting vectorization...'))

  await processBatch(images, assetsDir, false);

  // ========================================================
  // 2. SECOND PASS (Retry Failed Assets)
  // ========================================================
  const failedImages = fs.readdirSync(failedDir);
  if (failedImages.length > 0) {
    console.log(chalk.yellow('\n================================='))
    console.log(chalk.yellow(`Found ${failedImages.length} failed files. Starting RETRY...`))
    console.log(chalk.yellow('=================================\n'))
    
    await speak(`Lihan Boss, first phase complete. Now retrying ${failedImages.length} failed images.`);
    
    // রিট্রাই প্রসেস শুরু
    await processBatch(failedImages, failedDir, true);
  } else {
    console.log(chalk.green('\n✅ No failed files found! Skipping retry phase.'));
  }

  // ========================================================
  // 3. FINAL FINISH
  // ========================================================
  await browser.close()
  
  console.log(chalk.cyan('\n================================='))
  console.log(chalk.cyan('        PROCESS SUMMARY          '))
  console.log(chalk.cyan('================================='))
  console.log(chalk.blue(`Total Images Attempted : ${initialTotal}`))
  console.log(chalk.green(`Successfully Completed : ${successCount}`))
  console.log(chalk.red(`Final Failed Count     : ${failCount}`))
  console.log(chalk.cyan('=================================\n'))

  console.log(chalk.green('ALL DONE'))
  speak(`Lihan Boss, all processing is complete. Out of ${initialTotal} images, ${successCount} were successful, and ${failCount} failed completely.`)
}

vectorizeImages()
