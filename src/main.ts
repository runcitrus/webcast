import { Browser, Page, launch } from 'puppeteer'
import type { ElementHandle, BoundingBox } from 'puppeteer'
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder'

export type WebCastOptions = {
    // viewport width
    width: number

    // viewport height
    height: number

    // device scale factor
    scale: number

    // cursor size. Default is 20
    cursorSize?: number

    // cursor background color. Default is 'rgba(0, 0, 0, 0.5)'
    cursorBackground?: string

    // screen recording options
    recorder: any
}

export default async function (options: WebCastOptions): Promise<WebCast> {
    const browser = await launch()
    const page = await browser.newPage()
    await page.setViewport({
        width: options.width,
        height: options.height,
        deviceScaleFactor: options.scale,
    })

    return new WebCast(browser, page, options)
}

const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms))

const easeInOut = (pos: number, len: number, base: number) =>
    (base + (1 - Math.sin((pos / len) * Math.PI)) * base);

async function easeInOutSleep(
    acc: number,
    pos: number,
    len: number,
    speed: number,
): Promise<number> {
    const delayStep = easeInOut(pos, len, speed)
    acc += delayStep
    if(acc >= 1) {
        const roundedDelay = Math.floor(acc)
        await sleep(roundedDelay)
        acc -= roundedDelay
    }
    return acc
}

class WebCast {
    private browser: Browser
    public page: Page
    private recorder?: PuppeteerScreenRecorder

    private options: WebCastOptions
    private cursorSize: number
    private cursorBackground: string

    private cursorX = 0
    private cursorY = 0

    constructor(browser: Browser, page: Page, options: WebCastOptions) {
        this.browser = browser
        this.page = page

        this.options = options
        this.cursorSize = options.cursorSize || 20
        this.cursorBackground = options.cursorBackground || 'rgba(0, 0, 0, 0.5)'
    }

    // waits for the ms
    async sleep(ms: number) {
        await sleep(ms)
    }

    async close() {
        await this.stop()
        await this.browser.close()
    }

    // starts the screen recording
    async screencast(output: string) {
        this.recorder = new PuppeteerScreenRecorder(this.page, this.options.recorder)
        await this.recorder.start(output)
        await sleep(100)
    }

    // stops the screen recording
    async stop() {
        if(this.recorder) {
            await this.recorder.stop()
            this.recorder = undefined
        }
    }

    // navigates to the url and waits for the network to be idle
    async goto(url: string) {
        await this.page.goto(url)
        await this.wait()

        await this.page.evaluate((size, bg) => {
            let cursor = document.getElementById('webshot-cursor')
            if(cursor) {
                cursor.style.display = 'none'
                return
            }

            const style = document.createElement('style')
            style.innerHTML =
`@keyframes webshot-bounce {
    0%, 100% { transform: scale(1); }
    25% { transform: scale(1.25); }
    50% { transform: scale(0.75); }
    75% { transform: scale(1.15); }
}

.webshot-cursor {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    animation: webshot-bounce 0.5s;
    animation-iteration-count: 1;
    background: ${ bg };
    width: ${ size }px;
    height: ${ size }px;
    border-radius: 50%;
}`;

            cursor = document.createElement('div')
            document.body.append(style, cursor)

            cursor.id = 'webshot-cursor'
            cursor.className = 'webshot-cursor'
            cursor.style.display = 'none'
        }, this.cursorSize, this.cursorBackground)
    }

    // waits for the network to be idle
    async wait() {
        await this.page.focus('body')
        await this.page.waitForNetworkIdle()
    }

    async cursorMove(x: number, y: number) {
        this.cursorX = x
        this.cursorY = y
        await this.page.mouse.move(x, y)
    }

    async cursorClick() {
        await this.page.evaluate((x, y, size) => {
            const cursor = document.getElementById('webshot-cursor')
            if(!cursor) {
                return
            }
            const r = size / 2
            cursor.style.left = (x - r) + 'px'
            cursor.style.top = (y - r) + 'px'
            cursor.style.display = 'block'
            setTimeout(() => {
                cursor.style.display = 'none'
            }, 500)
        }, this.cursorX, this.cursorY, this.cursorSize)

        await sleep(200)
        await this.page.mouse.down()
        await this.page.mouse.up()
        await sleep(200)
    }

    async textType(selector: string, text: string) {
        await this.page.focus(selector)

        let delay = 0
        for(let i = 0; i < text.length; i++) {
            await this.page.keyboard.type(text[i])
            delay = await easeInOutSleep(delay, i, text.length, 40)
        }
    }

    // checks if the element exists
    async elementExists(selector: string): Promise<boolean> {
        const el = await this.page.$(selector)
        return !!el
    }

    // gets the bounding box of the element
    async elementGetBox(selector: string): Promise<BoundingBox> {
        const element = await this.page.$(selector)
        if(!element) {
            throw new Error('element not found: ' + selector)
        }

        const box = await element.boundingBox()
        if(!box) {
            throw new Error('element not visible: ' + selector)
        }

        return box
    }

    // clicks the center of the element and waits for the network to be idle
    async elementClick(selector: string) {
        const box = await this.elementGetBox(selector)
        const x = Math.round(box.x + box.width / 2)
        const y = Math.round(box.y + box.height / 2)

        await this.cursorMove(x, y)
        await this.cursorClick()
        await this.wait()
        await sleep(200)
    }

    // selects the value from the select element
    async elementSelect(selector: string, value: string) {
        const box = await this.elementGetBox(selector)
        const x = Math.round(box.x + box.width / 2)
        const y = Math.round(box.y + box.height / 2)

        await this.cursorMove(x, y)
        await this.cursorClick()
        await this.page.select(selector, value)
        await sleep(200)
    }

    // scrolls smoothly to the element
    async elementScrollIntoView(selector: string) {
        await this.page.evaluate((selector) => {
            const el = document.querySelector(selector)
            if(el) {
                el.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                })
            }
        }, selector)
        await sleep(200)
    }

    // selects the file into the file input element
    async elementFileSelect(selector: string, file: string) {
        await this.elementClick(selector)
        const sourceFile = await this.page.$(selector) as ElementHandle<HTMLInputElement>
        await sourceFile.uploadFile(file)
    }

    // waits for the selector to appear in page
    async elementWaitFor(selector: string, timeout: number = 30000) {
        await this.page.waitForSelector(selector, {
            timeout: timeout,
        })
    }

    async elementGetAttribute(selector: string, attribute: string): Promise<string | undefined> {
        return await this.page.evaluate((s, a) => {
            const el = document.querySelector(s)
            // trim 'instance-' prefix
            return el?.getAttribute(a) || undefined
        }, selector, attribute)
    }
}
