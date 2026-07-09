// PATH: apps/api/src/lib/pdf.ts
import { logger } from "./logger.js";

type PuppeteerBrowser = {
  newPage: () => Promise<any>;
  close: () => Promise<void>;
};

let browserPromise: Promise<PuppeteerBrowser> | null = null;

async function launchBrowser(): Promise<PuppeteerBrowser> {
  const isServerless = !!(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
  );

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default as any;
    const puppeteerCore = await import("puppeteer-core");
    const executablePath = await chromium.executablePath();

    return puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 },
      executablePath,
      headless: true,
    }) as unknown as Promise<PuppeteerBrowser>;
  }

  const puppeteer = await import("puppeteer");
  return puppeteer.launch({ headless: true }) as unknown as Promise<PuppeteerBrowser>;
}

async function getBrowser(): Promise<PuppeteerBrowser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

/**
 * Render HTML string menjadi PDF buffer asli.
 * width/height (mis. "215mm"/"330mm" untuk F4) override format default A4.
 */
export async function generatePdfFromHtml(
  html: string,
  options?: {
    landscape?: boolean;
    width?: string;
    height?: string;
    margin?: { top?: string; bottom?: string; left?: string; right?: string };
  }
): Promise<Buffer> {
  let browser: PuppeteerBrowser;
  try {
    browser = await getBrowser();
  } catch (err) {
    logger.error({ err }, "pdf.browser_launch.error");
    throw new Error(
      `Gagal menjalankan browser untuk PDF (Puppeteer belum siap). Detail: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer: Buffer = await page.pdf({
      ...(options?.width && options?.height
        ? { width: options.width, height: options.height }
        : { format: "A4" }),
      landscape: !!options?.landscape,
      printBackground: true,
      margin: {
        top: options?.margin?.top || "16mm",
        bottom: options?.margin?.bottom || "16mm",
        left: options?.margin?.left || "14mm",
        right: options?.margin?.right || "14mm",
      },
    });
    return Buffer.from(pdfBuffer);
  } catch (err) {
    logger.error({ err }, "pdf.generate.error");
    throw new Error(`Gagal merender PDF. Detail: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    try { await page.close(); } catch {}
  }
}

export async function closePdfBrowser(): Promise<void> {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch (err) {
    logger.error({ err }, "pdf.close.error");
  } finally {
    browserPromise = null;
  }
}