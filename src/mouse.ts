import { Page } from 'puppeteer'
import { sleep } from './utils'

const cursorSize = 20

export class Mouse {
    private page: Page
    private x = 0
    private y = 0

    constructor() {}

    async init(page: Page) {
        this.page = page
        this.x = -cursorSize
        this.y = -cursorSize

        await page.evaluate((size) => {
            let cursor = document.getElementById('screen-cursor')
            if(!cursor) {
                cursor = document.createElement('div')
                document.body.append(cursor)

                cursor.id = 'screen-cursor'
                cursor.style.pointerEvents = 'none' // Ensures the cursor doesn't block clicks
                cursor.style.zIndex = '9999'        // Ensures the cursor is always on top
                cursor.style.background = 'black'   // Set color
                cursor.style.opacity = '0.5'        // Set opacity
                cursor.style.width = size + 'px'    // Set size
                cursor.style.height = size + 'px'
                cursor.style.borderRadius = '50%'   // Makes it a circle
                cursor.style.position = 'fixed'     // Allows it to move freely
            }
            cursor.style.display = 'none'           // Hide it initially
        }, cursorSize)
    }

    async move(x, y: number) {
        this.x = x
        this.y = y
        await this.page.mouse.move(x, y)
    }

    async click() {
        await this.page.evaluate((x, y, size) => {
            const cursor = document.getElementById('screen-cursor')
            const r = size / 2
            cursor.style.left = (x - r) + 'px'
            cursor.style.top = (y - r) + 'px'
            cursor.style.display = 'block'
            setTimeout(() => {
                cursor.style.display = 'none'
            }, 500)
        }, this.x, this.y, cursorSize)

        await sleep(200)
        await this.page.mouse.down()
        await this.page.mouse.up()
        await sleep(200)
    }
}
