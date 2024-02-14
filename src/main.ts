import { Browser, Page, launch } from 'puppeteer'
import type { ElementHandle, ConsoleMessage } from 'puppeteer'
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

export type SplashScreenOptions = {
    // background image
    style: ElementCSSInlineStyle

    // logo
    logo?: string
    logoStyle?: ElementCSSInlineStyle

    // title
    title?: string
    titleStyle?: ElementCSSInlineStyle

    // subtitle
    subtitle?: string
    subtitleStyle?: ElementCSSInlineStyle
}

export default async function (options: WebCastOptions): Promise<WebCast> {
    const browser = await launch()
    const page = await browser.newPage()
    await page.setViewport({
        width: options.width,
        height: options.height,
        deviceScaleFactor: options.scale,
    })

    page.on('console', (message: ConsoleMessage) => {
        const t = message.type().substring(0, 3).toUpperCase()
        console.log('  > ' + t + ' ' + message.text())
    })

    page.on('pageerror', ({ message }) => console.error(message))

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
    private page: Page
    private recorder?: PuppeteerScreenRecorder

    private options: WebCastOptions
    private cursorSize: number
    private cursorBackground: string

    constructor(browser: Browser, page: Page, options: WebCastOptions) {
        this.browser = browser
        this.page = page

        this.options = options
        this.cursorSize = options.cursorSize || 20
        this.cursorBackground = options.cursorBackground || 'rgba(0, 0, 0, 0.5)'
    }

    // waits for the ms
    async sleep(ms: number = 1000) {
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

    async setMediaFeature(name: string, value: string) {
        await this.page.emulateMediaFeatures([{ name, value }])
    }

    // navigates to the url and waits for the network to be idle
    async goto(url: string) {
        await this.page.goto(url)
        await this.wait()

        await this.page.evaluate((size, bg) => {
            const style = document.createElement('style')
            style.innerHTML =
`@keyframes webcast-bounce {
    0%, 100% { transform: scale(1); }
    25% { transform: scale(1.25); }
    50% { transform: scale(0.75); }
    75% { transform: scale(1.15); }
}

@keyframes webcast-blink {
    0% { background: black; }
    100% { background: white; }
}

.webcast-cursor {
    position: fixed;
    z-index: 9999;
    pointer-events: none;
    animation: webcast-bounce 0.4s;
    animation-iteration-count: 1;
    background: ${ bg };
    width: ${ size }px;
    height: ${ size }px;
    border-radius: 50%;
}

.webcast-h264-blink {
    position: fixed;
    z-index: 99999;
    right: 1px;
    bottom: 1px;
    width: 1px;
    height: 1px;
    animation: webcast-blink 1s linear infinite;
}`;
            document.body.append(style)

            const cursor = document.createElement('div')
            document.body.append(cursor)
            cursor.id = 'webcast-cursor'
            cursor.className = 'webcast-cursor'
            cursor.style.display = 'none'

            // hack to prevent h264 video from skipping static frames
            const hack = document.createElement('div')
            document.body.append(hack)
            hack.id = 'webcast-h264-blink'
            hack.className = 'webcast-h264-blink'
        }, this.cursorSize, this.cursorBackground)
    }

    // waits for the network to be idle
    async wait() {
        await this.page.focus('body')
        await this.page.waitForNetworkIdle()
    }

    async cursorClick(x: number, y: number) {
        await this.page.evaluate((x, y, size) => new Promise<void>(
            resolve => {
                const cursor = document.getElementById('webcast-cursor')
                if(!cursor) {
                    resolve()
                    return
                }

                const r = size / 2
                cursor.style.left = (x - r) + 'px'
                cursor.style.top = (y - r) + 'px'
                cursor.style.display = 'block'
                setTimeout(() => {
                    cursor.style.display = 'none'
                    resolve()
                }, 400)
            }
        ), x, y, this.cursorSize)

        await this.page.mouse.move(x, y)
        await this.page.mouse.down()
        await this.page.mouse.up()
        await sleep(200)
    }

    // checks if the element exists
    async elementExists(selector: string): Promise<boolean> {
        const el = await this.page.$(selector)
        return !!el
    }

    // focuses the element and clicks the center of the element
    private async elementClick(selector: string) {
        const element = await this.page.$(selector)
        if(!element) {
            throw new Error('element not found: ' + selector)
        }

        const box = await element.boundingBox()
        if(!box) {
            throw new Error('element not visible: ' + selector)
        }

        await element.focus()

        const x = Math.round(box.x + box.width / 2)
        const y = Math.round(box.y + box.height / 2)

        await this.cursorClick(x, y)
    }

    // clicks the center of the element and waits for the network to be idle
    async click(selector: string) {
        await this.elementClick(selector)

        await this.wait()
        await sleep(200)
    }

    // selects the value from the select element
    async selectValue(selector: string, value: string) {
        await this.elementClick(selector)

        await this.page.select(selector, value)
        await sleep(200)
    }

    // types the text value into the input element
    async inputText(selector: string, text: string) {
        await this.elementClick(selector)

        let delay = 0
        for(let i = 0; i < text.length; i++) {
            await this.page.keyboard.type(text[i])
            delay = await easeInOutSleep(delay, i, text.length, 40)
        }
    }

    // selects the file into the file input element
    async inputFile(selector: string, file: string) {
        await this.elementClick(selector)

        const sourceFile = await this.page.$(selector) as ElementHandle<HTMLInputElement>
        await sourceFile.uploadFile(file)
    }

    // waits for the selector to appear in page
    async waitFor(selector: string, timeout: number = 30000) {
        await this.page.waitForSelector(selector, {
            timeout: timeout,
        })
    }

    async scrollIntoView(selector: string) {
        await this.page.evaluate((s) => {
            const el = document.querySelector(s)
            el?.scrollIntoView({
                behavior: 'smooth',
            })
        }, selector)
    }

    async getAttribute(selector: string, attribute: string): Promise<string | undefined> {
        return await this.page.evaluate((s, a) => {
            const el = document.querySelector(s)
            // trim 'instance-' prefix
            return el?.getAttribute(a) || undefined
        }, selector, attribute)
    }

    async showSplashScreen(options: SplashScreenOptions) {
        await this.page.evaluate((options: SplashScreenOptions) => {
            const splash = document.createElement('div')
            splash.id = 'webcast-splashscreen'
            Object.assign(splash.style, {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                backgroundSize: 'cover',
                zIndex: '9999',
                ...options.style,
            })
            document.body.appendChild(splash)

            if(options.logo) {
                const logo = document.createElement('img')
                logo.src = options.logo
                Object.assign(logo.style, {
                    display: 'block',
                    position: 'absolute',
                    top: '100px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    ...options.logoStyle,
                })
                splash.appendChild(logo)
            }

            if(options.title) {
                const title = document.createElement('h1')
                title.innerText = options.title
                Object.assign(title.style, {
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    color: 'white',
                    fontSize: '42px',
                    fontWeight: 'bold',
                    ...options.titleStyle,
                })
                splash.appendChild(title)
            }

            if(options.subtitle) {
                const subtitle = document.createElement('h2')
                subtitle.innerText = options.subtitle
                Object.assign(subtitle.style, {
                    position: 'absolute',
                    bottom: '100px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    textAlign: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: '500',
                    ...options.subtitleStyle,
                })
                splash.appendChild(subtitle)
            }

            splash.focus()
        }, options)

        await this.wait()
    }

    async hideSplashScreen() {
        await this.page.evaluate(() => {
            document.getElementById('webcast-splashscreen')?.remove()
        })
    }
}
