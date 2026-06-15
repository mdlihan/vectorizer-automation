Lihan Boss, নিচের বক্স থেকে পুরো লেখাটি একসাথে কপি করে আপনার `README.md` ফাইলে পেস্ট করে দিন:

```markdown
# Image Vectorization Automation

This tool automates the process of converting regular images to vector images using [vectorizer.ai](https://vectorizer.ai/).

## Pre-requisites

- Node.js
- npm or yarn
- TypeScript
- Google Chrome browser installed on your computer

## Dependencies

- [puppeteer-core](https://www.npmjs.com/package/puppeteer-core)
- [fs](https://nodejs.dev/learn/the-nodejs-fs-module)
- [chalk](https://www.npmjs.com/package/chalk)
- [path](https://nodejs.dev/learn/nodejs-path-module)
- [say](https://www.npmjs.com/package/say)

## Setup and Usage

1. Clone the repository to your local machine.
2. Install the necessary dependencies:
```bash
   npm install

```

3. Place the images you wish to vectorize inside the `./assets` directory.
4. **Important Configuration:** Open `main.ts` and check the `executablePath` inside the `puppeteer.launch` options. Make sure it matches the actual installation path of Google Chrome on your system.
5. Run the script using:

```bash
   npx ts-node main.ts

```

6. **First Run Login:** On the very first run, the browser will open and wait for 45 seconds. Please use this time to manually log in to vectorizer.ai. Your session will be saved securely in a local `chrome_data` folder, so you won't need to log in again for future runs.
7. The vectorized images will be saved in the `./vector_images` directory.

## Important Notes

* The script uses browser emulation (`puppeteer-core`) to interact with the vectorizer.ai website.
* It's recommended to monitor the process during its execution, as the website structure or behavior might change over time (e.g., CAPTCHAs), potentially causing the automation to fail.

## Contributions

Contributions are welcome! If you encounter any issues or have suggestions for improvements, please open an issue or submit a pull request.

## License

This tool is open-source and free to use. However, make sure to respect the terms of service of [vectorizer.ai](https://vectorizer.ai/).

## Disclaimer

This tool is not affiliated with, endorsed by, or in any way associated with vectorizer.ai. It's a utility script designed for personal convenience.

```

```