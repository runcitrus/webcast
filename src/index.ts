import { Browser, Page, launch } from 'puppeteer'
import type { ElementHandle, BoundingBox } from 'puppeteer'
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder'

import { Mouse } from './mouse'
import { easeInOutSleep, sleep } from './utils'

export default class WebShot {
    private browser: Browser
    public page: Page
    private recorder?: PuppeteerScreenRecorder

    private mouse: Mouse

    constructor() {
        this.mouse = new Mouse()
    }

    // waits for the ms
    async sleep(ms: number) {
        await sleep(ms)
    }

    async start(w, h, scale: number) {
        this.browser = await launch()
        this.page = await this.browser.newPage()

        await this.page.setViewport({
            width: w,
            height: h,
            deviceScaleFactor: scale,
        })
    }

    async stop() {
        if (this.recorder) {
            await this.recorder.stop()
            this.recorder = undefined
        }

        await this.browser.close()
    }

    // starts the screen recording
    async screencast(file: string, options: any) {
        this.recorder = new PuppeteerScreenRecorder(this.page, options)
        await this.recorder.start(file)
        await sleep(100)
    }

    // navigates to the url and waits for the network to be idle
    async goto(url: string) {
        await this.page.goto(url)
        await this.wait()
        await this.mouse.init(this.page)
    }

    // waits for the network to be idle
    async wait() {
        await this.page.focus('body')
        await this.page.waitForNetworkIdle()
    }

    async textType(selector, text: string) {
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

        await this.mouse.move(x, y)
        await this.mouse.click()
        await this.wait()
        await sleep(200)
    }

    // selects the value from the select element
    async elementSelect(selector, value: string) {
        const box = await this.elementGetBox(selector)
        const x = Math.round(box.x + box.width / 2)
        const y = Math.round(box.y + box.height / 2)

        await this.mouse.move(x, y)
        await this.mouse.click()
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
